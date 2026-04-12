package tools

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ═══════════════════════════════════════════════════════════
// hanimo 도구 통합 테스트 — TUI 없이 터미널에서 검증
// go test ./internal/tools/ -v -run TestIntegration
// ═══════════════════════════════════════════════════════════

// --- 1. list_tree ---

func TestIntegration_ListTree_Normal(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "src", "components"), 0755)
	os.MkdirAll(filepath.Join(dir, "docs"), 0755)
	os.WriteFile(filepath.Join(dir, "README.md"), []byte("hi"), 0644)

	tree, err := ListTree(dir, 3)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(tree, "src/") {
		t.Errorf("expected 'src/' in tree:\n%s", tree)
	}
	if !strings.Contains(tree, "components/") {
		t.Errorf("expected 'components/' nested:\n%s", tree)
	}
	t.Logf("tree:\n%s", tree)
}

func TestIntegration_ListTree_SkipsNodeModules(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "node_modules", "react"), 0755)
	os.MkdirAll(filepath.Join(dir, "src"), 0755)

	tree, err := ListTree(dir, 3)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(tree, "node_modules") {
		t.Errorf("should skip node_modules:\n%s", tree)
	}
}

func TestIntegration_ListTree_EmptyDir(t *testing.T) {
	dir := t.TempDir()
	tree, err := ListTree(dir, 3)
	if err != nil {
		t.Fatal(err)
	}
	// Just the root line, no children.
	lines := strings.Split(strings.TrimSpace(tree), "\n")
	if len(lines) != 1 {
		t.Errorf("empty dir should have 1 line, got %d:\n%s", len(lines), tree)
	}
}

// --- 2. File CRUD + read-before-write ---

func TestIntegration_FileWrite_NewFile(t *testing.T) {
	ResetReadSet()
	dir := t.TempDir()
	p := filepath.Join(dir, "new.txt")

	err := FileWrite(p, "hello world")
	if err != nil {
		t.Fatalf("new file write should succeed: %v", err)
	}
	got, _ := os.ReadFile(p)
	if string(got) != "hello world" {
		t.Errorf("content mismatch: %q", got)
	}
}

func TestIntegration_FileWrite_OverwriteBlocked(t *testing.T) {
	ResetReadSet()
	dir := t.TempDir()
	p := filepath.Join(dir, "exist.txt")
	os.WriteFile(p, []byte("original"), 0644)

	err := FileWrite(p, "overwritten")
	if err == nil {
		t.Fatal("overwrite without read should be blocked")
	}
	if !strings.Contains(err.Error(), "먼저 읽지 않고") {
		t.Errorf("expected Korean error, got: %v", err)
	}
}

func TestIntegration_FileEdit_FullCycle(t *testing.T) {
	ResetReadSet()
	dir := t.TempDir()
	p := filepath.Join(dir, "code.go")
	os.WriteFile(p, []byte("func main() {\n\tfmt.Println(\"old\")\n}"), 0644)

	// Read first
	content, err := FileRead(p)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(content, "old") {
		t.Fatal("content should contain 'old'")
	}

	// Edit
	n, err := FileEdit(p, `"old"`, `"new"`)
	if err != nil {
		t.Fatalf("edit failed: %v", err)
	}
	if n != 1 {
		t.Errorf("expected 1 replacement, got %d", n)
	}

	// Verify
	got, _ := os.ReadFile(p)
	if !strings.Contains(string(got), `"new"`) {
		t.Errorf("edit not applied: %s", got)
	}
}

func TestIntegration_FileEdit_WrongOldString(t *testing.T) {
	ResetReadSet()
	dir := t.TempDir()
	p := filepath.Join(dir, "code.go")
	os.WriteFile(p, []byte("func main() {}"), 0644)

	FileRead(p) // mark as read
	_, err := FileEdit(p, "NONEXISTENT_STRING", "replacement")
	if err == nil {
		t.Fatal("should fail for non-matching old_string")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected 'not found' in error: %v", err)
	}
}

// --- 3. Shell safety ---

func TestIntegration_ShellExec_SafeCommand(t *testing.T) {
	ctx := context.Background()
	result, err := ShellExec(ctx, "echo hello")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result.Stdout, "hello") {
		t.Errorf("expected 'hello' in stdout: %q", result.Stdout)
	}
}

func TestIntegration_ShellExec_DangerousBlocked(t *testing.T) {
	ctx := context.Background()
	_, err := ShellExec(ctx, "rm -rf /")
	if err == nil {
		t.Fatal("rm -rf / should be blocked")
	}
}

func TestIntegration_ShellExec_CredentialBlocked(t *testing.T) {
	ctx := context.Background()
	_, err := ShellExec(ctx, "export OPENAI_API_KEY=sk-test")
	if err == nil {
		t.Fatal("credential export should be blocked")
	}
}

// --- 4. Knowledge search ---

func TestIntegration_KnowledgeSearch_ViaExecute(t *testing.T) {
	// knowledge_search goes through Execute() path.
	result := Execute("knowledge_search", `{"query":"svelte runes"}`)
	// May return results or "폴더가 비어있거나" depending on env.
	if result == "" {
		t.Error("Execute should return non-empty result")
	}
	t.Logf("knowledge_search result: %s", result[:min(len(result), 200)])
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// --- 5. Grep search ---

func TestIntegration_GrepSearch(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "main.go"), []byte("func main() {\n\tfmt.Println(\"hello\")\n}"), 0644)
	os.WriteFile(filepath.Join(dir, "util.go"), []byte("package util\n"), 0644)

	results, _ := GrepSearch("main", dir, "", false, 0)
	if results == "" {
		t.Error("expected grep results")
	}
	if !strings.Contains(results, "main.go") {
		t.Errorf("expected main.go in results: %s", results)
	}
}

// --- 6. Glob search ---

func TestIntegration_GlobSearch(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "app.tsx"), []byte("export default"), 0644)
	os.WriteFile(filepath.Join(dir, "style.css"), []byte("body{}"), 0644)
	os.MkdirAll(filepath.Join(dir, "src"), 0755)
	os.WriteFile(filepath.Join(dir, "src", "index.tsx"), []byte("import"), 0644)

	results, _ := GlobSearch("**/*.tsx", dir)
	if !strings.Contains(results, "app.tsx") {
		t.Errorf("expected app.tsx in glob: %s", results)
	}
}

// --- 7. Diagnostics ---

func TestIntegration_Diagnostics(t *testing.T) {
	dir := t.TempDir()
	// No project files — should report "no issues" gracefully.
	result, err := RunDiagnostics(dir, "")
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("diagnostics: %s", result)
}

// --- 8. Tool count ---

func TestIntegration_ToolCount(t *testing.T) {
	all := AllTools()
	if len(all) < 16 {
		t.Errorf("expected >= 16 tools in AllTools, got %d", len(all))
	}
	ro := ReadOnlyTools()
	if len(ro) >= len(all) {
		t.Errorf("ReadOnlyTools (%d) should be fewer than AllTools (%d)", len(ro), len(all))
	}
	t.Logf("AllTools: %d, ReadOnlyTools: %d", len(all), len(ro))
}
