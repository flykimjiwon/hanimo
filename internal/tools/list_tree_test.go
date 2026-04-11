package tools

import (
	"strings"
	"testing"
)

func TestListTree(t *testing.T) {
	tree, err := ListTree("../..", 2)
	if err != nil {
		t.Fatalf("ListTree error: %v", err)
	}
	if !strings.Contains(tree, "internal/") {
		t.Errorf("expected 'internal/' in tree, got:\n%s", tree)
	}
	if !strings.Contains(tree, "cmd/") {
		t.Errorf("expected 'cmd/' in tree, got:\n%s", tree)
	}
	if strings.Contains(tree, "node_modules") {
		t.Errorf("should have skipped node_modules, got:\n%s", tree)
	}
	if strings.Contains(tree, ".git") {
		t.Errorf("should have skipped .git, got:\n%s", tree)
	}
	t.Logf("tree output:\n%s", tree)
}
