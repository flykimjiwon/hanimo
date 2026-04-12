package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// ── Config ──────────────────────────────────────────────────────────
const (
	apiEndpoint = "https://spark3-share.tech-2030.net/api/v1"
	apiKey      = "f0a26c072bd83b635a4daad40a51be068bb80d5a7540adfe"
	mainModel   = "gemma4:31b"  // deep reasoning
	fastModel   = "gemma4:26b"  // fast responses (default)
	listenAddr  = ":9800"
)

// ── API Types ───────────────────────────────────────────────────────
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Stream      bool          `json:"stream"`
	Temperature float64       `json:"temperature,omitempty"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
}

type ChatResponse struct {
	Choices []struct {
		Message      *ChatMessage `json:"message,omitempty"`
		Delta        *ChatMessage `json:"delta,omitempty"`
		FinishReason *string      `json:"finish_reason,omitempty"`
	} `json:"choices"`
	Model string `json:"model"`
}

type ModelsResponse struct {
	Data []struct {
		ID string `json:"id"`
	} `json:"data"`
}

// ── API Client ──────────────────────────────────────────────────────
var httpClient = &http.Client{Timeout: 120 * time.Second}

func apiRequest(method, path string, body interface{}) (*http.Response, error) {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, apiEndpoint+path, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	return httpClient.Do(req)
}

// ── Handlers ────────────────────────────────────────────────────────

func handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	tmpl.Execute(w, map[string]string{
		"MainModel": mainModel,
		"FastModel": fastModel,
	})
}

func handleModels(w http.ResponseWriter, r *http.Request) {
	resp, err := apiRequest("GET", "/models", nil)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	defer resp.Body.Close()

	var models ModelsResponse
	json.NewDecoder(resp.Body).Decode(&models)

	gemma := []string{}
	for _, m := range models.Data {
		if strings.HasPrefix(m.ID, "gemma4") {
			gemma = append(gemma, m.ID)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(gemma)
}

func handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", 405)
		return
	}

	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request: "+err.Error(), 400)
		return
	}

	if req.Model == "" {
		req.Model = fastModel
	}
	req.Stream = true
	if req.Temperature == 0 {
		req.Temperature = 0.7
	}
	if req.MaxTokens == 0 {
		req.MaxTokens = 4096
	}

	// System prompt
	sys := ChatMessage{Role: "system", Content: "You are Spark, a helpful AI assistant powered by Gemma4 on DGX Spark. Answer in the user's language. Be concise and accurate."}
	req.Messages = append([]ChatMessage{sys}, req.Messages...)

	resp, err := apiRequest("POST", "/chat/completions", req)
	if err != nil {
		http.Error(w, "upstream error: "+err.Error(), 502)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		http.Error(w, fmt.Sprintf("upstream %d: %s", resp.StatusCode, string(body)), resp.StatusCode)
		return
	}

	// SSE streaming
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", 500)
		return
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 64*1024), 64*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				fmt.Fprintf(w, "data: [DONE]\n\n")
				flusher.Flush()
				break
			}
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

// ── Main ────────────────────────────────────────────────────────────
func main() {
	addr := listenAddr
	if p := os.Getenv("PORT"); p != "" {
		addr = ":" + p
	}

	http.HandleFunc("/", handleIndex)
	http.HandleFunc("/api/models", handleModels)
	http.HandleFunc("/api/chat", handleChat)

	fmt.Printf("\n")
	fmt.Printf("  ⚡ Spark — DGX Spark Gemma4 Chat\n")
	fmt.Printf("  ─────────────────────────────────\n")
	fmt.Printf("  Main model : %s (deep)\n", mainModel)
	fmt.Printf("  Fast model : %s (default)\n", fastModel)
	fmt.Printf("  Endpoint   : %s\n", apiEndpoint)
	fmt.Printf("  Listen     : http://localhost%s\n", addr)
	fmt.Printf("\n")

	log.Fatal(http.ListenAndServe(addr, nil))
}

// ── Embedded HTML ───────────────────────────────────────────────────
var tmpl = template.Must(template.New("index").Parse(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spark — Gemma4 Chat</title>
<style>
:root {
  --bg: #0d1117; --surface: #161b22; --border: #30363d;
  --text: #e6edf3; --muted: #8b949e; --accent: #f97316;
  --accent2: #a855f7; --user-bg: #1c2333; --ai-bg: #111820;
  --radius: 12px;
}
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', 'Helvetica Neue', sans-serif;
  background: var(--bg); color: var(--text);
  height: 100vh; display: flex; flex-direction: column;
}

/* Header */
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.header .logo { display: flex; align-items: center; gap: 8px; }
.header .logo svg { width: 22px; height: 22px; }
.header .logo span { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; }
.header .controls { display: flex; align-items: center; gap: 10px; }
.model-select {
  background: var(--bg); border: 1px solid var(--border); color: var(--text);
  padding: 5px 10px; border-radius: 6px; font-size: 12px; font-family: 'SF Mono', monospace;
  cursor: pointer; outline: none;
}
.model-select:focus { border-color: var(--accent); }
.btn-deep {
  display: flex; align-items: center; gap: 4px;
  background: transparent; border: 1px solid var(--border); color: var(--muted);
  padding: 5px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;
  transition: all .15s;
}
.btn-deep.active { background: rgba(168,85,247,.15); border-color: var(--accent2); color: var(--accent2); }
.btn-clear {
  background: transparent; border: 1px solid var(--border); color: var(--muted);
  padding: 5px 8px; border-radius: 6px; cursor: pointer; font-size: 13px;
  transition: all .15s;
}
.btn-clear:hover { border-color: #f44; color: #f44; }
.status-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #3fb950;
  display: inline-block; margin-right: 2px;
}

/* Messages */
.messages {
  flex: 1; overflow-y: auto; padding: 16px 0;
  scroll-behavior: smooth;
}
.messages::-webkit-scrollbar { width: 6px; }
.messages::-webkit-scrollbar-track { background: transparent; }
.messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; gap: 12px; opacity: .4;
}
.empty-state svg { width: 48px; height: 48px; color: var(--accent); }
.empty-state h2 { font-size: 28px; font-weight: 700; }
.empty-state p { font-size: 13px; font-family: monospace; }
.quick-btns { display: flex; gap: 8px; margin-top: 8px; }
.quick-btn {
  background: var(--surface); border: 1px solid var(--border); color: var(--muted);
  padding: 6px 12px; border-radius: 8px; font-size: 11px; cursor: pointer;
  transition: all .15s;
}
.quick-btn:hover { border-color: var(--accent); color: var(--text); }

.msg { padding: 4px 20px; display: flex; }
.msg.user { justify-content: flex-end; }
.msg.assistant { justify-content: flex-start; }
.msg .bubble {
  max-width: 75%; padding: 12px 16px; border-radius: var(--radius);
  line-height: 1.6; font-size: 14px; white-space: pre-wrap; word-break: break-word;
  position: relative;
}
.msg.user .bubble { background: var(--user-bg); border: 1px solid rgba(249,115,22,.15); }
.msg.assistant .bubble { background: var(--ai-bg); border: 1px solid var(--border); }
.msg .meta {
  font-size: 10px; color: var(--muted); margin-bottom: 4px;
  font-family: 'SF Mono', monospace; display: flex; align-items: center; gap: 4px;
}
.msg .time { font-size: 9px; color: var(--muted); opacity: .5; margin-top: 4px; }
.cursor { animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }

/* Code blocks */
.bubble pre {
  background: #0d1117; border: 1px solid var(--border); border-radius: 8px;
  padding: 12px; margin: 8px 0; overflow-x: auto; font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
}
.bubble code {
  font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px;
  background: rgba(255,255,255,.06); padding: 1px 4px; border-radius: 3px;
}
.bubble pre code { background: none; padding: 0; }

/* Input */
.input-area {
  padding: 12px 20px; border-top: 1px solid var(--border);
  background: var(--surface); display: flex; align-items: flex-end; gap: 10px;
}
.input-area textarea {
  flex: 1; background: var(--bg); border: 1px solid var(--border); color: var(--text);
  padding: 10px 14px; border-radius: 10px; font-size: 14px; resize: none;
  font-family: inherit; outline: none; max-height: 150px; line-height: 1.5;
}
.input-area textarea:focus { border-color: var(--accent); }
.input-area textarea::placeholder { color: var(--muted); }
.send-btn {
  width: 38px; height: 38px; border-radius: 50%; border: none;
  background: var(--accent); color: #fff; font-size: 18px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s; flex-shrink: 0;
}
.send-btn:hover { filter: brightness(1.15); }
.send-btn:disabled { opacity: .3; cursor: default; }
.send-btn.stop { background: #ef4444; }
</style>
</head>
<body>

<div class="header">
  <div class="logo">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent)">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
    </svg>
    <span>Spark</span>
  </div>
  <div class="controls">
    <span class="status-dot"></span>
    <select class="model-select" id="modelSelect">
      <option value="{{.FastModel}}" selected>{{.FastModel}} (fast)</option>
      <option value="{{.MainModel}}">{{.MainModel}} (deep)</option>
    </select>
    <button class="btn-deep" id="deepBtn" title="Deep Think: force 31B model">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a9 9 0 0 1 9 9c0 3.87-3.13 7-7 7h-1v4h-2v-4H10c-3.87 0-7-3.13-7-7a9 9 0 0 1 9-9z"/></svg>
      Deep
    </button>
    <button class="btn-clear" id="clearBtn" title="Clear chat">&#x1D5EB;</button>
  </div>
</div>

<div class="messages" id="messages">
  <div class="empty-state" id="emptyState">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
    </svg>
    <h2>Spark</h2>
    <p>DGX Spark &middot; Gemma4</p>
    <div class="quick-btns">
      <button class="quick-btn" onclick="setInput('Explain quantum computing in simple terms')">Quantum computing</button>
      <button class="quick-btn" onclick="setInput('Write a Python Fibonacci function')">Python code</button>
      <button class="quick-btn" onclick="setInput('Summarize the latest AI trends')">AI trends</button>
    </div>
  </div>
</div>

<div class="input-area">
  <textarea id="input" rows="1" placeholder="Message Spark..." autofocus></textarea>
  <button class="send-btn" id="sendBtn" title="Send">&#x2191;</button>
</div>

<script>
const messagesEl = document.getElementById('messages');
const emptyState = document.getElementById('emptyState');
const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const modelSelect = document.getElementById('modelSelect');
const deepBtn = document.getElementById('deepBtn');
const clearBtn = document.getElementById('clearBtn');

let history = [];
let streaming = false;
let abortCtrl = null;
let deepMode = false;

function setInput(text) { input.value = text; input.focus(); }

function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function timeStr() {
  return new Date().toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' });
}

function formatContent(text) {
  var BT = String.fromCharCode(96);
  var codeBlockRe = new RegExp(BT+BT+BT+'(\\w*)\\n([\\s\\S]*?)'+BT+BT+BT, 'g');
  var inlineRe = new RegExp(BT+'([^'+BT+']+)'+BT, 'g');
  return text
    .replace(codeBlockRe, '<pre><code>$2</code></pre>')
    .replace(inlineRe, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function addMessage(role, content, model) {
  if (emptyState) emptyState.style.display = 'none';
  const div = document.createElement('div');
  div.className = 'msg ' + role;

  const inner = document.createElement('div');
  if (role === 'assistant' && model) {
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = '&#x26A1; ' + model;
    inner.appendChild(meta);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = formatContent(content);
  inner.appendChild(bubble);

  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = timeStr();
  inner.appendChild(time);

  div.appendChild(inner);
  messagesEl.appendChild(div);
  scrollBottom();
  return bubble;
}

async function send() {
  const text = input.value.trim();
  if (!text || streaming) return;

  input.value = '';
  autoResize();
  history.push({ role: 'user', content: text });
  addMessage('user', text);

  const model = deepMode ? '{{.MainModel}}' : modelSelect.value;
  streaming = true;
  sendBtn.innerHTML = '&#x25A0;';
  sendBtn.classList.add('stop');

  abortCtrl = new AbortController();
  const bubble = addMessage('assistant', '', model);
  let fullText = '';

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: history.slice(-20)
      }),
      signal: abortCtrl.signal
    });

    if (!resp.ok) {
      const errText = await resp.text();
      bubble.innerHTML = '<span style="color:#f44">Error: ' + resp.status + ' — ' + errText + '</span>';
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              bubble.innerHTML = formatContent(fullText) + '<span class="cursor">&#x258C;</span>';
              scrollBottom();
            }
          } catch(e) {}
        }
      }
    }

    bubble.innerHTML = formatContent(fullText);
    history.push({ role: 'assistant', content: fullText });
  } catch (e) {
    if (e.name !== 'AbortError') {
      bubble.innerHTML = '<span style="color:#f44">Error: ' + e.message + '</span>';
    }
  } finally {
    streaming = false;
    abortCtrl = null;
    sendBtn.innerHTML = '&#x2191;';
    sendBtn.classList.remove('stop');
    scrollBottom();
  }
}

function stopStream() {
  if (abortCtrl) abortCtrl.abort();
}

// Events
sendBtn.addEventListener('click', () => {
  if (streaming) stopStream(); else send();
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

function autoResize() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 150) + 'px';
}
input.addEventListener('input', autoResize);

deepBtn.addEventListener('click', () => {
  deepMode = !deepMode;
  deepBtn.classList.toggle('active', deepMode);
});

clearBtn.addEventListener('click', () => {
  history = [];
  messagesEl.innerHTML = '';
  if (emptyState) {
    messagesEl.appendChild(emptyState);
    emptyState.style.display = '';
  }
});

// Load models
fetch('/api/models').then(r => r.json()).then(models => {
  if (Array.isArray(models) && models.length) {
    const current = modelSelect.value;
    modelSelect.innerHTML = '';
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m + (m === '{{.FastModel}}' ? ' (fast)' : m === '{{.MainModel}}' ? ' (deep)' : '');
      if (m === current) opt.selected = true;
      modelSelect.appendChild(opt);
    });
  }
}).catch(() => {});
</script>
</body>
</html>`))
