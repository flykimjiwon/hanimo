import { useCallback } from "react";
import { useThemeStore } from "../../stores/theme-store";
import { useChatStore } from "../../stores/chat-store";
import { useSidecar } from "../../hooks/use-sidecar";
import { MessageList } from "../chat/MessageList";
import { ChatInput } from "../chat/ChatInput";
import type { SidecarEvent } from "../../lib/ipc";

export function ChatPanel() {
  const { theme } = useThemeStore();
  const c = theme.colors;
  const {
    addMessage,
    setStreaming,
    appendStreamingContent,
    clearStreamingContent,
    isStreaming,
    streamingContent,
  } = useChatStore();

  const handleEvent = useCallback(
    (event: SidecarEvent) => {
      switch (event.type) {
        case "text":
          appendStreamingContent(String(event.data ?? ""));
          break;
        case "tool-call": {
          const data = event.data as { toolName?: string; content?: string } | null;
          addMessage({
            role: "tool-call",
            content: String(data?.content ?? JSON.stringify(event.data)),
            toolName: data?.toolName,
          });
          break;
        }
        case "tool-result": {
          const data = event.data as { toolName?: string; content?: string } | null;
          addMessage({
            role: "tool-result",
            content: String(data?.content ?? JSON.stringify(event.data)),
            toolName: data?.toolName,
          });
          break;
        }
        case "done": {
          const content = streamingContent;
          clearStreamingContent();
          if (content) {
            addMessage({ role: "assistant", content });
          }
          setStreaming(false);
          break;
        }
        case "error": {
          clearStreamingContent();
          addMessage({
            role: "assistant",
            content: String(event.data ?? "An error occurred"),
            isError: true,
          });
          setStreaming(false);
          break;
        }
      }
    },
    [addMessage, setStreaming, appendStreamingContent, clearStreamingContent, streamingContent]
  );

  const { send } = useSidecar({ onEvent: handleEvent });

  const handleSend = async (content: string) => {
    addMessage({ role: "user", content });
    setStreaming(true);
    clearStreamingContent();
    await send(content);
  };

  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{ width: 340, background: c.bg, borderLeft: `1px solid ${c.border}` }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{ height: 36, borderBottom: `1px solid ${c.border}`, background: c.bgSecondary }}
      >
        <span className="text-base">🐶</span>
        <span className="text-sm font-medium" style={{ color: c.text }}>
          hanimo chat
        </span>
      </div>

      {/* Messages */}
      <MessageList />

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
