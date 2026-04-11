package providers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	openai "github.com/sashabaranov/go-openai"
)

// retryableStatus reports whether an HTTP status should trigger a retry.
func retryableStatus(code int) bool {
	return code == 429 || code == 408 || (code >= 500 && code <= 599)
}

// friendlyError converts upstream API errors into Korean user-facing messages.
// Returns the original error wrapped with a localized prefix when recognizable.
func friendlyError(err error) error {
	if err == nil {
		return nil
	}
	var apiErr *openai.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.HTTPStatusCode {
		case 401:
			return fmt.Errorf("인증 실패 (401): API 키를 확인하세요 — %w", err)
		case 403:
			return fmt.Errorf("권한 거부 (403): 이 모델/엔드포인트 접근이 허용되지 않았습니다 — %w", err)
		case 404:
			return fmt.Errorf("모델을 찾을 수 없음 (404): 모델 ID를 확인하세요 — %w", err)
		case 408:
			return fmt.Errorf("요청 타임아웃 (408): 네트워크 상태를 확인하세요 — %w", err)
		case 429:
			return fmt.Errorf("요청 한도 초과 (429): 재시도해도 실패했습니다. 잠시 후 다시 시도하거나 다른 프로바이더로 전환하세요 — %w", err)
		case 500, 502, 503, 504:
			return fmt.Errorf("프로바이더 서버 오류 (%d): 재시도해도 실패했습니다 — %w", apiErr.HTTPStatusCode, err)
		}
	}
	msg := err.Error()
	switch {
	case strings.Contains(msg, "context deadline exceeded"), strings.Contains(msg, "i/o timeout"):
		return fmt.Errorf("연결 타임아웃: 프로바이더 응답이 없습니다 — %w", err)
	case strings.Contains(msg, "connection refused"):
		return fmt.Errorf("연결 거부: 엔드포인트가 실행 중인지 확인하세요 (Ollama/vLLM 등) — %w", err)
	case strings.Contains(msg, "no such host"):
		return fmt.Errorf("호스트를 찾을 수 없음: base_url을 확인하세요 — %w", err)
	}
	return err
}

// createStreamWithRetry wraps CreateChatCompletionStream with exponential
// backoff retry on 429 / 5xx / transient network errors. Max 4 attempts
// (1s → 2s → 4s → 8s). Non-retryable errors return immediately.
func createStreamWithRetry(ctx context.Context, api *openai.Client, req openai.ChatCompletionRequest) (*openai.ChatCompletionStream, error) {
	const maxAttempts = 4
	var lastErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		stream, err := api.CreateChatCompletionStream(ctx, req)
		if err == nil {
			return stream, nil
		}
		lastErr = err
		var apiErr *openai.APIError
		if errors.As(err, &apiErr) && !retryableStatus(apiErr.HTTPStatusCode) {
			return nil, friendlyError(err)
		}
		if attempt == maxAttempts-1 {
			break
		}
		backoff := time.Duration(1<<attempt) * time.Second
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(backoff):
		}
	}
	return nil, friendlyError(lastErr)
}

// defaultBaseURLs maps provider names to their default API base URLs.
var defaultBaseURLs = map[string]string{
	"openai":     "https://api.openai.com/v1",
	"novita":     "https://api.novita.ai/v1",
	"openrouter": "https://openrouter.ai/api/v1",
	"deepseek":   "https://api.deepseek.com/v1",
	"groq":       "https://api.groq.com/openai/v1",
	"together":   "https://api.together.xyz/v1",
	"fireworks":  "https://api.fireworks.ai/inference/v1",
	"mistral":    "https://api.mistral.ai/v1",
}

// OpenAICompatProvider implements Provider using the OpenAI-compatible API.
type OpenAICompatProvider struct {
	name   string
	api    *openai.Client
	apiKey string
}

// normalizeBaseURL ensures the base URL is in the correct format.
func normalizeBaseURL(url string) string {
	url = strings.TrimRight(url, "/")
	url = strings.TrimSuffix(url, "/chat/completions")
	url = strings.TrimRight(url, "/")
	return url
}

