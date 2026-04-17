package llm

type ModelInfo struct {
	ID          string
	DisplayName string
	Description string
}

var Models = map[string]ModelInfo{
	// OpenAI
	"gpt-4o":      {ID: "gpt-4o", DisplayName: "GPT-4o", Description: "OpenAI flagship multimodal"},
	"gpt-4o-mini": {ID: "gpt-4o-mini", DisplayName: "GPT-4o Mini", Description: "OpenAI fast & cheap"},
	"o3-mini":     {ID: "o3-mini", DisplayName: "o3-mini", Description: "OpenAI reasoning model"},
	// Anthropic
	"claude-sonnet-4":  {ID: "claude-sonnet-4", DisplayName: "Claude Sonnet 4", Description: "Anthropic balanced"},
	"claude-haiku-4":   {ID: "claude-haiku-4", DisplayName: "Claude Haiku 4", Description: "Anthropic fast"},
	"claude-opus-4":    {ID: "claude-opus-4", DisplayName: "Claude Opus 4", Description: "Anthropic flagship"},
	// Google
	"gemini-2.5-pro": {ID: "gemini-2.5-pro", DisplayName: "Gemini 2.5 Pro", Description: "Google flagship"},
	"gemini-2.5-flash": {ID: "gemini-2.5-flash", DisplayName: "Gemini 2.5 Flash", Description: "Google fast"},
	// DeepSeek
	"deepseek-chat":     {ID: "deepseek-chat", DisplayName: "DeepSeek V3", Description: "DeepSeek general"},
	"deepseek-reasoner": {ID: "deepseek-reasoner", DisplayName: "DeepSeek R1", Description: "DeepSeek reasoning"},
	// Open models (Ollama/Novita/vLLM)
	"qwen3:8b":          {ID: "qwen3:8b", DisplayName: "Qwen3 8B", Description: "Alibaba local model"},
	"llama3.1:8b":       {ID: "llama3.1:8b", DisplayName: "Llama 3.1 8B", Description: "Meta local model"},
	"codestral:latest":  {ID: "codestral:latest", DisplayName: "Codestral", Description: "Mistral coding model"},
	"gemma-4:12b":       {ID: "gemma-4:12b", DisplayName: "Gemma 4 12B", Description: "Google open model"},
}
