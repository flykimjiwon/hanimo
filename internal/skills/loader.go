// Package skills implements a SKILL.md loader compatible with the
// agentskills.io open standard. Users drop SKILL.md files into
// ~/.hanimo/skills/<name>/ or .hanimo/skills/<name>/ and hanimo
// picks them up on startup. The LLM sees skill descriptions in the
// system prompt and can invoke them via /skill <name>.
//
// Frontmatter format (YAML between --- fences):
//
//	---
//	name: review-pr
//	description: PR 코드 리뷰 수행
//	allowed-tools: [grep_search, file_read, shell_exec]
//	user-invocable: true
//	---
//	<body — the skill prompt injected into context when invoked>
//
// Fields:
//   - name: canonical identifier, used in /skill <name>
//   - description: one-line summary shown in system prompt TOC
//   - allowed-tools: optional tool whitelist (empty = all tools)
//   - user-invocable: if false, only the model can invoke it (default true)
package skills

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

// Skill is a parsed SKILL.md.
type Skill struct {
	Name          string   `yaml:"name"`
	Description   string   `yaml:"description"`
	AllowedTools  []string `yaml:"allowed-tools"`
	UserInvocable bool     `yaml:"user-invocable"`
	Body          string   // the prompt content after frontmatter
	Path          string   // filesystem path for debug
}

// Registry holds all loaded skills, keyed by name.
type Registry struct {
	mu     sync.RWMutex
	skills map[string]*Skill
	order  []string // sorted names for deterministic listing
}

// GlobalRegistry is the process-wide skill registry. Set on startup
// via ScanSkills(). Read by /skill slash command and system prompt TOC.
var GlobalRegistry = &Registry{skills: map[string]*Skill{}}

// skillDirs returns search paths in priority order (project-local first).
func skillDirs() []string {
	dirs := []string{".hanimo/skills"}
	if home, err := os.UserHomeDir(); err == nil {
		dirs = append(dirs, filepath.Join(home, ".hanimo", "skills"))
	}
	return dirs
}

// ScanSkills walks skill directories and loads every SKILL.md found.
// Project-local skills override global ones with the same name.
func ScanSkills() *Registry {
	reg := &Registry{skills: map[string]*Skill{}}
	// Scan in reverse priority order so project-local (first in
	// skillDirs) overwrites global (second).
	dirs := skillDirs()
	for i := len(dirs) - 1; i >= 0; i-- {
		dir := dirs[i]
		abs, err := filepath.Abs(dir)
		if err != nil {
			continue
		}
		entries, err := os.ReadDir(abs)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			skillFile := filepath.Join(abs, e.Name(), "SKILL.md")
			data, err := os.ReadFile(skillFile)
			if err != nil {
				continue
			}
			skill := parseSkillMD(string(data))
			if skill.Name == "" {
				skill.Name = e.Name()
			}
			skill.Path = skillFile
			reg.skills[skill.Name] = skill
		}
	}
	// Build sorted order.
	for name := range reg.skills {
		reg.order = append(reg.order, name)
	}
	sort.Strings(reg.order)
	return reg
}

// parseSkillMD extracts YAML frontmatter and body from a SKILL.md file.
// Lightweight parser — no external YAML dependency; handles the small
// subset of fields we care about.
func parseSkillMD(content string) *Skill {
	s := &Skill{UserInvocable: true}
	lines := strings.Split(content, "\n")
	if len(lines) < 3 || strings.TrimSpace(lines[0]) != "---" {
		// No frontmatter — entire content is body.
		s.Body = content
		return s
	}
	// Find closing ---
	endIdx := -1
	for i := 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == "---" {
			endIdx = i
			break
		}
	}
	if endIdx < 0 {
		s.Body = content
		return s
	}
	// Parse frontmatter fields manually.
	for _, line := range lines[1:endIdx] {
		key, val := splitFrontmatter(line)
		switch key {
		case "name":
			s.Name = val
		case "description":
			s.Description = val
		case "allowed-tools":
			s.AllowedTools = parseYAMLList(val)
		case "user-invocable":
			s.UserInvocable = val != "false"
		}
	}
	// Body is everything after the closing ---.
	s.Body = strings.TrimSpace(strings.Join(lines[endIdx+1:], "\n"))
	return s
}

func splitFrontmatter(line string) (string, string) {
	idx := strings.Index(line, ":")
	if idx < 0 {
		return "", ""
	}
	key := strings.TrimSpace(line[:idx])
	val := strings.TrimSpace(line[idx+1:])
	// Strip surrounding quotes.
	val = strings.Trim(val, "\"'")
	return key, val
}

// parseYAMLList handles [a, b, c] inline YAML lists.
func parseYAMLList(val string) []string {
	val = strings.TrimPrefix(val, "[")
	val = strings.TrimSuffix(val, "]")
	parts := strings.Split(val, ",")
	var out []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		p = strings.Trim(p, "\"'")
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// Count returns the number of loaded skills.
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.skills)
}

// Get returns a skill by name, or nil if not found.
func (r *Registry) Get(name string) *Skill {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.skills[name]
}

// List returns all skills in sorted order.
func (r *Registry) List() []*Skill {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*Skill, 0, len(r.order))
	for _, name := range r.order {
		out = append(out, r.skills[name])
	}
	return out
}

// TableOfContents returns a compact summary for system prompt injection.
func (r *Registry) TableOfContents() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if len(r.skills) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString(fmt.Sprintf("\n\n## Skills (%d available)\n", len(r.skills)))
	b.WriteString("User can invoke with `/skill <name>`. You can suggest them when relevant.\n\n")
	for _, name := range r.order {
		s := r.skills[name]
		desc := s.Description
		if desc == "" {
			desc = "(설명 없음)"
		}
		b.WriteString(fmt.Sprintf("- `/skill %s` — %s\n", name, desc))
	}
	return b.String()
}

// FormatSkillBody returns the full skill prompt ready for injection
// into the conversation, with an optional $ARGUMENTS substitution.
func FormatSkillBody(s *Skill, args string) string {
	body := s.Body
	if args != "" {
		body = strings.ReplaceAll(body, "$ARGUMENTS", args)
	}
	return fmt.Sprintf("## Skill: %s\n\n%s", s.Name, body)
}
