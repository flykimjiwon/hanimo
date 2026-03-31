#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const cli = join(projectRoot, 'src', 'cli.ts');

const child = spawn(process.execPath, ['--import', 'tsx', cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: projectRoot,
  env: { ...process.env, NODE_PATH: join(projectRoot, 'node_modules') },
});

child.on('exit', (code) => process.exit(code ?? 1));
