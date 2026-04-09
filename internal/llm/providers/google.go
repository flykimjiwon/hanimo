package providers

// GoogleProvider uses the OpenAI-compatible layer as a stub.
// Google Gemini exposes an OpenAI-compatible endpoint at generativelanguage.googleapis.com.
type GoogleProvider struct {
	*OpenAICompatProvider
}

const defaultGoogleURL = "https://generativelanguage.googleapis.com/v1beta/openai"

func NewGoogle(baseURL, apiKey string) *GoogleProvider {
	if baseURL == "" {
		baseURL = defaultGoogleURL
	}
	return &GoogleProvider{
		OpenAICompatProvider: NewOpenAICompat("google", baseURL, apiKey),
	}
}

func (p *GoogleProvider) Name() string { return "google" }

func init() {
	Register("google", func(baseURL, apiKey string) Provider {
		return NewGoogle(baseURL, apiKey)
	})
}
