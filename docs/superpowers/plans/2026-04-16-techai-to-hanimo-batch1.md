# TECHAI_CODE → hanimo Batch 1 Porting Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port 11 independent features from TECHAI_CODE into hanimo — 7 tools + 4 knowledge enhancements — without touching app.go.

**Architecture:** All ported files live under `internal/tools/` or `internal/knowledge/`. Each file is a self-contained module that only depends on `internal/config` (for `ConfigDir()` and `DebugLog()`). The only shared integration point is `internal/tools/registry.go` where new tool cases are added to `executeInner()`. Module path changes from `github.com/kimjiwon/tgc` to `github.com/flykimjiwon/hanimo`. Korean UI strings are replaced with English (hanimo is open-source international).

**Tech Stack:** Go 1.26, Bubble Tea v2, go-openai, SQLite (modernc), no CGO

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `internal/tools/diff.go` | Unified diff generation between old/new content |
| Create | `internal/tools/snapshot.go` | Pre-edit file backup + undo system |
| Create | `internal/tools/secrets.go` | Secret/credential pattern detection |
| Create | `internal/tools/gitignore.go` | .gitignore parser + pattern matching |
| Create | `internal/tools/project.go` | Project type/framework auto-detection |
| Create | `internal/tools/init.go` | `/init` project profile generator (.hanimo.md) |
| Create | `internal/tools/commands.go` | Custom command loader (.hanimo/commands/*.md) |
| Modify | `internal/tools/registry.go` | Add `project_detect` and `init_project` tool defs + execute cases |
| Modify | `internal/tools/file.go` | Integrate snapshot + secrets into FileWrite/FileEdit |
| Modify | `internal/tools/search.go` | Use gitignore parser instead of hardcoded skipDirs |
| Modify | `internal/knowledge/injector.go` | Upgrade to 3-stage search (keyword → BM25 → LLM fallback) |

---

### Task 1: diff.go — Unified Diff Generator

**Files:**
- Create: `internal/tools/diff.go`

- [ ] **Step 1: Create diff.go**

```go
package tools

import (
	"fmt"
	"strings"
)

// GenerateUnifiedDiff produces a simple unified diff between old and new content.
// Returns a human-readable diff string with +/- markers.
func GenerateUnifiedDiff(path, oldContent, newContent string) string {
	oldLines := strings.Split(oldContent, "\n")
	newLines := strings.Split(newContent, "\n")

	// Leading common lines
	commonStart := 0
	for commonStart < len(oldLines) && commonStart < len(newLines) && oldLines[commonStart] == newLines[commonStart] {
		commonStart++
	}

	// Trailing common lines
	commonEnd := 0
	for commonEnd < len(oldLines)-commonStart && commonEnd < len(newLines)-commonStart &&
		oldLines[len(oldLines)-1-commonEnd] == newLines[len(newLines)-1-commonEnd] {
		commonEnd++
	}

	removedStart := commonStart
	removedEnd := len(oldLines) - commonEnd
	addedStart := commonStart
	addedEnd := len(newLines) - commonEnd

	if removedStart >= removedEnd && addedStart >= addedEnd {
		return "" // no diff
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("--- %s\n+++ %s\n", path, path))

	ctxStart := commonStart - 3
	if ctxStart < 0 {
		ctxStart = 0
	}
	ctxEnd := len(oldLines) - commonEnd + 3
	if ctxEnd > len(oldLines) {
		ctxEnd = len(oldLines)
	}
	newCtxEnd := len(newLines) - commonEnd + 3
	if newCtxEnd > len(newLines) {
		newCtxEnd = len(newLines)
	}

	b.WriteString(fmt.Sprintf("@@ -%d,%d +%d,%d @@\n",
		ctxStart+1, ctxEnd-ctxStart,
		ctxStart+1, newCtxEnd-ctxStart-(removedEnd-removedStart)+(addedEnd-addedStart)))

	for i := ctxStart; i < commonStart; i++ {
		b.WriteString(fmt.Sprintf(" %s\n", oldLines[i]))
	}
	for i := removedStart; i < removedEnd; i++ {
		b.WriteString(fmt.Sprintf("-%s\n", oldLines[i]))
	}
	for i := addedStart; i < addedEnd; i++ {
		b.WriteString(fmt.Sprintf("+%s\n", newLines[i]))
	}

	trailStart := len(oldLines) - commonEnd
	trailEnd := trailStart + 3
	if trailEnd > len(oldLines) {
		trailEnd = len(oldLines)
	}
	for i := trailStart; i < trailEnd; i++ {
		b.WriteString(fmt.Sprintf(" %s\n", oldLines[i]))
	}

	return b.String()
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/jiwonkim/Desktop/kimjiwon/hanimo && go build ./internal/tools/`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/jiwonkim/Desktop/kimjiwon/hanimo
git add internal/tools/diff.go
git commit -m "feat(tools): add unified diff generator (ported from TECHAI_CODE)"
```

---

### Task 2: secrets.go — Secret Pattern Detection

**Files:**
- Create: `internal/tools/secrets.go`

- [ ] **Step 1: Create secrets.go**

```go
package tools

import (
	"path/filepath"
	"regexp"
	"strings"

	"github.com/flykimjiwon/hanimo/internal/config"
)

// Secret patterns to detect before writing files or committing.
var secretPatterns = []struct {
	re   *regexp.Regexp
	desc string
}{
	{regexp.MustCompile(`(?i)(sk-[a-zA-Z0-9]{20,})`), "OpenAI API key"},
	{regexp.MustCompile(`(?i)(AKIA[0-9A-Z]{16})`), "AWS Access Key"},
	{regexp.MustCompile(`-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----`), "Private key"},
	{regexp.MustCompile(`(?i)(ghp_[a-zA-Z0-9]{36})`), "GitHub token"},
	{regexp.MustCompile(`(?i)(gho_[a-zA-Z0-9]{36})`), "GitHub OAuth token"},
	{regexp.MustCompile(`(?i)(glpat-[a-zA-Z0-9\-]{20,})`), "GitLab token"},
	{regexp.MustCompile(`(?i)password\s*[:=]\s*["'][^"']{8,}["']`), "Hardcoded password"},
	{regexp.MustCompile(`(?i)(xox[bporas]-[a-zA-Z0-9\-]{10,})`), "Slack token"},
	{regexp.MustCompile(`(?i)(eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.)`), "JWT token"},
}

// Sensitive file extensions that should not be written by AI.
var sensitiveFiles = map[string]bool{
	".env":                 true,
	".env.local":           true,
	".env.production":      true,
	".pem":                 true,
	".key":                 true,
	".p12":                 true,
	".pfx":                 true,
	".jks":                 true,
	"credentials.json":     true,
	"service-account.json": true,
}

// CheckSecrets scans content for potential secrets.
// Returns a warning string if secrets are found, empty string if clean.
func CheckSecrets(content string) string {
	var found []string
	for _, p := range secretPatterns {
		if p.re.MatchString(content) {
			found = append(found, p.desc)
			config.DebugLog("[SECRET-WARN] detected: %s", p.desc)
		}
	}
	if len(found) == 0 {
		return ""
	}
	return "WARNING: Potential secrets detected: " + strings.Join(found, ", ")
}

// CheckSensitiveFile returns a warning if the file path is a sensitive file type.
func CheckSensitiveFile(path string) string {
	base := filepath.Base(path)
	ext := filepath.Ext(path)

	if sensitiveFiles[base] || sensitiveFiles[ext] {
		config.DebugLog("[SECRET-WARN] sensitive file: %s", path)
		return "WARNING: Sensitive file: " + base
	}
	return ""
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/jiwonkim/Desktop/kimjiwon/hanimo && go build ./internal/tools/`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add internal/tools/secrets.go
git commit -m "feat(tools): add secret/credential pattern detection (ported from TECHAI_CODE)"
```

---

### Task 3: snapshot.go — File Backup & Undo System

**Files:**
- Create: `internal/tools/snapshot.go`

- [ ] **Step 1: Create snapshot.go**

```go
package tools

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/flykimjiwon/hanimo/internal/config"
)

// SnapshotEntry records a single file backup.
type SnapshotEntry struct {
	OriginalPath string
	SnapshotPath string
	Timestamp    time.Time
}

const maxSnapshots = 50

// snapshotDir returns ~/.hanimo/snapshots/ (auto-created).
func snapshotDir() string {
	dir := filepath.Join(config.ConfigDir(), "snapshots")
	_ = os.MkdirAll(dir, 0755)
	return dir
}

// CreateSnapshot backs up a file before modification.
// Returns the snapshot path or empty string if file doesn't exist yet.
func CreateSnapshot(absPath string) string {
	data, err := os.ReadFile(absPath)
	if err != nil {
		return ""
	}

	ts := time.Now().Format("20060102-150405.000")
	baseName := filepath.Base(absPath)
	snapName := fmt.Sprintf("%s_%s", ts, baseName)
	snapPath := filepath.Join(snapshotDir(), snapName)

	if err := os.WriteFile(snapPath, data, 0644); err != nil {
		config.DebugLog("[SNAPSHOT] failed to create snapshot: %v", err)
		return ""
	}

	metaPath := snapPath + ".meta"
	_ = os.WriteFile(metaPath, []byte(absPath), 0644)

	config.DebugLog("[SNAPSHOT] created %s -> %s (%d bytes)", absPath, snapPath, len(data))
	pruneSnapshots()
	return snapPath
}

// ListSnapshots returns recent snapshots, newest first.
func ListSnapshots(limit int) []SnapshotEntry {
	dir := snapshotDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}

	var snapshots []SnapshotEntry
	for _, e := range entries {
		if e.IsDir() || strings.HasSuffix(e.Name(), ".meta") {
			continue
		}
		snapPath := filepath.Join(dir, e.Name())
		metaPath := snapPath + ".meta"
		origPath := ""
		if data, err := os.ReadFile(metaPath); err == nil {
			origPath = string(data)
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		snapshots = append(snapshots, SnapshotEntry{
			OriginalPath: origPath,
			SnapshotPath: snapPath,
			Timestamp:    info.ModTime(),
		})
	}

	sort.Slice(snapshots, func(i, j int) bool {
		return snapshots[i].Timestamp.After(snapshots[j].Timestamp)
	})

	if limit > 0 && len(snapshots) > limit {
		snapshots = snapshots[:limit]
	}
	return snapshots
}

// UndoLast restores the N most recent snapshots. Returns a summary.
func UndoLast(count int) string {
	if count <= 0 {
		count = 1
	}
	snapshots := ListSnapshots(count)
	if len(snapshots) == 0 {
		return "No snapshots to undo."
	}

	var results []string
	for _, snap := range snapshots {
		if snap.OriginalPath == "" {
			results = append(results, fmt.Sprintf("WARN: %s: no original path (skipped)", filepath.Base(snap.SnapshotPath)))
			continue
		}
		data, err := os.ReadFile(snap.SnapshotPath)
		if err != nil {
			results = append(results, fmt.Sprintf("WARN: %s: read failed", filepath.Base(snap.SnapshotPath)))
			continue
		}
		if err := os.WriteFile(snap.OriginalPath, data, 0644); err != nil {
			results = append(results, fmt.Sprintf("WARN: %s -> %s: restore failed", filepath.Base(snap.SnapshotPath), snap.OriginalPath))
			continue
		}
		_ = os.Remove(snap.SnapshotPath)
		_ = os.Remove(snap.SnapshotPath + ".meta")
		results = append(results, fmt.Sprintf("OK: %s restored", snap.OriginalPath))
		config.DebugLog("[UNDO] restored %s from %s", snap.OriginalPath, snap.SnapshotPath)
	}
	return strings.Join(results, "\n")
}

// FormatSnapshotList formats snapshots for display.
func FormatSnapshotList(limit int) string {
	snapshots := ListSnapshots(limit)
	if len(snapshots) == 0 {
		return "No snapshots."
	}
	var lines []string
	for i, s := range snapshots {
		ts := s.Timestamp.Format("01/02 15:04:05")
		orig := s.OriginalPath
		if orig == "" {
			orig = "(unknown)"
		}
		lines = append(lines, fmt.Sprintf("  %d. [%s] %s", i+1, ts, orig))
	}
	return strings.Join(lines, "\n")
}

// pruneSnapshots removes oldest snapshots when over maxSnapshots.
func pruneSnapshots() {
	all := ListSnapshots(0)
	if len(all) <= maxSnapshots {
		return
	}
	for _, old := range all[maxSnapshots:] {
		_ = os.Remove(old.SnapshotPath)
		_ = os.Remove(old.SnapshotPath + ".meta")
	}
	config.DebugLog("[SNAPSHOT] pruned %d old snapshots", len(all)-maxSnapshots)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/jiwonkim/Desktop/kimjiwon/hanimo && go build ./internal/tools/`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add internal/tools/snapshot.go
git commit -m "feat(tools): add file snapshot backup + undo system (ported from TECHAI_CODE)"
```

---

### Task 4: Integrate Snapshot + Secrets into file.go

**Files:**
- Modify: `internal/tools/file.go:58-110` (FileWrite and FileEdit functions)

- [ ] **Step 1: Add secret check + snapshot to FileWrite**

In `internal/tools/file.go`, find the `FileWrite` function and add checks at the top:

```go
// FileWrite creates or overwrites a file.
func FileWrite(path, content string) error {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return err
	}

	// Check for sensitive files
	if warn := CheckSensitiveFile(absPath); warn != "" {
		return fmt.Errorf("%s — writing blocked. Use shell_exec if you really need to write this file.", warn)
	}

	// Check for secrets in content
	if warn := CheckSecrets(content); warn != "" {
		config.DebugLog("[FILE-WRITE] %s for %s", warn, absPath)
		// Allow write but return warning as prefix
		CreateSnapshot(absPath)
		if err := os.MkdirAll(filepath.Dir(absPath), 0755); err != nil {
			return err
		}
		if err := os.WriteFile(absPath, []byte(content), 0644); err != nil {
			return err
		}
		return fmt.Errorf("%s — file written anyway, snapshot created", warn)
	}

	// Snapshot before overwrite
	CreateSnapshot(absPath)

	if err := os.MkdirAll(filepath.Dir(absPath), 0755); err != nil {
		return err
	}
	return os.WriteFile(absPath, []byte(content), 0644)
}
```

- [ ] **Step 2: Add snapshot to FileEdit**

Find `FileEdit` and add `CreateSnapshot(absPath)` before the write:

```go
func FileEdit(path, oldStr, newStr string) (int, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return 0, err
	}
	data, err := os.ReadFile(absPath)
	if err != nil {
		return 0, err
	}
	content := string(data)
	if !strings.Contains(content, oldStr) {
		return 0, fmt.Errorf("old_string not found in %s", path)
	}

	// Snapshot before edit
	CreateSnapshot(absPath)

	newContent := strings.Replace(content, oldStr, newStr, 1)
	if err := os.WriteFile(absPath, []byte(newContent), 0644); err != nil {
		return 0, err
	}
	return strings.Count(content, oldStr), nil
}
```

- [ ] **Step 3: Add missing imports to file.go if needed**

Ensure `file.go` imports `"github.com/flykimjiwon/hanimo/internal/config"` and `"fmt"`. These may already be there — check before adding.

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/jiwonkim/Desktop/kimjiwon/hanimo && go build ./internal/tools/`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add internal/tools/file.go
git commit -m "feat(tools): integrate snapshot + secret detection into FileWrite/FileEdit"
```

---

### Task 5: gitignore.go — .gitignore Parser

**Files:**
- Create: `internal/tools/gitignore.go`

- [ ] **Step 1: Create gitignore.go**

```go
package tools

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/flykimjiwon/hanimo/internal/config"
)

// GitIgnore holds compiled patterns from .gitignore files.
type GitIgnore struct {
	patterns []ignorePattern
}

type ignorePattern struct {
	re      *regexp.Regexp
	negate  bool // lines starting with '!'
	dirOnly bool // lines ending with '/'
}

// LoadGitIgnore reads .gitignore files from the base directory up to the git root.
// Returns nil if no .gitignore found (caller falls back to skipDirs).
func LoadGitIgnore(basePath string) *GitIgnore {
	gi := &GitIgnore{}
	loaded := 0

	dir, err := filepath.Abs(basePath)
	if err != nil {
		return nil
	}

	var paths []string
	for {
		candidate := filepath.Join(dir, ".gitignore")
		if _, err := os.Stat(candidate); err == nil {
			paths = append(paths, candidate)
		}
		if _, err := os.Stat(filepath.Join(dir, ".git")); err == nil {
			break
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	for i := len(paths) - 1; i >= 0; i-- {
		if err := gi.loadFile(paths[i]); err == nil {
			loaded++
		}
	}

	if loaded == 0 {
		return nil
	}

	config.DebugLog("[GITIGNORE] loaded %d .gitignore file(s) with %d patterns", loaded, len(gi.patterns))
	return gi
}

func (gi *GitIgnore) loadFile(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		negate := false
		if strings.HasPrefix(line, "!") {
			negate = true
			line = line[1:]
		}

		dirOnly := false
		if strings.HasSuffix(line, "/") {
			dirOnly = true
			line = strings.TrimSuffix(line, "/")
		}

		re, err := gitignorePatternToRegex(line)
		if err != nil {
			continue
		}

		gi.patterns = append(gi.patterns, ignorePattern{
			re:      re,
			negate:  negate,
			dirOnly: dirOnly,
		})
	}
	return nil
}

// ShouldIgnore checks if a relative path should be ignored.
func (gi *GitIgnore) ShouldIgnore(relPath string, isDir bool) bool {
	if gi == nil {
		return false
	}

	relPath = filepath.ToSlash(relPath)

	ignored := false
	for _, p := range gi.patterns {
		if p.dirOnly && !isDir {
			continue
		}
		name := filepath.Base(relPath)
		if p.re.MatchString(relPath) || p.re.MatchString(name) {
			if p.negate {
				ignored = false
			} else {
				ignored = true
			}
		}
	}
	return ignored
}

// gitignorePatternToRegex converts a gitignore glob pattern to a regex.
func gitignorePatternToRegex(pattern string) (*regexp.Regexp, error) {
	var b strings.Builder

	anchored := strings.Contains(pattern, "/")
	pattern = strings.TrimPrefix(pattern, "/")

	if !anchored {
		b.WriteString("(^|/)")
	} else {
		b.WriteString("^")
	}

	i := 0
	for i < len(pattern) {
		ch := pattern[i]
		switch ch {
		case '*':
			if i+1 < len(pattern) && pattern[i+1] == '*' {
				if i+2 < len(pattern) && pattern[i+2] == '/' {
					b.WriteString("(.*/)?")
					i += 3
				} else {
					b.WriteString(".*")
					i += 2
				}
			} else {
				b.WriteString("[^/]*")
				i++
			}
		case '?':
			b.WriteString("[^/]")
			i++
		case '.':
			b.WriteString("\\.")
			i++
		case '[':
			end := strings.IndexByte(pattern[i:], ']')
			if end > 0 {
				b.WriteString(pattern[i : i+end+1])
				i += end + 1
			} else {
				b.WriteString("\\[")
				i++
			}
		default:
			if strings.ContainsRune(`+{}()^$|\\`, rune(ch)) {
				b.WriteByte('\\')
			}
			b.WriteByte(ch)
			i++
		}
	}

	b.WriteString("(/.*)?$")

	return regexp.Compile(b.String())
}

