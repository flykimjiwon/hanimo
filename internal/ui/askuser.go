package ui

import (
	"fmt"
	"strings"

	"charm.land/lipgloss/v2"
)

// RenderAskUser renders an interactive choice/confirm question box.
func RenderAskUser(question string, options []string, selected int, width int) string {
	boxWidth := min(width-4, 72)
	if boxWidth < 20 {
		boxWidth = 20
	}
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#F9E2AF")).
		Padding(1, 2).
		Width(boxWidth)

	title := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#F9E2AF")).
		Bold(true).
		Render("💬 AI asks")

	qStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#CDD6F4"))

	var b strings.Builder
	b.WriteString(title)
	b.WriteString("\n\n")
	b.WriteString(qStyle.Render(question))
	b.WriteString("\n\n")

	for i, opt := range options {
		marker := "  "
		style := lipgloss.NewStyle().Foreground(lipgloss.Color("#A6ADC8"))
		if i == selected {
			marker = "→ "
			style = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#F9E2AF")).
				Bold(true)
		}
		b.WriteString(style.Render(fmt.Sprintf("%s[%d] %s", marker, i+1, opt)))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	hint := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#6C7086")).
		Render("↑↓ navigate · Enter confirm · Esc skip · 1-9 quick")
	b.WriteString(hint)

	return boxStyle.Render(b.String())
}

// RenderAskText renders a free-text ASK_USER input.
func RenderAskText(question, input string, width int) string {
	boxWidth := min(width-4, 72)
	if boxWidth < 20 {
		boxWidth = 20
	}
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#F9E2AF")).
		Padding(1, 2).
		Width(boxWidth)

	title := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#F9E2AF")).
		Bold(true).
		Render("💬 AI asks")

	qStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#CDD6F4"))

	var b strings.Builder
	b.WriteString(title)
	b.WriteString("\n\n")
	b.WriteString(qStyle.Render(question))
	b.WriteString("\n\n")

	inputWidth := min(boxWidth-6, 60)
	if inputWidth < 10 {
		inputWidth = 10
	}
	inputBox := lipgloss.NewStyle().
		Border(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("#6C7086")).
		Padding(0, 1).
		Width(inputWidth)

	cursor := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#F9E2AF")).
		Render("█")
	b.WriteString(inputBox.Render(input + cursor))
	b.WriteString("\n\n")

	hint := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#6C7086")).
		Render("Enter confirm · Esc skip")
	b.WriteString(hint)

	return boxStyle.Render(b.String())
}

// RenderDangerConfirm renders a confirmation prompt for a dangerous command.
func RenderDangerConfirm(command, reason string, selected int, width int) string {
	boxWidth := min(width-4, 72)
	if boxWidth < 20 {
		boxWidth = 20
	}
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#F38BA8")).
		Padding(1, 2).
		Width(boxWidth)

	title := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#F38BA8")).
		Bold(true).
		Render("⚠  Dangerous operation")

	cmdStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#F9E2AF")).
		Bold(true)
	reasonStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#A6ADC8"))

	var b strings.Builder
	b.WriteString(title)
	b.WriteString("\n\n")
	if reason != "" {
		b.WriteString(reasonStyle.Render(reason))
		b.WriteString("\n")
	}
	b.WriteString(cmdStyle.Render("$ " + command))
	b.WriteString("\n\n")

	options := []string{"Allow once", "Deny"}
	for i, opt := range options {
		marker := "  "
		style := lipgloss.NewStyle().Foreground(lipgloss.Color("#A6ADC8"))
		if i == selected {
			marker = "→ "
			style = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#F38BA8")).
				Bold(true)
		}
		b.WriteString(style.Render(fmt.Sprintf("%s[%d] %s", marker, i+1, opt)))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	hint := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#6C7086")).
		Render("↑↓ navigate · Enter confirm · Esc deny")
	b.WriteString(hint)

	return boxStyle.Render(b.String())
}
