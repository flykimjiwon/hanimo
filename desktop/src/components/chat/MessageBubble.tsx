import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
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
        {isUser ? (
          message.content
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const codeString = String(children).replace(/\n$/, "");
                if (match) {
                  return (
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => navigator.clipboard.writeText(codeString)}
                        style={{ position: "absolute", right: 4, top: 4, background: c.bgTertiary, border: `1px solid ${c.border}`, borderRadius: 4, padding: "2px 6px", fontSize: 11, color: c.textSecondary, cursor: "pointer", zIndex: 1 }}
                      >
                        Copy
                      </button>
                      <SyntaxHighlighter
                        style={theme.name === "dark" ? oneDark : oneLight}
                        language={match[1]}
                        PreTag="div"
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  );
                }
                return <code className={className} style={{ background: c.bgTertiary, padding: "1px 4px", borderRadius: 3, fontSize: "0.9em" }} {...props}>{children}</code>;
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