// shouldSkip checks a path against gitignore (if loaded) or falls back to hardcoded skipDirs.
func shouldSkip(gi *GitIgnore, relPath string, isDir bool, name string) bool {
	if name == ".git" {
		return true
	}

	if gi != nil {
		return gi.ShouldIgnore(relPath, isDir)
	}

	if isDir {
		return skipDirs[name]
	}
	return false
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/jiwonkim/Desktop/kimjiwon/hanimo && go build ./internal/tools/`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add internal/tools/gitignore.go
git commit -m "feat(tools): add .gitignore parser with glob-to-regex conversion (ported from TECHAI_CODE)"
```

---

### Task 6: project.go — Project Type Auto-Detection

**Files:**
- Create: `internal/tools/project.go`

- [ ] **Step 1: Create project.go**

```go
package tools

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/flykimjiwon/hanimo/internal/config"
)

// ProjectInfo describes the detected project type and key files.
type ProjectInfo struct {
	Type      string   // "go", "node", "python", "rust", "java", "unknown"
	Name      string   // project name if detectable
	Framework string   // "nextjs", "react", "vue", "django", "flask", "gin", etc.
	KeyFiles  []string // important config files found
}

// DetectProject scans the working directory for project markers.
func DetectProject(dir string) ProjectInfo {
	if dir == "" {
		dir = "."
	}
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return ProjectInfo{Type: "unknown"}
	}

	info := ProjectInfo{Type: "unknown"}

	markers := []struct {
		file      string
		projType  string
		framework string
	}{
		{"go.mod", "go", ""},
		{"Cargo.toml", "rust", ""},
		{"package.json", "node", ""},
		{"pyproject.toml", "python", ""},
		{"requirements.txt", "python", ""},
		{"setup.py", "python", ""},
		{"pom.xml", "java", "maven"},
		{"build.gradle", "java", "gradle"},
		{"Gemfile", "ruby", ""},
		{"composer.json", "php", ""},
	}

	for _, m := range markers {
		path := filepath.Join(absDir, m.file)
		if _, err := os.Stat(path); err == nil {
			info.Type = m.projType
			info.KeyFiles = append(info.KeyFiles, m.file)
			if m.framework != "" {
				info.Framework = m.framework
			}
			break
		}
	}

	if info.Type == "node" {
		info.Framework = detectNodeFramework(absDir)
		info.Name = detectPackageName(absDir)
	} else if info.Type == "go" {
		info.Name = detectGoModule(absDir)
	} else if info.Type == "python" {
		info.Framework = detectPythonFramework(absDir)
	}

	extras := []string{
		"Makefile", "Dockerfile", "docker-compose.yml",
		".env", ".env.local", "tsconfig.json",
		"next.config.js", "next.config.ts", "next.config.mjs",
		"vite.config.ts", "webpack.config.js",
	}
	for _, f := range extras {
		if _, err := os.Stat(filepath.Join(absDir, f)); err == nil {
			info.KeyFiles = append(info.KeyFiles, f)
		}
	}

	config.DebugLog("[PROJECT] type=%s framework=%s name=%s keyFiles=%v", info.Type, info.Framework, info.Name, info.KeyFiles)
	return info
}

// FormatProjectContext returns a string suitable for system prompt injection.
func FormatProjectContext(info ProjectInfo) string {
	if info.Type == "unknown" {
		return ""
	}
	var parts []string
	parts = append(parts, fmt.Sprintf("Project type: %s", info.Type))
	if info.Name != "" {
		parts = append(parts, fmt.Sprintf("Project name: %s", info.Name))
	}
	if info.Framework != "" {
		parts = append(parts, fmt.Sprintf("Framework: %s", info.Framework))
	}
	if len(info.KeyFiles) > 0 {
		parts = append(parts, fmt.Sprintf("Key files: %s", strings.Join(info.KeyFiles, ", ")))
	}
	return strings.Join(parts, " | ")
}

func detectNodeFramework(dir string) string {
	data, err := os.ReadFile(filepath.Join(dir, "package.json"))
	if err != nil {
		return ""
	}
	content := string(data)
	switch {
	case strings.Contains(content, `"next"`):
		return "nextjs"
	case strings.Contains(content, `"nuxt"`):
		return "nuxt"
	case strings.Contains(content, `"@angular/core"`):
		return "angular"
	case strings.Contains(content, `"vue"`):
		return "vue"
	case strings.Contains(content, `"svelte"`):
		return "svelte"
	case strings.Contains(content, `"react"`):
		return "react"
	case strings.Contains(content, `"express"`):
		return "express"
	case strings.Contains(content, `"fastify"`):
		return "fastify"
	}
	return ""
}

func detectPackageName(dir string) string {
	data, err := os.ReadFile(filepath.Join(dir, "package.json"))
	if err != nil {
		return ""
	}
	content := string(data)
	if idx := strings.Index(content, `"name"`); idx >= 0 {
		rest := content[idx+6:]
		if start := strings.IndexByte(rest, '"'); start >= 0 {
			rest = rest[start+1:]
			if end := strings.IndexByte(rest, '"'); end >= 0 {
				return rest[:end]
			}
		}
	}
	return ""
}

func detectGoModule(dir string) string {
	data, err := os.ReadFile(filepath.Join(dir, "go.mod"))
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "module ") {
			return strings.TrimSpace(strings.TrimPrefix(line, "module "))
		}
	}
	return ""
}

func detectPythonFramework(dir string) string {
	for _, f := range []string{"requirements.txt", "pyproject.toml"} {
		data, err := os.ReadFile(filepath.Join(dir, f))
		if err != nil {
			continue
		}
		content := strings.ToLower(string(data))
		switch {
		case strings.Contains(content, "django"):
			return "django"
		case strings.Contains(content, "flask"):
			return "flask"
		case strings.Contains(content, "fastapi"):
			return "fastapi"
		}
	}
	return ""
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/jiwonkim/Desktop/kimjiwon/hanimo && go build ./internal/tools/`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add internal/tools/project.go
git commit -m "feat(tools): add project type auto-detection (ported from TECHAI_CODE)"
```

---

### Task 7: init.go — Project Profile Generator

**Files:**
- Create: `internal/tools/init.go`

- [ ] **Step 1: Create init.go**

```go
package tools

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/flykimjiwon/hanimo/internal/config"
)

