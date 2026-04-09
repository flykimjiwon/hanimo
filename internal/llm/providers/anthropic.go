package providers

// AnthropicProvider uses the OpenAI-compatible layer as a stub.
// A future version may use the native Anthropic SDK.
type AnthropicProvider struct {
	*OpenAICompatProvider
}

const defaultAnthropicURL = "https://api.anthropic.com/v1"

func NewAnthropic(baseURL, apiKey string) *AnthropicProvider {
	if baseURL == "" {
		baseURL = defaultAnthropicURL
	}
	return &AnthropicProvider{
		OpenAICompatProvider: NewOpenAICompat("anthropic", baseURL, apiKey),
	}
}

func (p *AnthropicProvider) Name() string { return "anthropic" }

func init() {
	Register("anthropic", func(baseURL, apiKey string) Provider {
		return NewAnthropic(baseURL, apiKey)
	})
}
