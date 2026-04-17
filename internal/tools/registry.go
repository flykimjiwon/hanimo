package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	openai "github.com/sashabaranov/go-openai"

	"github.com/flykimjiwon/hanimo/internal/config"
	"github.com/flykimjiwon/hanimo/internal/knowledge"
	"github.com/flykimjiwon/hanimo/internal/lsp"
)

// activeClients caches running LSP server connections keyed by server name.
var (
	activeClients   = map[string]*lsp.Client{}
	activeClientsMu sync.Mutex
	serverAvailCache   = map[string]bool{}
	serverAvailCacheMu sync.Mutex
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
				Name:        "symbol_search",
				Description: "Search for code symbols (functions, classes, methods, types) by name. Faster than grep for finding definitions. Supports Go, JS/TS, Python, Java, Rust, Shell.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"query": {Type: "string", Description: "Symbol name to search for (partial match)"},
						"path":  {Type: "string", Description: "Directory to search in (default: current directory)"},
					},
					Required: []string{"query"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "knowledge_search",
				Description: "Search the user's knowledge base (.hanimo/knowledge/) for docs on a topic. Returns excerpts from matching md/txt files. Use when the question touches a framework, convention, or concept that may be in the knowledge folder. DO NOT guess — search first.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"query":       {Type: "string", Description: "Search query (keywords)"},
						"max_results": {Type: "string", Description: "Max results (default: 3)"},
					},
					Required: []string{"query"},
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
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "project_detect",
				Description: "Detect the project type, framework, and key files in a directory. Returns structured info (type, name, framework, key files). Use at the start of a session to understand the codebase.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"dir": {Type: "string", Description: "Directory to scan (default: current directory)"},
					},
					Required: []string{"dir"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "init_project",
				Description: "Generate a comprehensive .hanimo.md project profile. Scans directory structure, detects type/framework, lists dependencies, entry points, scripts, and git info. The generated file is loaded into AI context on every session.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"dir": {Type: "string", Description: "Directory to profile (default: current directory)"},
					},
					Required: []string{"dir"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "import_graph",
				Description: "Build and display the import/dependency graph for a directory. Shows which files import which, detects circular dependencies. Supports Go, JS/TS, Python.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path": {Type: "string", Description: "Directory to scan (default: current directory)"},
					},
					Required: []string{"path"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "reverse_imports",
				Description: "Find all files that import a given file. Useful for understanding who depends on a module.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path": {Type: "string", Description: "Directory to scan (default: current directory)"},
						"file": {Type: "string", Description: "Target file (relative to path) to find importers of"},
					},
					Required: []string{"path", "file"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "change_impact",
				Description: "Show all files transitively depending on the target file. Helps assess blast radius of a change.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path": {Type: "string", Description: "Directory to scan (default: current directory)"},
						"file": {Type: "string", Description: "Target file (relative to path) to analyze impact for"},
					},
					Required: []string{"path", "file"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "test_coverage_gaps",
				Description: "Find source files that are missing test counterparts. Supports Go, JS/TS, and Python. Returns files sorted by most recently modified (highest risk first).",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path": {Type: "string", Description: "Directory to scan (default: current directory)"},
					},
					Required: []string{},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "code_quality_scan",
				Description: "Run rule-based quality checks: TODO/FIXME/HACK markers, large functions (>50 lines), deep nesting (>5 levels). Pass checks='all' or comma-separated subset: 'todo,large_functions,deep_nesting'.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":   {Type: "string", Description: "Directory to scan (default: current directory)"},
						"checks": {Type: "string", Description: "Comma-separated checks or 'all' (default: all)"},
					},
					Required: []string{},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "git_blame",
				Description: "Show who wrote each line of a file, grouping consecutive lines by the same author.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"dir":  {Type: "string", Description: "Git repository directory"},
						"file": {Type: "string", Description: "File path (relative to the repo root)"},
					},
					Required: []string{"dir", "file"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "git_hot_files",
				Description: "Return the most frequently changed files in the last N days, sorted by change count.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"dir":  {Type: "string", Description: "Git repository directory"},
						"days": {Type: "string", Description: "Number of days to look back (default: 30)"},
					},
					Required: []string{"dir"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "git_file_history",
				Description: "Show the commit history for a specific file.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"dir":   {Type: "string", Description: "Git repository directory"},
						"file":  {Type: "string", Description: "File path to get history for"},
						"count": {Type: "string", Description: "Number of commits to show (default: 10)"},
					},
					Required: []string{"dir", "file"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "smart_context",
				Description: "Given a target file, find the most relevant related files using import graph, git history, and directory proximity. Returns top N files with their first 30 lines (signatures/exports).",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"file":      {Type: "string", Description: "Target file path (relative to cwd or absolute)"},
						"path":      {Type: "string", Description: "Base directory to scan (default: current directory)"},
						"max_files": {Type: "string", Description: "Maximum number of related files to return (default: 5)"},
					},
					Required: []string{"file"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "find_references",
				Description: "Find all files that reference (call or use) a given symbol name. Shows definition location and all usage sites grouped by file.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"symbol": {Type: "string", Description: "Symbol name to search for"},
						"path":   {Type: "string", Description: "Directory to search in (default: current directory)"},
					},
					Required: []string{"symbol"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "fuzzy_search",
				Description: "Fuzzy file search by name. Finds files even with typos or partial names. Use when you know roughly what file you're looking for but not the exact name.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"query": {Type: "string", Description: "Fuzzy search query (partial file name)"},
						"path":  {Type: "string", Description: "Directory to search (default: current directory)"},
					},
					Required: []string{"query"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "lsp_definition",
				Description: "Go to definition of a symbol at a given position using a language server (LSP). Returns the file and line where the symbol is defined. Requires a language server (gopls, typescript-language-server, pyright-langserver) to be installed.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":      {Type: "string", Description: "File path containing the symbol"},
						"line":      {Type: "string", Description: "Line number (0-based)"},
						"character": {Type: "string", Description: "Character offset (0-based)"},
					},
					Required: []string{"path", "line", "character"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "lsp_references",
				Description: "Find all references to a symbol at a given position using a language server (LSP). Returns all locations where the symbol is used. Requires a language server to be installed.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":      {Type: "string", Description: "File path containing the symbol"},
						"line":      {Type: "string", Description: "Line number (0-based)"},
						"character": {Type: "string", Description: "Character offset (0-based)"},
					},
					Required: []string{"path", "line", "character"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "lsp_hover",
				Description: "Get type information and documentation for a symbol at a given position using a language server (LSP). Requires a language server to be installed.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path":      {Type: "string", Description: "File path containing the symbol"},
						"line":      {Type: "string", Description: "Line number (0-based)"},
						"character": {Type: "string", Description: "Character offset (0-based)"},
					},
					Required: []string{"path", "line", "character"},
				},
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "lsp_symbols",
				Description: "List all symbols (functions, types, variables) in a file using a language server (LSP). Requires a language server to be installed.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"path": {Type: "string", Description: "File path to list symbols for"},
					},
					Required: []string{"path"},
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
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "project_detect",
				Description: "Detect the project type, framework, and key files in a directory. Returns structured info. Use at the start of a session to understand the codebase.",
				Parameters: paramSchema{
					Type: "object",
					Properties: map[string]propertySchema{
						"dir": {Type: "string", Description: "Directory to scan (default: current directory)"},
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
		// Try ripgrep first for speed
		if IsRipgrepAvailable() {
			result, err := RipgrepSearch(pattern, searchPath, glob, ignoreCase, contextLines)
			if err == nil {
				return result
			}
			// Fall through to Go implementation
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

	case "symbol_search":
		query, _ := args["query"].(string)
		if query == "" {
			return "Error: query is required"
		}
		searchPath, _ := args["path"].(string)
		result, err := SymbolSearch(query, searchPath)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return result

	case "knowledge_search":
		query, _ := args["query"].(string)
		if query == "" {
			return "Error: query is required"
		}
		maxR := 3
		if s, ok := args["max_results"].(string); ok && s != "" {
			var n int
			if _, err := fmt.Sscanf(s, "%d", &n); err == nil && n > 0 {
				maxR = n
			}
		}
		idx := knowledge.GlobalIndex
		if idx == nil || idx.Count() == 0 {
			return "Knowledge folder is empty or missing. Add md/txt files to .hanimo/knowledge/"
		}
		results := idx.Search(query, maxR)
		return knowledge.FormatSearchResults(results, query)

	case "import_graph":
		path, _ := args["path"].(string)
		if path == "" {
			path = "."
		}
		graph := ImportGraph(path)
		return FormatImportGraph(graph)

	case "reverse_imports":
		path, _ := args["path"].(string)
		if path == "" {
			path = "."
		}
		file, _ := args["file"].(string)
		if file == "" {
			return "Error: file is required"
		}
		graph := ImportGraph(path)
		importers := ReverseImports(graph, file)
		if len(importers) == 0 {
			return fmt.Sprintf("No files import %s", file)
		}
		return fmt.Sprintf("Files that import %s:\n%s", file, strings.Join(importers, "\n"))

	case "change_impact":
		path, _ := args["path"].(string)
		if path == "" {
			path = "."
		}
		file, _ := args["file"].(string)
		if file == "" {
			return "Error: file is required"
		}
		graph := ImportGraph(path)
		impacted := ChangeImpact(graph, file)
		if len(impacted) == 0 {
			return fmt.Sprintf("No files are transitively affected by changes to %s", file)
		}
		return fmt.Sprintf("Files affected by changes to %s (%d):\n%s", file, len(impacted), strings.Join(impacted, "\n"))

	case "test_coverage_gaps":
		path, _ := args["path"].(string)
		if path == "" {
			path = "."
		}
		return TestCoverageGaps(path)

	case "code_quality_scan":
		path, _ := args["path"].(string)
		if path == "" {
			path = "."
		}
		checks, _ := args["checks"].(string)
		return CodeQualityScan(path, checks)

	case "git_blame":
		dir, _ := args["dir"].(string)
		file, _ := args["file"].(string)
		if dir == "" {
			return "Error: dir is required"
		}
		if file == "" {
			return "Error: file is required"
		}
		result, err := GitBlame(dir, file)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return result

	case "git_hot_files":
		dir, _ := args["dir"].(string)
		if dir == "" {
			return "Error: dir is required"
		}
		days := 30
		if d, ok := args["days"].(string); ok && d != "" {
			fmt.Sscanf(d, "%d", &days)
		}
		if d, ok := args["days"].(float64); ok {
			days = int(d)
		}
		result, err := GitHotFiles(dir, days)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return result

	case "git_file_history":
		dir, _ := args["dir"].(string)
		file, _ := args["file"].(string)
		if dir == "" {
			return "Error: dir is required"
		}
		if file == "" {
			return "Error: file is required"
		}
		n := 10
		if c, ok := args["count"].(string); ok && c != "" {
			fmt.Sscanf(c, "%d", &n)
		}
		if c, ok := args["count"].(float64); ok {
			n = int(c)
		}
		result, err := GitFileHistory(dir, file, n)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return result

	case "smart_context":
		file, _ := args["file"].(string)
		if file == "" {
			return "Error: file is required"
		}
		scPath, _ := args["path"].(string)
		if scPath == "" {
			scPath = "."
		}
		scMax := 5
		if s, ok := args["max_files"].(string); ok && s != "" {
			var n int
			if _, err := fmt.Sscanf(s, "%d", &n); err == nil && n > 0 {
				scMax = n
			}
		}
		if f, ok := args["max_files"].(float64); ok && f > 0 {
			scMax = int(f)
		}
		scResult, scErr := SmartContext(file, scPath, scMax)
		if scErr != nil {
			return fmt.Sprintf("Error: %v", scErr)
		}
		return scResult

	case "find_references":
		symbol, _ := args["symbol"].(string)
		if symbol == "" {
			return "Error: symbol is required"
		}
		path, _ := args["path"].(string)
		result, err := FindReferences(symbol, path)
		if err != nil {
			return fmt.Sprintf("Error: %v", err)
		}
		return result

	case "fuzzy_search":
		query, _ := args["query"].(string)
		if query == "" {
			return "Error: query is required"
		}
		searchPath, _ := args["path"].(string)
		maxR := 20
		if m, ok := args["max_results"].(float64); ok && m > 0 {
			maxR = int(m)
		}
		result, err := FuzzyFileSearch(query, searchPath, maxR)
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

	case "project_detect":
		dir, _ := args["dir"].(string)
		if dir == "" {
			dir = "."
		}
		info := DetectProject(dir)
		ctx := FormatProjectContext(info)
		if ctx == "" {
			return "Unknown project type — no recognizable markers found."
		}
		return ctx

	case "init_project":
		dir, _ := args["dir"].(string)
		if dir == "" {
			dir = "."
		}
		profile := GenerateProjectProfile(dir)
		outPath := filepath.Join(dir, ".hanimo.md")
		absOut, _ := filepath.Abs(outPath)
		CreateSnapshot(absOut)
		if err := os.WriteFile(absOut, []byte(profile), 0644); err != nil {
			return fmt.Sprintf("Error writing .hanimo.md: %v", err)
		}
		return fmt.Sprintf("OK: generated .hanimo.md (%d bytes)\n\n%s", len(profile), profile)

	case "lsp_definition":
		path, _ := args["path"].(string)
		line, _ := args["line"].(string)
		char, _ := args["character"].(string)
		if path == "" || line == "" || char == "" {
			return "Error: path, line, and character are required"
		}
		lineN, charN := 0, 0
		fmt.Sscanf(line, "%d", &lineN)
		fmt.Sscanf(char, "%d", &charN)
		return lspDefinition(path, lineN, charN)

	case "lsp_references":
		path, _ := args["path"].(string)
		line, _ := args["line"].(string)
		char, _ := args["character"].(string)
		if path == "" || line == "" || char == "" {
			return "Error: path, line, and character are required"
		}
		lineN, charN := 0, 0
		fmt.Sscanf(line, "%d", &lineN)
		fmt.Sscanf(char, "%d", &charN)
		return lspReferences(path, lineN, charN)

	case "lsp_hover":
		path, _ := args["path"].(string)
		line, _ := args["line"].(string)
		char, _ := args["character"].(string)
		if path == "" || line == "" || char == "" {
			return "Error: path, line, and character are required"
		}
		lineN, charN := 0, 0
		fmt.Sscanf(line, "%d", &lineN)
		fmt.Sscanf(char, "%d", &charN)
		return lspHover(path, lineN, charN)

	case "lsp_symbols":
		path, _ := args["path"].(string)
		if path == "" {
			return "Error: path is required"
		}
		return lspSymbols(path)

	default:
		config.DebugLog("[TOOL-ERR] unknown tool '%s'", name)
		return fmt.Sprintf("Error: unknown tool '%s'", name)
	}
}

// --- LSP tool helpers ---

func pathToURI(path string) string {
	abs, err := filepath.Abs(path)
	if err != nil {
		abs = path
	}
	return "file://" + abs
}

func uriToPath(uri string) string {
	if u, err := url.Parse(uri); err == nil && u.Scheme == "file" {
		return u.Path
	}
	return strings.TrimPrefix(uri, "file://")
}

func formatLocations(locs []lsp.Location) string {
	if len(locs) == 0 {
		return "No results found."
	}
	var sb strings.Builder
	for _, loc := range locs {
		p := uriToPath(loc.URI)
		sb.WriteString(fmt.Sprintf("%s:%d:%d\n", p, loc.Range.Start.Line+1, loc.Range.Start.Character+1))
	}
	return strings.TrimRight(sb.String(), "\n")
}

func isServerAvailCached(name string) bool {
	serverAvailCacheMu.Lock()
	defer serverAvailCacheMu.Unlock()
	if v, ok := serverAvailCache[name]; ok {
		return v
	}
	v := lsp.IsServerAvailable(name)
	serverAvailCache[name] = v
	return v
}

func installHint(sc *lsp.ServerConfig) string {
	switch sc.Name {
	case "gopls":
		return fmt.Sprintf("%s not found. Install: go install golang.org/x/tools/gopls@latest", sc.Command)
	case "typescript-language-server":
		return fmt.Sprintf("%s not found. Install: npm install -g typescript-language-server typescript", sc.Command)
	case "pyright-langserver":
		return fmt.Sprintf("%s not found. Install: pip install pyright", sc.Command)
	default:
		return fmt.Sprintf("%s not found on PATH", sc.Command)
	}
}

func getLSPClient(filePath string) (*lsp.Client, *lsp.ServerConfig, error) {
	abs, err := filepath.Abs(filePath)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid path: %w", err)
	}
	ext := strings.ToLower(filepath.Ext(abs))
	sc := lsp.DetectServer(ext)
	if sc == nil {
		return nil, nil, fmt.Errorf("no known LSP server for %s files", ext)
	}
	if !isServerAvailCached(sc.Command) {
		return nil, nil, fmt.Errorf("%s", installHint(sc))
	}

	activeClientsMu.Lock()
	defer activeClientsMu.Unlock()

	if client, ok := activeClients[sc.Name]; ok {
		return client, sc, nil
	}

	client, err := lsp.NewClient(sc.Command, sc.Args...)
	if err != nil {
		return nil, nil, fmt.Errorf("start %s: %w", sc.Name, err)
	}

	// Find project root (directory containing go.mod, package.json, etc.)
	rootDir := filepath.Dir(abs)
	for _, marker := range []string{"go.mod", "package.json", "pyproject.toml", ".git"} {
		dir := filepath.Dir(abs)
		for dir != "/" && dir != "." {
			if _, err := os.Stat(filepath.Join(dir, marker)); err == nil {
				rootDir = dir
				break
			}
			dir = filepath.Dir(dir)
		}
	}

	if err := client.Initialize(pathToURI(rootDir)); err != nil {
		client.Close()
		return nil, nil, fmt.Errorf("initialize %s: %w", sc.Name, err)
	}

	activeClients[sc.Name] = client
	return client, sc, nil
}

