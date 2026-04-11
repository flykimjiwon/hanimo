package llm

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// IsHanimoOwnRepo reports whether the current working directory is inside
// hanimo's own source repo. Walks up from cwd looking for a go.mod whose
// module path is github.com/flykimjiwon/hanimo. Used to gate write-side
// tools with an extra confirmation so a stray `/auto` doesn't self-modify.
//
// Bypass: set HANIMO_DEV_MODE=1 to suppress the warning when you are
// legitimately editing hanimo itself.
func IsHanimoOwnRepo() bool {
	if os.Getenv("HANIMO_DEV_MODE") == "1" {
		return false
	}
	cwd, err := os.Getwd()
	if err != nil {
		return false
	}
	dir := cwd
	for i := 0; i < 8; i++ { // cap the walk to avoid crawling the whole disk
		goMod := filepath.Join(dir, "go.mod")
		if data, err := os.ReadFile(goMod); err == nil {
			first := strings.SplitN(string(data), "\n", 2)[0]
			if strings.HasPrefix(first, "module ") &&
				strings.Contains(first, "github.com/flykimjiwon/hanimo") {
				return true
			}
			// Found a go.mod but it's not hanimo — stop walking.
			return false
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return false
		}
		dir = parent
	}
	return false
}

// GatherSystemContext returns minimal context (~50 tokens) for system prompt injection.
// Heavy info (IP, git status, file listing) is available on-demand via tools.
func GatherSystemContext() string {
	var b strings.Builder
	b.WriteString("\n\n## System\n")

	// OS & Architecture (~10 tok)
	b.WriteString(fmt.Sprintf("- OS: %s/%s\n", runtime.GOOS, runtime.GOARCH))

	// Current working directory (~15 tok)
	if cwd, err := os.Getwd(); err == nil {
		b.WriteString(fmt.Sprintf("- CWD: %s\n", cwd))
	}

	// Date only (~10 tok)
	b.WriteString(fmt.Sprintf("- Date: %s\n", time.Now().Format("2006-01-02")))

	// Self-repo guard: if the user is running hanimo inside its own source
	// tree, tell the model explicitly. The model should confirm before
	// editing hanimo's own source — it's too easy to brick the tool.
	if IsHanimoOwnRepo() {
		b.WriteString("\n⚠️  SELF-REPO WARNING: 현재 CWD는 hanimo 자체 소스 레포입니다.\n")
		b.WriteString("- hanimo 자신의 소스를 수정하려면 반드시 먼저 사용자에게 ASK_USER 로 확인.\n")
		b.WriteString("- 무심코 file_edit/file_write 하면 다음 빌드에서 hanimo 자체가 깨질 수 있습니다.\n")
	}

	return b.String()
}

// GatherFullContext collects full environment information (for debug/on-demand).
// Includes: OS, hostname, user, shell, CWD, date, timezone, IP, git, files.
func GatherFullContext() string {
	var b strings.Builder
	b.WriteString("\n\n## System Context (full)\n")

	b.WriteString(fmt.Sprintf("- OS: %s/%s\n", runtime.GOOS, runtime.GOARCH))

	if hostname, err := os.Hostname(); err == nil {
		b.WriteString(fmt.Sprintf("- Hostname: %s\n", hostname))
	}

	if u, err := user.Current(); err == nil {
		b.WriteString(fmt.Sprintf("- User: %s\n", u.Username))
	}

	if shell := os.Getenv("SHELL"); shell != "" {
		b.WriteString(fmt.Sprintf("- Shell: %s\n", shell))
	} else if comspec := os.Getenv("COMSPEC"); comspec != "" {
		b.WriteString(fmt.Sprintf("- Shell: %s\n", comspec))
	}

	if cwd, err := os.Getwd(); err == nil {
		b.WriteString(fmt.Sprintf("- CWD: %s\n", cwd))
	}

	now := time.Now()
	b.WriteString(fmt.Sprintf("- Date: %s\n", now.Format("2006-01-02 (Mon) 15:04")))
	_, offset := now.Zone()
	b.WriteString(fmt.Sprintf("- Timezone: UTC%+d\n", offset/3600))

	if ips := getLocalIPs(); len(ips) > 0 {
		b.WriteString(fmt.Sprintf("- IP: %s\n", strings.Join(ips, ", ")))
	}

	if gitInfo := getGitInfo(); gitInfo != "" {
		b.WriteString(gitInfo)
	}

	if files := listCurrentDir(30); files != "" {
		b.WriteString(fmt.Sprintf("- Files in CWD:\n%s\n", files))
	}

	return b.String()
}

