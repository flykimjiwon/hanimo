import { execaCommand } from 'execa';

/**
 * Send a macOS notification when a long-running task completes.
 * Falls back silently on non-macOS or missing osascript.
 */
export async function sendNotification(
  title: string,
  message: string,
): Promise<void> {
  if (process.platform !== 'darwin') return;

  try {
    // Sanitize: strip all quotes and backslashes to prevent shell/AppleScript injection
    const clean = (s: string): string => s.replace(/["'\\`$]/g, '').slice(0, 200);
    const safeTitle = clean(title);
    const safeMessage = clean(message);
    await execaCommand(
      `osascript -e 'display notification "${safeMessage}" with title "${safeTitle}"'`,
      { shell: true, timeout: 5000, reject: false },
    );
  } catch {
    // Silent fail — notification is non-critical
  }
}

/**
 * Play a terminal bell as a simple audible notification.
 */
export function bell(): void {
  process.stdout.write('\x07');
}
