/**
 * Terminal markdown renderer with syntax highlighting.
 * No external dependencies. Handles common markdown + code blocks
 * with keyword-based syntax coloring for popular languages.
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

// Language keyword sets
const JS_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'class', 'extends', 'new', 'this', 'import', 'export', 'from', 'default',
  'async', 'await', 'try', 'catch', 'throw', 'typeof', 'instanceof',
  'switch', 'case', 'break', 'continue', 'do', 'in', 'of', 'yield',
  'interface', 'type', 'enum', 'implements', 'abstract', 'readonly',
  'public', 'private', 'protected', 'static', 'super', 'void',
]);

const PYTHON_KEYWORDS = new Set([
  'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'import',
  'from', 'as', 'try', 'except', 'finally', 'with', 'raise', 'pass',
  'lambda', 'yield', 'global', 'nonlocal', 'assert', 'del', 'in', 'not',
  'and', 'or', 'is', 'async', 'await', 'break', 'continue',
]);

const BASH_KEYWORDS = new Set([
  'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done',
  'case', 'esac', 'function', 'return', 'exit', 'export', 'source',
  'local', 'readonly', 'declare', 'set', 'unset', 'echo', 'cd', 'ls',
  'grep', 'sed', 'awk', 'cat', 'mkdir', 'rm', 'cp', 'mv', 'chmod',
  // PowerShell / Windows equivalents
  'dir', 'type', 'findstr', 'icacls', 'copy', 'del', 'move', 'md',
]);

const BUILTIN_VALUES = new Set([
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
  'True', 'False', 'None',
]);

function getKeywords(lang: string): Set<string> | null {
  const l = lang.toLowerCase();
  if (['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx'].includes(l)) return JS_KEYWORDS;
  if (['python', 'py'].includes(l)) return PYTHON_KEYWORDS;
  if (['bash', 'sh', 'zsh', 'shell', 'powershell', 'ps1', 'cmd', 'bat'].includes(l)) return BASH_KEYWORDS;
  return null;
}

function highlightCodeLine(line: string, lang: string): string {
  const l = lang.toLowerCase();

  // JSON: special regex-based highlighting
  if (['json', 'jsonc'].includes(l)) {
    return highlightJson(line);
  }

  const keywords = getKeywords(lang);
  if (!keywords) return line;

  let result = '';
  let i = 0;

  while (i < line.length) {
    const ch = line[i]!;

    // String literals
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) {
        if (line[j] === '\\') j++;
        j++;
      }
      j = Math.min(j + 1, line.length);
      result += `${GREEN}${line.slice(i, j)}${RESET}`;
      i = j;
      continue;
    }

    // Single-line comments
    if (ch === '/' && line[i + 1] === '/') {
      result += `${DIM}${line.slice(i)}${RESET}`;
      break;
    }
    if (ch === '#' && !['json', 'jsonc'].includes(l)) {
      result += `${DIM}${line.slice(i)}${RESET}`;
      break;
    }

    // Numbers
    if (/[0-9]/.test(ch) && (i === 0 || /[\s,=([{:+\-*/!<>&|^~?;]/.test(line[i - 1]!))) {
      let j = i;
      while (j < line.length && /[0-9._xXa-fA-Fbon]/.test(line[j]!)) j++;
      result += `${YELLOW}${line.slice(i, j)}${RESET}`;
      i = j;
      continue;
    }

    // Words (keywords, identifiers, builtins)
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j]!)) j++;
      const word = line.slice(i, j);
      if (keywords.has(word)) {
        result += `${MAGENTA}${BOLD}${word}${RESET}`;
      } else if (BUILTIN_VALUES.has(word)) {
        result += `${CYAN}${word}${RESET}`;
      } else {
        result += word;
      }
      i = j;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

function highlightJson(line: string): string {
  return line
    .replace(/"([^"]+)"(?=\s*:)/g, `${CYAN}"$1"${RESET}`)
    .replace(/:\s*"([^"]*?)"/g, `: ${GREEN}"$1"${RESET}`)
    .replace(/:\s*(-?\d+\.?\d*)/g, `: ${YELLOW}$1${RESET}`)
    .replace(/:\s*(true|false|null)/g, `: ${CYAN}$1${RESET}`);
}