const maxInitDepth = 4
const maxInitFiles = 500

// GenerateProjectProfile scans the current directory and produces
// a comprehensive markdown profile suitable for .hanimo.md.
func GenerateProjectProfile(dir string) string {
	if dir == "" {
		dir = "."
	}
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return fmt.Sprintf("Error: %v", err)
	}

	var sb strings.Builder
	projName := filepath.Base(absDir)

	sb.WriteString(fmt.Sprintf("# %s\n\n", projName))

	info := DetectProject(dir)
	if info.Type != "unknown" {
		sb.WriteString("## Project Info\n\n")
		sb.WriteString(fmt.Sprintf("- **Type**: %s\n", info.Type))
		if info.Name != "" {
			sb.WriteString(fmt.Sprintf("- **Name**: %s\n", info.Name))
		}
		if info.Framework != "" {
			sb.WriteString(fmt.Sprintf("- **Framework**: %s\n", info.Framework))
		}
		if len(info.KeyFiles) > 0 {
			sb.WriteString(fmt.Sprintf("- **Key files**: %s\n", strings.Join(info.KeyFiles, ", ")))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("## Directory Structure\n\n```\n")
	tree := initBuildTree(absDir, "", 0)
	sb.WriteString(tree)
	sb.WriteString("```\n\n")

	deps := initReadDependencies(absDir, info.Type)
	if deps != "" {
		sb.WriteString("## Dependencies\n\n")
		sb.WriteString(deps)
		sb.WriteString("\n")
	}

	entries := initFindEntryPoints(absDir, info.Type)
	if len(entries) > 0 {
		sb.WriteString("## Entry Points\n\n")
		for _, e := range entries {
			sb.WriteString(fmt.Sprintf("- `%s`\n", e))
		}
		sb.WriteString("\n")
	}

	scripts := initReadScripts(absDir, info.Type)
	if scripts != "" {
		sb.WriteString("## Scripts / Commands\n\n")
		sb.WriteString(scripts)
		sb.WriteString("\n")
	}

	gitInfo := initReadGitInfo(absDir)
	if gitInfo != "" {
		sb.WriteString("## Git\n\n")
		sb.WriteString(gitInfo)
		sb.WriteString("\n")
	}

	sb.WriteString("---\n")
	sb.WriteString("*Generated by `/init`. Edit freely — this file is loaded into AI context on every session.*\n")

	config.DebugLog("[INIT] generated profile for %s (%d bytes)", absDir, sb.Len())
	return sb.String()
}

func initBuildTree(root, prefix string, depth int) string {
	if depth > maxInitDepth {
		return ""
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		return ""
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir() != entries[j].IsDir() {
			return entries[i].IsDir()
		}
		return entries[i].Name() < entries[j].Name()
	})

	var filtered []os.DirEntry
	for _, e := range entries {
		name := e.Name()
		if skipDirs[name] || name == ".DS_Store" || strings.HasPrefix(name, ".") {
			continue
		}
		filtered = append(filtered, e)
	}

	var sb strings.Builder
	for i, e := range filtered {
		isLast := i == len(filtered)-1
		connector := "├── "
		childPrefix := "│   "
		if isLast {
			connector = "└── "
			childPrefix = "    "
		}

		if e.IsDir() {
			sb.WriteString(fmt.Sprintf("%s%s%s/\n", prefix, connector, e.Name()))
			sub := initBuildTree(filepath.Join(root, e.Name()), prefix+childPrefix, depth+1)
			sb.WriteString(sub)
		} else {
			sb.WriteString(fmt.Sprintf("%s%s%s\n", prefix, connector, e.Name()))
		}
	}
	return sb.String()
}

