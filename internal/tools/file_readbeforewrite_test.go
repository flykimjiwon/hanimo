package tools

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestReadBeforeWrite_EditUnread(t *testing.T) {
	ResetReadSet()
	dir := t.TempDir()
	p := filepath.Join(dir, "a.txt")
	if err := os.WriteFile(p, []byte("hello world"), 0644); err != nil {
		t.Fatal(err)
	}
	// Attempt to edit without a prior read — must refuse.
	_, err := FileEdit(p, "hello", "bye")
	if err == nil {
		t.Fatal("expected refusal when editing unread file")
	}
	if !strings.Contains(err.Error(), "without reading it first") {
		t.Errorf("expected refusal message, got %v", err)
	}
}

func TestReadBeforeWrite_EditAfterRead(t *testing.T) {
	ResetReadSet()
	dir := t.TempDir()
	p := filepath.Join(dir, "a.txt")
	if err := os.WriteFile(p, []byte("hello world"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := FileRead(p); err != nil {
		t.Fatal(err)
	}
	n, err := FileEdit(p, "hello", "bye")
	if err != nil {
		t.Fatalf("edit after read should succeed, got %v", err)
	}
	if n != 1 {
		t.Errorf("expected 1 replacement, got %d", n)
	}
	got, _ := os.ReadFile(p)
	if string(got) != "bye world" {
		t.Errorf("file content mismatch: %q", got)
	}
}

func TestReadBeforeWrite_OverwriteUnread(t *testing.T) {
	ResetReadSet()
	dir := t.TempDir()
	p := filepath.Join(dir, "a.txt")
	if err := os.WriteFile(p, []byte("original"), 0644); err != nil {
		t.Fatal(err)
	}
	// Overwrite existing unread file — must refuse.
	err := FileWrite(p, "clobbered")
	if err == nil {
		t.Fatal("expected refusal when overwriting unread file")
	}
	got, _ := os.ReadFile(p)
	if string(got) != "original" {
		t.Errorf("file should be untouched, got %q", got)
	}
}

func TestReadBeforeWrite_NewFileAllowed(t *testing.T) {
	ResetReadSet()
	dir := t.TempDir()
	p := filepath.Join(dir, "fresh.txt")
	// Writing a brand-new file is always allowed.
	if err := FileWrite(p, "new content"); err != nil {
		t.Fatalf("new file write should succeed, got %v", err)
	}
	got, _ := os.ReadFile(p)
	if string(got) != "new content" {
		t.Errorf("new file content wrong: %q", got)
	}
}

func TestReadBeforeWrite_ResetClears(t *testing.T) {
	ResetReadSet()
	dir := t.TempDir()
	p := filepath.Join(dir, "a.txt")
	if err := os.WriteFile(p, []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	_, _ = FileRead(p)
	ResetReadSet() // new turn
	_, err := FileEdit(p, "x", "y")
	if err == nil {
		t.Fatal("ResetReadSet should drop the prior read, edit must refuse")
	}
}
