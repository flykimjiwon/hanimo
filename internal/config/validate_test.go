package config

import (
	"strings"
	"testing"
)

func mustPanic(t *testing.T, wantSubstr string, fn func()) {
	t.Helper()
	defer func() {
		r := recover()
		if r == nil {
			t.Errorf("expected panic containing %q, got none", wantSubstr)
			return
		}
		msg := ""
		switch v := r.(type) {
		case string:
			msg = v
		case error:
			msg = v.Error()
		}
		if !strings.Contains(msg, wantSubstr) {
			t.Errorf("panic message %q missing %q", msg, wantSubstr)
		}
	}()
	fn()
}

func TestValidateBakedMode_Vanilla(t *testing.T) {
	prev := BakedMode
	defer func() { BakedMode = prev }()
	BakedMode = ""
	ValidateBakedMode() // must not panic
}

func TestValidateBakedMode_UnknownMode(t *testing.T) {
	oldMode := BakedMode
	defer func() { BakedMode = oldMode }()
	BakedMode = "weird"
	mustPanic(t, "unknown BakedMode", func() { ValidateBakedMode() })
}

func TestValidateBakedMode_SealedWithoutKey(t *testing.T) {
	oldMode, oldURL, oldKey := BakedMode, BakedBaseURL, BakedAPIKey
	defer func() { BakedMode, BakedBaseURL, BakedAPIKey = oldMode, oldURL, oldKey }()
	BakedMode = "sealed"
	BakedBaseURL = "https://example.com/v1"
	BakedAPIKey = ""
	mustPanic(t, "BakedAPIKey", func() { ValidateBakedMode() })
}

func TestValidateBakedMode_SealedWithoutURL(t *testing.T) {
	oldMode, oldURL, oldKey := BakedMode, BakedBaseURL, BakedAPIKey
	defer func() { BakedMode, BakedBaseURL, BakedAPIKey = oldMode, oldURL, oldKey }()
	BakedMode = "sealed"
	BakedBaseURL = ""
	BakedAPIKey = "sk-foo"
	mustPanic(t, "BakedBaseURL", func() { ValidateBakedMode() })
}

func TestValidateBakedMode_DistroWithoutURL(t *testing.T) {
	oldMode, oldURL := BakedMode, BakedBaseURL
	defer func() { BakedMode, BakedBaseURL = oldMode, oldURL }()
	BakedMode = "distro"
	BakedBaseURL = ""
	mustPanic(t, "BakedBaseURL", func() { ValidateBakedMode() })
}

func TestValidateBakedMode_VanillaWithKey(t *testing.T) {
	oldMode, oldKey := BakedMode, BakedAPIKey
	defer func() { BakedMode, BakedAPIKey = oldMode, oldKey }()
	BakedMode = ""
	BakedAPIKey = "sk-stray"
	mustPanic(t, "BakedAPIKey must only be set when BakedMode=sealed", func() {
		ValidateBakedMode()
	})
}

func TestValidateBakedMode_DistroValid(t *testing.T) {
	oldMode, oldURL := BakedMode, BakedBaseURL
	defer func() { BakedMode, BakedBaseURL = oldMode, oldURL }()
	BakedMode = "distro"
	BakedBaseURL = "https://example.com/v1"
	ValidateBakedMode() // must not panic
}

func TestValidateBakedMode_SealedValid(t *testing.T) {
	oldMode, oldURL, oldKey := BakedMode, BakedBaseURL, BakedAPIKey
	defer func() { BakedMode, BakedBaseURL, BakedAPIKey = oldMode, oldURL, oldKey }()
	BakedMode = "sealed"
	BakedBaseURL = "https://example.com/v1"
	BakedAPIKey = "sk-baked"
	ValidateBakedMode() // must not panic
}
