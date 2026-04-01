import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.hanimo');
const INSTRUCTIONS_FILE = join(CONFIG_DIR, 'instructions.md');

function ensureDir(): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
}

/** Load global user instructions. Returns empty string if none set. */
export function loadGlobalInstructions(): string {
  try {
    return readFileSync(INSTRUCTIONS_FILE, 'utf-8').trim();
  } catch {
    return '';
  }
}

/** Save global user instructions. */
export function saveGlobalInstructions(content: string): void {
  ensureDir();
  writeFileSync(INSTRUCTIONS_FILE, content.trim() + '\n', 'utf-8');
}

/** Append to global instructions. */
export function appendGlobalInstructions(content: string): void {
  ensureDir();
  const existing = loadGlobalInstructions();
  const updated = existing ? `${existing}\n${content.trim()}` : content.trim();
  writeFileSync(INSTRUCTIONS_FILE, updated + '\n', 'utf-8');
}

/** Clear global instructions. */
export function clearGlobalInstructions(): void {
  if (existsSync(INSTRUCTIONS_FILE)) {
    writeFileSync(INSTRUCTIONS_FILE, '', 'utf-8');
  }
}

/** Get the instructions file path (for display). */
export function getInstructionsPath(): string {
  return INSTRUCTIONS_FILE;
}
