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
    const escapedTitle = title.replace(/"/g, '\\"');
    const escapedMessage = message.replace(/"/g, '\\"');
    await execaCommand(
      `osascript -e 'display notification "${escapedMessage}" with title "${escapedTitle}"'`,
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
