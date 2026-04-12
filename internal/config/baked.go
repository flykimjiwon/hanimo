package config

import "fmt"

// Build-time baked configuration.
//
// hanimo supports three distribution modes, selected at `go build` time via
// `-ldflags -X`:
//
//   1. vanilla  — nothing baked. Users run `hanimo` and go through the
//      setup wizard to enter endpoint + key. Default for the public repo.
//
//   2. distro   — admin bakes the endpoint/provider/model into the binary
//      but leaves the API key empty. End users drop in HANIMO_API_KEY (or
//      fill it at the setup wizard) and everything else is fixed. Typical
//      for teams distributing a pre-configured hanimo to employees.
//
//   3. sealed   — admin bakes EVERYTHING including the API key. No user
//      input required; launching the binary goes straight to the TUI.
//      Typical for demos, kiosks, or fully managed environments. The
//      sealed binary MUST NOT be redistributed because it contains a
//      secret.
//
// Build mode is selected by setting BakedMode to "distro" or "sealed" at
// link time. In vanilla (the default "") all Baked* values are ignored.
//
// Example (distro):
//
//   go build -ldflags "\
//     -X 'github.com/flykimjiwon/hanimo/internal/config.BakedMode=distro' \
//     -X 'github.com/flykimjiwon/hanimo/internal/config.BakedBaseURL=https://api.novita.ai/v3/openai' \
//     -X 'github.com/flykimjiwon/hanimo/internal/config.BakedProvider=novita' \
//     -X 'github.com/flykimjiwon/hanimo/internal/config.BakedModel=qwen/qwen3-coder-30b'" \
//     -o hanimo ./cmd/hanimo
//
// Example (sealed):
//
//   go build -ldflags "\
//     -X 'github.com/flykimjiwon/hanimo/internal/config.BakedMode=sealed' \
//     -X 'github.com/flykimjiwon/hanimo/internal/config.BakedBaseURL=https://api.novita.ai/v3/openai' \
//     -X 'github.com/flykimjiwon/hanimo/internal/config.BakedProvider=novita' \
//     -X 'github.com/flykimjiwon/hanimo/internal/config.BakedModel=qwen/qwen3-coder-30b' \
//     -X 'github.com/flykimjiwon/hanimo/internal/config.BakedAPIKey=sk-…'" \
//     -o hanimo ./cmd/hanimo
//
// Convenience Makefile targets (build-distro / build-sealed) wrap these
// invocations so the admin doesn't have to memorize them.
var (
	// BakedMode selects the distribution mode.
	//   ""       — vanilla
	//   "distro" — endpoint+provider+model baked, API key user-provided
	//   "sealed" — everything baked including API key
	BakedMode = ""

	// BakedBaseURL is the API endpoint frozen into the binary. Ignored
	// unless BakedMode is "distro" or "sealed".
	BakedBaseURL = ""

	// BakedProvider is the logical provider name (openai / anthropic /
	// novita / ollama / ...). Used for display and for provider-specific
	// behaviour (e.g. Anthropic native path).
	BakedProvider = ""

	// BakedModel is the default Super/Plan model.
	BakedModel = ""

	// BakedDevModel is the default Deep Agent model. If empty, BakedModel
	// is used for both.
	BakedDevModel = ""

	// BakedAPIKey is the API key frozen into a "sealed" build. MUST NOT
	// be set for "distro" builds — leave empty and let the user supply
	// HANIMO_API_KEY at runtime.
	BakedAPIKey = ""

	// BakedBrand overrides the displayed product name (for white-label
	// enterprise distributions). Empty keeps the default "hanimo".
	BakedBrand = ""

	// BakedNoStream disables SSE streaming when set to "true". Some
	// endpoints (e.g. Ollama behind certain proxies) do not support
	// server-sent events. In that case we fall back to a single
	// non-streaming POST and emit the full response at once.
	BakedNoStream = ""
)

