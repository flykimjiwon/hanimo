import { useState } from "react";
import { useThemeStore } from "../../stores/theme-store";
import { useChatStore } from "../../stores/chat-store";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const { theme } = useThemeStore();
  const c = theme.colors;
  const [input, setInput] = useState("");
  const { isStreaming, connectionStatus } = useChatStore();

  const canSend = connectionStatus === "connected" && !isStreaming && input.trim().length > 0 && !disabled;

  const handleSend = () => {
    if (!canSend) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="flex items-end gap-2 px-3 py-2 flex-shrink-0"
      style={{ borderTop: `1px solid ${c.border}` }}
    >
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        disabled={disabled}
        rows={1}
        className="flex-1 rounded-md px-3 py-1.5 text-sm outline-none resize-none"
        style={{
          background: c.inputBg,
          border: `1px solid ${c.inputBorder}`,
          color: c.text,
          maxHeight: 120,
          opacity: disabled ? 0.5 : 1,
        }}
      />
      <button
        onClick={handleSend}
        disabled={!canSend}
        className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex-shrink-0"
        style={{
          background: canSend ? c.accent : c.bgTertiary,
          color: canSend ? "#ffffff" : c.textMuted,
          cursor: canSend ? "pointer" : "not-allowed",
          border: `1px solid ${canSend ? c.accent : c.border}`,
        }}
      >
        Send
      </button>
    </div>
  );
}
