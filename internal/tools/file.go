package tools

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func FileRead(path string) (string, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return "", fmt.Errorf("invalid path: %w", err)
	}
	data, err := os.ReadFile(absPath)
	if err != nil {
		return "", fmt.Errorf("read failed: %w", err)
	}
	return string(data), nil
}

func FileWrite(path, content string) error {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return fmt.Errorf("invalid path: %w", err)
	}
	dir := filepath.Dir(absPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("mkdir failed: %w", err)
	}
	return os.WriteFile(absPath, []byte(content), 0644)
}

// FileEdit performs a search-and-replace edit on a file.
// Returns the number of replacements made.
func FileEdit(path, oldStr, newStr string) (int, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return 0, fmt.Errorf("invalid path: %w", err)
	}
	data, err := os.ReadFile(absPath)
	if err != nil {
		return 0, fmt.Errorf("read failed: %w", err)
	}
	content := string(data)
	count := strings.Count(content, oldStr)
	if count == 0 {
		// Show a snippet of the file for context
		preview := content
		if len(preview) > 500 {
			preview = preview[:500] + "..."
		}
		return 0, fmt.Errorf("old_string not found in %s. File preview:\n%s", path, preview)
	}
	newContent := strings.Replace(content, oldStr, newStr, 1)
	if err := os.WriteFile(absPath, []byte(newContent), 0644); err != nil {
		return 0, fmt.Errorf("write failed: %w", err)
	}
	return 1, nil
}

// defaultSkipDirs is the set of directory names that recursive ListFiles
// should skip entirely. These are dependency caches, build artifacts, VCS
// metadata, IDE folders, and hanimo-specific legacy paths that pollute
// recursive listings and hit the 500-file cap without yielding useful info.
var defaultSkipDirs = map[string]bool{
	".git":          true,
	".svn":          true,
	".hg":           true,
	"node_modules":  true,
	"dist":          true,
	"build":         true,
	"__pycache__":   true,
	".next":         true,
	".nuxt":         true,
	".svelte-kit":   true,
	"vendor":        true,
	".venv":         true,
	"venv":          true,
	"target":        true, // Rust
	".gradle":       true,
	".idea":         true,
	".vscode":       true,
	".omc":          true,
	".superpowers":  true,
	"_legacy_ts":    true, // hanimo-specific
	".DS_Store":     true,
	".pytest_cache": true,
	".mypy_cache":   true,
	".ruff_cache":   true,
	"coverage":      true,
}

// ListFiles lists files in a directory, optionally recursive.
func ListFiles(dir string, recursive bool) ([]string, error) {
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return nil, fmt.Errorf("invalid path: %w", err)
	}
	info, err := os.Stat(absDir)
	if err != nil {
		return nil, fmt.Errorf("stat failed: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%s is not a directory", dir)
	}

	var files []string
	truncated := false
	if recursive {
		err = filepath.WalkDir(absDir, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return nil // skip errors
			}
			name := d.Name()
			// Always skip known-noise directories entirely (don't walk into
			// them). Also skip any other hidden dir not explicitly listed.
			if d.IsDir() && path != absDir {
				if defaultSkipDirs[name] || strings.HasPrefix(name, ".") {
					return filepath.SkipDir
				}
			}
			rel, _ := filepath.Rel(absDir, path)
			if d.IsDir() {
				files = append(files, rel+"/")
			} else {
				files = append(files, rel)
			}
			if len(files) > 500 {
				truncated = true
				return filepath.SkipAll
			}
			return nil
		})
		if truncated {
			files = append(files, "", "[Hint] Too many files. Retry with recursive=false, or specify a subdirectory.")
		}
	} else {
		entries, err2 := os.ReadDir(absDir)
		if err2 != nil {
			return nil, fmt.Errorf("readdir failed: %w", err2)
		}
		for _, e := range entries {
			if e.IsDir() {
				files = append(files, e.Name()+"/")
			} else {
				files = append(files, e.Name())
			}
		}
	}
	return files, err
}

func FileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// ListTree renders a directory-only tree (no files) up to maxDepth. Skips the
// same noise directories as ListFiles. Gives the LLM a fast, token-cheap view
// of project structure without enumerating every file.
func ListTree(dir string, maxDepth int) (string, error) {
	if maxDepth <= 0 {
		maxDepth = 3
	}
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return "", fmt.Errorf("invalid path: %w", err)
	}
	info, err := os.Stat(absDir)
	if err != nil {
		return "", fmt.Errorf("stat failed: %w", err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("%s is not a directory", dir)
	}

	var sb strings.Builder
	sb.WriteString(filepath.Base(absDir) + "/\n")

	var walk func(path string, prefix string, depth int) error
	walk = func(path string, prefix string, depth int) error {
		if depth > maxDepth {
			return nil
		}
		entries, err := os.ReadDir(path)
		if err != nil {
			return nil
		}
		dirs := make([]os.DirEntry, 0, len(entries))
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			name := e.Name()
			if defaultSkipDirs[name] || strings.HasPrefix(name, ".") {
				continue
			}
			dirs = append(dirs, e)
		}
		for i, e := range dirs {
			last := i == len(dirs)-1
			branch := "├── "
			nextPrefix := prefix + "│   "
			if last {
				branch = "└── "
				nextPrefix = prefix + "    "
			}
			sb.WriteString(prefix + branch + e.Name() + "/\n")
			_ = walk(filepath.Join(path, e.Name()), nextPrefix, depth+1)
		}
		return nil
	}
	_ = walk(absDir, "", 1)
	return sb.String(), nil
}
