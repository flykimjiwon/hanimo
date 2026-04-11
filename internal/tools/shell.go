package tools

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/flykimjiwon/hanimo/internal/config"
)

type ShellResult struct {
	Stdout   string
	Stderr   string
	ExitCode int
	Duration time.Duration
}

// Shell execution timeouts. DefaultShellTimeout covers interactive build/test
// commands; LongCommandTimeout is applied automatically when the command looks
// like a known long-running operation (network, package install, docker).
const (
	DefaultShellTimeout = 60 * time.Second
	LongCommandTimeout  = 5 * time.Minute
)

// longCommands are command prefixes/substrings that warrant the extended
// LongCommandTimeout. Match is case-insensitive substring.
var longCommands = []string{
	"npm install", "npm i ", "yarn install", "pnpm install",
	"git clone", "docker build", "docker pull",
	"cargo build", "go mod download",
	"pip install", "poetry install",
}

// deprecatedTools maps a deprecated CLI invocation to the recommended modern
// alternative. If a command matches any key, ShellExec short-circuits and
// returns the suggestion without executing anything.
var deprecatedTools = map[string]string{
	"create-react-app": "Use `npm create vite@latest <name> -- --template react-ts` instead",
	"yarn init":        "Use `npm init -y` instead",
	"bower install":    "Use `npm install` instead",
}

// SoftDangerousPatterns match commands that should require explicit user
// confirmation (but are not hard-blocked). These cover destructive-but-legit
// operations the agent may legitimately need to run.
var SoftDangerousPatterns = []*regexp.Regexp{
	regexp.MustCompile(`\brm\s+-[rRf]+`),         // rm -rf anything
	regexp.MustCompile(`\brm\s+-[^\s]*f`),        // rm -f ...
	regexp.MustCompile(`\bgit\s+push\s+.*--force`),
	regexp.MustCompile(`\bgit\s+push\s+.*-f\b`),
	regexp.MustCompile(`\bgit\s+reset\s+--hard`),
	regexp.MustCompile(`\bgit\s+clean\s+-[a-z]*f`),
	regexp.MustCompile(`\bdrop\s+table\b`),
	regexp.MustCompile(`\bdrop\s+database\b`),
	regexp.MustCompile(`\btruncate\s+table\b`),
	regexp.MustCompile(`\bchmod\s+-R\s+777\b`),
	regexp.MustCompile(`\bmv\s+.*\s+/dev/null`),
	regexp.MustCompile(`>\s*/dev/null\s*2>&1\s*&\s*$`),
}

// IsDangerous reports whether the command matches any soft-dangerous pattern
// and therefore warrants a user confirmation prompt. It does NOT include the
// hard-blocked patterns (those are still rejected by CheckSafety).
func IsDangerous(command string) (bool, string) {
	lower := strings.ToLower(command)
	for _, p := range SoftDangerousPatterns {
		if p.MatchString(lower) {
			return true, "Matches dangerous pattern: " + p.String()
		}
	}
	return false, ""
}

