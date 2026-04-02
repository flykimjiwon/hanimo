import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

// Mascot: 하니(honey bee) + 모돌(bichon puppy) fusion — pixel art style
const MASCOT_LINES = [
  '  ▄▀▀▀▀▄ ',
  '  █◕ᴥ◕ █ ',
  '  ▀▄▄▄▄▀ ',
  '  ≋█  █≋ ',
  '    ▀▀   ',
];

// Compact mascot for narrow terminals
const MASCOT_COMPACT = [
  '▄▀▀▀▀▄',
  '█◕ᴥ◕ █',
];

// ASCII art — fits within 52 columns
const LOGO_LINES = [
  ' ██   ██  █████  ███   ██ ██ ███   ███  ██████ ',
  ' ██   ██ ██   ██ ████  ██ ██ ████ ████ ██    ██',
  ' ███████ ███████ ██ ██ ██ ██ ██ ███ ██ ██    ██',
  ' ██   ██ ██   ██ ██  ████ ██ ██     ██ ██    ██',
  ' ██   ██ ██   ██ ██   ███ ██ ██     ██  ██████ ',
];

// Compact version for narrow terminals (< 60 cols)
const LOGO_COMPACT = [
  ' ╻ ╻┏━┓┏┓╻╻┏┳┓┏━┓',
  ' ┣━┫┣━┫┃┗┫┃┃┃┃┃ ┃',
  ' ╹ ╹╹ ╹╹ ╹╹╹ ╹┗━┛',
];

/**
 * 10 banner color schemes — one per TUI theme.
 * Each has 5 gradient colors (one per logo line) + 3 for compact.
 * 하니모 = "honey" + warm/friendly — reflected in the default scheme.
 */
export const BANNER_SCHEMES: Record<string, { full: string[]; compact: string[] }> = {
  // 1. Honey Gold (하니 = 꿀) — 따뜻한 꿀빛 앰버/골드
  catppuccin: {
    full: ['#F9E2AF', '#FAB387', '#F5C890', '#EBA06D', '#CBA6F7'],
    compact: ['#F9E2AF', '#FAB387', '#CBA6F7'],
  },
  // 2. Ocean Breeze — 시원한 바다 블루 그라디언트
  'tokyo-night': {
    full: ['#7AA2F7', '#7DCFFF', '#73C8E2', '#2AC3DE', '#BB9AF7'],
    compact: ['#7AA2F7', '#7DCFFF', '#BB9AF7'],
  },
  // 3. Night Bloom — 밤꽃 퍼플/핑크
  dracula: {
    full: ['#FF79C6', '#BD93F9', '#D6ACFF', '#FF92DF', '#8BE9FD'],
    compact: ['#FF79C6', '#BD93F9', '#8BE9FD'],
  },
  // 4. Frost — 얼음 같은 차가운 블루
  nord: {
    full: ['#88C0D0', '#81A1C1', '#5E81AC', '#B48EAD', '#A3BE8C'],
    compact: ['#88C0D0', '#5E81AC', '#A3BE8C'],
  },
  // 5. Autumn Warm — 가을 단풍 따뜻한 톤
  gruvbox: {
    full: ['#FABD2F', '#FE8019', '#D65D0E', '#CC241D', '#B8BB26'],
    compact: ['#FABD2F', '#FE8019', '#B8BB26'],
  },
  // 6. Solar Glow — 태양빛 오렌지/옐로
  solarized: {
    full: ['#B58900', '#CB4B16', '#DC322F', '#D33682', '#268BD2'],
    compact: ['#B58900', '#CB4B16', '#268BD2'],
  },
  // 7. Twilight — 황혼 블루→퍼플
  'one-dark': {
    full: ['#61AFEF', '#56B6C2', '#C678DD', '#E06C75', '#98C379'],
    compact: ['#61AFEF', '#C678DD', '#98C379'],
  },
  // 8. Neon Pulse — 사이버펑크 네온
  cyberpunk: {
    full: ['#FF2079', '#FF6AC1', '#00D4FF', '#00FF9C', '#FFD700'],
    compact: ['#FF2079', '#00D4FF', '#00FF9C'],
  },
  // 9. Silver — 클린 모노크롬
  minimal: {
    full: ['#FFFFFF', '#D0D0D0', '#A0A0A0', '#808080', '#C0C0C0'],
    compact: ['#FFFFFF', '#A0A0A0', '#C0C0C0'],
  },
  // 10. Emerald — 자연 숲 그린
  forest: {
    full: ['#A5D6A7', '#81C784', '#66BB6A', '#4CAF50', '#80CBC4'],
    compact: ['#A5D6A7', '#66BB6A', '#80CBC4'],
  },
};

// Fallback gradient (used when theme ID doesn't match)
const DEFAULT_SCHEME = BANNER_SCHEMES['catppuccin']!;

interface BannerProps {
  version?: string;
  tagline?: string;
  cols?: number;
  themeId?: string;
}

export const Banner = React.memo(function Banner({
  version = '0.1.0',
  tagline,
  cols = 80,
  themeId,
}: BannerProps): React.ReactElement {
  const useCompact = cols < 60;
  const logoLines = useCompact ? LOGO_COMPACT : LOGO_LINES;
  const mascotLines = useCompact ? MASCOT_COMPACT : MASCOT_LINES;
  const scheme = (themeId ? BANNER_SCHEMES[themeId] : undefined) ?? DEFAULT_SCHEME;
  const gradient = useCompact ? scheme.compact : scheme.full;
  const showInline = cols >= 75; // Show mascot inline with logo if wide enough

  return (
    <Box flexDirection="column" alignItems="center" width="100%" paddingTop={1}>
      {showInline ? (
        /* Wide layout: mascot left + logo right */
        <Box justifyContent="center" width="100%">
          <Box flexDirection="column" marginRight={2}>
            {mascotLines.map((line, i) => (
              <Text key={`m${i}`} color={gradient[i % gradient.length]}>{line}</Text>
            ))}
          </Box>
          <Box flexDirection="column">
            {logoLines.map((line, i) => (
              <Text key={`l${i}`} color={gradient[i % gradient.length]} bold>{line}</Text>
            ))}
          </Box>
        </Box>
      ) : (
        /* Narrow layout: mascot above logo */
        <>
          {mascotLines.map((line, i) => (
            <Box key={`m${i}`} justifyContent="center" width="100%">
              <Text color={gradient[i % gradient.length]}>{line}</Text>
            </Box>
          ))}
          {logoLines.map((line, i) => (
            <Box key={`l${i}`} justifyContent="center" width="100%">
              <Text color={gradient[i % gradient.length]} bold>{line}</Text>
            </Box>
          ))}
        </>
      )}
      {/* Version/tagline removed — keep banner clean */}
    </Box>
  );
});
