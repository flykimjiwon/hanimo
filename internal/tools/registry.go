package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	openai "github.com/sashabaranov/go-openai"

	"github.com/flykimjiwon/hanimo/internal/config"
)

type paramSchema struct {
	Type       string                    `json:"type"`
	Properties map[string]propertySchema `json:"properties"`
	Required   []string                  `json:"required"`
}

type propertySchema struct {
	Type        string `json:"type"`
	Description string `json:"description"`
}

// AllTools returns tool definitions for modes with full access (super, dev).
func AllTools() []openai.Tool {
	return []openai.Tool{
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "file_read",
				Description: "Read the contents of a file. Use this to understand existing code before making changes. DO NOT use to check if a file exists — call list_files on the parent directory instead (cheaper and won't error).",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path": {Type: "string", Description: "File path (relative to cwd or absolute)"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "file_write",
				Description: "Create a new file or completely overwrite an existing file. Use for NEW files only. DO NOT use to modify an existing file — use file_edit (one change) or chain several file_edit calls. DO NOT use to append — read first, then write the full new content.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":    {Type: "string", Description: "File path to write"},
						"content": {Type: "string", Description: "Complete file content"},
					},
					Required: []string{"path", "content"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "file_edit",
				Description: "Edit an existing file by replacing a specific string. The old_string must match EXACTLY (including whitespace/indentation). Only the first occurrence is replaced. DO NOT use for new files — use file_write. DO NOT guess old_string from memory — always file_read first so whitespace matches. If old_string is not unique, include surrounding context lines until it is.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":       {Type: "string", Description: "File path to edit"},
						"old_string": {Type: "string", Description: "Exact string to find (must match file content exactly)"},
						"new_string": {Type: "string", Description: "Replacement string"},
					},
					Required: []string{"path", "old_string", "new_string"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "list_files",
				Description: "List files in a directory. Use recursive=true to see the full project tree (skips node_modules, .git, dist). DO NOT call this on an unknown repo without trying list_tree first — large monorepos will hit the 500-file cap and waste context. DO NOT use instead of grep_search/glob_search when looking for specific files by content or pattern.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":      {Type: "string", Description: "Directory path (default: current directory)"},
						"recursive": {Type: "string", Description: "Set to 'true' for recursive listing"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "list_tree",
				Description: "Render a directory-only tree (no files) up to max_depth. Token-cheap way to grasp project structure. Use this BEFORE list_files for unknown repos.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":      {Type: "string", Description: "Directory path (default: current directory)"},
						"max_depth": {Type: "string", Description: "Max depth to descend (default: 3)"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "shell_exec",
				Description: "Execute a shell command. Use for: git, npm, build, test, lint. Dangerous commands (rm -rf /, sudo, credential exfiltration) are blocked. DO NOT use for searching file contents — use grep_search. DO NOT use for listing files — use list_files/list_tree/glob_search. DO NOT use for reading files — use file_read. DO NOT chain with && to bypass the loop detector. Prefer one command per call so the user can approve/deny individually.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"command": {Type: "string", Description: "Shell command to execute"},
					},
					Required: []string{"command"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "grep_search",
				Description: "Search file contents by regex pattern. Returns file:line:content matches. Faster and safer than shell grep. Skips binary files, .git, node_modules, dist.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"pattern":       {Type: "string", Description: "Regex pattern to search for (required)"},
						"path":          {Type: "string", Description: "Directory to search in (default: current directory)"},
						"glob":          {Type: "string", Description: "File filter glob (e.g. '*.go', '*.ts')"},
						"ignore_case":   {Type: "string", Description: "Set to 'true' for case-insensitive search"},
						"context_lines": {Type: "string", Description: "Number of context lines around matches (default: 0)"},
					},
					Required: []string{"pattern"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "glob_search",
				Description: "Find files by glob pattern (supports **). Returns matching file paths. Use instead of shell find. Skips .git, node_modules, dist.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"pattern": {Type: "string", Description: "Glob pattern (e.g. '**/*.go', 'src/**/*.ts', '*.json')"},
						"path":    {Type: "string", Description: "Base directory to search in (default: current directory)"},
					},
					Required: []string{"pattern"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "hashline_read",
				Description: "Read file with hash-tagged line numbers for safe editing. Each line gets a 4-char MD5 hash anchor.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path": {Type: "string", Description: "File path (relative to cwd or absolute)"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "hashline_edit",
				Description: "Edit file using hash anchors to verify lines haven't changed since read. Prevents stale-edit corruption.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":         {Type: "string", Description: "File path to edit"},
						"start_anchor": {Type: "string", Description: "Start anchor in N#hash format (e.g. '3#e4d9')"},
						"end_anchor":   {Type: "string", Description: "End anchor in N#hash format (e.g. '5#b2a1')"},
						"new_content":  {Type: "string", Description: "Replacement content for the anchored line range"},
					},
					Required: []string{"path", "start_anchor", "end_anchor", "new_content"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "git_status",
				Description: "Show git status (short format) for a directory. Returns modified, added, deleted files.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path": {Type: "string", Description: "Directory path (default: current directory)"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "git_diff",
				Description: "Show git diff for a directory. Use staged=true to see staged changes.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":   {Type: "string", Description: "Directory path (default: current directory)"},
						"staged": {Type: "string", Description: "Set to 'true' to show staged changes"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "git_log",
				Description: "Show recent git commits in oneline format.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":  {Type: "string", Description: "Directory path (default: current directory)"},
						"count": {Type: "string", Description: "Number of commits to show (default: 10)"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "git_commit",
				Description: "Create a git commit with the given message. Files must be staged first.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":    {Type: "string", Description: "Directory path"},
						"message": {Type: "string", Description: "Commit message"},
					},
					Required: []string{"path", "message"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "diagnostics",
				Description: "Run code diagnostics (go vet, tsc, eslint, ruff). Auto-detects project type.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"dir":  {Type: "string", Description: "Project directory to run diagnostics in"},
						"file": {Type: "string", Description: "Optional specific file to check"},
					},
					Required: []string{"dir"},
				},
			},
		},
	}
}

// ReadOnlyTools returns tool definitions for plan mode (no file writes).
func ReadOnlyTools() []openai.Tool {
	return []openai.Tool{
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "file_read",
				Description: "Read the contents of a file.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path": {Type: "string", Description: "File path to read"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "list_files",
				Description: "List files in a directory.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":      {Type: "string", Description: "Directory path"},
						"recursive": {Type: "string", Description: "Set to 'true' for recursive listing"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "list_tree",
				Description: "Render a directory-only tree (no files) up to max_depth. Prefer this over recursive list_files for structural overview.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":      {Type: "string", Description: "Directory path (default: current directory)"},
						"max_depth": {Type: "string", Description: "Max depth to descend (default: 3)"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "shell_exec",
				Description: "Execute read-only shell commands: ls, cat, git log, git status, etc. Prefer grep_search/glob_search over shell grep/find.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"command": {Type: "string", Description: "Shell command (read-only operations only)"},
					},
					Required: []string{"command"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "grep_search",
				Description: "Search file contents by regex pattern. Returns file:line:content matches.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"pattern":       {Type: "string", Description: "Regex pattern to search for (required)"},
						"path":          {Type: "string", Description: "Directory to search in (default: current directory)"},
						"glob":          {Type: "string", Description: "File filter glob (e.g. '*.go', '*.ts')"},
						"ignore_case":   {Type: "string", Description: "Set to 'true' for case-insensitive search"},
						"context_lines": {Type: "string", Description: "Number of context lines around matches (default: 0)"},
					},
					Required: []string{"pattern"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "glob_search",
				Description: "Find files by glob pattern (supports **). Returns matching file paths.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"pattern": {Type: "string", Description: "Glob pattern (e.g. '**/*.go', 'src/**/*.ts')"},
						"path":    {Type: "string", Description: "Base directory (default: current directory)"},
					},
					Required: []string{"pattern"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "hashline_read",
				Description: "Read file with hash-tagged line numbers for safe editing. Each line gets a 4-char MD5 hash anchor.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path": {Type: "string", Description: "File path to read with hash anchors"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "git_status",
				Description: "Show git status (short format) for a directory.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path": {Type: "string", Description: "Directory path (default: current directory)"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "git_diff",
				Description: "Show git diff for a directory. Use staged=true to see staged changes.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":   {Type: "string", Description: "Directory path (default: current directory)"},
						"staged": {Type: "string", Description: "Set to 'true' to show staged changes"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "git_log",
				Description: "Show recent git commits in oneline format.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":  {Type: "string", Description: "Directory path (default: current directory)"},
						"count": {Type: "string", Description: "Number of commits to show (default: 10)"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "diagnostics",
				Description: "Run code diagnostics (go vet, tsc, eslint, ruff). Auto-detects project type.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"dir":  {Type: "string", Description: "Project directory to run diagnostics in"},
						"file": {Type: "string", Description: "Optional specific file to check"},
					},
					Required: []string{"dir"},
				},
			},
		},
	}
}

// ToolsForMode returns the appropriate tool definitions based on mode.
func ToolsForMode(mode int) []openai.Tool {
	switch mode {
	case 2: // Plan — read-only
		return ReadOnlyTools()
	default: // Super, Dev — full access
		return AllTools()
	}
}

// Execute runs a tool by name with the given JSON arguments and returns the result.
func Execute(name string, argsJSON string) string {
	config.DebugLog("[TOOL-CALL] %s | args=%s", name, argsJSON)

	result := executeInner(name, argsJSON)

	truncated := len(result) > 30000
	config.DebugLog("[TOOL-RESULT] %s | resultLen=%d | truncated=%v", name, len(result), truncated)
	return result
}

func executeInner(name string, argsJSON string) string {
	var args map[string]interface{}
	if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
		config.DebugLog("[TOOL-ERR] %s | invalid JSON: %v", name, err)
		return fmt.Sprintf("Error: invalid arguments: %v", err)
	}

	switch name {
	case "file_read":
		path, _ := args["path"].(string)
		if path == "" {
			return "Error: path is required"
		}
		content, err := FileRead(path)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		if len(content) > 50000 {
			return content[:50000] + "\n\n... [truncated, file too large]"
		}
		return content

	case "file_write":
		path, _ := args["path"].(string)
		content, _ := args["content"].(string)
		if path == "" {
			return "Error: path is required"
		}
		if err := FileWrite(path, content); err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return fmt.Sprintf("OK: written %d bytes to %s", len(content), path)

	case "file_edit":
		path, _ := args["path"].(string)
		oldStr, _ := args["old_string"].(string)
		newStr, _ := args["new_string"].(string)
		if path == "" || oldStr == "" {
			return "Error: path and old_string are required"
		}
		count, err := FileEdit(path, oldStr, newStr)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return fmt.Sprintf("OK: replaced %d occurrence(s) in %s", count, path)

	case "list_files":
		path, _ := args["path"].(string)
		if path == "" {
			path = "."
		}
		recursive := false
		if r, ok := args["recursive"].(string); ok && r == "true" {
			recursive = true
		}
		if r, ok := args["recursive"].(bool); ok && r {
			recursive = true
		}
		files, err := ListFiles(path, recursive)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return strings.Join(files, "\n")

	case "list_tree":
		path, _ := args["path"].(string)
		if path == "" {
			path = "."
		}
		maxDepth := 3
		if s, ok := args["max_depth"].(string); ok && s != "" {
			var n int
			if _, err := fmt.Sscanf(s, "%d", &n); err == nil && n > 0 {
				maxDepth = n
			}
		}
		if f, ok := args["max_depth"].(float64); ok && f > 0 {
			maxDepth = int(f)
		}
		tree, err := ListTree(path, maxDepth)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return tree

	case "shell_exec":
		command, _ := args["command"].(string)
		if command == "" {
			return "Error: command is required"
		}
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		result, err := ShellExec(ctx, command)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		output := result.Stdout
		if result.Stderr != "" {
			output += "\nSTDERR: " + result.Stderr
		}
		if result.ExitCode != 0 {
			output += fmt.Sprintf("\nExit code: %d", result.ExitCode)
		}
		if len(output) > 30000 {
			output = output[:30000] + "\n\n... [truncated]"
		}
		return output

	case "grep_search":
		pattern, _ := args["pattern"].(string)
		if pattern == "" {
			return "Error: pattern is required"
		}
		searchPath, _ := args["path"].(string)
		glob, _ := args["glob"].(string)
		ignoreCase := false
		if ic, ok := args["ignore_case"].(string); ok && ic == "true" {
			ignoreCase = true
		}
		if ic, ok := args["ignore_case"].(bool); ok && ic {
			ignoreCase = true
		}
		contextLines := 0
		if cl, ok := args["context_lines"].(string); ok {
			fmt.Sscanf(cl, "%d", &contextLines)
		}
		if cl, ok := args["context_lines"].(float64); ok {
			contextLines = int(cl)
		}
		result, err := GrepSearch(pattern, searchPath, glob, ignoreCase, contextLines)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return result

	case "glob_search":
		pattern, _ := args["pattern"].(string)
		if pattern == "" {
			return "Error: pattern is required"
		}
		searchPath, _ := args["path"].(string)
		result, err := GlobSearch(pattern, searchPath)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return result

	case "hashline_read":
		path, _ := args["path"].(string)
		if path == "" {
			return "Error: path is required"
		}
		result, err := HashlineRead(path)
		if err != nil {
			return fmt.Sprintf("ERROR: %s", err.Error())
		}
		if len(result) > 50000 {
			return result[:50000] + "\n\n... [truncated, file too large]"
		}
		return result

	case "hashline_edit":
		path, _ := args["path"].(string)
		startAnchor, _ := args["start_anchor"].(string)
		endAnchor, _ := args["end_anchor"].(string)
		newContent, _ := args["new_content"].(string)
		if path == "" || startAnchor == "" || endAnchor == "" {
			return "Error: path, start_anchor, and end_anchor are required"
		}
		result, err := HashlineEdit(path, startAnchor, endAnchor, newContent)
		if err != nil {
			return fmt.Sprintf("ERROR: %s", err.Error())
		}
		return result

	case "git_status":
		path, _ := args["path"].(string)
		if path == "" {
			path = "."
		}
		result, err := GitStatus(path)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		if result == "" {
			return "Nothing to commit, working tree clean"
		}
		return result

	case "git_diff":
		path, _ := args["path"].(string)
		if path == "" {
			path = "."
		}
		staged := false
		if s, ok := args["staged"].(string); ok && s == "true" {
			staged = true
		}
		if s, ok := args["staged"].(bool); ok && s {
			staged = true
		}
		result, err := GitDiff(path, staged)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		if result == "" {
			return "No changes"
		}
		if len(result) > 30000 {
			return result[:30000] + "\n\n... [truncated]"
		}
		return result

	case "git_log":
		path, _ := args["path"].(string)
		if path == "" {
			path = "."
		}
		n := 10
		if c, ok := args["count"].(string); ok {
			fmt.Sscanf(c, "%d", &n)
		}
		if c, ok := args["count"].(float64); ok {
			n = int(c)
		}
		if n <= 0 {
			n = 10
		}
		result, err := GitLog(path, n)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return result

	case "git_commit":
		path, _ := args["path"].(string)
		message, _ := args["message"].(string)
		if path == "" {
			path = "."
		}
		if message == "" {
			return "Error: message is required"
		}
		result, err := GitCommit(path, message)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return result

	case "diagnostics":
		dir, _ := args["dir"].(string)
		if dir == "" {
			dir = "."
		}
		file, _ := args["file"].(string)
		result, err := RunDiagnostics(dir, file)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return result

	default:
		config.DebugLog("[TOOL-ERR] unknown tool '%s'", name)
		return fmt.Sprintf("Error: unknown tool '%s'", name)
	}
}
