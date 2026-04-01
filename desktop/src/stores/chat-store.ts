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
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  connectionError: string | null;
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;
  clear: () => void;
  setConnectionStatus: (status: "disconnected" | "connecting" | "connected" | "error") => void;
  setConnectionError: (error: string | null) => void;
}

let idCounter = 0;

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  streamingContent: "",
  connectionStatus: "disconnected",
  connectionError: null,
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
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setConnectionError: (error) => set({ connectionError: error }),
}));
