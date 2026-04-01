import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useThemeStore } from "../../stores/theme-store";
import { useChatStore } from "../../stores/chat-store";
import { MessageBubble } from "./MessageBubble";

export function MessageList({ onRetry }: { onRetry?: () => void }) {
  const { theme } = useThemeStore();
  const c = theme.colors;
  const { messages, isStreaming, streamingContent, connectionStatus, connectionError } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col">
      {connectionStatus === "connecting" && (
        <div
          className="rounded-md px-3 py-2 mb-2 text-sm"
          style={{ background: "#fef3c7", color: "#92400e" }}
        >
          Connecting to LLM...
        </div>
      )}
      {connectionStatus === "error" && (
        <div
          className="rounded-md px-3 py-2 mb-2 text-sm flex items-center gap-2"
          style={{ background: "#fee2e2", color: "#991b1b" }}
        >
          <span className="flex-1">Connection failed: {connectionError}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{ background: "#991b1b", color: "#ffffff" }}
            >
              Retry
            </button>
          )}
        </div>
      )}
      {connectionStatus === "disconnected" && (
        <div
          className="rounded-md px-3 py-2 mb-2 text-sm"
          style={{ background: c.bgTertiary, color: c.textMuted }}
        >
          Not connected
        </div>
      )}
      {messages.length === 0 && !isStreaming && (
        <p className="text-sm text-center mt-8" style={{ color: c.textMuted }}>
          No messages yet. Start a conversation!
        </p>
      )}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isStreaming && streamingContent && (
        <div className="flex justify-start my-1">
          <div
            className="rounded-lg px-3 py-2 text-sm max-w-[85%]"
            style={{
              background: c.assistantBubble,
              color: c.text,
              border: `1px solid ${c.border}`,
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
            <span className="animate-pulse">▊</span>
          </div>
        </div>
      )}
      {isStreaming && !streamingContent && (
        <div className="flex justify-start my-1">
          <div
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              background: c.assistantBubble,
              color: c.textMuted,
              border: `1px solid ${c.border}`,
            }}
          >
            <span className="animate-pulse">▊</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
