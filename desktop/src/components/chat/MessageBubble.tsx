import { useThemeStore } from "../../stores/theme-store";
import type { ChatMessage } from "../../stores/chat-store";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { theme } = useThemeStore();
  const c = theme.colors;

  if (message.role === "tool-call" || message.role === "tool-result") {
    const prefix = message.role === "tool-call" ? "▶" : "✓";
    return (
      <div
        className="rounded-md px-3 py-2 text-xs font-mono my-1"
        style={{ background: c.bgTertiary, border: `1px solid ${c.border}` }}
      >
        <div className="font-semibold mb-1" style={{ color: c.text }}>
          {prefix} {message.toolName ?? message.role}
        </div>
        <div style={{ color: c.textSecondary }}>{message.content}</div>
      </div>
    );
  }

  const isUser = message.role === "user";

  return (
    <div className={`flex my-1 ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="rounded-lg px-3 py-2 text-sm max-w-[85%]"
        style={{
          background: isUser ? c.userBubble : c.assistantBubble,
          color: message.isError ? c.error : c.text,
          border: `1px solid ${c.border}`,
        }}
      >
        {message.content}
      </div>
    </div>
  );
}
