package llm

import (
	"context"
	"fmt"
	"strings"

	openai "github.com/sashabaranov/go-openai"

	"github.com/flykimjiwon/hanimo/internal/config"
)

// estimateTokens returns a rough token count (chars / 4).
func estimateTokens(msgs []openai.ChatCompletionMessage) int {
	total := 0
	for _, m := range msgs {
		total += len(m.Content) / 4
	}
	return total
}

// Compact applies Stage 1 (snip) and Stage 2 (micro) compaction in-place.
// Stage 1: For conversations with 40+ messages, replace tool-role messages
// older than the last 10 that exceed 200 chars with a snip marker.
// Stage 2: Truncate any single message longer than 4000 chars.
func Compact(messages []openai.ChatCompletionMessage) []openai.ChatCompletionMessage {
	if len(messages) < 40 {
		return messages
	}

	config.DebugLog("[COMPACT] stage 1 snip | messages=%d", len(messages))

	// Stage 1 — Snip: replace old tool messages >200 chars
	boundary := len(messages) - 10
	snipped := 0
	for i := 0; i < boundary; i++ {
		if messages[i].Role == openai.ChatMessageRoleTool && len(messages[i].Content) > 200 {
			lines := strings.Count(messages[i].Content, "\n") + 1
			messages[i].Content = fmt.Sprintf("[snipped: %d lines]", lines)
			snipped++
		}
	}
	if snipped > 0 {
		config.DebugLog("[COMPACT] snipped %d tool messages", snipped)
	}

	// Stage 2 — Micro: truncate any message >4000 chars
	const maxChars = 4000
	const keepChars = 2000
	truncated := 0
	for i := range messages {
		if len(messages[i].Content) > maxChars {
			head := messages[i].Content[:keepChars]
			tail := messages[i].Content[len(messages[i].Content)-keepChars:]
			messages[i].Content = head + "\n...[truncated]...\n" + tail
			truncated++
		}
	}
	if truncated > 0 {
		config.DebugLog("[COMPACT] truncated %d messages (>%d chars)", truncated, maxChars)
	}

	return messages
}

// CompactWithLLM applies all 3 stages including LLM-based summarization.
// If estimated tokens exceed maxTokens after stages 1-2, it keeps the system
// prompt (index 0) and last 10 messages, summarizes everything in between,
// and reconstructs the history.
func CompactWithLLM(ctx context.Context, client *Client, model string, messages []openai.ChatCompletionMessage, maxTokens int) []openai.ChatCompletionMessage {
	// Apply stages 1 & 2 first
	messages = Compact(messages)

	// Check if stage 3 is needed
	tokens := estimateTokens(messages)
	if tokens <= maxTokens {
		return messages
	}

	config.DebugLog("[COMPACT] stage 3 LLM summary | tokens=%d > max=%d | messages=%d", tokens, maxTokens, len(messages))

	if len(messages) <= 11 {
		// Not enough messages to summarize
		return messages
	}

	// Keep system prompt (index 0) + last 10 messages
	sysMsg := messages[0]
	lastN := 10
	if len(messages)-1 < lastN {
		lastN = len(messages) - 1
	}
	tail := make([]openai.ChatCompletionMessage, lastN)
	copy(tail, messages[len(messages)-lastN:])

	// Build the middle section to summarize
	middle := messages[1 : len(messages)-lastN]
	if len(middle) == 0 {
		return messages
	}

	// Build summarization prompt
	var sb strings.Builder
	for _, m := range middle {
		sb.WriteString(fmt.Sprintf("[%s]: %s\n", m.Role, m.Content))
	}

	summaryReq := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: "Summarize the conversation. Preserve: task goal, completed work, current state, decisions.",
		},
		{
			Role:    openai.ChatMessageRoleUser,
			Content: sb.String(),
		},
	}

	summary, err := client.Chat(ctx, model, summaryReq)
	if err != nil {
		config.DebugLog("[COMPACT] LLM summary failed: %v", err)
		return messages // fall back to stages 1-2 only
	}

	config.DebugLog("[COMPACT] LLM summary done | summaryLen=%d | kept=%d tail messages", len(summary), lastN)

	// Reconstruct: system + summary + last 10
	result := make([]openai.ChatCompletionMessage, 0, 2+lastN)
	result = append(result, sysMsg)
	result = append(result, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: "[Previous conversation summary]\n" + summary,
	})
	result = append(result, tail...)

	return result
}
