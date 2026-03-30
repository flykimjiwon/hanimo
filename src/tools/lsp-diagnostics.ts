import { tool } from 'ai';
import { z } from 'zod';
import { execaCommand } from 'execa';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Run TypeScript compiler or ESLint to get diagnostics.
 * Zero-dependency approach: shell out to tsc/eslint if available.
 */
async function runTsc(cwd: string, file?: string): Promise<string> {
  const tscPaths = [
    join(cwd, 'node_modules', '.bin', 'tsc'),
    ...(process.platform === 'win32' ? [join(cwd, 'node_modules', '.bin', 'tsc.cmd')] : []),
    'tsc',
  ];

  let tscBin = 'tsc';
  for (const p of tscPaths) {
    if (p === 'tsc' || existsSync(p)) {
      tscBin = p;
      break;
    }
  }

  const args = file
    ? `${tscBin} --noEmit --pretty false "${file}"`
    : `${tscBin} --noEmit --pretty false`;

  try {
    const result = await execaCommand(args, {
      cwd,
      timeout: 30000,
      shell: true,
      reject: false,
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    return typeof result.stdout === 'string' ? result.stdout : '';
  } catch {
    return '';
  }
}

async function runEslint(cwd: string, file?: string): Promise<string> {
  const eslintPaths = [
    join(cwd, 'node_modules', '.bin', 'eslint'),
    ...(process.platform === 'win32' ? [join(cwd, 'node_modules', '.bin', 'eslint.cmd')] : []),
    'eslint',
  ];

  let eslintBin = 'eslint';
  for (const p of eslintPaths) {
    if (p === 'eslint' || existsSync(p)) {
      eslintBin = p;
      break;
    }
  }

  const target = file ? `"${file}"` : '.';
  const args = `${eslintBin} ${target} --format compact --no-error-on-unmatched-pattern`;

  try {
    const result = await execaCommand(args, {
      cwd,
      timeout: 30000,
      shell: true,
      reject: false,
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    return typeof result.stdout === 'string' ? result.stdout : '';
  } catch {
    return '';
  }
}

export interface DiagnosticEntry {
  file: string;
  line: number;
  col: number;
  severity: string;
  message: string;
  code?: string;
}

function parseTscOutput(output: string): DiagnosticEntry[] {
  const entries: DiagnosticEntry[] = [];
  // Format: file(line,col): error TS1234: message
  const regex = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(output)) !== null) {
    entries.push({
      file: match[1]!,
      line: parseInt(match[2]!, 10),
      col: parseInt(match[3]!, 10),
      severity: match[4]!,
      code: match[5],
      message: match[6]!,
    });
  }
  return entries;
}

function parseEslintCompact(output: string): DiagnosticEntry[] {
  const entries: DiagnosticEntry[] = [];
  // Format: /path/file.ts: line 10, col 5, Error - message (rule-name)
  const regex = /^(.+?):\s+line\s+(\d+),\s+col\s+(\d+),\s+(Error|Warning)\s+-\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(output)) !== null) {
    entries.push({
      file: match[1]!,
      line: parseInt(match[2]!, 10),
      col: parseInt(match[3]!, 10),
      severity: match[4]!.toLowerCase(),
      message: match[5]!,
    });
  }
  return entries;
}

export const lspDiagnosticsTool = tool({
  description:
    'Get TypeScript and ESLint diagnostics (type errors, lint issues) for a file or the whole project. ' +
    'Runs tsc --noEmit and eslint to check for errors without modifying files.',
  parameters: z.object({
    file: z
      .string()
      .optional()
      .describe('Specific file to check. If omitted, checks the whole project.'),
    checker: z
      .enum(['all', 'tsc', 'eslint'])
      .optional()
      .default('all')
      .describe('Which checker to run (default: all)'),
  }),
  execute: async ({ file, checker }) => {
    const cwd = process.cwd();
    const diagnostics: DiagnosticEntry[] = [];
    const checks: string[] = [];

    if (checker === 'all' || checker === 'tsc') {
      // Only run tsc if tsconfig exists
      if (existsSync(join(cwd, 'tsconfig.json'))) {
        const tscOutput = await runTsc(cwd, file);
        const tscDiags = parseTscOutput(tscOutput);
        diagnostics.push(...tscDiags);
        checks.push('tsc');
      }
    }

    if (checker === 'all' || checker === 'eslint') {
      const eslintConfigs = ['eslint.config.js', 'eslint.config.mjs', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml'];
      if (eslintConfigs.some((c) => existsSync(join(cwd, c)))) {
        const eslintOutput = await runEslint(cwd, file);
        const eslintDiags = parseEslintCompact(eslintOutput);
        diagnostics.push(...eslintDiags);
        checks.push('eslint');
      }
    }

    if (checks.length === 0) {
      return {
        success: true,
        message: 'No checkers available (no tsconfig.json or eslint config found)',
        diagnostics: [],
      };
    }

    const errors = diagnostics.filter((d) => d.severity === 'error');
    const warnings = diagnostics.filter((d) => d.severity === 'warning');

    // Limit output
    const MAX_ITEMS = 50;
    const truncated = diagnostics.length > MAX_ITEMS;
    const shown = diagnostics.slice(0, MAX_ITEMS);

    return {
      success: true,
      checkers: checks,
      summary: {
        total: diagnostics.length,
        errors: errors.length,
        warnings: warnings.length,
        truncated,
      },
      diagnostics: shown,
    };
  },
});