// NewOpenAICompat creates a new OpenAI-compatible provider.
func NewOpenAICompat(name, baseURL, apiKey string) *OpenAICompatProvider {
	if baseURL == "" {
		if defaultURL, ok := defaultBaseURLs[name]; ok {
			baseURL = defaultURL
		} else {
			baseURL = defaultBaseURLs["openai"]
		}
	}

	cfg := openai.DefaultConfig(apiKey)
	cfg.BaseURL = normalizeBaseURL(baseURL)

	return &OpenAICompatProvider{
		name:   name,
		api:    openai.NewClientWithConfig(cfg),
		apiKey: apiKey,
	}
}

func (p *OpenAICompatProvider) Name() string { return p.name }

func (p *OpenAICompatProvider) SupportsTools() bool { return true }

func (p *OpenAICompatProvider) ListModels() ([]ModelInfo, error) {
	return nil, nil // not implemented for generic OpenAI-compatible
}

// Chat streams a chat completion, returning chunks on a channel.
func (p *OpenAICompatProvider) Chat(ctx context.Context, req ChatRequest) (<-chan ChatChunk, error) {
	// Convert messages
	msgs := make([]openai.ChatCompletionMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		msg := openai.ChatCompletionMessage{
			Role:    m.Role,
			Content: m.Content,
			Name:    m.Name,
		}
		if m.ToolCallID != "" {
			msg.ToolCallID = m.ToolCallID
		}
		if len(m.ToolCalls) > 0 {
			for _, tc := range m.ToolCalls {
				msg.ToolCalls = append(msg.ToolCalls, openai.ToolCall{
					ID:   tc.ID,
					Type: openai.ToolTypeFunction,
					Function: openai.FunctionCall{
						Name:      tc.Name,
						Arguments: tc.Arguments,
					},
				})
			}
		}
		msgs = append(msgs, msg)
	}

	// Convert tools
	var toolDefs []openai.Tool
	for _, t := range req.Tools {
		toolDefs = append(toolDefs, openai.Tool{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.Parameters,
			},
		})
	}

	apiReq := openai.ChatCompletionRequest{
		Model:    req.Model,
		Messages: msgs,
		Stream:   true,
	}
	if len(toolDefs) > 0 {
		apiReq.Tools = toolDefs
	}

	stream, err := createStreamWithRetry(ctx, p.api, apiReq)
	if err != nil {
		return nil, err
	}

	ch := make(chan ChatChunk)
	go func() {
		defer close(ch)
		defer stream.Close()

		tcMap := make(map[int]*ToolCall)

		for {
			resp, err := stream.Recv()
			if errors.Is(err, io.EOF) {
				// Stream finished — emit accumulated tool calls
				if len(tcMap) > 0 {
					calls := make([]ToolCall, 0, len(tcMap))
					for i := 0; i < len(tcMap); i++ {
						if tc, ok := tcMap[i]; ok {
							calls = append(calls, *tc)
						}
					}
					ch <- ChatChunk{Done: true, ToolCalls: calls}
				} else {
					ch <- ChatChunk{Done: true}
				}
				return
			}
			if err != nil {
				ch <- ChatChunk{Error: friendlyError(err), Done: true}
				return
			}

			if len(resp.Choices) == 0 {
				continue
			}

			delta := resp.Choices[0].Delta

			// Stream text content
			if delta.Content != "" {
				ch <- ChatChunk{Content: delta.Content}
			}

			// Accumulate tool call deltas
			for _, tc := range delta.ToolCalls {
				idx := 0
				if tc.Index != nil {
					idx = *tc.Index
				}
				if _, ok := tcMap[idx]; !ok {
					tcMap[idx] = &ToolCall{
						ID:   tc.ID,
						Name: tc.Function.Name,
					}
				} else {
					if tc.ID != "" {
						tcMap[idx].ID = tc.ID
					}
					if tc.Function.Name != "" {
						tcMap[idx].Name = tc.Function.Name
					}
				}
				tcMap[idx].Arguments += tc.Function.Arguments
			}
		}
	}()

	return ch, nil
}

func init() {
	// Register all OpenAI-compatible providers
	openaiCompat := []string{
		"openai", "novita", "openrouter", "deepseek",
		"groq", "together", "fireworks", "mistral",
		"vllm", "lmstudio", "custom",
	}
	for _, name := range openaiCompat {
		n := name // capture
		Register(n, func(baseURL, apiKey string) Provider {
			return NewOpenAICompat(n, baseURL, apiKey)
		})
	}
}
