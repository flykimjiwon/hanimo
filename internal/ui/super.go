package ui

import (
	"fmt"
	"strings"

	"charm.land/lipgloss/v2"
)

var mascotLines = []string{
	`  ▄▀▀▀▀▄ `,
	`  █◕ᴥ◕ █ `,
	`  ▀▄▄▄▄▀ `,
	`  ≋█  █≋ `,
	`    ▀▀   `,
}

var logoLines = []string{
	" ██   ██  █████  ███   ██ ██ ███   ███  ██████ ",
	" ██   ██ ██   ██ ████  ██ ██ ████ ████ ██    ██",
	" ███████ ███████ ██ ██ ██ ██ ██ ███ ██ ██    ██",
	" ██   ██ ██   ██ ██  ████ ██ ██     ██ ██    ██",
	" ██   ██ ██   ██ ██   ███ ██ ██     ██  ██████ ",
}

// CODE subtitle block (smaller than HANIMO, rendered below with divider)
var codeLines = []string{
	"         ██████  ██████  ██████  ███████       ",
	"        ██      ██    ██ ██   ██ ██            ",
	"        ██      ██    ██ ██   ██ █████         ",
	"        ██      ██    ██ ██   ██ ██            ",
	"         ██████  ██████  ██████  ███████       ",
}

const logoDivider = " ───────────────────────────────────────────── "

func RenderLogo() string {
	// Honey gold gradient for logo lines
	logoColors := []string{"#F9E2AF", "#FAB387", "#F5C890", "#EBA06D", "#CBA6F7"}
	mascotColor := lipgloss.NewStyle().Foreground(lipgloss.Color("#F9E2AF")).Bold(true)

	var b strings.Builder

	// Render mascot + logo side by side if both fit, else stacked
	mascotWidth := 0
	for _, line := range mascotLines {
		w := lipgloss.Width(line)
		if w > mascotWidth {
			mascotWidth = w
		}
	}

	// Side-by-side layout: mascot on left, logo on right
	maxLines := len(logoLines)
	if len(mascotLines) > maxLines {
		maxLines = len(mascotLines)
	}

	// Pad mascot to align with logo vertically (center mascot)
	mascotOffset := 0
	if len(mascotLines) < len(logoLines) {
		mascotOffset = (len(logoLines) - len(mascotLines)) / 2
	}

	for i := 0; i < maxLines; i++ {
		// Mascot part
		mascotIdx := i - mascotOffset
		if mascotIdx >= 0 && mascotIdx < len(mascotLines) {
			b.WriteString(mascotColor.Render(mascotLines[mascotIdx]))
		} else {
			b.WriteString(fmt.Sprintf("%-*s", mascotWidth, ""))
		}
		b.WriteString("  ") // gap between mascot and logo

		// Logo part
		if i < len(logoLines) {
			clr := logoColors[i%len(logoColors)]
			style := lipgloss.NewStyle().Foreground(lipgloss.Color(clr)).Bold(true)
			b.WriteString(style.Render(logoLines[i]))
		}

		if i < maxLines-1 {
			b.WriteString("\n")
		}
	}

	// Divider line beneath HANIMO (aligned with logo, mascot column empty)
	dividerStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#6C7086"))
	b.WriteString("\n")
	b.WriteString(fmt.Sprintf("%-*s", mascotWidth, ""))
	b.WriteString("  ")
	b.WriteString(dividerStyle.Render(logoDivider))

	// CODE block beneath divider, aligned with HANIMO (mascot column empty)
	codeColors := []string{"#CBA6F7", "#B4A5F5", "#A196F2", "#8B87F0", "#7678ED"}
	for i, line := range codeLines {
		b.WriteString("\n")
		b.WriteString(fmt.Sprintf("%-*s", mascotWidth, ""))
		b.WriteString("  ")
		clr := codeColors[i%len(codeColors)]
		style := lipgloss.NewStyle().Foreground(lipgloss.Color(clr)).Bold(true)
		b.WriteString(style.Render(line))
	}
	return b.String()
}

func ModeWelcome(mode int, modelID string) string {
	var b strings.Builder

	b.WriteString(RenderLogo())
	b.WriteString("\n\n")

	b.WriteString(modeInfoBoxInner(mode, modelID))

	return b.String()
}

// ModeInfoBox renders just the mode description box (no logo).
func ModeInfoBox(mode int, modelID string) string {
	return modeInfoBoxInner(mode, modelID)
}

func modeInfoBoxInner(mode int, modelID string) string {
	// Strip provider prefix (e.g. "google/gemma-4-31b-it" → "gemma-4-31b-it")
	shortModel := modelID
	if idx := strings.LastIndex(modelID, "/"); idx >= 0 {
		shortModel = modelID[idx+1:]
	}
	modeClr := ModeColor(mode)
	modeName := lipgloss.NewStyle().Foreground(modeClr).Bold(true)
	desc := lipgloss.NewStyle().Foreground(ColorText)

	tipStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#9CA3AF")).
		Padding(0, 1).
		Width(55)

	var tips string
	switch mode {
	case 0:
		tips = fmt.Sprintf("%s\n%s",
			modeName.Render(fmt.Sprintf("Super — %s", shortModel)),
			desc.Render("Smart all-in-one. Auto-detects intent (chat/plan/deep)"),
		)
	case 1:
		tips = fmt.Sprintf("%s\n%s",
			modeName.Render(fmt.Sprintf("Deep Agent — %s", shortModel)),
			desc.Render("Long-running autonomous coding. Up to 100 iterations"),
		)
	case 2:
		tips = fmt.Sprintf("%s\n%s",
			modeName.Render(fmt.Sprintf("Plan — %s", shortModel)),
			desc.Render("Plan-first. Creates step-by-step plan, executes on approval"),
		)
	}
	return tipStyle.Render(tips)
}
