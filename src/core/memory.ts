import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { isEnabled } from './feature-flags.js';

const MEMORY_DIR = join(homedir(), '.hanimo', 'memory');
const MEMORY_FILE = 'MEMORY.md';
const MAX_LINES = 200;
const MAX_BYTES = 25 * 1024;

function ensureDir(): void {
  mkdirSync(MEMORY_DIR, { recursive: true });
}

/**
 * Sanitize topic name to prevent path traversal.
 * Rejects path separators, .., and special characters.
 */
function sanitizeTopic(topic: string): string {
  const cleaned = topic
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\.\./g, '_');
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error(`Invalid topic name: "${topic}"`);
  }
  return cleaned;
}

export function loadMemory(): string {
  if (!isEnabled('MEMORY_SYSTEM')) return '';
  ensureDir();
  const path = join(MEMORY_DIR, MEMORY_FILE);
  if (!existsSync(path)) return '';
  try {
    let content = readFileSync(path, 'utf-8');
    // Enforce limits
    const lines = content.split('\n');
    if (lines.length > MAX_LINES) {
      content = lines.slice(0, MAX_LINES).join('\n');
    }
    if (Buffer.byteLength(content, 'utf-8') > MAX_BYTES) {
      content = content.slice(0, MAX_BYTES);
    }
    return content;
  } catch {
    return '';
  }
}

export function writeMemory(content: string, topic?: string): void {
  if (!isEnabled('MEMORY_SYSTEM')) return;
  ensureDir();
  const fileName = topic ? `${sanitizeTopic(topic)}.md` : MEMORY_FILE;
  const path = join(MEMORY_DIR, fileName);

  let combined: string;
  if (existsSync(path)) {
    const existing = readFileSync(path, 'utf-8');
    combined = existing + '\n' + content;
  } else {
    combined = content;
  }

  // Enforce size limits on write to prevent unbounded growth
  const lines = combined.split('\n');
  if (lines.length > MAX_LINES) {
    combined = lines.slice(-MAX_LINES).join('\n');
  }
  if (Buffer.byteLength(combined, 'utf-8') > MAX_BYTES) {
    const allLines = combined.split('\n');
    while (allLines.length > 1 && Buffer.byteLength(allLines.join('\n'), 'utf-8') > MAX_BYTES) {
      allLines.shift();
    }
    combined = allLines.join('\n');
  }

  writeFileSync(path, combined);
}

export function readMemoryTopic(topic: string): string {
  if (!isEnabled('MEMORY_SYSTEM')) return '';
  ensureDir();
  const path = join(MEMORY_DIR, `${sanitizeTopic(topic)}.md`);
  if (!existsSync(path)) return '';
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
}

export function listTopics(): string[] {
  if (!isEnabled('MEMORY_SYSTEM')) return [];
  ensureDir();
  try {
    return readdirSync(MEMORY_DIR)
      .filter(f => f.endsWith('.md') && f !== MEMORY_FILE)
      .map(f => f.replace('.md', ''));
  } catch {
    return [];
  }
}

export function buildMemoryPrompt(): string {
  const memory = loadMemory();
  if (!memory) return '';
  return `\n\n## User Memory\n${memory}`;
}
