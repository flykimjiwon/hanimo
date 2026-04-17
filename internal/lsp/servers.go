package lsp

import "os/exec"

// ServerConfig describes a known language server.
type ServerConfig struct {
	Name       string
	Command    string
	Args       []string
	LanguageID string
	Extensions []string
}

// KnownServers lists language servers that hanimo can use out of the box.
var KnownServers = []ServerConfig{
	{
		Name:       "gopls",
		Command:    "gopls",
		Args:       []string{"serve"},
		LanguageID: "go",
		Extensions: []string{".go"},
	},
	{
		Name:       "typescript-language-server",
		Command:    "typescript-language-server",
		Args:       []string{"--stdio"},
		LanguageID: "typescript",
		Extensions: []string{".ts", ".tsx", ".js", ".jsx"},
	},
	{
		Name:       "pyright-langserver",
		Command:    "pyright-langserver",
		Args:       []string{"--stdio"},
		LanguageID: "python",
		Extensions: []string{".py"},
	},
}

// DetectServer returns the appropriate server config for a file extension.
// Returns nil if no matching server is known.
func DetectServer(ext string) *ServerConfig {
	for i := range KnownServers {
		for _, e := range KnownServers[i].Extensions {
			if e == ext {
				return &KnownServers[i]
			}
		}
	}
	return nil
}

// IsServerAvailable checks if the server binary is on PATH.
func IsServerAvailable(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}
