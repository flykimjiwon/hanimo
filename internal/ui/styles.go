package ui

import (
	"image/color"

	"charm.land/lipgloss/v2"
)

var (
	// Colors — hanimo warm honey palette
	ColorPrimary   = lipgloss.Color("#F9E2AF") // honey gold
	ColorSecondary = lipgloss.Color("#FAB387") // warm peach
	ColorAccent    = lipgloss.Color("#CBA6F7") // lavender accent
	ColorSuccess   = lipgloss.Color("#A6E3A1") // mint green
	ColorError     = lipgloss.Color("#F38BA8") // soft red
	ColorMuted     = lipgloss.Color("#6C7086") // overlay
	ColorBg        = lipgloss.Color("#1E1E2E") // mocha base
	ColorBgLight   = lipgloss.Color("#313244") // mocha surface0
	ColorText      = lipgloss.Color("#CDD6F4") // text
	ColorTextDim   = lipgloss.Color("#A6ADC8") // subtext

	// Tab styles
	ActiveTab = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#0F172A")).
			Padding(0, 2)

	InactiveTab = lipgloss.NewStyle().
			Foreground(ColorTextDim).
			Background(ColorBgLight).
			Padding(0, 2)

	// Tab bar container
	TabBar = lipgloss.NewStyle().
		Background(ColorBgLight).
		Padding(0, 1)

	// Message styles
	UserMsg = lipgloss.NewStyle().
		Foreground(ColorSecondary).
		Bold(true)

	AssistantMsg = lipgloss.NewStyle().
			Foreground(ColorText)

	SystemMsg = lipgloss.NewStyle().
			Foreground(ColorMuted).
			Italic(true)

	ErrorMsg = lipgloss.NewStyle().
			Foreground(ColorError).
			Bold(true)

	// Status bar
	StatusBar = lipgloss.NewStyle().
			Background(ColorBgLight).
			Foreground(ColorTextDim).
			Padding(0, 1)

	StatusModel = lipgloss.NewStyle().
			Foreground(ColorAccent).
			Bold(true)

	StatusTokens = lipgloss.NewStyle().
			Foreground(ColorSuccess)

	// Input area
	InputStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(ColorPrimary).
			Padding(0, 1)

	InputPrompt = lipgloss.NewStyle().
			Foreground(ColorPrimary).
			Bold(true)

	// General
	Title = lipgloss.NewStyle().
		Foreground(ColorPrimary).
		Bold(true)

	Subtle = lipgloss.NewStyle().
		Foreground(ColorMuted)

	// Setup wizard styles
	SetupTitle = lipgloss.NewStyle().
			Foreground(ColorPrimary).
			Bold(true).
			Padding(1, 2)

	SetupLabel = lipgloss.NewStyle().
			Foreground(ColorText).
			Bold(true)

	SetupHint = lipgloss.NewStyle().
			Foreground(ColorMuted).
			Italic(true)

	SetupSuccess = lipgloss.NewStyle().
			Foreground(ColorSuccess).
			Bold(true)

	// Mode-specific accent colors
	SuperColor = lipgloss.Color("#F9E2AF") // honey gold
	DevColor   = lipgloss.Color("#A6E3A1") // mint green
	PlanColor  = lipgloss.Color("#FAB387") // peach
)

func ModeColor(mode int) color.Color {
	switch mode {
	case 0:
		return SuperColor
	case 1:
		return DevColor
	case 2:
		return PlanColor
	default:
		return SuperColor
	}
}