func initReadDependencies(dir, projType string) string {
	switch projType {
	case "go":
		data, err := os.ReadFile(filepath.Join(dir, "go.mod"))
		if err != nil {
			return ""
		}
		var deps []string
		inRequire := false
		for _, line := range strings.Split(string(data), "\n") {
			line = strings.TrimSpace(line)
			if line == "require (" {
				inRequire = true
				continue
			}
			if line == ")" {
				inRequire = false
				continue
			}
			if inRequire && !strings.Contains(line, "// indirect") {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					deps = append(deps, fmt.Sprintf("- `%s` %s", parts[0], parts[1]))
				}
			}
		}
		if len(deps) > 0 {
			return strings.Join(deps, "\n") + "\n"
		}

	case "node":
		data, err := os.ReadFile(filepath.Join(dir, "package.json"))
		if err != nil {
			return ""
		}
		content := string(data)
		var deps []string
		for _, section := range []string{`"dependencies"`, `"devDependencies"`} {
			idx := strings.Index(content, section)
			if idx < 0 {
				continue
			}
			start := strings.IndexByte(content[idx:], '{')
			if start < 0 {
				continue
			}
			end := strings.IndexByte(content[idx+start:], '}')
			if end < 0 {
				continue
			}
			block := content[idx+start+1 : idx+start+end]
			for _, line := range strings.Split(block, "\n") {
				line = strings.TrimSpace(line)
				line = strings.TrimSuffix(line, ",")
				if strings.Contains(line, ":") {
					deps = append(deps, fmt.Sprintf("- %s", line))
				}
			}
		}
		if len(deps) > 0 {
			return strings.Join(deps, "\n") + "\n"
		}

	case "python":
		data, err := os.ReadFile(filepath.Join(dir, "requirements.txt"))
		if err != nil {
			return ""
		}
		var deps []string
		for _, line := range strings.Split(string(data), "\n") {
			line = strings.TrimSpace(line)
			if line != "" && !strings.HasPrefix(line, "#") {
				deps = append(deps, fmt.Sprintf("- `%s`", line))
			}
		}
		if len(deps) > 0 {
			return strings.Join(deps, "\n") + "\n"
		}
	}
	return ""
}

