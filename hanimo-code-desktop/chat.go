package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	openai "github.com/sashabaranov/go-openai"
)

// ChatMessage is the frontend-facing message type.
type ChatMessage struct {
	Role    string `json:"role"` // "user", "ai", "tool"
	Content string `json:"content"`
}

// chatEngine manages conversation state and LLM streaming.
type chatEngine struct {
	client  *openai.Client
	model   string
	history []openai.ChatCompletionMessage
	app     *App // back-reference for Wails events + tool execution
	baseURL string

	// ── Phase 13 — live metrics for MetricsRow ──
	metricsMu           sync.Mutex
	lastPromptTokens    int     // most recent call's prompt_tokens (used as "context")
	sessionPromptTokens int64   // cumulative across all requests
	sessionCompTokens   int64   // cumulative completion tokens
	sessionCachedTokens int64   // cumulative cached_tokens (from PromptTokensDetails)
	iter                int     // current loop iteration within an in-flight request
	iterLabel           string  // "idle" | "thinking" | "tool_use"
}

func newChatEngine(cfg TGCConfig, app *App) *chatEngine {
	ocfg := openai.DefaultConfig(cfg.API.APIKey)
	baseURL := strings.TrimRight(cfg.API.BaseURL, "/")
	baseURL = strings.TrimSuffix(baseURL, "/chat/completions")
	ocfg.BaseURL = strings.TrimRight(baseURL, "/")

	return &chatEngine{
		client:    openai.NewClientWithConfig(ocfg),
		model:     cfg.Models.Super,
		app:       app,
		baseURL:   ocfg.BaseURL,
		iterLabel: "idle",
		history: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: systemPrompt(),
			},
		},
	}
}

// setIterLabel updates the MetricsRow "Iter" sub-label atomically.
func (ce *chatEngine) setIterLabel(label string) {
	ce.metricsMu.Lock()
	ce.iterLabel = label
	ce.metricsMu.Unlock()
}

// bumpIter increments the in-flight request counter. Caps at 999 so the
// MetricsRow's `iter / iterMax` display never wraps weirdly.
func (ce *chatEngine) bumpIter() {
	ce.metricsMu.Lock()
	if ce.iter < 999 {
		ce.iter++
	}
	ce.metricsMu.Unlock()
}

// recordUsage folds an OpenAI Usage object into the session counters.
// Safe to call from the stream loop. Missing fields are treated as zero.
func (ce *chatEngine) recordUsage(u *openai.Usage) {
	if u == nil {
		return
	}
	ce.metricsMu.Lock()
	defer ce.metricsMu.Unlock()
	ce.lastPromptTokens = u.PromptTokens
	ce.sessionPromptTokens += int64(u.PromptTokens)
	ce.sessionCompTokens += int64(u.CompletionTokens)
	if u.PromptTokensDetails != nil {
		ce.sessionCachedTokens += int64(u.PromptTokensDetails.CachedTokens)
	}
}

var userLanguage = "korean" // default, changeable via settings

func systemPrompt() string {
	langInstruction := "ALWAYS respond in Korean. Code/paths stay in English."
	switch userLanguage {
	case "english":
		langInstruction = "ALWAYS respond in English."
	case "korean":
		langInstruction = "ALWAYS respond in Korean. Code/paths stay in English."
	default:
		if userLanguage != "" {
			langInstruction = "ALWAYS respond in " + userLanguage + ". Code/paths stay in English."
		}
	}

	base := `You are hanimo — AI coding assistant embedded in an IDE.
` + langInstruction + `

## Workflow
- Simple question → direct answer
- Code modification → use tools (file_read → file_write)
- Project overview → list_files → read key files

## Rules
- Read file before editing (file_read first)
- Use grep_search/glob_search for search. Never shell_exec grep/find.
- Git: create new commits. No force push/amend.
- Never include secrets (.env, API keys) in code.
- Be concise and direct. Show changes clearly.`

	// Load project context (.hanimo.md + project type detection)
	cwd, _ := os.Getwd()
	if ctx := loadKnowledgeContext(cwd); ctx != "" {
		base += ctx
	}

	return base
}

