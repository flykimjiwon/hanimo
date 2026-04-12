package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

type APIConfig struct {
	BaseURL string `yaml:"base_url"`
	APIKey  string `yaml:"api_key"`
}

type ModelsConfig struct {
	Super string `yaml:"super"`
	Dev   string `yaml:"dev"`
}

type ProviderConfig struct {
	APIKey  string `yaml:"api_key,omitempty"`
	BaseURL string `yaml:"base_url,omitempty"`
}

type DefaultConfig_ struct {
	Provider string `yaml:"provider,omitempty"`
	Model    string `yaml:"model,omitempty"`
}

type Config struct {
	API           APIConfig                 `yaml:"api"`
	Models        ModelsConfig              `yaml:"models"`
	Default       DefaultConfig_            `yaml:"default,omitempty"`
	Providers     map[string]ProviderConfig `yaml:"providers,omitempty"`
	MaxIterations int                       `yaml:"max_iterations,omitempty"`
	NoStream      bool                      `yaml:"no_stream,omitempty"`
}

// Build-time overridable defaults (set via -ldflags)
var (
	DefaultBaseURL  = "http://localhost:11434/v1"
	DefaultModel    = "qwen3:8b"
	DefaultDevModel = "qwen3:8b"
	ConfigDirName   = ".hanimo"
	DebugMode       = "false" // set to "true" via ldflags in build-debug
)

// IsDebug returns true when the binary was built with debug mode enabled.
func IsDebug() bool { return DebugMode == "true" }

var (
	debugFile *os.File
	debugMu   sync.Mutex
)

// InitDebugLog opens the debug log file in the config directory.
func InitDebugLog() {
	if !IsDebug() {
		return
	}
	dir := ConfigDir()
	_ = os.MkdirAll(dir, 0755)
	f, err := os.Create(filepath.Join(dir, "debug.log"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "[DEBUG] failed to create debug.log: %v\n", err)
		return
	}
	debugFile = f
	DebugLog("========================================")
	DebugLog("=== HANIMO DEBUG MODE ===")
	DebugLog("========================================")
	DebugLog("[SYS] OS=%s | ARCH=%s | GoVersion=%s", runtime.GOOS, runtime.GOARCH, runtime.Version())
	hostname, _ := os.Hostname()
	DebugLog("[SYS] Hostname=%s", hostname)
	home, _ := os.UserHomeDir()
	DebugLog("[SYS] HomeDir=%s", home)
	cwd, _ := os.Getwd()
	DebugLog("[SYS] CWD=%s", cwd)
	DebugLog("[SYS] ConfigDir=%s", dir)
	DebugLog("[SYS] PID=%d", os.Getpid())
	// Dump all HANIMO_ env vars
	for _, e := range os.Environ() {
		if strings.HasPrefix(e, "HANIMO_") || strings.HasPrefix(e, "HTTP") || strings.HasPrefix(e, "NO_PROXY") || strings.HasPrefix(e, "https_proxy") || strings.HasPrefix(e, "http_proxy") || strings.HasPrefix(e, "no_proxy") {
			DebugLog("[ENV] %s", e)
		}
	}
	DebugLog("========================================")
}

// CloseDebugLog flushes and closes the debug log file.
func CloseDebugLog() {
	debugMu.Lock()
	defer debugMu.Unlock()
	if debugFile != nil {
		debugFile.Close()
		debugFile = nil
	}
}

// DebugLog writes a timestamped line to the debug log file.
// No-op when debug mode is disabled or log file is not open.
func DebugLog(format string, args ...interface{}) {
	if !IsDebug() || debugFile == nil {
		return
	}
	debugMu.Lock()
	defer debugMu.Unlock()
	msg := fmt.Sprintf(format, args...)
	fmt.Fprintf(debugFile, "[%s] %s\n", time.Now().Format("15:04:05.000"), msg)
}

// DebugLogPath returns the path to the debug log file.
func DebugLogPath() string {
	return filepath.Join(ConfigDir(), "debug.log")
}

func DefaultConfig() Config {
	return Config{
		API: APIConfig{
			BaseURL: DefaultBaseURL,
			APIKey:  "",
		},
		Models: ModelsConfig{
			Super: DefaultModel,
			Dev:   DefaultDevModel,
		},
	}
}

func ConfigDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ConfigDirName)
}

func ConfigPath() string {
	return filepath.Join(ConfigDir(), "config.yaml")
}

// Load resolves configuration in this precedence order (highest first):
//
//   1. sealed bake     — admin-frozen values, cannot be overridden
//   2. environment     — HANIMO_* vars (skipped in sealed mode)
//   3. ~/.hanimo/config.yaml — user config (skipped in sealed mode)
//   4. distro bake     — admin endpoint/provider/model (only where user is silent)
//   5. built-in default — DefaultBaseURL etc.
func Load() (Config, error) {
	cfg := DefaultConfig()

	// Sealed binaries ignore user config and env entirely.
	if IsSealed() {
		return applyBaked(cfg), nil
	}

	data, err := os.ReadFile(ConfigPath())
	if err == nil {
		if err := yaml.Unmarshal(data, &cfg); err != nil {
			return cfg, fmt.Errorf("config parse error: %w", err)
		}
		distroUserHasConfig = true
	} else {
		distroUserHasConfig = false
	}

	if v := os.Getenv("HANIMO_API_BASE_URL"); v != "" {
		cfg.API.BaseURL = v
	}
	if v := os.Getenv("HANIMO_API_KEY"); v != "" {
		cfg.API.APIKey = v
	}
	if v := os.Getenv("HANIMO_MODEL_SUPER"); v != "" {
		cfg.Models.Super = v
	}
	if v := os.Getenv("HANIMO_MODEL_DEV"); v != "" {
		cfg.Models.Dev = v
	}
	if v := os.Getenv("HANIMO_NO_STREAM"); v == "true" || v == "1" {
		cfg.NoStream = true
	}

	// Distro bake fills in any remaining empty/default fields.
	cfg = applyBaked(cfg)
	return cfg, nil
}

func Save(cfg Config) error {
	dir := ConfigDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config dir: %w", err)
	}
	data, err := yaml.Marshal(&cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}
	return os.WriteFile(ConfigPath(), data, 0600)
}

func NeedsSetup() bool {
	// Sealed binaries ship with everything frozen — never prompt.
	if IsSealed() {
		return false
	}
	// Ollama doesn't need API key, so skip setup if using default (localhost)
	cfg, err := Load()
	if err != nil {
		return false // don't block startup
	}
	// No setup needed if using Ollama (localhost) or if API key is set
	if strings.Contains(cfg.API.BaseURL, "localhost") || strings.Contains(cfg.API.BaseURL, "127.0.0.1") {
		return false
	}
	return cfg.API.APIKey == "" && os.Getenv("HANIMO_API_KEY") == ""
}

func RunSetupWizard() (Config, error) {
	cfg := applyBaked(DefaultConfig())
	reader := bufio.NewReader(os.Stdin)

	fmt.Printf("\n  %s 설정  (%s)\n", BakedBrandName(), BakeInfo())

	if IsDistro() {
		// Distro: endpoint is baked. Only ask for the key.
		fmt.Printf("  엔드포인트: %s (빌드 고정)\n", cfg.API.BaseURL)
		if cfg.Default.Provider != "" {
			fmt.Printf("  프로바이더: %s (빌드 고정)\n", cfg.Default.Provider)
		}
		if cfg.Models.Super != "" {
			fmt.Printf("  기본 모델: %s (빌드 고정)\n", cfg.Models.Super)
		}
		fmt.Print("  API Key: ")
		if input, _ := reader.ReadString('\n'); strings.TrimSpace(input) != "" {
			cfg.API.APIKey = strings.TrimSpace(input)
		}
	} else {
		hint := cfg.API.BaseURL
		if hint == "" {
			hint = DefaultBaseURL
		}
		fmt.Printf("  API Base URL [%s]: ", hint)
		if input, _ := reader.ReadString('\n'); strings.TrimSpace(input) != "" {
			cfg.API.BaseURL = strings.TrimSpace(input)
		}

		fmt.Print("  API Key: ")
		if input, _ := reader.ReadString('\n'); strings.TrimSpace(input) != "" {
			cfg.API.APIKey = strings.TrimSpace(input)
		}
	}

	if err := Save(cfg); err != nil {
		return cfg, err
	}

	fmt.Printf("\n  저장됨: %s\n\n", ConfigPath())
	return cfg, nil
}