func initFindEntryPoints(dir, projType string) []string {
	var entries []string
	candidates := map[string][]string{
		"go":     {"cmd/*/main.go", "main.go"},
		"node":   {"src/index.ts", "src/index.js", "src/main.ts", "src/main.js", "index.ts", "index.js"},
		"python": {"main.py", "app.py", "src/main.py", "manage.py"},
		"rust":   {"src/main.rs"},
		"java":   {"src/main/java/**/Application.java", "src/main/java/**/Main.java"},
	}

	patterns, ok := candidates[projType]
	if !ok {
		return nil
	}

	for _, pattern := range patterns {
		matches, _ := filepath.Glob(filepath.Join(dir, pattern))
		for _, m := range matches {
			rel, _ := filepath.Rel(dir, m)
			entries = append(entries, rel)
		}
	}
	return entries
}

func initReadScripts(dir, projType string) string {
	var results []string

	if data, err := os.ReadFile(filepath.Join(dir, "package.json")); err == nil {
		content := string(data)
		if idx := strings.Index(content, `"scripts"`); idx >= 0 {
			start := strings.IndexByte(content[idx:], '{')
			if start >= 0 {
				end := strings.IndexByte(content[idx+start:], '}')
				if end >= 0 {
					block := content[idx+start+1 : idx+start+end]
					for _, line := range strings.Split(block, "\n") {
						line = strings.TrimSpace(line)
						line = strings.TrimSuffix(line, ",")
						if strings.Contains(line, ":") {
							results = append(results, fmt.Sprintf("- %s", line))
						}
					}
				}
			}
		}
	}

	if data, err := os.ReadFile(filepath.Join(dir, "Makefile")); err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			if strings.Contains(line, ":") && !strings.HasPrefix(line, "\t") && !strings.HasPrefix(line, "#") && !strings.HasPrefix(line, ".") {
				parts := strings.SplitN(line, ":", 2)
				target := strings.TrimSpace(parts[0])
				if target != "" && !strings.Contains(target, "=") && !strings.Contains(target, " ") {
					results = append(results, fmt.Sprintf("- `make %s`", target))
				}
			}
		}
	}

	if len(results) > 0 {
		return strings.Join(results, "\n") + "\n"
	}
	return ""
}

