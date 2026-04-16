package multi

import (
	"context"
	"fmt"
	"strings"
	"time"

	openai "github.com/sashabaranov/go-openai"

	"github.com/flykimjiwon/hanimo/internal/config"
	"github.com/flykimjiwon/hanimo/internal/llm"
)

// synthesisTimeout is the max time allowed for the LLM synthesis call.
const synthesisTimeout = 30 * time.Second

// MergeWithSynthesis uses an LLM to combine both agent outputs into one
// cohesive response. Falls back to simple merge on error.
// The parent ctx is used so that user cancellation (Ctrl+C) stops the synthesis call.
func MergeWithSynthesis(ctx context.Context, client *llm.Client, model string, strategy Strategy, a1, a2 AgentResult) string {
	// If Agent1 errored, fall back to simple merge (shows error)
	if a1.Err != nil {
		return simpleMerge(strategy, a1, a2)
	}
	// If only Agent2 errored (e.g. model 404), return Agent1 cleanly
	if a2.Err != nil {
		config.DebugLog("[MERGE] Agent2 error, returning Agent1 only: %v", a2.Err)
		return a1.Content
	}

	// If Agent2 has no content, just return Agent1
	a2Trimmed := strings.TrimSpace(a2.Content)
	if a2Trimmed == "" {
		return a1.Content
	}

	// Skip synthesis when Agent2 found no issues (wasteful LLM call)
	if strings.Contains(a2Trimmed, "no issues found") {
		return a1.Content
	}

	ctx, cancel := context.WithTimeout(ctx, synthesisTimeout)
	defer cancel()

	var synthesisPrompt string

	switch strategy {
	case StrategyReview:
		synthesisPrompt = fmt.Sprintf(`You are an editor synthesizing two AI agent responses into one.

Agent1(Super) wrote the original response, and Agent2(Dev) submitted a review.

## Agent1(Super) Response:
%s

## Agent2(Dev) Review:
%s

## Instructions:
- Based on Agent1's original response, incorporate valid points from Agent2's review into one complete response.
- Do not mention "Agent1" or "Agent2" — write as if a single AI authored it from the start.
- If Agent2 identified bugs or issues, reflect the corrections.
- Include any useful information Agent2 added.
- Remove unnecessary repetition.
- If there are code blocks, include only the final version reflecting Agent2's improvement suggestions.`, a1.Content, a2.Content)

	case StrategyConsensus:
		synthesisPrompt = fmt.Sprintf(`You are an analyst synthesizing two independent AI agent responses.

Both agents answered the same question independently.

## Agent1(Super) Response:
%s

## Agent2(Dev) Response:
%s

## Instructions:
- Analyze the similarities and differences between the two responses.
- Synthesize them into one optimal response that draws on the strengths of each.
- For areas of disagreement, briefly compare both perspectives.
- Use "from one perspective..." and "from another perspective..." instead of "Agent1..." or "Agent2...".`, a1.Content, a2.Content)

	case StrategyScan:
		synthesisPrompt = fmt.Sprintf(`You are an editor integrating parallel scan results from two AI agents.

The two agents explored different areas of the project.

## Agent1(Super) Scan Results:
%s

## Agent2(Dev) Scan Results:
%s

## Instructions:
- Merge both scan results into one comprehensive report.
- Remove duplicate content; include all unique findings from each agent.
- Reorganize logically.
- Do not reference "Agent1" or "Agent2" — present the findings as unified output.`, a1.Content, a2.Content)

	default:
		config.DebugLog("[MULTI-SYNTHESIS] unknown strategy %s, falling back to simple merge", strategy)
		return simpleMerge(strategy, a1, a2)
	}

	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleUser,
			Content: synthesisPrompt,
		},
	}

	config.DebugLog("[MULTI-SYNTHESIS] starting model=%s strategy=%s", model, strategy)

	resp, err := client.Chat(ctx, model, messages)
	if err != nil {
		config.DebugLog("[MULTI-SYNTHESIS] error: %v, falling back to simple merge", err)
		return simpleMerge(strategy, a1, a2)
	}

	config.DebugLog("[MULTI-SYNTHESIS] done len=%d", len(resp))
	return resp
}

// simpleMerge is the fallback when LLM synthesis fails.
func simpleMerge(strategy Strategy, a1, a2 AgentResult) string {
	switch strategy {
	case StrategyReview:
		return simpleMergeReview(a1, a2)
	case StrategyConsensus:
		return simpleMergeConsensus(a1, a2)
	case StrategyScan:
		return simpleMergeScan(a1, a2)
	default:
		return simpleMergeReview(a1, a2)
	}
}

func simpleMergeReview(a1, a2 AgentResult) string {
	var b strings.Builder

	if a1.Err != nil {
		b.WriteString(fmt.Sprintf("## Agent1(Super) Error\n%v\n\n", a1.Err))
	} else {
		b.WriteString(a1.Content)
	}

	if a2.Err != nil {
		b.WriteString(fmt.Sprintf("\n\n---\n## Review Error\n%v\n", a2.Err))
	} else if a2.Content != "" {
		b.WriteString("\n\n---\n## Review\n")
		b.WriteString(a2.Content)
	}

	return b.String()
}

func simpleMergeConsensus(a1, a2 AgentResult) string {
	var b strings.Builder

	b.WriteString("## Perspective 1\n")
	if a1.Err != nil {
		b.WriteString(fmt.Sprintf("Error: %v\n", a1.Err))
	} else {
		b.WriteString(a1.Content)
	}

	b.WriteString("\n\n---\n## Perspective 2\n")
	if a2.Err != nil {
		b.WriteString(fmt.Sprintf("Error: %v\n", a2.Err))
	} else {
		b.WriteString(a2.Content)
	}

	return b.String()
}

func simpleMergeScan(a1, a2 AgentResult) string {
	var b strings.Builder
	b.WriteString("## Parallel Scan Results\n\n")

	if a1.Err != nil {
		b.WriteString(fmt.Sprintf("### Area 1\nError: %v\n\n", a1.Err))
	} else if a1.Content != "" {
		b.WriteString("### Area 1\n")
		b.WriteString(a1.Content)
		b.WriteString("\n\n")
	}

	if a2.Err != nil {
		b.WriteString(fmt.Sprintf("### Area 2\nError: %v\n\n", a2.Err))
	} else if a2.Content != "" {
		b.WriteString("### Area 2\n")
		b.WriteString(a2.Content)
		b.WriteString("\n\n")
	}

	return b.String()
}
