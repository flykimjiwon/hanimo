package main

// Phase 12 — MCP (Model Context Protocol) client.
//
// Ports the hanimo CLI's internal/mcp (client + stdio transport + manager)
// into this separate Go module. Frontend-facing API:
//
//   - App.GetMCPServers()    → []mcpServerStatus (config + tools + connection state)
//   - App.CallMCPTool(...)   → string (tool text result)
//   - App.RefreshMCPServers()→ re-read config + restart clients
//
// Lifecycle: lazy spawn on first GetMCPServers() call. All clients share
// the App for the full session. StopMCP() is called from App.shutdown().

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"gopkg.in/yaml.v3"
)

// ── Config types (mirror CLI's config.MCPServer) ──

type mcpServerCfg struct {
	Name      string            `yaml:"name"`
	Transport string            `yaml:"transport"` // "stdio" | "sse" (only stdio implemented here)
	Command   string            `yaml:"command"`
	Args      []string          `yaml:"args"`
	URL       string            `yaml:"url"`
	Env       map[string]string `yaml:"env"`
}

type mcpConfigFile struct {
	MCP struct {
		Servers []mcpServerCfg `yaml:"servers"`
	} `yaml:"mcp"`
}

// ── JSON-RPC 2.0 types ──

type mcpRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int64       `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}

type mcpResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int64           `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *mcpRPCError    `json:"error,omitempty"`
}

type mcpRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e *mcpRPCError) Error() string { return fmt.Sprintf("rpc error %d: %s", e.Code, e.Message) }

// ── Tool definition (wire format + frontend surface) ──

type mcpTool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

// mcpServerStatus is the frontend-facing summary of one configured server.
type mcpServerStatus struct {
	Name      string    `json:"name"`
	Transport string    `json:"transport"`
	Command   string    `json:"command,omitempty"`
	URL       string    `json:"url,omitempty"`
	Connected bool      `json:"connected"`
	Error     string    `json:"error,omitempty"`
	Tools     []mcpTool `json:"tools"`
}

// ── Transport ──

type mcpStdioTransport struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	reader *bufio.Reader
}

func newStdioTransport(command string, args []string, env map[string]string) (*mcpStdioTransport, error) {
	cmd := exec.Command(command, args...)
	if len(env) > 0 {
		cmd.Env = os.Environ()
		for k, v := range env {
			cmd.Env = append(cmd.Env, k+"="+v)
		}
	}
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		stdin.Close()
		return nil, fmt.Errorf("stdout pipe: %w", err)
	}
	if err := cmd.Start(); err != nil {
		stdin.Close()
		return nil, fmt.Errorf("start %s: %w", command, err)
	}
	return &mcpStdioTransport{cmd: cmd, stdin: stdin, reader: bufio.NewReader(stdout)}, nil
}

func (t *mcpStdioTransport) Send(data []byte) error {
	if _, err := io.WriteString(t.stdin, fmt.Sprintf("Content-Length: %d\r\n\r\n", len(data))); err != nil {
		return fmt.Errorf("write header: %w", err)
	}
	if _, err := t.stdin.Write(data); err != nil {
		return fmt.Errorf("write body: %w", err)
	}
	return nil
}

func (t *mcpStdioTransport) Receive() ([]byte, error) {
	var contentLength int
	for {
		line, err := t.reader.ReadString('\n')
		if err != nil {
			return nil, fmt.Errorf("read header: %w", err)
		}
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			break
		}
		if strings.HasPrefix(line, "Content-Length: ") {
			val := strings.TrimPrefix(line, "Content-Length: ")
			contentLength, err = strconv.Atoi(val)
			if err != nil {
				return nil, fmt.Errorf("parse content-length %q: %w", val, err)
			}
		}
	}
	if contentLength == 0 {
		return nil, fmt.Errorf("missing or zero Content-Length")
	}
	body := make([]byte, contentLength)
	if _, err := io.ReadFull(t.reader, body); err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	return body, nil
}

func (t *mcpStdioTransport) Close() error {
	_ = t.stdin.Close()
	// Best-effort: kill the child if it doesn't exit cleanly.
	if t.cmd.Process != nil {
		_ = t.cmd.Process.Kill()
	}
	return t.cmd.Wait()
}

// ── Client ──

type mcpClient struct {
	transport *mcpStdioTransport
	nextID    atomic.Int64
	mu        sync.Mutex
	tools     []mcpTool
}

func (c *mcpClient) call(method string, params interface{}) (json.RawMessage, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	id := c.nextID.Add(1)
	data, err := json.Marshal(mcpRequest{JSONRPC: "2.0", ID: id, Method: method, Params: params})
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}
	if err := c.transport.Send(data); err != nil {
		return nil, err
	}
	respData, err := c.transport.Receive()
	if err != nil {
		return nil, err
	}
	var resp mcpResponse
	if err := json.Unmarshal(respData, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}
	if resp.Error != nil {
		return nil, resp.Error
	}
	return resp.Result, nil
}

func (c *mcpClient) notify(method string, params interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	notif := struct {
		JSONRPC string      `json:"jsonrpc"`
		Method  string      `json:"method"`
		Params  interface{} `json:"params,omitempty"`
	}{JSONRPC: "2.0", Method: method, Params: params}
	data, err := json.Marshal(notif)
	if err != nil {
		return err
	}
	return c.transport.Send(data)
}

func (c *mcpClient) initialize(_ context.Context) error {
	_, err := c.call("initialize", map[string]interface{}{
		"protocolVersion": "2025-06-18",
		"capabilities":    map[string]interface{}{},
		"clientInfo": map[string]interface{}{
			"name":    "hanimo-desktop",
			"version": "0.1.0",
		},
	})
	if err != nil {
		return err
	}
	return c.notify("notifications/initialized", nil)
}