func initReadGitInfo(dir string) string {
	if _, err := os.Stat(filepath.Join(dir, ".git")); err != nil {
		return ""
	}

	var lines []string
	lines = append(lines, "- Git repository detected")

	if data, err := os.ReadFile(filepath.Join(dir, ".gitignore")); err == nil {
		gitignoreLines := strings.Split(string(data), "\n")
		count := 0
		for _, l := range gitignoreLines {
			l = strings.TrimSpace(l)
			if l != "" && !strings.HasPrefix(l, "#") {
				count++
			}
		}
		lines = append(lines, fmt.Sprintf("- `.gitignore`: %d patterns", count))
	}

	return strings.Join(lines, "\n") + "\n"
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/jiwonkim/Desktop/kimjiwon/hanimo && go build ./internal/tools/`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add internal/tools/init.go
git commit -m "feat(tools): add /init project profile generator (ported from TECHAI_CODE)"
```

---

### Task 8: commands.go — Custom Command Loader

**Files:**
- Create: `internal/tools/commands.go`

- [ ] **Step 1: Create commands.go**

```go
package tools

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/flykimjiwon/hanimo/internal/config"
)

// LoadCustomCommands scans ~/.hanimo/commands/ (global) and .hanimo/commands/ (project-local)
// for .md files. Returns map[commandName]templateContent.
// Project-local commands override global ones with the same name.
func LoadCustomCommands() map[string]string {
	commands := make(map[string]string)

	globalDir := filepath.Join(config.ConfigDir(), "commands")
	loadCommandsFromDir(globalDir, commands)

	localDir := filepath.Join(".hanimo", "commands")
	loadCommandsFromDir(localDir, commands)

	config.DebugLog("[COMMANDS] loaded %d custom commands", len(commands))
	return commands
}

// loadCommandsFromDir reads all .md files from dir and adds them to commands.
func loadCommandsFromDir(dir string, commands map[string]string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".md") {
			continue
		}
		cmdName := strings.ToLower(strings.TrimSuffix(name, ".md"))
		path := filepath.Join(dir, name)
		data, err := os.ReadFile(path)
		if err != nil {
			config.DebugLog("[COMMANDS] failed to read %s: %v", path, err)
			continue
		}
		commands[cmdName] = string(data)
		config.DebugLog("[COMMANDS] loaded /%s from %s", cmdName, path)
	}
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/jiwonkim/Desktop/kimjiwon/hanimo && go build ./internal/tools/`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add internal/tools/commands.go
git commit -m "feat(tools): add custom command loader from .hanimo/commands/ (ported from TECHAI_CODE)"
```

---

### Task 9: Register project_detect and init_project in registry.go

**Files:**
- Modify: `internal/tools/registry.go`

- [ ] **Step 1: Add tool definitions to AllTools()**

In `internal/tools/registry.go`, add two new tool definitions at the end of the `AllTools()` slice (before the closing `}`):

```go
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
```

- [ ] **Step 2: Add execute cases to executeInner()**

In `executeInner()`, add cases before the `default:` case:

```go
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
		if err := os.WriteFile(absOut, []byte(profile), 0644); err != nil {
			return fmt.Sprintf("Error writing .hanimo.md: %v", err)
		}
		return fmt.Sprintf("OK: generated .hanimo.md (%d bytes)\n\n%s", len(profile), profile)