func lspDefinition(path string, line, char int) string {
	client, _, err := getLSPClient(path)
	if err != nil {
		return fmt.Sprintf("Error: %v", err)
	}
	uri := pathToURI(path)
	locs, err := client.Definition(uri, line, char)
	if err != nil {
		return fmt.Sprintf("Error: %v", err)
	}
	return formatLocations(locs)
}

func lspReferences(path string, line, char int) string {
	client, _, err := getLSPClient(path)
	if err != nil {
		return fmt.Sprintf("Error: %v", err)
	}
	uri := pathToURI(path)
	locs, err := client.References(uri, line, char)
	if err != nil {
		return fmt.Sprintf("Error: %v", err)
	}
	return formatLocations(locs)
}

func lspHover(path string, line, char int) string {
	client, _, err := getLSPClient(path)
	if err != nil {
		return fmt.Sprintf("Error: %v", err)
	}
	uri := pathToURI(path)
	text, err := client.Hover(uri, line, char)
	if err != nil {
		return fmt.Sprintf("Error: %v", err)
	}
	if text == "" {
		return "No hover information available."
	}
	return text
}

func lspSymbols(path string) string {
	client, _, err := getLSPClient(path)
	if err != nil {
		return fmt.Sprintf("Error: %v", err)
	}
	uri := pathToURI(path)
	syms, err := client.DocumentSymbols(uri)
	if err != nil {
		return fmt.Sprintf("Error: %v", err)
	}
	if len(syms) == 0 {
		return "No symbols found."
	}
	var sb strings.Builder
	for _, s := range syms {
		p := uriToPath(s.Location.URI)
		sb.WriteString(fmt.Sprintf("%s:%d [kind=%d] %s\n", p, s.Location.Range.Start.Line+1, s.Kind, s.Name))
	}
	return strings.TrimRight(sb.String(), "\n")
}
