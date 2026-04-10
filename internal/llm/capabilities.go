package llm

// CodingTier represents a model's coding ability level.
type CodingTier int

const (
	CodingStrong   CodingTier = iota // Production-grade code generation
	CodingModerate                   // Good for standard tasks
	CodingWeak                       // Basic completions only
	CodingNone                       // No coding ability
)

// RoleType determines what tools are available.
type RoleType int

const (
	RoleAgent     RoleType = iota // Full tools (read + write + exec)
	RoleAssistant                 // Read-only tools
	RoleChat                      // No tools
)

// ModelCapability describes a model's known capabilities.
type ModelCapability struct {
	ContextWindow int
	CodingTier    CodingTier
	DefaultRole   RoleType
	SupportsTools bool
}

// knownModels maps model IDs to their capabilities.
var knownModels = map[string]ModelCapability{
	"gpt-4o":            {128000, CodingStrong, RoleAgent, true},
	"gpt-4o-mini":       {128000, CodingModerate, RoleAgent, true},
	"claude-sonnet-4":   {200000, CodingStrong, RoleAgent, true},
	"claude-haiku-4":    {200000, CodingModerate, RoleAgent, true},
	"gemini-2.5-flash":  {1000000, CodingModerate, RoleAgent, true},
	"deepseek-chat":     {128000, CodingStrong, RoleAgent, true},
	"deepseek-reasoner": {128000, CodingStrong, RoleAgent, true},
	"qwen3:8b":          {32768, CodingModerate, RoleAssistant, true},
	"qwen3:32b":         {32768, CodingStrong, RoleAgent, true},
	"qwen3-coder-30b":   {32768, CodingStrong, RoleAgent, true},
	"llama3.1:8b":       {128000, CodingWeak, RoleChat, false},
	"llama3.1:70b":      {128000, CodingModerate, RoleAgent, true},
	"codellama:13b":     {16384, CodingModerate, RoleAssistant, true},
	"mistral-large":     {128000, CodingModerate, RoleAgent, true},
	"gpt-oss-120b":      {128000, CodingStrong, RoleAgent, true},
	// Gemma models (via Novita)
	"gemma-4-26b-a4b-it": {262144, CodingStrong, RoleAgent, true},
	"gemma-4-31b-it":     {262144, CodingStrong, RoleAgent, true},
	"gemma-3-12b-it":     {128000, CodingModerate, RoleAgent, true},
	"gemma-3-27b-it":     {128000, CodingStrong, RoleAgent, true},
}

// GetCapability returns the capability for a model, with a sensible default.
func GetCapability(model string) ModelCapability {
	if cap, ok := knownModels[model]; ok {
		return cap
	}
	// Strip provider prefix (e.g. "openai/gpt-4o" -> "gpt-4o")
	for i := len(model) - 1; i >= 0; i-- {
		if model[i] == '/' {
			if cap, ok := knownModels[model[i+1:]]; ok {
				return cap
			}
			break
		}
	}
	return ModelCapability{32768, CodingModerate, RoleAssistant, true}
}

// AutoAssignRole returns the default role for a given model.
func AutoAssignRole(model string) RoleType {
	return GetCapability(model).DefaultRole
}

// RoleLabel returns a human-readable label for a role type.
func RoleLabel(r RoleType) string {
	switch r {
	case RoleAgent:
		return "Agent"
	case RoleAssistant:
		return "Assistant"
	case RoleChat:
		return "Chat"
	default:
		return "Unknown"
	}
}

// CodingTierLabel returns a human-readable label for a coding tier.
func CodingTierLabel(t CodingTier) string {
	switch t {
	case CodingStrong:
		return "Strong"
	case CodingModerate:
		return "Moderate"
	case CodingWeak:
		return "Weak"
	case CodingNone:
		return "None"
	default:
		return "Unknown"
	}
}
