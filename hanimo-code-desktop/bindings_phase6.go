package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// ModelOption is a single entry in the ProviderChip dropdown.
type ModelOption struct {
	ID       string `json:"id"`       // canonical model id (e.g. "qwen3-coder-30b")
	Label    string `json:"label"`    // display name
	Provider string `json:"provider"` // "anthropic" | "openai" | "google" | "ollama" | ...
	Tier     string `json:"tier"`     // "T1" | "T2" | "T3"
	Group    string `json:"group"`    // "Certified" | "Discovered" | "Community"
	Hint     string `json:"hint"`     // short description shown in subtitle
}

// tier1Catalog mirrors docs/strategy/hanimo-certified-models-v0.2.4.md.
// Static list — refreshed manually when the certified tier is updated.
var tier1Catalog = []ModelOption{
	{ID: "claude-sonnet-4-6", Label: "Claude Sonnet 4.6", Provider: "anthropic", Tier: "T1", Group: "Certified", Hint: "1M context · SWE 80%"},
	{ID: "gpt-5", Label: "GPT-5", Provider: "openai", Tier: "T1", Group: "Certified", Hint: "Codex-class"},
	{ID: "gemini-2.5-pro", Label: "Gemini 2.5 Pro", Provider: "google", Tier: "T1", Group: "Certified", Hint: "free tier 1000 req/day"},
	{ID: "qwen3-coder-30b", Label: "Qwen3-Coder 30B", Provider: "ollama", Tier: "T1", Group: "Certified", Hint: "256K context · local"},
	{ID: "gpt-oss-120b", Label: "gpt-oss 120B", Provider: "novita", Tier: "T1", Group: "Certified", Hint: "$0.20/MTok"},
}

var tier2Catalog = []ModelOption{
	{ID: "deepseek-chat", Label: "DeepSeek V3", Provider: "deepseek", Tier: "T2", Group: "Supported", Hint: "$0.14/$0.28"},
	{ID: "mistral-large", Label: "Mistral Large", Provider: "mistral", Tier: "T2", Group: "Supported"},
	{ID: "gemma-4-31b-it", Label: "Gemma 4 31B", Provider: "novita", Tier: "T2", Group: "Supported", Hint: "262K context"},
	{ID: "gemini-2.5-flash", Label: "Gemini 2.5 Flash", Provider: "google", Tier: "T2", Group: "Supported", Hint: "free 1000 req/day"},
}

// fetchOllamaTags returns local Ollama models, or nil on any error.
// Best-effort: short timeout so the dropdown doesn't hang on a missing daemon.
func fetchOllamaTags(baseURL string) []ModelOption {
	if baseURL == "" {
		return nil
	}
	// Strip "/v1" suffix if present — Ollama's tags endpoint sits at /api/tags.
	root := strings.TrimSuffix(strings.TrimRight(baseURL, "/"), "/v1")
	if root == "" {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 700*time.Millisecond)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "GET", root+"/api/tags", nil)
	if err != nil {
		return nil
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil
	}

	var body struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil
	}

	var out []ModelOption
	for _, m := range body.Models {
		if m.Name == "" {
			continue
		}
		out = append(out, ModelOption{
			ID:       m.Name,
			Label:    m.Name,
			Provider: "ollama",
			Tier:     "T3",
			Group:    "Discovered",
			Hint:     "local Ollama tag",
		})
	}
	return out
}

// GetAvailableModels merges the static T1/T2 catalog with local Ollama tags.
// Frontend Phase 6 ProviderChip dropdown calls this on open.
func (a *App) GetAvailableModels() []ModelOption {
	cfg := LoadTGCConfig()
	out := make([]ModelOption, 0, len(tier1Catalog)+len(tier2Catalog)+10)
	out = append(out, tier1Catalog...)
	out = append(out, tier2Catalog...)
	if tags := fetchOllamaTags(cfg.API.BaseURL); len(tags) > 0 {
		out = append(out, tags...)
	}
	return out
}

// saveTGCConfig writes config.yaml back to ~/.hanimo/config.yaml. Used by
// SwitchModel to persist user choice across restarts.
func saveTGCConfig(cfg TGCConfig) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dir := filepath.Join(home, ".hanimo")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("mkdir %s: %w", dir, err)
	}
	data, err := yaml.Marshal(&cfg)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	path := filepath.Join(dir, "config.yaml")
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}

// SwitchModel updates the active model in config.yaml and rebuilds the chat
// engine so the next message uses the new model. Returns the new model name
// for toast confirmation.
func (a *App) SwitchModel(modelID string) (string, error) {
	if strings.TrimSpace(modelID) == "" {
		return "", fmt.Errorf("empty model id")
	}
	cfg := LoadTGCConfig()
	cfg.Models.Super = modelID
	cfg.Models.Dev = modelID
	if err := saveTGCConfig(cfg); err != nil {
		return "", err
	}
	// Rebuild chat with new config so subsequent SendMessage uses the new model.
	a.chatMu.Lock()
	defer a.chatMu.Unlock()
	if a.chat != nil {
		a.chat = newChatEngine(cfg, a)
	}
	return modelID, nil
}
