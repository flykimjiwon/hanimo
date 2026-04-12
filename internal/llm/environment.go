package llm

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

// probe defines a tool to check: binary name + version flag.
type probe struct {
	Name    string
	Bin     string
	Version string // flag to get version (e.g. "--version")
}

// allProbes is the full list of runtimes/tools to detect on startup.
// Grouped by category for readability but flattened at probe time.
var allProbes = []probe{
	// JavaScript / TypeScript
	{"node", "node", "--version"},
	{"npm", "npm", "--version"},
	{"npx", "npx", "--version"},
	{"pnpm", "pnpm", "--version"},
	{"yarn", "yarn", "--version"},
	{"bun", "bun", "--version"},
	{"deno", "deno", "--version"},

	// Python
	{"python3", "python3", "--version"},
	{"python", "python", "--version"},
	{"pip", "pip3", "--version"},
	{"uv", "uv", "--version"},
	{"poetry", "poetry", "--version"},

	// Go
	{"go", "go", "version"},

	// Rust
	{"rustc", "rustc", "--version"},
	{"cargo", "cargo", "--version"},

	// Java / JVM
	{"java", "java", "-version"},
	{"javac", "javac", "-version"},
	{"mvn", "mvn", "--version"},
	{"gradle", "gradle", "--version"},
	{"kotlin", "kotlin", "-version"},

	// Ruby
	{"ruby", "ruby", "--version"},
	{"gem", "gem", "--version"},
	{"bundle", "bundle", "--version"},

	// PHP
	{"php", "php", "--version"},
	{"composer", "composer", "--version"},

	// Swift / Dart / Flutter
	{"swift", "swift", "--version"},
	{"dart", "dart", "--version"},
	{"flutter", "flutter", "--version"},

	// .NET
	{"dotnet", "dotnet", "--version"},

	// Others
	{"lua", "lua", "-v"},
	{"perl", "perl", "--version"},
	{"R", "R", "--version"},
	{"zig", "zig", "version"},
	{"elixir", "elixir", "--version"},

	// Build tools
	{"make", "make", "--version"},
	{"cmake", "cmake", "--version"},

	// Containers & Git
	{"docker", "docker", "--version"},
	{"git", "git", "--version"},

	// Network
	{"curl", "curl", "--version"},

	// Cloud CLIs
	{"aws", "aws", "--version"},
	{"gcloud", "gcloud", "--version"},
	{"kubectl", "kubectl", "version --client --short"},
	{"terraform", "terraform", "--version"},
}

// ProbeResult holds the detection result for one tool.
type ProbeResult struct {
	Name      string
	Available bool
	Version   string // short version string or ""
}

// EnvProbeResults is the cached probe from startup.
var EnvProbeResults []ProbeResult

// ProbeEnvironment checks which tools are installed and caches results.
// Call once at startup. Takes ~200ms on a typical system (parallel would
// be faster but sequential is simpler and still fast enough for a one-time
// startup check).
func ProbeEnvironment() []ProbeResult {
	results := make([]ProbeResult, 0, len(allProbes))
	seen := map[string]bool{}

	for _, p := range allProbes {
		// Skip duplicates (python3 vs python — keep whichever found first)
		if p.Name == "python" && seen["python3"] {
			continue
		}
		path, err := exec.LookPath(p.Bin)
		if err != nil || path == "" {
			results = append(results, ProbeResult{Name: p.Name, Available: false})
			continue
		}
		seen[p.Name] = true
		ver := getVersion(p.Bin, p.Version)
		results = append(results, ProbeResult{Name: p.Name, Available: true, Version: ver})
	}

	EnvProbeResults = results
	return results
}

// getVersion runs "bin flag" and extracts a short version string.
// Returns "" on any failure — never blocks or panics.
func getVersion(bin, flag string) string {
	args := strings.Fields(flag)
	cmd := exec.Command(bin, args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return ""
	}
	// Take first line, trim, cap at 40 chars.
	line := strings.TrimSpace(strings.Split(string(out), "\n")[0])
	// Strip common prefixes like "v", "go version go1.26", "Python 3.12"
	line = strings.TrimPrefix(line, "v")
	if len([]rune(line)) > 40 {
		line = string([]rune(line)[:40])
	}
	return line
}

// FormatEnvironmentContext returns a compact system-prompt block showing
// which tools are available. The LLM reads this to avoid calling
// tools that aren't installed.
//
// Format:
//
//	## Environment
//	OS: darwin/arm64
//	✅ node 20.14 | npm 10.8 | go 1.26 | git 2.45 | docker 27.0
//	❌ rust | java | ruby (not installed)
func FormatEnvironmentContext(results []ProbeResult) string {
	var available []string
	var missing []string

	for _, r := range results {
		if r.Available {
			label := r.Name
			if r.Version != "" {
				label += " " + r.Version
			}
			available = append(available, label)
		} else {
			missing = append(missing, r.Name)
		}
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("\n## Environment: %s/%s\n", runtime.GOOS, runtime.GOARCH))

	if len(available) > 0 {
		b.WriteString("✅ " + strings.Join(available, " | ") + "\n")
	}
	if len(missing) > 0 {
		b.WriteString("❌ " + strings.Join(missing, " | ") + " (미설치)\n")
	}
	b.WriteString("미설치 도구는 사용하지 마세요. 필요하면 사용자에게 설치 방법을 안내하세요.\n")

	return b.String()
}