// toolDefs returns the OpenAI tool definitions — mirrors TUI's 15 tools.
func toolDefs() []openai.Tool {
	return []openai.Tool{
		makeTool("file_read", "Read a file and return its content", map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"path":   map[string]string{"type": "string", "description": "File path to read"},
				"offset": map[string]string{"type": "string", "description": "Start line (1-indexed, optional)"},
				"limit":  map[string]string{"type": "string", "description": "Max lines to read (optional)"},
			},
			"required": []string{"path"},
		}),
		makeTool("file_write", "Write content to a file (creates or overwrites)", map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"path":    map[string]string{"type": "string", "description": "File path to write"},
				"content": map[string]string{"type": "string", "description": "File content"},
			},
			"required": []string{"path", "content"},
		}),
		makeTool("hashline_read", "Read a file with per-line MD5 anchors. Each line is prefixed with N#hash| so you can reference exact lines in hashline_edit without race conditions.", map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"path": map[string]string{"type": "string", "description": "File path to read"},
			},
			"required": []string{"path"},
		}),
		makeTool("hashline_edit", "Edit a file by replacing a line range identified by hash anchors. Anchors are in 'N#hash' format from hashline_read. Mismatched hashes abort the edit so the agent can never silently overwrite.", map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"path":         map[string]string{"type": "string", "description": "File path"},
				"start_anchor": map[string]string{"type": "string", "description": "Start anchor like '3#a3f1'"},
				"end_anchor":   map[string]string{"type": "string", "description": "End anchor like '7#9b2c'"},
				"new_content":  map[string]string{"type": "string", "description": "Replacement content (multi-line ok)"},
			},
			"required": []string{"path", "start_anchor", "end_anchor", "new_content"},
		}),
		makeTool("shell_exec", "Execute a shell command and return output", map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"command": map[string]string{"type": "string", "description": "Shell command to execute"},
				"timeout": map[string]string{"type": "string", "description": "Timeout in seconds (default: 30)"},
			},
			"required": []string{"command"},
		}),
		makeTool("grep_search", "Search file contents using grep pattern", map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"pattern": map[string]string{"type": "string", "description": "Search pattern (regex supported)"},
				"path":    map[string]string{"type": "string", "description": "Directory to search in (default: .)"},
				"include": map[string]string{"type": "string", "description": "File glob filter (e.g. *.go)"},
			},
			"required": []string{"pattern"},
		}),
		makeTool("glob_search", "Find files matching a glob pattern", map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"pattern": map[string]string{"type": "string", "description": "Glob pattern (e.g. **/*.go)"},
				"path":    map[string]string{"type": "string", "description": "Base directory (default: .)"},
			},
			"required": []string{"pattern"},
		}),
		makeTool("list_files", "List files in a directory", map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"path": map[string]string{"type": "string", "description": "Directory path (default: .)"},
			},
		}),
		makeTool("git_status", "Get git repository status (branch, changes)", map[string]interface{}{
			"type": "object", "properties": map[string]interface{}{},
		}),
		makeTool("git_diff", "Get git diff of current changes", map[string]interface{}{
			"type": "object", "properties": map[string]interface{}{},
		}),
		makeTool("apply_patch", "Apply a unified diff patch to modify a file", map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"path":  map[string]string{"type": "string", "description": "File path to patch"},
				"patch": map[string]string{"type": "string", "description": "Unified diff content"},
			},
			"required": []string{"path", "patch"},
		}),
		makeTool("git_log", "Get recent git commit history", map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"n": map[string]string{"type": "string", "description": "Number of commits (default: 10)"},
			},
		}),
	}
}

func makeTool(name, desc string, params interface{}) openai.Tool {
	raw, _ := json.Marshal(params)
	return openai.Tool{
		Type: openai.ToolTypeFunction,
		Function: &openai.FunctionDefinition{
			Name:        name,
			Description: desc,
			Parameters:  json.RawMessage(raw),
		},
	}
}

// SendMessage is called from the frontend. It streams the response via Wails events.
func (a *App) SendMessage(prompt string) {
	if a.chat == nil {
		return
	}

	// Add user message to history
	a.chat.history = append(a.chat.history, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: prompt,
	})

	// Stream response
	a.chat.streamResponse()
}

// GetChatHistory returns the conversation for display/export.
func (a *App) GetChatHistory() []ChatMessage {
	if a.chat == nil {
		return nil
	}
	var msgs []ChatMessage
	for _, m := range a.chat.history {
		if m.Role == "system" {
			continue
		}
		role := "ai"
		if m.Role == "user" {
			role = "user"
		} else if m.Role == "tool" {
			role = "tool"
		}
		msgs = append(msgs, ChatMessage{Role: role, Content: m.Content})
	}
	return msgs
}

