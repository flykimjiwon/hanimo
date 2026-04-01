import { useCallback, useState } from "react";
import { useThemeStore } from "../../stores/theme-store";
import { useChatStore } from "../../stores/chat-store";
import { useSidecar } from "../../hooks/use-sidecar";
import { MessageList } from "../chat/MessageList";
import { ChatInput } from "../chat/ChatInput";
import type { SidecarEvent } from "../../lib/ipc";

type Role = "hanimo" | "dev" | "plan";

const ROLES: { id: Role; icon: string; label: string }[] = [
  { id: "hanimo", icon: "🐶", label: "hanimo" },
  { id: "dev", icon: "🔧", label: "dev" },
  { id: "plan", icon: "📋", label: "plan" },
];

export function ChatPanel() {
  const { theme } = useThemeStore();
  const c = theme.colors;
  const [role, setRole] = useState<Role>("hanimo");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { send } = useSidecar({ onEvent: handleEvent, role });

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
        <span className="text-base">{ROLES.find((r) => r.id === role)?.icon}</span>
        <span className="text-sm font-medium" style={{ color: c.text }}>
          hanimo chat
        </span>
        <div className="flex items-center gap-1 ml-auto">
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              title={r.label}
              style={{
                background: role === r.id ? c.accent : "transparent",
                border: `1px solid ${role === r.id ? c.accent : c.border}`,
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 13,
                lineHeight: 1,
                padding: "2px 4px",
                opacity: role === r.id ? 1 : 0.6,
              }}
            >
              {r.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <MessageList />

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
