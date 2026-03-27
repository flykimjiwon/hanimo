/**
 * Lightweight terminal markdown renderer using ANSI escape codes.
 * No external dependencies. Handles the most common markdown patterns
 * found in LLM output: headers, code blocks, bold, inline code, lists.
 */

// ANSI helpers
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const ITALIC = '\x1b[3m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';
const BG_GRAY = '\x1b[48;5;236m';

function renderInline(line: string): string {
  // Bold: **text** or __text__
  line = line.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`);
  line = line.replace(/__(.+?)__/g, `${BOLD}$1${RESET}`);

  // Italic: *text* or _text_ (but not inside words with underscores)
  line = line.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, `${ITALIC}$1${RESET}`);

  // Inline code: `code`
  line = line.replace(/`([^`]+?)`/g, `${BG_GRAY}${CYAN} $1 ${RESET}`);

  // Links: [text](url) → text (url)
  line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `${CYAN}$1${RESET} ${DIM}($2)${RESET}`);

  return line;
}

export function renderMarkdown(text: string): string {
  const lines = text.split('\n');
  const output: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Code block fence
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        const lang = line.trimStart().slice(3).trim();
        const label = lang ? ` ${lang} ` : '';
        output.push(`${DIM}┌──${label}${'─'.repeat(Math.max(0, 40 - label.length))}${RESET}`);
        continue;
      } else {
        inCodeBlock = false;
        output.push(`${DIM}└${'─'.repeat(43)}${RESET}`);
        continue;
      }
    }

    // Inside code block — no formatting, just dim border
    if (inCodeBlock) {
      output.push(`${DIM}│${RESET} ${line}`);
      continue;
    }

    // Headers
    const h3 = line.match(/^### (.+)/);
    if (h3) {
      output.push(`${YELLOW}${BOLD}   ${h3[1]}${RESET}`);
      continue;
    }
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      output.push(`${MAGENTA}${BOLD}  ${h2[1]}${RESET}`);
      continue;
    }
    const h1 = line.match(/^# (.+)/);
    if (h1) {
      output.push(`${GREEN}${BOLD}${h1[1]}${RESET}`);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      output.push(`${DIM}${'─'.repeat(44)}${RESET}`);
      continue;
    }

    // Unordered list items
    const ul = line.match(/^(\s*)[*-] (.+)/);
    if (ul) {
      const indent = ul[1] ?? '';
      output.push(`${indent}${DIM}•${RESET} ${renderInline(ul[2] ?? '')}`);
      continue;
    }

    // Ordered list items
    const ol = line.match(/^(\s*)\d+\. (.+)/);
    if (ol) {
      const indent = ol[1] ?? '';
      const num = line.match(/^(\s*)(\d+)\./);
      output.push(`${indent}${DIM}${num?.[2] ?? '1'}.${RESET} ${renderInline(ol[2] ?? '')}`);
      continue;
    }

    // Regular line with inline formatting
    output.push(renderInline(line));
  }

  // If code block never closed, close it
  if (inCodeBlock) {
    output.push(`${DIM}└${'─'.repeat(43)}${RESET}`);
  }

  return output.join('\n');
}