// ExportChat saves the conversation to a markdown file.
func (a *App) ExportChat() (string, error) {
	msgs := a.GetChatHistory()
	if len(msgs) == 0 {
		return "", fmt.Errorf("no messages to export")
	}
	var sb strings.Builder
	sb.WriteString("# hanimo Chat Export\n\n")
	for _, m := range msgs {
		switch m.Role {
		case "user":
			sb.WriteString("## You\n" + m.Content + "\n\n")
		case "ai":
			sb.WriteString("## AI\n" + m.Content + "\n\n")
		case "tool":
			sb.WriteString("> " + m.Content + "\n\n")
		}
	}
	path := filepath.Join(a.cwd, "hanimo-chat-export.md")
	if err := os.WriteFile(path, []byte(sb.String()), 0644); err != nil {
		return "", err
	}
	return path, nil
}

// ClearChat resets the conversation.
func (a *App) ClearChat() {
	if a.chat == nil {
		return
	}
	a.chat.history = []openai.ChatCompletionMessage{
		{Role: openai.ChatMessageRoleSystem, Content: systemPrompt()},
	}
	// Reset live metrics so MetricsRow doesn't keep climbing iter / showing
	// "thinking" after a fresh start. Cumulative cache/token counters stay —
	// they're per-session, not per-conversation.
	a.chat.metricsMu.Lock()
	a.chat.iter = 0
	a.chat.iterLabel = "idle"
	a.chat.lastPromptTokens = 0
	a.chat.metricsMu.Unlock()
	runtime.EventsEmit(a.ctx, "chat:cleared")
}

// GetModel returns the current model name.
func (a *App) GetModel() string {
	if a.chat == nil {
		return ""
	}
	// Strip provider prefix for display
	m := a.chat.model
	if idx := strings.LastIndex(m, "/"); idx >= 0 {
		m = m[idx+1:]
	}
	return m
}

// streamResponse handles the streaming + tool loop.
func (ce *chatEngine) streamResponse() {
	// Limit history to prevent context overflow
	if len(ce.history) > 80 {
		ce.history = append([]openai.ChatCompletionMessage{ce.history[0]}, ce.history[len(ce.history)-60:]...)
	}

	// Whole SendMessage call resets to idle on exit so MetricsRow doesn't get
	// stuck on "thinking" after an error.
	defer ce.setIterLabel("idle")

	for iter := 0; iter < 15; iter++ {
		ce.bumpIter()
		ce.setIterLabel("thinking")
		req := openai.ChatCompletionRequest{
			Model:    ce.model,
			Messages: ce.history,
			Stream:   true,
			Tools:    toolDefs(),
			// Ask the server to include a final usage chunk so MetricsRow
			// can show real context% + cache hit% + saved$.
			StreamOptions: &openai.StreamOptions{IncludeUsage: true},
		}

		stream, err := ce.client.CreateChatCompletionStream(ce.app.ctx, req)
		if err != nil {
			runtime.EventsEmit(ce.app.ctx, "chat:error", err.Error())
			return
		}

		var contentBuf strings.Builder
		toolCalls := make(map[int]*openai.ToolCall)

		// Signal stream start
		runtime.EventsEmit(ce.app.ctx, "chat:stream_start")

		for {
			resp, err := stream.Recv()
			if errors.Is(err, io.EOF) {
				break
			}
			if err != nil {
				runtime.EventsEmit(ce.app.ctx, "chat:error", err.Error())
				stream.Close()
				return
			}

			// The final chunk (with IncludeUsage=true) has an empty Choices
			// array but a populated Usage field. Record it before continuing.
			if resp.Usage != nil {
				ce.recordUsage(resp.Usage)
			}

			if len(resp.Choices) == 0 {
				continue
			}

			delta := resp.Choices[0].Delta

			// Stream content chunks
			if delta.Content != "" {
				contentBuf.WriteString(delta.Content)
				runtime.EventsEmit(ce.app.ctx, "chat:chunk", delta.Content)
			}

			// Accumulate tool calls
			for _, tc := range delta.ToolCalls {
				idx := 0
				if tc.Index != nil {
					idx = *tc.Index
				}
				if _, ok := toolCalls[idx]; !ok {
					toolCalls[idx] = &openai.ToolCall{
						ID:   tc.ID,
						Type: openai.ToolTypeFunction,
						Function: openai.FunctionCall{
							Name:      tc.Function.Name,
							Arguments: tc.Function.Arguments,
						},
					}
				} else {
					if tc.ID != "" {
						toolCalls[idx].ID = tc.ID
					}
					if tc.Function.Name != "" {
						toolCalls[idx].Function.Name = tc.Function.Name
					}
					toolCalls[idx].Function.Arguments += tc.Function.Arguments
				}
			}
		}
		stream.Close()

		// Signal stream done
		runtime.EventsEmit(ce.app.ctx, "chat:stream_done")

		// Text-based tool_call parsing fallback (Qwen3 proxy compat).
		// If the proxy didn't convert tool calls, parse from content.
		if len(toolCalls) == 0 && contentBuf.Len() > 0 {
			if parsed := parseTextToolCalls(contentBuf.String()); len(parsed) > 0 {
				for i, p := range parsed {
					idx := i
					toolCalls[idx] = &openai.ToolCall{
						ID:   p.ID,
						Type: openai.ToolTypeFunction,
						Function: openai.FunctionCall{
							Name:      p.Name,
							Arguments: p.Arguments,
						},
					}
				}
			}
		}

		// If tool calls, execute them and loop
		if len(toolCalls) > 0 {
			ce.setIterLabel("tool_use")
			// Add assistant message with tool calls to history
			assistantMsg := openai.ChatCompletionMessage{
				Role:    openai.ChatMessageRoleAssistant,
				Content: contentBuf.String(),
			}
			for i := 0; i < len(toolCalls); i++ {
				if tc, ok := toolCalls[i]; ok {
					assistantMsg.ToolCalls = append(assistantMsg.ToolCalls, *tc)
				}
			}
			ce.history = append(ce.history, assistantMsg)

			// Execute each tool
			for i := 0; i < len(toolCalls); i++ {
				tc, ok := toolCalls[i]
				if !ok {
					continue
				}

				runtime.EventsEmit(ce.app.ctx, "chat:tool_start", map[string]string{
					"name": tc.Function.Name,
					"args": tc.Function.Arguments,
				})

				result := ce.app.executeTool(tc.Function.Name, tc.Function.Arguments)

				runtime.EventsEmit(ce.app.ctx, "chat:tool_done", map[string]string{
					"name":   tc.Function.Name,
					"result": truncate(result, 200),
				})

				ce.history = append(ce.history, openai.ChatCompletionMessage{
					Role:       openai.ChatMessageRoleTool,
					Content:    result,
					ToolCallID: tc.ID,
				})
			}

			// Continue the loop — model will see tool results
			continue
		}

		// No tool calls — normal completion
		if contentBuf.Len() > 0 {
			ce.history = append(ce.history, openai.ChatCompletionMessage{
				Role:    openai.ChatMessageRoleAssistant,
				Content: contentBuf.String(),
			})
		}
		return
	}
}

