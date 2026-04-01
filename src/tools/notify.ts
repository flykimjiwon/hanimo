import { execaCommand } from 'execa';

/**
 * Send a desktop notification when a long-running task completes.
 * Supports macOS (osascript), Linux (notify-send), and Windows (PowerShell).
 * Falls back silently on unsupported platforms or missing tools.
 */
export async function sendNotification(
  title: string,
  message: string,
): Promise<void> {
  const clean = (s: string): string => s.replace(/[^a-zA-Z0-9 .,!?\-_\u3131-\uD79D]/g, '').slice(0, 200);
  const safeTitle = clean(title);
  const safeMessage = clean(message);

  try {
    if (process.platform === 'darwin') {
      await execaCommand(
        `osascript -e 'display notification "${safeMessage}" with title "${safeTitle}"'`,
        { shell: true, timeout: 5000, reject: false },
      );
    } else if (process.platform === 'linux') {
      await execaCommand(
        `notify-send "${safeTitle}" "${safeMessage}"`,
        { shell: true, timeout: 5000, reject: false },
      );
    } else if (process.platform === 'win32') {
      // Use PowerShell toast notification (non-blocking, Windows 10+)
      const ps = [
        'powershell -Command "',
        '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;',
        '$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(0);',
        `$t.GetElementsByTagName('text')[0].AppendChild($t.CreateTextNode('${safeTitle}: ${safeMessage}')) | Out-Null;`,
        `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('hanimo').Show([Windows.UI.Notifications.ToastNotification]::new($t))`,
        '"',
      ].join(' ');
      await execaCommand(ps, { shell: true, timeout: 5000, reject: false });
    }
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
