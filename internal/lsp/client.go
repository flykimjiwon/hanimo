package lsp

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Client communicates with a language server via stdio using LSP's
// Content-Length framed JSON-RPC protocol.
type Client struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	stdout  *bufio.Reader
	nextID  int
	mu      sync.Mutex
	pending map[int]chan *Response
}

// NewClient spawns a language server process and connects via stdio.
func NewClient(command string, args ...string) (*Client, error) {
	cmd := exec.Command(command, args...)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("stdout pipe: %w", err)
	}
	// Discard stderr to avoid blocking.
	cmd.Stderr = nil

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start %s: %w", command, err)
	}

	c := &Client{
		cmd:     cmd,
		stdin:   stdin,
		stdout:  bufio.NewReaderSize(stdout, 64*1024),
		pending: make(map[int]chan *Response),
	}
	go c.readLoop()
	return c, nil
}

// Initialize sends the LSP initialize request and initialized notification.
func (c *Client) Initialize(rootURI string) error {
	params := map[string]interface{}{
		"processId": nil,
		"rootUri":   rootURI,
		"capabilities": map[string]interface{}{
			"textDocument": map[string]interface{}{
				"definition":      map[string]interface{}{},
				"references":      map[string]interface{}{},
				"hover":           map[string]interface{}{},
				"documentSymbol":  map[string]interface{}{},
				"publishDiagnostics": map[string]interface{}{},
			},
		},
	}
	resp, err := c.call("initialize", params)
	if err != nil {
		return fmt.Errorf("initialize: %w", err)
	}
	if resp.Error != nil {
		return resp.Error
	}
	c.notify("initialized", map[string]interface{}{})
	return nil
}

// Definition returns the definition location for a symbol at position.
func (c *Client) Definition(uri string, line, char int) ([]Location, error) {
	params := TextDocumentPositionParams{
		TextDocument: TextDocumentIdentifier{URI: uri},
		Position:     Position{Line: line, Character: char},
	}
	resp, err := c.call("textDocument/definition", params)
	if err != nil {
		return nil, err
	}
	if resp.Error != nil {
		return nil, resp.Error
	}
	// Result can be Location, []Location, or null.
	if resp.Result == nil || string(resp.Result) == "null" {
		return nil, nil
	}
	// Try []Location first.
	var locs []Location
	if err := json.Unmarshal(resp.Result, &locs); err == nil {
		return locs, nil
	}
	// Try single Location.
	var loc Location
	if err := json.Unmarshal(resp.Result, &loc); err == nil {
		return []Location{loc}, nil
	}
	return nil, nil
}

// References returns all references to a symbol at position.
func (c *Client) References(uri string, line, char int) ([]Location, error) {
	params := map[string]interface{}{
		"textDocument": TextDocumentIdentifier{URI: uri},
		"position":     Position{Line: line, Character: char},
		"context":      map[string]interface{}{"includeDeclaration": true},
	}
	resp, err := c.call("textDocument/references", params)
	if err != nil {
		return nil, err
	}
	if resp.Error != nil {
		return nil, resp.Error
	}
	if resp.Result == nil || string(resp.Result) == "null" {
		return nil, nil
	}
	var locs []Location
	if err := json.Unmarshal(resp.Result, &locs); err != nil {
		return nil, fmt.Errorf("unmarshal references: %w", err)
	}
	return locs, nil
}

// Hover returns hover information (type info, docs) at position.
func (c *Client) Hover(uri string, line, char int) (string, error) {
	params := TextDocumentPositionParams{
		TextDocument: TextDocumentIdentifier{URI: uri},
		Position:     Position{Line: line, Character: char},
	}
	resp, err := c.call("textDocument/hover", params)
	if err != nil {
		return "", err
	}
	if resp.Error != nil {
		return "", resp.Error
	}
	if resp.Result == nil || string(resp.Result) == "null" {
		return "", nil
	}
	var hover struct {
		Contents interface{} `json:"contents"`
	}
	if err := json.Unmarshal(resp.Result, &hover); err != nil {
		return "", fmt.Errorf("unmarshal hover: %w", err)
	}
	return extractHoverText(hover.Contents), nil
}

// DocumentSymbols returns all symbols in a document.
func (c *Client) DocumentSymbols(uri string) ([]SymbolInformation, error) {
	params := map[string]interface{}{
		"textDocument": TextDocumentIdentifier{URI: uri},
	}
	resp, err := c.call("textDocument/documentSymbol", params)
	if err != nil {
		return nil, err
	}
	if resp.Error != nil {
		return nil, resp.Error
	}
	if resp.Result == nil || string(resp.Result) == "null" {
		return nil, nil
	}
	var syms []SymbolInformation
	if err := json.Unmarshal(resp.Result, &syms); err != nil {
		// Some servers return DocumentSymbol[] instead; ignore parse errors.
		return nil, nil
	}
	return syms, nil
}

