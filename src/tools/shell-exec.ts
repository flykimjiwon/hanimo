import { tool } from 'ai';
import { z } from 'zod';
import { execaCommand } from 'execa';
import { checkPathSandbox } from '../core/permission.js';

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 120000;
const MIN_TIMEOUT_MS = 1000;
const MAX_OUTPUT_CHARS = 50000;

const DANGEROUS_PATTERNS: RegExp[] = [
  // rm variants (handles -r -f, --recursive, --force, etc.)
  /\brm\b.*-[^\s]*r[^\s]*f.*\//,
  /\brm\b.*--recursive/,
  /\brm\b.*--force.*\//,
  // SQL injection
  /DROP\s+TABLE/i,
  /DROP\s+DATABASE/i,
  /TRUNCATE\s+TABLE/i,
  // Disk destruction
  /FORMAT\s+/i,
  /\bmkfs\b/,
  /\bdd\b\s+if=/,
  />\s*\/dev\/sd/,
  // Permission escalation
  /chmod\s+(-R\s+)?777\s+\//,
  /\bsudo\b/,
  // Fork bomb variants
  /:\(\)\s*\{.*:\|:.*\}/,
  // Pipe-to-shell (curl|bash, wget|sh)
  /\bcurl\b.*\|\s*(ba)?sh/,
  /\bwget\b.*\|\s*(ba)?sh/,
  // Eval execution
  /\beval\b\s+/,
  // Dangerous redirects
  />\s*\/dev\/(sda|nvme|disk)/,
  />\s*\/etc\//,
  // History/credential exfiltration
  /\bcat\b.*\.(bash_history|ssh|aws|env)/,
];

export function isDangerous(command: string): string | null {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return `Command matches dangerous pattern: ${pattern.source}`;
    }
  }
  return null;
}

export const shellExecTool = tool({
  description: 'Execute a shell command and return stdout, stderr, and exit code',
  parameters: z.object({
    command: z.string().describe('Shell command to execute'),
    cwd: z.string().optional().describe('Working directory (defaults to process.cwd())'),
    timeout: z
      .number()
      .min(MIN_TIMEOUT_MS)
      .max(MAX_TIMEOUT_MS)
      .optional()
      .default(DEFAULT_TIMEOUT_MS)
      .describe('Timeout in milliseconds (1s-120s, default 30s)'),
  }),
  execute: async ({ command, cwd, timeout }) => {
    const dangerReason = isDangerous(command);
    if (dangerReason) {
      return {
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: '',
        error: `Blocked: ${dangerReason}`,
      };
    }

    if (cwd) {
      const sandboxErr = checkPathSandbox(cwd, process.cwd());
      if (sandboxErr) {
        return { success: false, exitCode: -1, stdout: '', stderr: '', error: sandboxErr };
      }
    }

    try {
      const result = await execaCommand(command, {
        cwd: cwd ?? process.cwd(),
        timeout,
        reject: false,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      const stdout = typeof result.stdout === 'string' ? result.stdout : '';
      const stderr = typeof result.stderr === 'string' ? result.stderr : '';

      // Truncate very long output
      const MAX_LEN = MAX_OUTPUT_CHARS;
      const truncatedStdout =
        stdout.length > MAX_LEN
          ? stdout.slice(0, MAX_LEN) + `\n... (truncated, ${stdout.length} total chars)`
          : stdout;
      const truncatedStderr =
        stderr.length > MAX_LEN
          ? stderr.slice(0, MAX_LEN) + `\n... (truncated, ${stderr.length} total chars)`
          : stderr;

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode ?? -1,
        stdout: truncatedStdout,
        stderr: truncatedStderr,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: '',
        error: `Execution failed: ${message}`,
      };
    }
  },
});
