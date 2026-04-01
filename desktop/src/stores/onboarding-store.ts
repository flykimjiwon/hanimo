import { create } from "zustand";
import { persist } from "zustand/middleware";

export const PROVIDERS = [
  // Cloud providers (need API key)
  { id: "openai", name: "OpenAI", needsApiKey: true, models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o3-mini"] },
  { id: "anthropic", name: "Anthropic", needsApiKey: true, models: ["claude-sonnet-4-20250514", "claude-haiku-4-20250414", "claude-opus-4-20250514"] },
  { id: "google", name: "Google", needsApiKey: true, models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"] },
  { id: "deepseek", name: "DeepSeek", needsApiKey: true, models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"] },
  { id: "groq", name: "Groq", needsApiKey: true, models: ["qwen-qwq-32b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"] },
  { id: "together", name: "Together AI", needsApiKey: true, models: ["Qwen/Qwen2.5-Coder-32B-Instruct", "deepseek-ai/DeepSeek-V3", "meta-llama/Llama-3.3-70B-Instruct-Turbo"] },
  { id: "openrouter", name: "OpenRouter", needsApiKey: true, models: ["deepseek/deepseek-chat-v3-0324:free", "qwen/qwen3-coder", "anthropic/claude-sonnet-4"] },
  { id: "fireworks", name: "Fireworks AI", needsApiKey: true, models: ["accounts/fireworks/models/qwen2p5-coder-32b-instruct", "accounts/fireworks/models/deepseek-v3"] },
  { id: "mistral", name: "Mistral", needsApiKey: true, models: ["codestral-latest", "mistral-large-latest", "mistral-small-latest"] },
  { id: "glm", name: "GLM (智谱)", needsApiKey: true, models: ["glm-4-plus", "glm-4-flash"] },
  // Local providers (no API key)
  { id: "ollama", name: "Ollama (Local)", needsApiKey: false, models: [] },
  { id: "vllm", name: "vLLM (Local)", needsApiKey: false, models: [] },
  { id: "lmstudio", name: "LM Studio (Local)", needsApiKey: false, models: [] },
  // Custom endpoint
  { id: "custom", name: "Custom (OpenAI-compatible)", needsApiKey: true, needsBaseUrl: true, models: [] },
];

interface OnboardingState {
  completed: boolean;
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  step: number;
  setProvider: (provider: string) => void;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setBaseUrl: (url: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  complete: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      provider: "",
      apiKey: "",
      model: "",
      baseUrl: "",
      step: 0,
      setProvider: (provider) => set({ provider }),
      setApiKey: (key) => set({ apiKey: key }),
      setModel: (model) => set({ model }),
      setBaseUrl: (url) => set({ baseUrl: url }),
      nextStep: () => set((state) => ({ step: state.step + 1 })),
      prevStep: () => set((state) => ({ step: Math.max(0, state.step - 1) })),
      complete: () => set({ completed: true }),
      reset: () => set({ completed: false, provider: "", apiKey: "", model: "", baseUrl: "", step: 0 }),
    }),
    {
      name: "hanimo-onboarding",
    }
  )
);