// Dangerous command patterns — block before execution.
//
// Expanded 2026-04 to cover credential exfiltration and more disk/kernel
// footguns. Grouped by intent:
//
//   1. Filesystem wipes / kernel-level destruction
//   2. Privilege escalation / system state
//   3. Network-sourced code execution
//   4. Credential exposure / exfiltration
//   5. Classic pranks (fork bomb, etc.)
var dangerousPatterns = []*regexp.Regexp{
	// 1. Filesystem / kernel
	regexp.MustCompile(`\brm\s+(-[^\s]*\s+)*-[^\s]*r[^\s]*\s+/`),      // rm -rf /
	regexp.MustCompile(`\brm\s+(-[^\s]*\s+)*-[^\s]*r[^\s]*\s+~`),      // rm -rf ~
	regexp.MustCompile(`\bmkfs\b`),                                     // mkfs.*
	regexp.MustCompile(`\bdd\s+.*\bof=/dev/`),                          // dd of=/dev/sdX
	regexp.MustCompile(`>\s*/dev/sd`),                                  // redirect to raw disk
	regexp.MustCompile(`\bchmod\s+777\s+/`),                            // chmod 777 /
	regexp.MustCompile(`\bchmod\s+-R\s+777\s+/`),                       // chmod -R 777 /
	regexp.MustCompile(`\bchown\s+-R\s+.*\s+/`),                        // chown -R ... /

	// 2. Privilege / system state
	regexp.MustCompile(`\bsudo\b`),                                     // sudo
	regexp.MustCompile(`\bsu\s+-\b`),                                   // su -
	regexp.MustCompile(`\bshutdown\b`),                                 // shutdown
	regexp.MustCompile(`\breboot\b`),                                   // reboot
	regexp.MustCompile(`\bhalt\b`),                                     // halt
	regexp.MustCompile(`\bpoweroff\b`),                                 // poweroff

	// 3. Network-sourced code execution
	regexp.MustCompile(`\bcurl\b.*\|\s*(sh|bash|zsh)`),                 // curl | sh
	regexp.MustCompile(`\bwget\b.*\|\s*(sh|bash|zsh)`),                 // wget | sh
	regexp.MustCompile(`\bcurl\b.*\|\s*python`),                        // curl | python
	regexp.MustCompile(`\bwget\b.*-o-\s*\|\s*(sh|bash)`),               // wget -O- | sh

	// 4. Credential exposure / exfiltration
	// NOTE: CheckSafety lowercases the command before matching, so all
	// credential patterns below must be written in lowercase.
	regexp.MustCompile(`\bexport\s+(aws|openai|anthropic|github|google|gemini|groq|deepseek|novita|openrouter|mistral|huggingface|hf|azure)_[a-z_]*(key|token|secret)`),
	regexp.MustCompile(`\bcurl\b.*\s+-h\s+['"]?authorization`),         // curl -H "Authorization: Bearer …"
	regexp.MustCompile(`\bcurl\b.*\s+-u\s+[^:\s]+:[^\s]+`),             // curl -u user:pass
	regexp.MustCompile(`\benv\s*\|\s*(curl|wget|nc)\b`),                // env | curl — leak env
	regexp.MustCompile(`\bcat\s+.*\.(pem|key|crt|p12|pfx)\b`),          // dump private keys
	regexp.MustCompile(`\bcat\s+.*/\.ssh/id_`),                         // dump SSH keys
	regexp.MustCompile(`\bcat\s+.*/\.aws/credentials`),                 // dump AWS creds
	regexp.MustCompile(`\bcat\s+.*/\.(npm|pypi|docker)rc`),             // dump config creds

	// 5. Classic pranks / DoS
	regexp.MustCompile(`:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:`),     // fork bomb
	regexp.MustCompile(`\byes\b.*>\s*/dev/`),                           // yes > /dev/sda
}

// CheckSafety returns an error if the command matches a dangerous pattern.
func CheckSafety(command string) error {
	lower := strings.ToLower(command)
	for _, p := range dangerousPatterns {
		if p.MatchString(lower) {
			config.DebugLog("[SHELL-BLOCK] cmd=%q matched pattern=%s", command, p.String())
			return fmt.Errorf("blocked: dangerous command pattern detected: %s", p.String())
		}
	}
	return nil
}

func ShellExec(ctx context.Context, command string) (ShellResult, error) {
	// Safety check
	if err := CheckSafety(command); err != nil {
		return ShellResult{ExitCode: -1}, err
	}

	// Deprecated-tool short-circuit: refuse to run and surface the modern
	// alternative as the tool result so the LLM can retry correctly.
	lowerCmd := strings.ToLower(command)
	for tool, suggestion := range deprecatedTools {
		if strings.Contains(lowerCmd, tool) {
			msg := fmt.Sprintf("[DEPRECATED] '%s' is deprecated. %s\n\nCommand was NOT executed. Retry with the modern alternative.", tool, suggestion)
			config.DebugLog("[SHELL-DEPRECATED] cmd=%q | suggestion=%s", command, suggestion)
			return ShellResult{Stdout: msg, ExitCode: 1}, nil
		}
	}

	// Apply a default timeout if the caller did not supply one, stretching to
	// LongCommandTimeout for known slow commands.
	if _, hasDeadline := ctx.Deadline(); !hasDeadline {
		timeout := DefaultShellTimeout
		for _, lc := range longCommands {
			if strings.Contains(lowerCmd, lc) {
				timeout = LongCommandTimeout
				break
			}
		}
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	cwd := ""
	if dir, err := exec.LookPath("sh"); err == nil {
		cwd = dir
	}
	deadline, hasDeadline := ctx.Deadline()
	timeout := "none"
	if hasDeadline {
		timeout = fmt.Sprintf("%v", time.Until(deadline).Round(time.Millisecond))
	}
	config.DebugLog("[SHELL] cmd=%q | cwd=%s | timeout=%s | os=%s", command, cwd, timeout, runtime.GOOS)

	start := time.Now()

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, "cmd", "/c", command)
	} else {
		cmd = exec.CommandContext(ctx, "sh", "-c", command)
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	duration := time.Since(start)

	result := ShellResult{
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		ExitCode: 0,
		Duration: duration,
	}

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
		} else {
			config.DebugLog("[SHELL-ERR] cmd=%q | err=%v | elapsed=%v", command, err, duration)
			return result, fmt.Errorf("exec failed: %w", err)
		}
	}

	config.DebugLog("[SHELL] exitCode=%d | stdout=%dbytes | stderr=%dbytes | elapsed=%v", result.ExitCode, len(result.Stdout), len(result.Stderr), duration)
	return result, nil
}
