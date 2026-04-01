import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool-call" | "tool-result";
  content: string;
  toolName?: string;
  isError?: boolean;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;
  clear: () => void;
}

let idCounter = 0;

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  streamingContent: "",
  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: String(++idCounter), timestamp: Date.now() },
      ],
    })),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  appendStreamingContent: (content) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),
  clearStreamingContent: () => set({ streamingContent: "" }),
  clear: () => set({ messages: [], isStreaming: false, streamingContent: "" }),
}));
