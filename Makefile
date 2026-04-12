VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BINARY = hanimo
PKG_CONFIG = github.com/flykimjiwon/hanimo/internal/config

LDFLAGS = -ldflags "-s -w -X main.version=$(VERSION) \
	-X '$(PKG_CONFIG).DebugMode=true'"

# Bake variables (set on the command line for build-distro / build-sealed):
#   ENDPOINT  — API base URL (required)
#   PROVIDER  — provider name (novita / openai / anthropic / ollama / …)
#   MODEL     — default Super/Plan model
#   DEV_MODEL — default Deep Agent model (optional, falls back to MODEL)
#   API_KEY   — sealed mode only; baked secret (keep this binary private)
#   BRAND     — white-label product name override (optional)
ENDPOINT  ?=
PROVIDER  ?=
MODEL     ?=
DEV_MODEL ?=
API_KEY   ?=
BRAND     ?=
NO_STREAM ?=

BAKE_COMMON = \
	-X '$(PKG_CONFIG).BakedBaseURL=$(ENDPOINT)' \
	-X '$(PKG_CONFIG).BakedProvider=$(PROVIDER)' \
	-X '$(PKG_CONFIG).BakedModel=$(MODEL)' \
	-X '$(PKG_CONFIG).BakedDevModel=$(DEV_MODEL)' \
	-X '$(PKG_CONFIG).BakedBrand=$(BRAND)' \
	-X '$(PKG_CONFIG).BakedNoStream=$(NO_STREAM)'

LDFLAGS_DISTRO = -ldflags "-s -w -X main.version=$(VERSION) \
	-X '$(PKG_CONFIG).BakedMode=distro' \
	$(BAKE_COMMON)"

LDFLAGS_SEALED = -ldflags "-s -w -X main.version=$(VERSION) \
	-X '$(PKG_CONFIG).BakedMode=sealed' \
	-X '$(PKG_CONFIG).BakedAPIKey=$(API_KEY)' \
	$(BAKE_COMMON)"

.PHONY: build run clean build-all install lint test build-index \
	build-distro build-sealed build-distro-all build-sealed-all bake-help

# Knowledge index
build-index:
	@echo "Building knowledge index..."
	@go run ./cmd/build-index/
	@echo "Index built."

build: build-index
	go build $(LDFLAGS) -o $(BINARY) ./cmd/hanimo

run: build
	./$(BINARY)

install:
	go install $(LDFLAGS) ./cmd/hanimo

clean:
	rm -f $(BINARY)
	rm -rf dist/

build-all: clean
	mkdir -p dist
	GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o dist/$(BINARY)-darwin-arm64 ./cmd/hanimo
	GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o dist/$(BINARY)-darwin-amd64 ./cmd/hanimo
	GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o dist/$(BINARY)-windows-amd64.exe ./cmd/hanimo
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o dist/$(BINARY)-linux-amd64 ./cmd/hanimo
	GOOS=linux GOARCH=arm64 go build $(LDFLAGS) -o dist/$(BINARY)-linux-arm64 ./cmd/hanimo

lint:
	go vet ./...

test:
	go test ./...

# ---------- baked distribution builds ----------
#
# Three distribution modes:
#
#   1. vanilla — `make build`           (nothing baked)
#   2. distro  — `make build-distro ENDPOINT=… PROVIDER=… MODEL=…`
#                endpoint/provider/model frozen; user supplies API_KEY at runtime
#   3. sealed  — `make build-sealed ENDPOINT=… PROVIDER=… MODEL=… API_KEY=…`
#                everything frozen, ready to run; DO NOT redistribute
#
# Use build-distro-all / build-sealed-all for cross-platform matrices.

