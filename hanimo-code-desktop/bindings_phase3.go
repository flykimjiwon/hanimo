package main

import (
	"fmt"
	"os"
	"sync"
	"time"
)

// ── Snapshot store for one-click undo ──────────────────────────────────────
//
// Backs up the current file contents *before* every WriteFile so the frontend
// can call UndoLastEdit() to restore the previous state. Bounded LIFO stack
// (50 entries) keeps memory predictable for long agent sessions.

type snapshotEntry struct {
	Path     string
	Original []byte
	Existed  bool
	At       int64
}

var (
	snapshotMu    sync.Mutex
	snapshotStack []snapshotEntry
)

const snapshotStackCap = 50

// backupBeforeWrite is called by WriteFile before mutating disk. Errors are
// non-fatal — undo simply won't be available for that path.
func backupBeforeWrite(path string) {
	data, err := os.ReadFile(path)
	existed := err == nil
	if !existed {
		data = nil
	}
	snapshotMu.Lock()
	defer snapshotMu.Unlock()
	snapshotStack = append(snapshotStack, snapshotEntry{
		Path:     path,
		Original: data,
		Existed:  existed,
		At:       time.Now().Unix(),
	})
	if len(snapshotStack) > snapshotStackCap {
		snapshotStack = snapshotStack[len(snapshotStack)-snapshotStackCap:]
	}
}

// UndoLastEdit restores the most recent file mutation. Returns the path that
// was reverted so the frontend can show a toast. If the file did not exist
// before the edit it is removed; otherwise the original bytes are written.
func (a *App) UndoLastEdit() (string, error) {
	snapshotMu.Lock()
	defer snapshotMu.Unlock()
	if len(snapshotStack) == 0 {
		return "", fmt.Errorf("no edit to undo")
	}
	last := snapshotStack[len(snapshotStack)-1]
	snapshotStack = snapshotStack[:len(snapshotStack)-1]
	if !last.Existed {
		if err := os.Remove(last.Path); err != nil && !os.IsNotExist(err) {
			return "", fmt.Errorf("undo remove %s: %w", last.Path, err)
		}
		return last.Path, nil
	}
	if err := os.WriteFile(last.Path, last.Original, 0644); err != nil {
		return "", fmt.Errorf("undo restore %s: %w", last.Path, err)
	}
	return last.Path, nil
}

// SnapshotCount returns the current number of undoable edits.
func (a *App) SnapshotCount() int {
	snapshotMu.Lock()
	defer snapshotMu.Unlock()
	return len(snapshotStack)
}

// ── MetricsRow data ────────────────────────────────────────────────────────

// Metrics powers the right-panel MetricsRow component. Currently a stub —
// real context/cache/iter values will pipe in from chatEngine in Phase 4+.
type Metrics struct {
	ContextPct    int     `json:"contextPct"`
	ContextTokens int     `json:"contextTokens"`
	ContextMax    int     `json:"contextMax"`
	CacheHitPct   int     `json:"cacheHitPct"`
	CacheSavedUSD float64 `json:"cacheSavedUSD"`
	Iter          int     `json:"iter"`
	IterMax       int     `json:"iterMax"`
	IterLabel     string  `json:"iterLabel"`
	Provider      string  `json:"provider"`
	Tier          string  `json:"tier"`
}

// GetMetrics returns current session metrics. Stub values today; chatEngine
// hookup is Phase 4+.
func (a *App) GetMetrics() Metrics {
	cfg := LoadTGCConfig()
	provider := cfg.Models.Super
	if provider == "" {
		provider = "qwen3:8b"
	}
	return Metrics{
		ContextMax: 32000,
		IterMax:    200,
		IterLabel:  "idle",
		Provider:   provider,
	}
}

// ── LSP Problems strip data ────────────────────────────────────────────────

// Problem mirrors a single LSP diagnostic for the ProblemsStrip component.
type Problem struct {
	Severity string `json:"severity"` // "error" | "warning" | "hint"
	Message  string `json:"message"`
	Line     int    `json:"line"`
	Col      int    `json:"col"`
}

// GetProblems returns LSP diagnostics for the given file path. Stub today —
// returns empty slice; real LSP wiring (gopls / tsserver / pyright) is
// Phase 5.
func (a *App) GetProblems(filePath string) []Problem {
	_ = filePath
	return []Problem{}
}