function renderInline(line: string): string {
  // Bold: **text** or __text__
  line = line.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`);
  line = line.replace(/__(.+?)__/g, `${BOLD}$1${RESET}`);

  // Italic: *text*
  line = line.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, `${ITALIC}$1${RESET}`);

  // Inline code: `code`
  line = line.replace(/`([^`]+?)`/g, `${BG_GRAY}${CYAN} $1 ${RESET}`);

  // Links: [text](url)
  line = line.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    `${CYAN}$1${RESET} ${DIM}($2)${RESET}`,
  );

  return line;
}

/** Create an OSC 8 clickable hyperlink for terminal emulators */
function fileLink(filePath: string): string {
  const absPath = filePath.startsWith('/') ? filePath : filePath;
  return `\x1b]8;;file://${absPath}\x1b\\${CYAN}${filePath}${RESET}\x1b]8;;\x1b\\`;
}

/** Convert file paths in text to clickable terminal links */
function linkifyFilePaths(line: string): string {
  // Match absolute paths like /Users/... or ~/... or relative paths like src/foo.ts:123
  // Negative lookbehind excludes URLs (http://, https://, file://)
  return line.replace(
    /(?<!:\/|:\/\/)(?:\/(?:Users|home|tmp|var|etc|opt)\/[\w./-]+(?::\d+)?|~\/[\w./-]+(?::\d+)?|(?:src|tests|docs|dist)\/[\w./-]+(?::\d+)?)/g,
    (match) => fileLink(match),
  );
}

/** Strip or dim <think>...</think> blocks from reasoning models */
function filterThinkingTags(text: string): string {
  // Remove <think>...</think> blocks (multi-line)
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
}

export function renderMarkdown(text: string): string {
  // Filter out reasoning model thinking blocks
  text = filterThinkingTags(text);

  const lines = text.split('\n');
  const output: string[] = [];
  let inCodeBlock = false;
  let codeLang = '';

  for (const line of lines) {
    // Code block fence
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trimStart().slice(3).trim();
        const label = codeLang ? ` ${codeLang} ` : '';
        output.push(
          `${DIM}\u250C\u2500\u2500${label}${'\u2500'.repeat(Math.max(0, 40 - label.length))}${RESET}`,
        );
        continue;
      } else {
        inCodeBlock = false;
        output.push(`${DIM}\u2514${'\u2500'.repeat(43)}${RESET}`);
        codeLang = '';
        continue;
      }
    }

    // Inside code block — syntax highlight
    if (inCodeBlock) {
      const highlighted = codeLang
        ? highlightCodeLine(line, codeLang)
        : line;
      output.push(`${DIM}\u2502${RESET} ${highlighted}`);
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

    // Blockquotes
    const bq = line.match(/^>\s?(.*)/);
    if (bq) {
      output.push(
        `${DIM}\u2503${RESET} ${ITALIC}${bq[1] ?? ''}${RESET}`,
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      output.push(`${DIM}${'\u2500'.repeat(44)}${RESET}`);
      continue;
    }

    // Unordered list items
    const ul = line.match(/^(\s*)[*-] (.+)/);
    if (ul) {
      const indent = ul[1] ?? '';
      output.push(
        `${indent}${DIM}\u2022${RESET} ${renderInline(ul[2] ?? '')}`,
      );
      continue;
    }

    // Ordered list items
    const ol = line.match(/^(\s*)\d+\. (.+)/);
    if (ol) {
      const indent = ol[1] ?? '';
      const num = line.match(/^(\s*)(\d+)\./);
      output.push(
        `${indent}${DIM}${num?.[2] ?? '1'}.${RESET} ${renderInline(ol[2] ?? '')}`,
      );
      continue;
    }

    // Regular line with inline formatting + clickable file paths
    output.push(linkifyFilePaths(renderInline(line)));
  }

  // Close unclosed code block
  if (inCodeBlock) {
    output.push(`${DIM}\u2514${'\u2500'.repeat(43)}${RESET}`);
  }

  return output.join('\n');
}
