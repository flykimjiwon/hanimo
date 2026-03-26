// Catppuccin Mocha — color-blind tested palette
// https://catppuccin.com/palette

export const theme = {
  // Base
  base: '#1E1E2E',
  mantle: '#181825',
  crust: '#11111B',
  surface0: '#313244',
  surface1: '#45475A',
  surface2: '#585B70',
  overlay0: '#6C7086',
  overlay1: '#7F849C',
  text: '#CDD6F4',
  subtext0: '#A6ADC8',
  subtext1: '#BAC2DE',

  // Accent colors
  rosewater: '#F5E0DC',  // user input
  blue: '#89B4FA',        // AI assistant, primary
  green: '#A6E3A1',       // success, file writes
  red: '#F38BA8',         // errors, rejection
  yellow: '#F9E2AF',      // warnings, cost
  mauve: '#CBA6F7',       // tool calls, functions
  teal: '#94E2D5',        // info, streaming indicator
  peach: '#FAB387',       // highlights
  lavender: '#B4BEFE',    // borders, frames
  flamingo: '#F2CDCD',    // secondary accent
  sky: '#89DCEB',         // links, hints
} as const;

// Semantic color mapping
export const colors = {
  userText: theme.rosewater,
  assistantText: theme.text,
  toolCall: theme.mauve,
  toolResult: theme.overlay0,
  error: theme.red,
  success: theme.green,
  warning: theme.yellow,
  cost: theme.yellow,
  provider: theme.green,
  model: theme.blue,
  border: theme.surface1,
  borderFocus: theme.lavender,
  dimText: theme.overlay0,
  statusIdle: theme.green,
  statusThinking: theme.teal,
  statusTool: theme.mauve,
  hint: theme.sky,
  prompt: theme.green,
  promptDisabled: theme.overlay0,
} as const;
