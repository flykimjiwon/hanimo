package ui

import (
	"encoding/json"
	"strings"
)

// Persona controls the "flavour text" of the TUI — thinking verbs,
// cold-start messages, stall warnings. It is intentionally isolated so
// downstream forks (e.g. a downstream fork) can swap a single file to re-skin
// the whole product with a different metaphor:
//
//   hanimo        → 🐝 bee / honey / hive
//   a downstream fork   → 🤖 robot / circuit / bot farm
//   a samurai fork → ⚔️  samurai / katana / dojo
//
// Nothing about this file depends on hanimo-specific state, so porting
// is literally: copy this file, replace the strings, done.
//
// The streamStatus() renderer in app.go reads from ActivePersona and
// must not hard-code any domain-flavoured text. All flavour lives here.
type Persona struct {
	// Name is a short identifier used in logs (e.g. "hanimo-bee").
	Name string

	// Emoji is the mascot glyph shown before every flavour line.
	Emoji string

	// ThinkingVerbs rotate every ~2s while tokens are flowing. At
	// least 3 entries recommended to avoid visible repetition.
	ThinkingVerbs []string

	// ColdStart is shown before the first chunk arrives.
	ColdStart string

	// Stall5s is shown when 5+ seconds have passed since the last
	// chunk but streaming is still live. Signals "slow but alive".
	Stall5s string

	// Stall15s is shown when 15+ seconds have passed since the last
	// chunk. Signals "probably remote / safe to cancel".
	Stall15s string
}

// HanimoDefaultPersona is hanimo's default flavour text — neutral,
// Korean-first, no mascot. Forks can drop a different Persona for a
// themed re-skin (e.g. a robot variant for a downstream fork) by assigning
// ActivePersona in main.go without touching any caller.
var HanimoDefaultPersona = Persona{
	Name:  "hanimo-default",
	Emoji: "",
	ThinkingVerbs: []string{
		"생각하는 중",
		"분석 중",
		"작업 중",
		"정리 중",
		"검토 중",
	},
	ColdStart: "연결 중",
	Stall5s:   "응답 준비 중... 조금 오래 걸리네요",
	Stall15s:  "응답 지연 — 네트워크 또는 모델 부하일 수 있습니다",
}

// ActivePersona is the persona currently mounted on this binary. Code
// reads flavour strings through this variable; swap the pointer in an
// init() or main.go of a fork to re-skin without touching callers.
var ActivePersona = HanimoDefaultPersona

// ThinkingVerbFor returns the rotating thinking verb at the given
// elapsed-seconds offset. Empty verb list falls back to ColdStart.
func ThinkingVerbFor(elapsedSeconds float64) string {
	verbs := ActivePersona.ThinkingVerbs
	if len(verbs) == 0 {
		return ActivePersona.ColdStart
	}
	idx := int(elapsedSeconds/2) % len(verbs)
	if idx < 0 {
		idx = 0
	}
	return verbs[idx]
}

// FormatToolDiff produces a visual diff block for file_edit / file_write
// calls by parsing the tool-call arguments JSON. When the args don't
// include an old_string/new_string pair (e.g. file_write creating a
// fresh file) it falls back to a simple "+N lines written" summary.
func FormatToolDiff(name, argsJSON, output string) string {
	if name != "file_edit" && name != "file_write" {
		return ""
	}
	var args struct {
		Path      string `json:"path"`
		OldString string `json:"old_string"`
		NewString string `json:"new_string"`
		Content   string `json:"content"`
	}
	if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
		return ""
	}

	header := "<< " + name
	if args.Path != "" {
		header += " " + args.Path
	}

	// file_write: no diff, just a terse summary.
	if name == "file_write" {
		lineCount := 1 + strings.Count(args.Content, "\n")
		return header + "\n  │ +" + itoa(lineCount) + "줄 새로 작성"
	}

	// file_edit: show old_string (as removed) and new_string (as added)
	// with line prefixes. Cap each side at ~8 lines to keep tidy.
	const maxSide = 8
	oldLines := splitLinesKeep(args.OldString)
	newLines := splitLinesKeep(args.NewString)
	trimmedOld := false
	trimmedNew := false
	if len(oldLines) > maxSide {
		oldLines = oldLines[:maxSide]
		trimmedOld = true
	}
	if len(newLines) > maxSide {
		newLines = newLines[:maxSide]
		trimmedNew = true
	}

	var b []string
	b = append(b, header)
	b = append(b, "  │ −"+itoa(len(splitLinesKeep(args.OldString)))+"줄  +"+itoa(len(splitLinesKeep(args.NewString)))+"줄")
	for _, l := range oldLines {
		b = append(b, "  │ − "+trimRunes(l, 150))
	}
	if trimmedOld {
		b = append(b, "  │ −  ⋯ (더 있음)")
	}
	for _, l := range newLines {
		b = append(b, "  │ + "+trimRunes(l, 150))
	}
	if trimmedNew {
		b = append(b, "  │ +  ⋯ (더 있음)")
	}
	return joinNL(b)
}

// FormatToolResult renders a tool result with auto-collapsing so long
// outputs (file reads, shell output) don't flood the viewport. Single
// and short results display verbatim; anything over maxLines shows the
// first headLines and last tailLines with a compact ellipsis note.
//
// Output format (multi-line, already prefixed with leading spaces so
// RenderMessages can emit each line as a RoleTool row):
//
//   << name (N lines)
//   │ line 1
//   │ line 2
//   │ ⋯ +37 lines
//   │ line 40
//   │ line 41
func FormatToolResult(name, output string) string {
	const (
		maxLines  = 15
		headLines = 6
		tailLines = 4
	)
	raw := splitLinesKeep(output)
	total := len(raw)
	if total == 0 {
		return "<< " + name + ": (빈 결과)"
	}

	var b []string
	if total <= maxLines {
		b = append(b, "<< "+name)
		for _, l := range raw {
			b = append(b, "  │ "+trimRunes(l, 160))
		}
		return joinNL(b)
	}

	b = append(b, "<< "+name+" ("+formatLineCount(total)+")")
	for _, l := range raw[:headLines] {
		b = append(b, "  │ "+trimRunes(l, 160))
	}
	omitted := total - headLines - tailLines
	b = append(b, "  │ ⋯ +"+formatLineCount(omitted)+" 생략")
	for _, l := range raw[total-tailLines:] {
		b = append(b, "  │ "+trimRunes(l, 160))
	}
	return joinNL(b)
}

// splitLinesKeep splits on \n without emitting an empty trailing line.
func splitLinesKeep(s string) []string {
	lines := []string{}
	cur := ""
	for _, r := range s {
		if r == '\n' {
			lines = append(lines, cur)
			cur = ""
			continue
		}
		cur += string(r)
	}
	if cur != "" {
		lines = append(lines, cur)
	}
	return lines
}

func joinNL(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += "\n"
		}
		out += p
	}
	return out
}

func trimRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

func formatLineCount(n int) string {
	return itoa(n) + "줄"
}

func itoa(n int) string {
	// Tiny inline strconv to avoid pulling strconv into this file.
	if n == 0 {
		return "0"
	}
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	buf := [20]byte{}
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