bake-help:
	@echo ""
	@echo "hanimo baked-build cheat sheet"
	@echo "------------------------------"
	@echo "  make build"
	@echo "    → vanilla; nothing baked"
	@echo ""
	@echo "  make build-distro \\"
	@echo "    ENDPOINT=https://api.novita.ai/v3/openai \\"
	@echo "    PROVIDER=novita \\"
	@echo "    MODEL=qwen/qwen3-coder-30b"
	@echo "    → endpoint/provider/model frozen; user provides API_KEY at runtime"
	@echo ""
	@echo "  make build-sealed \\"
	@echo "    ENDPOINT=https://api.novita.ai/v3/openai \\"
	@echo "    PROVIDER=novita \\"
	@echo "    MODEL=qwen/qwen3-coder-30b \\"
	@echo "    API_KEY=sk-…"
	@echo "    → everything frozen; binary contains a secret, keep private"
	@echo ""
	@echo "  make build-distro-all … (cross-platform matrix)"
	@echo "  make build-sealed-all … (cross-platform matrix)"
	@echo ""

build-distro: build-index
	@test -n "$(ENDPOINT)" || (echo "error: ENDPOINT is required for build-distro" && exit 1)
	go build $(LDFLAGS_DISTRO) -o $(BINARY) ./cmd/hanimo
	@echo "✓ distro build: ENDPOINT=$(ENDPOINT) PROVIDER=$(PROVIDER) MODEL=$(MODEL)"

build-sealed: build-index
	@test -n "$(ENDPOINT)" || (echo "error: ENDPOINT is required for build-sealed" && exit 1)
	@test -n "$(API_KEY)"  || (echo "error: API_KEY is required for build-sealed"  && exit 1)
	go build $(LDFLAGS_SEALED) -o $(BINARY) ./cmd/hanimo
	@echo "✓ sealed build: keep this binary private — it contains a baked key"

build-distro-all: clean build-index
	@test -n "$(ENDPOINT)" || (echo "error: ENDPOINT is required" && exit 1)
	@mkdir -p dist
	GOOS=darwin  GOARCH=arm64 go build $(LDFLAGS_DISTRO) -o dist/$(BINARY)-distro-darwin-arm64       ./cmd/hanimo
	GOOS=darwin  GOARCH=amd64 go build $(LDFLAGS_DISTRO) -o dist/$(BINARY)-distro-darwin-amd64       ./cmd/hanimo
	GOOS=linux   GOARCH=amd64 go build $(LDFLAGS_DISTRO) -o dist/$(BINARY)-distro-linux-amd64        ./cmd/hanimo
	GOOS=linux   GOARCH=arm64 go build $(LDFLAGS_DISTRO) -o dist/$(BINARY)-distro-linux-arm64        ./cmd/hanimo
	GOOS=windows GOARCH=amd64 go build $(LDFLAGS_DISTRO) -o dist/$(BINARY)-distro-windows-amd64.exe  ./cmd/hanimo
	@echo "✓ distro matrix built in dist/"

build-sealed-all: clean build-index
	@test -n "$(ENDPOINT)" || (echo "error: ENDPOINT is required" && exit 1)
	@test -n "$(API_KEY)"  || (echo "error: API_KEY is required"  && exit 1)
	@mkdir -p dist
	GOOS=darwin  GOARCH=arm64 go build $(LDFLAGS_SEALED) -o dist/$(BINARY)-sealed-darwin-arm64      ./cmd/hanimo
	GOOS=darwin  GOARCH=amd64 go build $(LDFLAGS_SEALED) -o dist/$(BINARY)-sealed-darwin-amd64      ./cmd/hanimo
	GOOS=linux   GOARCH=amd64 go build $(LDFLAGS_SEALED) -o dist/$(BINARY)-sealed-linux-amd64       ./cmd/hanimo
	GOOS=linux   GOARCH=arm64 go build $(LDFLAGS_SEALED) -o dist/$(BINARY)-sealed-linux-arm64       ./cmd/hanimo
	GOOS=windows GOARCH=amd64 go build $(LDFLAGS_SEALED) -o dist/$(BINARY)-sealed-windows-amd64.exe ./cmd/hanimo
	@echo "✓ sealed matrix built in dist/ — contains baked secret, keep private"