// getLocalIPs returns non-loopback IPv4 addresses.
func getLocalIPs() []string {
	var ips []string
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ips
	}
	for _, addr := range addrs {
		if ipNet, ok := addr.(*net.IPNet); ok && !ipNet.IP.IsLoopback() {
			if ipNet.IP.To4() != nil {
				ips = append(ips, ipNet.IP.String())
			}
		}
	}
	return ips
}

// getGitInfo returns branch name and short status if in a git repo.
func getGitInfo() string {
	// Check if we're in a git repo
	if _, err := os.Stat(".git"); os.IsNotExist(err) {
		return ""
	}

	var b strings.Builder

	// Branch
	if out, err := exec.Command("git", "branch", "--show-current").Output(); err == nil {
		branch := strings.TrimSpace(string(out))
		if branch != "" {
			b.WriteString(fmt.Sprintf("- Git branch: %s\n", branch))
		}
	}

	// Short status (max 10 lines)
	if out, err := exec.Command("git", "status", "--short").Output(); err == nil {
		status := strings.TrimSpace(string(out))
		if status != "" {
			lines := strings.Split(status, "\n")
			if len(lines) > 10 {
				b.WriteString(fmt.Sprintf("- Git status: %d changed files (showing first 10)\n", len(lines)))
				lines = lines[:10]
			} else {
				b.WriteString(fmt.Sprintf("- Git status: %d changed files\n", len(lines)))
			}
			for _, line := range lines {
				b.WriteString(fmt.Sprintf("    %s\n", line))
			}
		} else {
			b.WriteString("- Git status: clean\n")
		}
	}

	return b.String()
}

// listCurrentDir returns a formatted listing of the current directory.
func listCurrentDir(maxEntries int) string {
	entries, err := os.ReadDir(".")
	if err != nil {
		return ""
	}

	var b strings.Builder
	count := 0
	for _, entry := range entries {
		if count >= maxEntries {
			remaining := len(entries) - maxEntries
			b.WriteString(fmt.Sprintf("    ... and %d more\n", remaining))
			break
		}
		name := entry.Name()
		// Skip hidden files except important ones
		if strings.HasPrefix(name, ".") {
			if name != ".git" && name != ".env" && name != ".gitignore" && name != ".hanimo.md" {
				continue
			}
		}
		indicator := ""
		if entry.IsDir() {
			indicator = "/"
		} else {
			// Show file size
			if info, err := entry.Info(); err == nil {
				size := info.Size()
				if size < 1024 {
					indicator = fmt.Sprintf(" (%dB)", size)
				} else if size < 1024*1024 {
					indicator = fmt.Sprintf(" (%.1fKB)", float64(size)/1024)
				} else {
					indicator = fmt.Sprintf(" (%.1fMB)", float64(size)/(1024*1024))
				}
			}
		}
		b.WriteString(fmt.Sprintf("    %s%s\n", name, indicator))
		count++
	}

	if count == 0 {
		return ""
	}

	// Show directory summary
	dirCount := 0
	fileCount := 0
	for _, entry := range entries {
		if entry.IsDir() {
			dirCount++
		} else {
			fileCount++
		}
	}
	summary := fmt.Sprintf("    [Total: %d dirs, %d files]\n", dirCount, fileCount)

	return b.String() + summary
}

// GatherContextForPath collects context for a specific path (used when cd)
func GatherContextForPath(path string) string {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return ""
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("\n[Context updated: CWD → %s]\n", absPath))

	entries, err := os.ReadDir(absPath)
	if err != nil {
		return b.String()
	}

	count := 0
	for _, entry := range entries {
		if count >= 15 {
			b.WriteString(fmt.Sprintf("  ... and %d more\n", len(entries)-15))
			break
		}
		name := entry.Name()
		if strings.HasPrefix(name, ".") && name != ".git" {
			continue
		}
		if entry.IsDir() {
			b.WriteString(fmt.Sprintf("  %s/\n", name))
		} else {
			b.WriteString(fmt.Sprintf("  %s\n", name))
		}
		count++
	}

	return b.String()
}