```

- [ ] **Step 3: Add required imports**

Make sure `"os"` and `"path/filepath"` are in the import block of registry.go. They may already be there — check first.

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/jiwonkim/Desktop/kimjiwon/hanimo && go build ./internal/tools/`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add internal/tools/registry.go
git commit -m "feat(tools): register project_detect and init_project tools in registry"
```

---

### Task 10: Copy knowledge/docs from TECHAI_CODE (excluding BXM)

**Files:**
- Create: `knowledge/docs/` subdirectories in hanimo

- [ ] **Step 1: Copy knowledge docs (excluding bxm/ which is proprietary)**

```bash
cd /Users/jiwonkim/Desktop/kimjiwon/hanimo
mkdir -p knowledge/docs

# Copy all categories except bxm (proprietary/on-prem only)
for category in auth charts css database go java javascript python react terminal testing tooling typescript utils validation vue; do
  src="/Users/jiwonkim/Desktop/kimjiwon/TECHAI_CODE/knowledge/docs/$category"
  if [ -d "$src" ]; then
    cp -r "$src" knowledge/docs/
  fi
done
```

- [ ] **Step 2: Copy and adapt index.json**

```bash
# Copy index.json, then remove bxm entries
cp /Users/jiwonkim/Desktop/kimjiwon/TECHAI_CODE/knowledge/index.json knowledge/index.json
```

Then edit `knowledge/index.json` to remove any entries with `"path"` starting with `"docs/bxm/"`.

- [ ] **Step 3: Verify file count**

Run: `find knowledge/docs -name "*.md" | wc -l`
Expected: ~70+ files (all except bxm ones)

- [ ] **Step 4: Commit**

```bash
git add knowledge/
git commit -m "feat(knowledge): port 70+ embedded knowledge docs from TECHAI_CODE (excludes proprietary bxm)"
```

---

### Task 11: Full Build + Test Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Build the entire project**

Run: `cd /Users/jiwonkim/Desktop/kimjiwon/hanimo && go build ./...`
Expected: no errors

- [ ] **Step 2: Run all tests**

Run: `cd /Users/jiwonkim/Desktop/kimjiwon/hanimo && go test ./... 2>&1`
Expected: all PASS (some may skip if no test files exist for new packages)

- [ ] **Step 3: Build the binary and smoke-test**

Run: `cd /Users/jiwonkim/Desktop/kimjiwon/hanimo && go build -o hanimo ./cmd/hanimo/ && ./hanimo --version`
Expected: prints version string without errors

- [ ] **Step 4: Verify new files exist**

Run:
```bash
ls -la internal/tools/diff.go internal/tools/secrets.go internal/tools/snapshot.go \
      internal/tools/gitignore.go internal/tools/project.go internal/tools/init.go \
      internal/tools/commands.go
```
Expected: all 7 files present

- [ ] **Step 5: Final commit if any cleanup needed**

If any imports or minor fixes were needed during verification, commit them:
```bash
git add -A
git commit -m "fix: post-porting cleanup — resolve build warnings"
```

---

## Summary

| Task | What | Lines | Difficulty |
|------|------|-------|-----------|
| 1 | diff.go | 86 | Easy |
| 2 | secrets.go | 69 | Easy |
| 3 | snapshot.go | 173 | Easy |
| 4 | Integrate into file.go | ~30 | Easy |
| 5 | gitignore.go | 216 | Medium |
| 6 | project.go | 188 | Easy |
| 7 | init.go | 320 | Easy |
| 8 | commands.go | 55 | Easy |
| 9 | Registry entries | ~50 | Easy |
| 10 | Knowledge docs | ~19,000 (copy) | Easy |
| 11 | Verification | 0 | Easy |
| **Total** | **11 tasks** | **~1,200 new Go + 19K docs** | |