// ValidateBakedMode panics at process start if the baked mode fields
// are internally inconsistent. Called from main.go before any TUI
// initialization so misconfigured builds fail loudly instead of
// silently behaving like vanilla.
func ValidateBakedMode() {
	switch BakedMode {
	case "", "distro", "sealed":
	default:
		panic(fmt.Sprintf("config: unknown BakedMode %q (expected \"\", \"distro\", or \"sealed\")", BakedMode))
	}
	if BakedMode == "sealed" && BakedAPIKey == "" {
		panic("config: BakedMode=sealed requires BakedAPIKey to be set at build time")
	}
	if BakedMode == "sealed" && BakedBaseURL == "" {
		panic("config: BakedMode=sealed requires BakedBaseURL to be set at build time")
	}
	if BakedMode == "distro" && BakedBaseURL == "" {
		panic("config: BakedMode=distro requires BakedBaseURL to be set at build time")
	}
	if BakedAPIKey != "" && BakedMode != "sealed" {
		panic("config: BakedAPIKey must only be set when BakedMode=sealed")
	}
}

// BakeInfo returns a human-readable summary of the baked configuration,
// suitable for /config output and the startup banner.
func BakeInfo() string {
	switch BakedMode {
	case "distro":
		return "distro — endpoint/provider/model baked; API key user-provided"
	case "sealed":
		return "sealed — everything baked (do not redistribute this binary)"
	default:
		return "vanilla — user-configurable"
	}
}

// IsSealed reports whether this binary was built with a baked API key.
// Sealed builds skip the setup wizard entirely.
func IsSealed() bool { return BakedMode == "sealed" && BakedAPIKey != "" }

// IsDistro reports whether this binary was built with a baked endpoint
// but no baked key (typical team distribution).
func IsDistro() bool { return BakedMode == "distro" }

// BakedBrandName returns the product name, respecting a white-label
// override from BakedBrand.
func BakedBrandName() string {
	if BakedBrand != "" {
		return BakedBrand
	}
	return "hanimo"
}

// applyBaked returns cfg with any baked values merged in. Baked values
// only override empty/default fields — user-supplied config.yaml settings
// still win over the distro bake, except for sealed mode which forces
// everything.
func applyBaked(cfg Config) Config {
	switch BakedMode {
	case "sealed":
		// Sealed: force every baked field, ignore user config.
		if BakedBaseURL != "" {
			cfg.API.BaseURL = BakedBaseURL
		}
		if BakedAPIKey != "" {
			cfg.API.APIKey = BakedAPIKey
		}
		if BakedModel != "" {
			cfg.Models.Super = BakedModel
			if BakedDevModel == "" {
				cfg.Models.Dev = BakedModel
			}
		}
		if BakedDevModel != "" {
			cfg.Models.Dev = BakedDevModel
		}
		if BakedProvider != "" {
			cfg.Default.Provider = BakedProvider
		}
	case "distro":
		// Distro: freeze endpoint/provider/model, leave API key to user.
		//
		// The endpoint is forced because that's the whole point of a
		// distro build — an admin pinning where traffic goes. We do NOT
		// clobber any of the MODEL fields anymore: the old heuristic
		// (overwrite when the field equals DefaultModel) falsely
		// triggered if a user's explicit choice happened to match the
		// default, which silently swapped their model under them.
		//
		// Precedence for models in distro builds is therefore:
		//   user config.yaml > env HANIMO_MODEL_* > baked model > built-in default
		// applyBaked only fires when the earlier layers left the field
		// at its built-in default value AND there was no config.yaml on
		// disk — which we detect via the presence of a config file in
		// the caller (see Load).
		if BakedBaseURL != "" {
			cfg.API.BaseURL = BakedBaseURL
		}
		if BakedProvider != "" && cfg.Default.Provider == "" {
			cfg.Default.Provider = BakedProvider
		}
		if !distroUserHasConfig {
			if BakedModel != "" {
				cfg.Models.Super = BakedModel
			}
			devBake := BakedDevModel
			if devBake == "" {
				devBake = BakedModel
			}
			if devBake != "" {
				cfg.Models.Dev = devBake
			}
		}
	}
	// Apply NoStream regardless of bake mode (also settable via config.yaml)
	if BakedNoStream == "true" {
		cfg.NoStream = true
	}
	return cfg
}

// distroUserHasConfig is flipped by Load() when a ~/.hanimo/config.yaml
// was actually read from disk so applyBaked can tell "user chose the
// default value" from "no user config at all, just the built-in default".
// It is intentionally a package-level flag rather than a parameter on
// applyBaked so the existing three-line call sites stay unchanged.
var distroUserHasConfig bool
