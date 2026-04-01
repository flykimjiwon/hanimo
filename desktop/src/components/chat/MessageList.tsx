import { useEffect, useRef } from "react";
import { useThemeStore } from "../../stores/theme-store";
import { useChatStore } from "../../stores/chat-store";
import { MessageBubble } from "./MessageBubble";

export function MessageList() {
  const { theme } = useThemeStore();
  const c = theme.colors;
  const { messages, isStreaming, streamingContent } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col">
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
            {streamingContent}
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
