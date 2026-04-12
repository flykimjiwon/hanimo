package llm

import "sync"

// Prompt caching strategy for hanimo.
//
// Stats tracking lives in config.GlobalCacheStats (to avoid circular
// imports with providers). The CacheBreakpoint below lives in llm
// because it's consumed by the prompt builder, not the provider.
//
// Provider-level details:
//   OpenAI: automatic prefix caching (50% discount). IncludeUsage on.
//   DeepSeek: automatic context caching. No code change.
//   Anthropic (future #5): explicit cache_control on content blocks.
//   Others: varies — most auto-cache or don't support it.
//
// Strategy:
//   1. Keep system prompt prefix STABLE across turns (embed split).
//   2. Track the stable/dynamic boundary so Anthropic native can
//      insert cache_control at the right point when #5 lands.
//   3. config.GlobalCacheStats tracks hits from IncludeUsage responses.

// CacheBreakpoint tracks where the "stable" part of the system prompt
// ends. Content before this offset can be marked as cacheable when
// talking to providers that support explicit cache control (Anthropic).
//
// The boundary is set once at session start and stays fixed until a
// mode switch or /knowledge reload. This is the future insertion
// point for Anthropic's cache_control: {"type":"ephemeral"}.
type CacheBreakpoint struct {
	mu              sync.RWMutex
	stablePrefix    string // core + mode body + askuser (invariant)
	dynamicSuffix   string // project ctx + knowledge TOC + skills TOC
}

// GlobalBreakpoint tracks the system prompt cache boundary.
var GlobalBreakpoint CacheBreakpoint

// SetBreakpoint records the stable/dynamic split of the system prompt.
func (cb *CacheBreakpoint) SetBreakpoint(stable, dynamic string) {
	cb.mu.Lock()
	cb.stablePrefix = stable
	cb.dynamicSuffix = dynamic
	cb.mu.Unlock()
}

// StablePrefix returns the cacheable prefix of the system prompt.
func (cb *CacheBreakpoint) StablePrefix() string {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.stablePrefix
}

// Full returns the complete system prompt (stable + dynamic).
func (cb *CacheBreakpoint) Full() string {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.stablePrefix + cb.dynamicSuffix
}
