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
  totalUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  totalCost: number;
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;
  finishStreaming: () => void;
  clear: () => void;
  setConnectionStatus: (status: "disconnected" | "connecting" | "connected" | "error") => void;
  setConnectionError: (error: string | null) => void;
  updateUsage: (usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void;
}

let idCounter = 0;

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  streamingContent: "",
  connectionStatus: "disconnected",
  connectionError: null,
  totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  totalCost: 0,
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
  finishStreaming: () =>
    set((state) => {
      const content = state.streamingContent;
      if (!content) return { isStreaming: false, streamingContent: "" };
      return {
        messages: [
          ...state.messages,
          { id: String(++idCounter), role: "assistant" as const, content, timestamp: Date.now() },
        ],
        isStreaming: false,
        streamingContent: "",
      };
    }),
  clear: () => set({ messages: [], isStreaming: false, streamingContent: "" }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setConnectionError: (error) => set({ connectionError: error }),
  updateUsage: (usage) =>
    set((state) => ({
      totalUsage: {
        promptTokens: state.totalUsage.promptTokens + (usage.promptTokens || 0),
        completionTokens: state.totalUsage.completionTokens + (usage.completionTokens || 0),
        totalTokens: state.totalUsage.totalTokens + (usage.totalTokens || 0),
      },
    })),
}));
