package main

import (
	"crypto/md5"
	"fmt"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// hashAnchorPayload mirrors the frontend HashAnchor type in
// frontend/src/components/hashAnchorGutter.ts.
type hashAnchorPayload struct {
	Line int    `json:"line"`
	Hash string `json:"hash"`
}

// hashLineMD5 returns the first 4 hex chars of the MD5 of a line —
// matches hanimo CLI's tools/hashline.go anchor format.
func hashLineMD5(line string) string {
	h := md5.Sum([]byte(line))
	return fmt.Sprintf("%x", h)[:4]
}

// emitHashAnchorsFor publishes a 'hash:anchor' Wails event with the first
// `cap` line anchors of `content`, then auto-clears after `clearAfter`.
// Phase 9 demo: every file_write triggers a brief anchor flash so the
// user sees the brand promise visually. Real per-line edit anchors will
// arrive when hashline_edit tool is ported (Phase 10+).
func emitHashAnchorsFor(a *App, content string, cap int, clearAfter time.Duration) {
	if a == nil || a.ctx == nil {
		return
	}
	lines := strings.Split(content, "\n")
	if len(lines) > cap {
		lines = lines[:cap]
	}
	anchors := make([]hashAnchorPayload, 0, len(lines))
	for i, ln := range lines {
		if strings.TrimSpace(ln) == "" {
			continue
		}
		anchors = append(anchors, hashAnchorPayload{Line: i + 1, Hash: hashLineMD5(ln)})
	}
	runtime.EventsEmit(a.ctx, "hash:anchor", anchors)
	go func() {
		time.Sleep(clearAfter)
		runtime.EventsEmit(a.ctx, "hash:anchor", []hashAnchorPayload{})
	}()
}
