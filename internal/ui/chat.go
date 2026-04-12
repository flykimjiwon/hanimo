package ui

import (
	"fmt"
	"strings"
	"time"

	"charm.land/glamour/v2"
	"charm.land/lipgloss/v2"
)

type Role int

const (
	RoleUser Role = iota
	RoleAssistant
	RoleSystem
	RoleTool
)

type Message struct {
	Role      Role
	Content   string
	Timestamp time.Time
	Tag       string // optional tag for filtering (e.g. "modebox")
}

// Q/A accent styling. User messages get a very subtle tinted block;
// assistant replies get only a left accent bar (no background) so long
// answers don't look like a giant colored wall. Forks can swap either
// constant to re-theme without touching renderers.
var (
	// userBlockBg is intentionally close to the terminal default so
	// the tint reads as a whisper rather than a UI block.
	userBlockBg = lipgloss.Color("#1A1409")
)

// renderUserBlock wraps a user message in a subtly tinted, left-bar
// accented block: honey-gold bar + amber background + 🐝 label.
func renderUserBlock(content string, width int) string {
	barStyle := lipgloss.NewStyle().
		Foreground(ColorPrimary).
		Background(userBlockBg).
		Bold(true)
	textStyle := lipgloss.NewStyle().
		Foreground(ColorText).
		Background(userBlockBg)
	blockWidth := width - 2
	if blockWidth < 20 {
		blockWidth = 20
	}
	wrapped := wrapText(content, blockWidth-4)
	var out []string
	for i, line := range strings.Split(wrapped, "\n") {
		bar := "  ▌ "
		if i == 0 {
			bar = "  ▌ "
		}
		padded := line
		displayW := lipgloss.Width(line)
		if displayW < blockWidth-4 {
			padded = line + strings.Repeat(" ", blockWidth-4-displayW)
		}
		out = append(out, barStyle.Render(bar)+textStyle.Render(padded))
	}
	return strings.Join(out, "\n")
}

// renderAssistantBlock prefixes markdown-rendered assistant content
// with a muted left accent bar — no background fill, so long answers
// stay readable and the viewport doesn't turn into a solid color wall.
func renderAssistantBlock(rendered string, width int) string {
	barStyle := lipgloss.NewStyle().Foreground(ColorAccent)
	var out []string
	for _, line := range strings.Split(rendered, "\n") {
		out = append(out, barStyle.Render("  ▎ ")+line)
	}
	return strings.Join(out, "\n")
}

func RenderMessages(messages []Message, streaming string, width int) string {
	var lines []string
	contentWidth := width - 6

	for _, msg := range messages {
		switch msg.Role {
		case RoleUser:
			// User messages get a tinted block with an accent bar so
			// they're instantly distinguishable from assistant replies
			// without relying solely on the "  > " prefix.
			block := renderUserBlock(msg.Content, contentWidth)
			lines = append(lines, block)
		case RoleAssistant:
			rendered := renderMarkdown(msg.Content, contentWidth-4)
			msgLines := strings.Split(rendered, "\n")
			// Show line count for long messages
			if len(msgLines) > 20 {
				countStyle := lipgloss.NewStyle().Foreground(ColorMuted)
				lines = append(lines, countStyle.Render(fmt.Sprintf("  [%d lines]", len(msgLines))))
			}
			lines = append(lines, renderAssistantBlock(rendered, contentWidth))
			lines = append(lines, "")
			continue
		case RoleSystem:
			wrapped := wrapText(msg.Content, contentWidth)
			for _, line := range strings.Split(wrapped, "\n") {
				lines = append(lines, SystemMsg.Render("  "+line))
			}
			lines = append(lines, "")
			continue
		case RoleTool:
			// Tool result: can be multi-line (see FormatToolResult).
			// Render each line in the accent color so long outputs stay
			// visually tied together.
			toolStyle := lipgloss.NewStyle().Foreground(ColorAccent)
			for _, rawLine := range strings.Split(msg.Content, "\n") {
				wrapped := wrapText(rawLine, contentWidth-2)
				for _, l := range strings.Split(wrapped, "\n") {
					lines = append(lines, toolStyle.Render("  "+l))
				}
			}
		}
		lines = append(lines, "")
	}

	if streaming != "" {
		thinkStyle := lipgloss.NewStyle().Foreground(ColorPrimary).Bold(true)
		lines = append(lines, "")
		lines = append(lines, thinkStyle.Render("  "+streaming))
	}

	return strings.Join(lines, "\n")
}