// executeTool runs a tool and returns the result string.
func (a *App) executeTool(name, argsJSON string) string {
	var args map[string]interface{}
	if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
		return fmt.Sprintf("Error: invalid arguments: %v", err)
	}

	switch name {
	case "file_read":
		path, _ := args["path"].(string)
		if path == "" {
			return "Error: path is required"
		}
		content, err := a.ReadFile(path)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return content

	case "file_write":
		path, _ := args["path"].(string)
		content, _ := args["content"].(string)
		if path == "" {
			return "Error: path is required"
		}
		if err := a.WriteFile(path, content); err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		// Notify frontend to refresh
		runtime.EventsEmit(a.ctx, "file:changed", path)
		// Flash hash anchors for the first 12 non-empty lines so the
		// gutter visualises the brand promise. Auto-clears after 2s.
		emitHashAnchorsFor(a, content, 12, 2*time.Second)
		return fmt.Sprintf("OK: wrote %d bytes to %s", len(content), path)

	case "hashline_read":
		path, _ := args["path"].(string)
		if path == "" {
			return "Error: path is required"
		}
		out, err := HashlineRead(path)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return out

	case "hashline_edit":
		path, _ := args["path"].(string)
		startA, _ := args["start_anchor"].(string)
		endA, _ := args["end_anchor"].(string)
		newC, _ := args["new_content"].(string)
		if path == "" || startA == "" || endA == "" {
			return "Error: path, start_anchor, end_anchor are required"
		}
		// Resolve to absolute path so backupBeforeWrite indexes correctly.
		abs := path
		if absResolved, err := a.safePath(path); err == nil {
			abs = absResolved
		}
		backupBeforeWrite(abs)
		summary, startLine, count, err := HashlineEdit(abs, startA, endA, newC)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		runtime.EventsEmit(a.ctx, "file:changed", abs)
		// Emit precise hash anchors only for the edited line range — not the
		// whole file like file_write does. This is the brand-promise pixel.
		emitHashAnchorsForLines(a, newC, startLine, count, 2500*time.Millisecond)
		return summary

	case "grep_search", "search_files":
		pattern, _ := args["pattern"].(string)
		dir, _ := args["path"].(string)
		if pattern == "" {
			return "Error: pattern is required"
		}
		results, err := a.SearchInFiles(pattern, dir)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		if len(results) == 0 {
			return "No matches found."
		}
		var sb strings.Builder
		for _, r := range results {
			fmt.Fprintf(&sb, "%s:%d: %s\n", r.File, r.Line, r.Content)
		}
		return sb.String()

	case "glob_search":
		pattern, _ := args["pattern"].(string)
		dir, _ := args["path"].(string)
		if pattern == "" {
			return "Error: pattern is required"
		}
		if dir == "" {
			dir = "."
		}
		// Use Go filepath.WalkDir instead of shell find (no injection risk)
		var matches []string
		base := dir
		if !filepath.IsAbs(base) {
			base = filepath.Join(a.cwd, base)
		}
		filepath.WalkDir(base, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			name := d.Name()
			if strings.HasPrefix(name, ".") || name == "node_modules" || name == "dist" {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			matched, _ := filepath.Match(pattern, name)
			if matched {
				rel, _ := filepath.Rel(a.cwd, path)
				matches = append(matches, rel)
			}
			if len(matches) >= 100 {
				return fmt.Errorf("limit")
			}
			return nil
		})
		if len(matches) == 0 {
			return "No files matched."
		}
		return strings.Join(matches, "\n")

	case "list_files":
		dir, _ := args["path"].(string)
		entries, err := a.ListFiles(dir, 1)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		var sb strings.Builder
		for _, e := range entries {
			if e.IsDir {
				fmt.Fprintf(&sb, "%s/\n", e.Name)
			} else {
				fmt.Fprintf(&sb, "%s\n", e.Name)
			}
		}
		return sb.String()

	case "shell_exec":
		command, _ := args["command"].(string)
		if command == "" {
			return "Error: command is required"
		}
		out, err := a.runShell("bash", "-c", command)
		if err != nil {
			return fmt.Sprintf("Error: %v\nOutput: %s", err, out)
		}
		// Limit output to 10KB
		if len(out) > 10240 {
			out = out[:10240] + "\n... [truncated]"
		}
		return out

	case "apply_patch":
		path, _ := args["path"].(string)
		patch, _ := args["patch"].(string)
		if path == "" || patch == "" {
			return "Error: path and patch are required"
		}
		// Simple approach: write patch to temp file, apply with git apply
		tmpFile := filepath.Join(os.TempDir(), "hanimo-patch.diff")
		if err := os.WriteFile(tmpFile, []byte(patch), 0644); err != nil {
			return fmt.Sprintf("Error writing patch: %v", err)
		}
		defer os.Remove(tmpFile)
		out, err := a.runShell("git", "apply", "--verbose", tmpFile)
		if err != nil {
			// Fallback: try patch command
			out2, err2 := a.runShell("patch", "-p0", "-i", tmpFile)
			if err2 != nil {
				return fmt.Sprintf("Error applying patch:\ngit apply: %s\npatch: %s", out, out2)
			}
			out = out2
		}
		runtime.EventsEmit(a.ctx, "file:changed", path)
		return fmt.Sprintf("OK: patch applied to %s\n%s", path, out)

	case "git_status":
		info := a.GetGitInfo()
		var sb strings.Builder
		fmt.Fprintf(&sb, "Branch: %s\n", info.Branch)
		if len(info.Changes) == 0 {
			sb.WriteString("Clean — no changes\n")
		} else {
			fmt.Fprintf(&sb, "Changes (%d):\n", len(info.Changes))
			for _, c := range info.Changes {
				fmt.Fprintf(&sb, "  %s %s\n", c.Status, c.File)
			}
		}
		return sb.String()

	case "git_diff":
		diff := a.GitDiff()
		if diff == "" {
			return "No changes."
		}
		if len(diff) > 10240 {
			diff = diff[:10240] + "\n... [truncated]"
		}
		return diff

	case "git_log":
		return a.GitLog(10)

	default:
		return fmt.Sprintf("Error: unknown tool '%s'", name)
	}
}

// runShell executes a command and returns combined output.
func (a *App) runShell(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	cmd.Dir = a.cwd
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func openaiMsg(role, content string) openai.ChatCompletionMessage {
	return openai.ChatCompletionMessage{Role: role, Content: content}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
