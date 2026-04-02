#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const cli = join(projectRoot, 'src', 'cli.ts');

// Prefer Bun (required for OpenTUI), fall back to Node+tsx
let runtime = 'bun';
let args = [cli, ...process.argv.slice(2)];

try {
  execFileSync('bun', ['--version'], { stdio: 'ignore' });
} catch {
  // Bun not available — fall back to Node.js + tsx
  runtime = process.execPath;
  args = ['--import', 'tsx', cli, ...process.argv.slice(2)];
}

const child = spawn(runtime, args, {
  stdio: 'inherit',
  cwd: projectRoot,
  env: { ...process.env, NODE_PATH: join(projectRoot, 'node_modules') },
});

child.on('exit', (code) => process.exit(code ?? 1));