// RenderStatusBar renders the bottom status bar.
// Variadic extras (all optional, positional):
//   [0] autoMode (bool) — show [AUTO] badge when true
//   [1] planProgress (string) — non-empty renders as "Plan X/Y"
func RenderStatusBar(model string, tokens int, elapsed time.Duration, mode int, cwd string, width int, debug bool, toolCount int, extras ...interface{}) string {
	modeStyle := lipgloss.NewStyle().
		Foreground(ModeColor(mode)).
		Bold(true)

	modeName := Tabs[mode].Name
	// Show full provider/model (e.g. "ollama/qwen3:8b")
	left := modeStyle.Render("  "+modeName) +
		Subtle.Render("  "+model) +
		Subtle.Render("  ./"+cwd)

	if debug {
		debugStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#F87171")).Bold(true)
		left += debugStyle.Render("  [DEBUG]")
	}

	if toolCount > 0 {
		toolStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#34D399")).Bold(true)
		left += toolStyle.Render(fmt.Sprintf("  %s(%d)", T().ToolOn, toolCount))
	} else {
		toolOffStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#F87171")).Bold(true)
		left += toolOffStyle.Render("  " + T().ToolOff)
	}

	if len(extras) > 0 {
		if auto, ok := extras[0].(bool); ok && auto {
			autoStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#FBBF24")).Bold(true)
			left += autoStyle.Render("  [AUTO]")
		}
	}
	if len(extras) > 1 {
		if planProgress, ok := extras[1].(string); ok && planProgress != "" {
			planStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#60A5FA")).Bold(true)
			left += planStyle.Render(fmt.Sprintf("  Plan %s", planProgress))
		}
	}

	if tokens > 0 {
		left += Subtle.Render(fmt.Sprintf("  %dtok", tokens))
	}
	if elapsed > 0 {
		left += Subtle.Render(fmt.Sprintf("  %.1fs", elapsed.Seconds()))
	}

	t := T()
	right := Subtle.Render(t.NewLine + "  " + t.SwitchMode + "  " + t.Menu + "  " + t.Exit + " ")

	gap := width - lipgloss.Width(left) - lipgloss.Width(right) - 2
	if gap < 1 {
		gap = 1
	}

	return lipgloss.NewStyle().
		Background(lipgloss.Color("#1E1E2E")).
		Width(width).
		Render(left + strings.Repeat(" ", gap) + right)
}

// renderMarkdown renders markdown content using glamour (dark theme).
func renderMarkdown(content string, width int) string {
	if width < 20 {
		width = 20
	}
	r, err := glamour.NewTermRenderer(
		glamour.WithStylePath("dark"),
		glamour.WithWordWrap(width),
	)
	if err != nil {
		return wrapText(content, width)
	}
	out, err := r.Render(content)
	if err != nil {
		return wrapText(content, width)
	}
	return strings.TrimRight(out, "\n")
}

func wrapText(text string, width int) string {
	if width <= 0 {
		return text
	}
	var result strings.Builder
	lines := strings.Split(text, "\n")
	for i, line := range lines {
		if i > 0 {
			result.WriteString("\n")
		}
		// Use display width (handles CJK double-width characters correctly)
		if lipgloss.Width(line) <= width {
			result.WriteString(line)
			continue
		}
		runes := []rune(line)
		cur := 0 // current display width
		start := 0
		for j, r := range runes {
			rw := lipgloss.Width(string(r))
			if cur+rw > width {
				result.WriteString(string(runes[start:j]))
				result.WriteString("\n")
				start = j
				cur = rw
			} else {
				cur += rw
			}
		}
		if start < len(runes) {
			result.WriteString(string(runes[start:]))
		}
	}
	return result.String()
}
