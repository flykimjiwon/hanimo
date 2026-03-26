import { tool } from 'ai';
import { z } from 'zod';
import { execaCommand } from 'execa';

const DANGEROUS_PATTERNS: RegExp[] = [
  /rm\s+(-rf|-fr)\s+\//,
  /DROP\s+TABLE/i,
  /DROP\s+DATABASE/i,
  /FORMAT\s+/i,
  /mkfs\./,
  /dd\s+if=/,
  />\s*\/dev\/sd/,
  /chmod\s+-R\s+777\s+\//,
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/,
];

function isDangerous(command: string): string | null {
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
      .min(1000)
      .max(120000)
      .optional()
      .default(30000)
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
      const MAX_LEN = 50000;
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
