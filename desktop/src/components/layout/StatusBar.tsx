import { useOnboardingStore } from "../../stores/onboarding-store";
import { useChatStore } from "../../stores/chat-store";
import { useThemeStore } from "../../stores/theme-store";

export function StatusBar() {
  const { provider, model } = useOnboardingStore();
  const { totalUsage, connectionStatus } = useChatStore();
  const { theme } = useThemeStore();
  const c = theme.colors;

  const statusDot =
    connectionStatus === "connected"
      ? "🟢"
      : connectionStatus === "connecting"
        ? "🟡"
        : connectionStatus === "error"
          ? "🔴"
          : "⚪";

  return (
    <div
      className="flex items-center px-3 gap-4 text-xs flex-shrink-0"
      style={{ height: 24, background: c.bgSecondary, borderTop: `1px solid ${c.border}`, color: c.textMuted }}
    >
      <span>{statusDot} {provider}/{model}</span>
      <span>tokens: {totalUsage.totalTokens.toLocaleString()}</span>
    </div>
  );
}
