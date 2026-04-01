import { tool } from 'ai';
import { z } from 'zod';

const MAX_CONTENT_LENGTH = 50000;
const TIMEOUT_MS = 15000;

const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
];

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost') return true;
  return PRIVATE_IP_PATTERNS.some((p) => p.test(h));
}

/**
 * Strip HTML tags and convert to readable plain text.
 * Lightweight — no external dependency needed.
 */
export function htmlToText(html: string): string {
  return html
    // Remove script/style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    // Block elements → newlines
    .replace(/<\/?(h[1-6]|p|div|br|li|tr|blockquote|pre|hr)[^>]*>/gi, '\n')
    // Links: keep text + URL
    .replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const webfetchTool = tool({
  description:
    'Fetch a web page and return its text content. Useful for reading documentation, ' +
    'API references, package info, blog posts, etc. Returns plain text extracted from HTML.',
  parameters: z.object({
    url: z.string().url().describe('URL to fetch'),
    selector: z
      .string()
      .optional()
      .describe('Optional: CSS-like tag to focus on (e.g. "article", "main"). Only text inside matching tags is returned.'),
  }),
  execute: async ({ url, selector }) => {
    try {
      const parsedUrl = new URL(url);
      if (isPrivateHost(parsedUrl.hostname)) {
        return { success: false, error: 'Blocked: URL points to internal/private network' };
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'hanimo/0.1 (AI coding assistant)',
          Accept: 'text/html,application/xhtml+xml,text/plain,application/json',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status} ${response.statusText}` };
      }

      const contentType = response.headers.get('content-type') ?? '';
      const raw = await response.text();

      // JSON → return formatted
      if (contentType.includes('application/json')) {
        try {
          const json = JSON.parse(raw);
          const pretty = JSON.stringify(json, null, 2);
          const truncated = pretty.length > MAX_CONTENT_LENGTH
            ? pretty.slice(0, MAX_CONTENT_LENGTH) + '\n... (truncated)'
            : pretty;
          return { success: true, url, contentType: 'json', content: truncated };
        } catch {
          // Fall through to text
        }
      }

      // Plain text
      if (contentType.includes('text/plain')) {
        const truncated = raw.length > MAX_CONTENT_LENGTH
          ? raw.slice(0, MAX_CONTENT_LENGTH) + '\n... (truncated)'
          : raw;
        return { success: true, url, contentType: 'text', content: truncated };
      }

      // HTML → extract text
      let html = raw;
      if (selector) {
        // Simple tag-based extraction (e.g. "main", "article")
        // Note: non-greedy match — doesn't handle nested same-name tags (e.g. <main><main>...)
        // This is acceptable since target selectors (main, article, section) are rarely nested.
        const tagRegex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'gi');
        const matches = [...html.matchAll(tagRegex)].map((m) => m[1]).filter(Boolean);
        if (matches.length > 0) {
          html = matches.join('\n');
        }
      }

      let text = htmlToText(html);
      if (text.length > MAX_CONTENT_LENGTH) {
        text = text.slice(0, MAX_CONTENT_LENGTH) + '\n... (truncated)';
      }

      return {
        success: true,
        url,
        contentType: 'html',
        contentLength: text.length,
        content: text,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('TimeoutError') || message.includes('aborted')) {
        return { success: false, error: `Request timed out after ${TIMEOUT_MS / 1000}s` };
      }
      return { success: false, error: `Fetch failed: ${message}` };
    }
  },
});
