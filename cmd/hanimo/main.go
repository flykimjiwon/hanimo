package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	tea "charm.land/bubbletea/v2"

	"github.com/flykimjiwon/hanimo/internal/agents"
	"github.com/flykimjiwon/hanimo/internal/app"
	"github.com/flykimjiwon/hanimo/internal/config"
	"github.com/flykimjiwon/hanimo/internal/llm"
	"github.com/flykimjiwon/hanimo/internal/session"
)

func printDebugBanner(cfg config.Config) {
	fmt.Println()
	fmt.Println("  ╔══════════════════════════════════════════════╗")
	fmt.Println("  ║          [DEBUG MODE] hanimo             ║")
	fmt.Println("  ╚══════════════════════════════════════════════╝")
	fmt.Printf("  Version:   %s\n", version)
	fmt.Printf("  BaseURL:   %s\n", cfg.API.BaseURL)
	fmt.Printf("  Model:     %s\n", cfg.Models.Super)
	fmt.Printf("  ConfigDir: %s\n", config.ConfigDir())
	fmt.Printf("  LogFile:   %s\n", config.DebugLogPath())
	fmt.Println()
}

var version = "dev"

func main() {
	// Fail loudly on misconfigured distro/sealed ldflags rather than
	// silently behaving like vanilla. No-op for a standard build.
	config.ValidateBakedMode()

	modeFlag := flag.String("mode", "super", "시작 모드: super, deep, plan")
	providerFlag := flag.String("provider", "", "LLM 프로바이더 (openai, novita, ollama, anthropic, ...)")
	modelFlag := flag.String("model", "", "모델 이름")
	versionFlag := flag.Bool("version", false, "버전 출력")
	setupFlag := flag.Bool("setup", false, "설정 재실행 (API URL/키 재입력)")
	resetFlag := flag.Bool("reset", false, "설정 초기화 (config 삭제 후 재설정)")
	resumeFlag := flag.String("resume", "", "세션 복원 (ID 또는 이름)")
	debugFlag := flag.Bool("debug", false, "디버그 모드 활성화")
	maxIterFlag := flag.Int("max-iter", 0, "Maximum auto-mode iterations (1-200, 0=use config/default)")
	// Short aliases
	flag.StringVar(providerFlag, "p", "", "LLM 프로바이더 (단축)")
	flag.StringVar(modelFlag, "m", "", "모델 이름 (단축)")
	flag.Parse()

	if *versionFlag {
		fmt.Printf("하니모 (hanimo) %s\n", version)
		os.Exit(0)
	}

	// Handle --debug: enable debug mode at runtime
	if *debugFlag {
		config.DebugMode = "true"
	}

	// Handle --reset: delete config and force setup
	if *resetFlag {
		_ = os.Remove(config.ConfigPath())
		fmt.Println("  설정이 초기화되었습니다.")
		*setupFlag = true
	}

	// Initialize session database (SQLite) before anything that
	// might need it (--resume, auto-save, /save, /load, /search).
	if err := session.InitDB(config.ConfigDir()); err != nil {
		config.DebugLog("[SESSION-DB] init failed: %v", err)
	} else {
		defer session.CloseDB()
	}

	// Load config
	cfg, err := config.Load()
	if err != nil {
		cfg = config.DefaultConfig()
	}

	// Apply CLI overrides for provider/model into config
	if *providerFlag != "" {
		cfg.Default.Provider = *providerFlag
	}
	if *modelFlag != "" {
		cfg.Default.Model = *modelFlag
	}

	// Resolve max auto-mode iterations. Priority: CLI flag > config > default.
	if *maxIterFlag > 0 && *maxIterFlag <= 200 {
		agents.MaxAutoIterations = *maxIterFlag
	} else if cfg.MaxIterations > 0 && cfg.MaxIterations <= 200 {
		agents.MaxAutoIterations = cfg.MaxIterations
	}

	// Initialize SQLite database
	if err := session.InitDB(config.ConfigDir()); err != nil {
		fmt.Fprintf(os.Stderr, "DB 초기화 오류: %v\n", err)
		os.Exit(1)
	}
	defer session.CloseDB()

	// Initialize debug logging (no-op if DebugMode != "true")
	config.InitDebugLog()
	defer config.CloseDebugLog()

	if config.IsDebug() {
		printDebugBanner(cfg)
		config.DebugLog("Config: baseURL=%s", cfg.API.BaseURL)
		config.DebugLog("Config: model=%s, configDir=%s", cfg.Models.Super, config.ConfigDir())
	}

	// Check if setup is needed (no API key) or forced via --setup
	needsSetup := config.NeedsSetup() || *setupFlag

	// Parse initial mode
	initialMode := parseMode(*modeFlag)

	// Handle --resume: load a saved session into the initial model.
	// The session ID prefix match (first 8+ chars) is accepted.
	resumeID := ""
	if *resumeFlag != "" {
		sessions, _ := session.ListSessions(100)
		for _, s := range sessions {
			if strings.HasPrefix(s.ID, *resumeFlag) || s.Name == *resumeFlag {
				resumeID = s.ID
				break
			}
		}
		if resumeID == "" {
			fmt.Fprintf(os.Stderr, "  세션을 찾을 수 없습니다: %s\n", *resumeFlag)
			os.Exit(1)
		}
	}

	// Create and run the app (AltScreen and Mouse are set in View)
	m := app.NewModel(cfg, initialMode, needsSetup)
	if resumeID != "" {
		m = app.ResumeSession(m, resumeID)
	}
	p := tea.NewProgram(m)

	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "실행 오류: %v\n", err)
		os.Exit(1)
	}

	if config.IsDebug() {
		fmt.Printf("\n  [DEBUG] 로그 파일: %s\n\n", config.DebugLogPath())
	}
}

func parseMode(mode string) int {
	switch mode {
	case "super":
		return int(llm.ModeSuper)
	case "deep", "dev", "개발", "자율":
		return int(llm.ModeDev)
	case "plan", "플랜":
		return int(llm.ModePlan)
	default:
		return int(llm.ModeSuper)
	}
}
