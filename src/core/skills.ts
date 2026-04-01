/**
 * Skills System — load markdown knowledge files into system prompt
 * Files in ~/.hanimo/skills/*.md are auto-loaded
 */
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SKILLS_DIR = join(homedir(), '.hanimo', 'skills');

export interface Skill {
  id: string;        // filename without .md
  name: string;      // first # heading or filename
  content: string;   // full markdown content
  path: string;
}

export function loadSkills(): Skill[] {
  // ensure dir exists
  mkdirSync(SKILLS_DIR, { recursive: true });

  let files: string[];
  try {
    files = readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
  } catch { return []; }

  return files.map(f => {
    const path = join(SKILLS_DIR, f);
    const content = readFileSync(path, 'utf-8');
    const id = f.replace('.md', '');
    // Extract name from first heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    const name = headingMatch?.[1] ?? id;
    return { id, name, content: content.trim(), path };
  }).filter(s => s.content.length > 0);
}

export function buildSkillsPrompt(skills: Skill[]): string {
  if (skills.length === 0) return '';
  const sections = skills.map(s => `### Skill: ${s.name}\n${s.content}`);
  return `\n\n## Loaded Skills (${skills.length})\n${sections.join('\n\n')}`;
}

export function getSkillsDir(): string {
  return SKILLS_DIR;
}