// DidOpen sends a textDocument/didOpen notification.
func (c *Client) DidOpen(uri, languageID, content string) error {
	params := map[string]interface{}{
		"textDocument": map[string]interface{}{
			"uri":        uri,
			"languageId": languageID,
			"version":    1,
			"text":       content,
		},
	}
	c.notify("textDocument/didOpen", params)
	return nil
}

// Shutdown sends the shutdown request to the language server.
func (c *Client) Shutdown() error {
	resp, err := c.call("shutdown", nil)
	if err != nil {
		return err
	}
	if resp.Error != nil {
		return resp.Error
	}
	c.notify("exit", nil)
	return nil
}

// Close kills the server process.
func (c *Client) Close() {
	_ = c.stdin.Close()
	if c.cmd.Process != nil {
		_ = c.cmd.Process.Kill()
	}
	_ = c.cmd.Wait()
}

// call sends a JSON-RPC request and waits for the response (10s timeout).
func (c *Client) call(method string, params interface{}) (*Response, error) {
	c.mu.Lock()
	c.nextID++
	id := c.nextID
	ch := make(chan *Response, 1)
	c.pending[id] = ch
	c.mu.Unlock()

	req := Request{
		JSONRPC: "2.0",
		ID:      id,
		Method:  method,
		Params:  params,
	}
	data, err := json.Marshal(req)
	if err != nil {
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
		return nil, fmt.Errorf("marshal: %w", err)
	}
	if err := c.writeMessage(data); err != nil {
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
		return nil, fmt.Errorf("write: %w", err)
	}

	select {
	case resp := <-ch:
		return resp, nil
	case <-time.After(10 * time.Second):
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
		return nil, fmt.Errorf("timeout waiting for response to %s (id=%d)", method, id)
	}
}

// notify sends a JSON-RPC notification (no response expected).
func (c *Client) notify(method string, params interface{}) {
	notif := Notification{
		JSONRPC: "2.0",
		Method:  method,
		Params:  params,
	}
	data, _ := json.Marshal(notif)
	_ = c.writeMessage(data)
}

// readLoop reads LSP messages from stdout using Content-Length framing.
func (c *Client) readLoop() {
	for {
		// Read headers until \r\n\r\n.
		contentLength := -1
		for {
			line, err := c.stdout.ReadString('\n')
			if err != nil {
				// Server closed or crashed — drain pending.
				c.mu.Lock()
				for id, ch := range c.pending {
					ch <- &Response{Error: &ResponseError{Code: -1, Message: "server closed"}}
					delete(c.pending, id)
				}
				c.mu.Unlock()
				return
			}
			line = strings.TrimRight(line, "\r\n")
			if line == "" {
				break // End of headers.
			}
			if strings.HasPrefix(line, "Content-Length:") {
				valStr := strings.TrimSpace(strings.TrimPrefix(line, "Content-Length:"))
				if n, err := strconv.Atoi(valStr); err == nil {
					contentLength = n
				}
			}
		}
		if contentLength <= 0 {
			continue
		}

		// Read exactly contentLength bytes.
		body := make([]byte, contentLength)
		if _, err := io.ReadFull(c.stdout, body); err != nil {
			return
		}

		// Try to parse as Response (has "id" field).
		var resp Response
		if err := json.Unmarshal(body, &resp); err != nil {
			continue
		}
		// Notifications have id==0 and no result/error — skip them.
		if resp.ID == 0 && resp.Result == nil && resp.Error == nil {
			continue
		}

		c.mu.Lock()
		ch, ok := c.pending[resp.ID]
		if ok {
			delete(c.pending, resp.ID)
		}
		c.mu.Unlock()

		if ok {
			ch <- &resp
		}
	}
}

// writeMessage writes an LSP framed message to stdin.
func (c *Client) writeMessage(data []byte) error {
	header := fmt.Sprintf("Content-Length: %d\r\n\r\n", len(data))
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, err := io.WriteString(c.stdin, header); err != nil {
		return err
	}
	if _, err := c.stdin.Write(data); err != nil {
		return err
	}
	return nil
}

// extractHoverText pulls readable text from the hover contents field,
// which can be a string, {kind, value}, or []interface{}.
func extractHoverText(contents interface{}) string {
	switch v := contents.(type) {
	case string:
		return v
	case map[string]interface{}:
		if val, ok := v["value"].(string); ok {
			return val
		}
	case []interface{}:
		var parts []string
		for _, item := range v {
			switch t := item.(type) {
			case string:
				parts = append(parts, t)
			case map[string]interface{}:
				if val, ok := t["value"].(string); ok {
					parts = append(parts, val)
				}
			}
		}
		return strings.Join(parts, "\n")
	}
	return fmt.Sprintf("%v", contents)
}