func (c *mcpClient) listTools(_ context.Context) ([]mcpTool, error) {
	raw, err := c.call("tools/list", nil)
	if err != nil {
		return nil, err
	}
	var result struct {
		Tools []mcpTool `json:"tools"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("unmarshal tools: %w", err)
	}
	c.tools = result.Tools
	return result.Tools, nil
}

func (c *mcpClient) callTool(_ context.Context, name string, args map[string]interface{}) (string, error) {
	raw, err := c.call("tools/call", map[string]interface{}{"name": name, "arguments": args})
	if err != nil {
		return "", err
	}
	var result struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		IsError bool `json:"isError,omitempty"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return "", fmt.Errorf("unmarshal tool result: %w", err)
	}
	var sb strings.Builder
	for _, c := range result.Content {
		if c.Type == "text" {
			sb.WriteString(c.Text)
		}
	}
	out := sb.String()
	if result.IsError {
		return out, fmt.Errorf("tool reported error")
	}
	return out, nil
}

func (c *mcpClient) close() error {
	if c.transport == nil {
		return nil
	}
	return c.transport.Close()
}

// ── Per-server wrapper (cached on App) ──

type mcpServerRuntime struct {
	cfg    mcpServerCfg
	client *mcpClient
	err    string
}

// ── Config loader ──

// loadMCPConfig reads the shared ~/.hanimo/config.yaml and returns the
// mcp.servers section. Missing config → empty list (not an error).
func loadMCPConfig() []mcpServerCfg {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil
	}
	path := filepath.Join(home, ".hanimo", "config.yaml")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var cfg mcpConfigFile
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil
	}
	return cfg.MCP.Servers
}

// ── App bindings ──

// ensureMCP spawns configured stdio servers on first access. Cached afterwards.
// Non-stdio transports are listed as 'not-supported' without an error (placeholder
// until SSE/HTTP is added to desktop).
func (a *App) ensureMCP() []*mcpServerRuntime {
	a.mcpMu.Lock()
	defer a.mcpMu.Unlock()
	if a.mcpStarted {
		return a.mcpRuntimes
	}
	a.mcpStarted = true

	cfgs := loadMCPConfig()
	for _, srv := range cfgs {
		rt := &mcpServerRuntime{cfg: srv}
		switch srv.Transport {
		case "stdio":
			if srv.Command == "" {
				rt.err = "stdio transport requires 'command'"
				break
			}
			tr, err := newStdioTransport(srv.Command, srv.Args, srv.Env)
			if err != nil {
				rt.err = err.Error()
				break
			}
			cli := &mcpClient{transport: tr}
			if err := cli.initialize(context.Background()); err != nil {
				rt.err = "initialize: " + err.Error()
				_ = cli.close()
				break
			}
			if _, err := cli.listTools(context.Background()); err != nil {
				// Connected but tool list failed — surface but keep client alive.
				rt.err = "list tools: " + err.Error()
			}
			rt.client = cli
		case "sse", "http":
			rt.err = srv.Transport + " transport not supported in desktop build yet"
		default:
			rt.err = "unknown transport: " + srv.Transport
		}
		a.mcpRuntimes = append(a.mcpRuntimes, rt)
	}
	return a.mcpRuntimes
}

// GetMCPServers returns the configured MCP servers + live connection state.
// Triggers lazy spawn of stdio servers on first call.
func (a *App) GetMCPServers() []mcpServerStatus {
	rts := a.ensureMCP()
	out := make([]mcpServerStatus, 0, len(rts))
	for _, rt := range rts {
		s := mcpServerStatus{
			Name:      rt.cfg.Name,
			Transport: rt.cfg.Transport,
			Command:   rt.cfg.Command,
			URL:       rt.cfg.URL,
			Connected: rt.client != nil,
			Error:     rt.err,
		}
		if rt.client != nil {
			s.Tools = append(s.Tools, rt.client.tools...)
		}
		if s.Tools == nil {
			s.Tools = []mcpTool{}
		}
		out = append(out, s)
	}
	return out
}

// CallMCPTool invokes a tool on the named server. argsJSON is a JSON object
// (the schema is server-defined — surfaced in GetMCPServers().Tools).
func (a *App) CallMCPTool(serverName, toolName, argsJSON string) (string, error) {
	rts := a.ensureMCP()
	var args map[string]interface{}
	if strings.TrimSpace(argsJSON) != "" {
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
			return "", fmt.Errorf("parse arguments JSON: %w", err)
		}
	}
	for _, rt := range rts {
		if rt.cfg.Name != serverName {
			continue
		}
		if rt.client == nil {
			return "", fmt.Errorf("server %q not connected: %s", serverName, rt.err)
		}
		return rt.client.callTool(context.Background(), toolName, args)
	}
	return "", fmt.Errorf("no MCP server named %q", serverName)
}

// RefreshMCPServers closes existing clients and re-reads config. Used when
// the user edits config.yaml while the app is running.
func (a *App) RefreshMCPServers() []mcpServerStatus {
	a.mcpMu.Lock()
	for _, rt := range a.mcpRuntimes {
		if rt.client != nil {
			_ = rt.client.close()
		}
	}
	a.mcpRuntimes = nil
	a.mcpStarted = false
	a.mcpMu.Unlock()
	return a.GetMCPServers()
}

// StopMCP shuts down all running clients. Called from App.shutdown().
func (a *App) StopMCP() {
	a.mcpMu.Lock()
	defer a.mcpMu.Unlock()
	for _, rt := range a.mcpRuntimes {
		if rt.client != nil {
			_ = rt.client.close()
		}
	}
	a.mcpRuntimes = nil
	a.mcpStarted = false
}
