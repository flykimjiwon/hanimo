package ui

import (
	"strings"

	"charm.land/lipgloss/v2"
)

type TabItem struct {
	Name string
}

var Tabs = []TabItem{
	{Name: "Super"},
	{Name: "Deep Agent"},
	{Name: "Plan"},
}

func RenderTabBar(activeIdx int, width int) string {
	var tabs []string

	for i, tab := range Tabs {
		label := " " + tab.Name + " "
		if i == activeIdx {
			style := lipgloss.NewStyle().
				Bold(true).
				Foreground(lipgloss.Color("#CDD6F4")).
				Background(lipgloss.Color("#313244")).
				Padding(0, 1)
			tabs = append(tabs, style.Render(label))
		} else {
			style := lipgloss.NewStyle().
				Foreground(ColorMuted).
				Padding(0, 1)
			tabs = append(tabs, style.Render(label))
		}
	}

	hint := Subtle.Render("  Tab")
	row := strings.Join(tabs, "") + hint

	return lipgloss.NewStyle().
		Background(lipgloss.Color("#1E1E2E")).
		Width(width).
		Render(row)
}
