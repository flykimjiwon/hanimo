package main

// Phase 11 — SKILL.md scanner.
// Mirrors hanimo CLI internal/skills/loader.go but trimmed: only the
// metadata the SkillsPanel needs (name, description, path) — the body
// will be loaded on demand when the user actually invokes a skill.

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// SkillEntry is the frontend-facing skill summary.
type SkillEntry struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Path        string `json:"path"`
	Source      string `json:"source"` // "project" | "global"
}

// skillSearchDirs returns search paths in priority order.
// Project-local first (overrides global), then ~/.hanimo/skills.
func skillSearchDirs() []struct {
	Dir    string
	Source string
} {
	out := []struct {
		Dir    string
		Source string
	}{
		{Dir: ".hanimo/skills", Source: "project"},
	}
	if home, err := os.UserHomeDir(); err == nil {
		out = append(out, struct {
			Dir    string
			Source string
		}{Dir: filepath.Join(home, ".hanimo", "skills"), Source: "global"})
	}
	return out
}

// GetSkills walks the skill directories and returns a deduplicated list.
// Project-local skills override global ones with the same name.
func (a *App) GetSkills() []SkillEntry {
	seen := map[string]SkillEntry{}
	for _, p := range skillSearchDirs() {
		abs, err := filepath.Abs(p.Dir)
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
			name, desc := parseSkillMeta(string(data))
			if name == "" {
				name = e.Name()
			}
			// Only set if not already filled by higher-priority dir.
			if _, ok := seen[name]; !ok {
				seen[name] = SkillEntry{
					Name:        name,
					Description: desc,
					Path:        skillFile,
					Source:      p.Source,
				}
			}
		}
	}
	out := make([]SkillEntry, 0, len(seen))
	names := make([]string, 0, len(seen))
	for n := range seen {
		names = append(names, n)
	}
	sort.Strings(names)
	for _, n := range names {
		out = append(out, seen[n])
	}
	return out
}

// parseSkillMeta extracts only `name:` and `description:` from a SKILL.md
// frontmatter. Lightweight — no full YAML parser needed.
func parseSkillMeta(content string) (string, string) {
	lines := strings.Split(content, "\n")
	if len(lines) < 3 || strings.TrimSpace(lines[0]) != "---" {
		return "", ""
	}
	var name, desc string
	for i := 1; i < len(lines); i++ {
		ln := strings.TrimRight(lines[i], "\r")
		if strings.TrimSpace(ln) == "---" {
			break
		}
		k, v := splitYAMLKV(ln)
		switch strings.ToLower(strings.TrimSpace(k)) {
		case "name":
			name = strings.TrimSpace(v)
		case "description":
			desc = strings.TrimSpace(v)
		}
	}
	return name, desc
}

func splitYAMLKV(line string) (string, string) {
	idx := strings.Index(line, ":")
	if idx < 0 {
		return "", ""
	}
	return line[:idx], strings.Trim(strings.TrimSpace(line[idx+1:]), "\"'")
}

// ReadSkill loads the full SKILL.md body for the given path. Used when
// the user clicks "Run skill" in the panel.
func (a *App) ReadSkill(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
