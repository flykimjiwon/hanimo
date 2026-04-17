package app

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"sort"
	"path/filepath"
	"strings"
	"time"

	"charm.land/bubbles/v2/textarea"
	"charm.land/bubbles/v2/viewport"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
	openai "github.com/sashabaranov/go-openai"

	hanimo "github.com/flykimjiwon/hanimo"
	"github.com/flykimjiwon/hanimo/internal/agents"
	"github.com/flykimjiwon/hanimo/internal/companion"
	"github.com/flykimjiwon/hanimo/internal/config"
	"github.com/flykimjiwon/hanimo/internal/gitinfo"
	"github.com/flykimjiwon/hanimo/internal/knowledge"
	"github.com/flykimjiwon/hanimo/internal/llm"
	"github.com/flykimjiwon/hanimo/internal/multi"
	"github.com/flykimjiwon/hanimo/internal/session"
	"github.com/flykimjiwon/hanimo/internal/skills"
	"github.com/flykimjiwon/hanimo/internal/llm/providers"
	"github.com/flykimjiwon/hanimo/internal/tools"
	"github.com/flykimjiwon/hanimo/internal/ui"
)

// streamTickMsg fires on a 150ms ticker while a stream is active so the
// spinner + elapsed-time display keeps animating even when no tokens
// have arrived for a long stretch. Without this the UI silently freezes
// at the last chunk and looks dead, even though waitForNextChunk is
// still blocked on the provider channel.
type streamTickMsg struct{}

func streamTickCmd() tea.Cmd {
	return tea.Tick(150*time.Millisecond, func(time.Time) tea.Msg {
		return streamTickMsg{}
	})
}

type streamChunkMsg struct {
	content   string
	done      bool
	err       error
	toolCalls []llm.ToolCallInfo
}

type toolResultMsg struct {
	results []toolResult
}

type toolResult struct {
	callID string
	name   string
	args   string // raw JSON arguments — used to render diff boxes for file_edit/file_write
	output string
}

type Model struct {
	cfg       config.Config
	client    *llm.Client
	activeTab int
	cwd       string // current working directory (abbreviated)

	// Single shared conversation (not per-mode)
	history []openai.ChatCompletionMessage
	msgs    []ui.Message

	projectCtx string // .hanimo.md content

	textarea textarea.Model
	viewport viewport.Model

	streaming    bool
	streamBuf    string
	streamCh     <-chan llm.StreamChunk
	streamCancel context.CancelFunc
	streamStart  time.Time
	lastChunkAt  time.Time
	lastElapsed  time.Duration
	tokenCount   int
	toolIter     int // tool loop iteration counter (max 20)
	// toolCallHistory counts identical tool invocations ("name:argsJson" →ct)
	// within a single user turn. Reset at the start of each sendMessage so the
	// loop detector only fires on repeated calls inside the same task.
	toolCallHistory map[string]int
	// recentToolNames is a rolling window of the last few tool names in a
	// single turn. When the same name appears ≥5 times consecutively we
	// treat it as a doom loop even if args drift (args-drift bypass of the
	// exact-match detector above).
	recentToolNames []string
	pendingQueue    []string // messages queued while streaming
	sessionID       string   // active SQLite session ID for save/load
	knowledgeInj *knowledge.Injector

	// Multi-line paste buffer. When the user pastes content with >=2 lines,
	// we stash the full text here and insert a compact placeholder token
	// ("[붙여넣기 #N: M줄]") into the textarea so the input stays readable.
	// On send, expandPastes() swaps placeholders back to the original text.
	pasteBuf     map[string]string
	pasteCounter int

	autoMode bool   // autonomous mode active
	autoTask string // task description for auto mode

	// Intent hint (Super mode)
	intentHint string

	// ASK_USER interactive prompt state
	askQuestion *agents.AskQuestion
	askSelected int
	askInput    string

	// Dangerous operation confirmation state
	dangerCmd      string
	dangerReason   string
	dangerSelected int
	dangerPending  []llm.ToolCallInfo // tool calls queued behind confirmation
	dangerIndex    int                // index in dangerPending that needs approval

	// Plan execution state
	activePlan           *agents.Plan
	planAwaitingApproval bool // true while waiting for LLM to return a draft plan
	planExecuting        bool // true while running approved plan step-by-step

	showPalette     bool
	paletteQuery    string
	paletteSelected int

	showMenu      bool
	menuItems     []string
	menuSelected  int
	menuAction    string // current submenu: "", "model", "provider"
	modelList     []string

	inSetup    bool
	setupInput textarea.Model
	setupCfg   config.Config

	width  int
	height int
	ready  bool

	// Git HUD
	gitInfo    gitinfo.Info

	// Input history
	inputHistory      []string
	inputHistoryIdx   int
	inputHistoryDraft string

	// Companion dashboard
	companionHub    *companion.Hub
	companionServer *companion.Server

	// Multi-agent
	multiEnabled  bool
	multiStrategy multi.Strategy
	multiAuto     bool

	// Mouse toggle
	mouseEnabled bool
}

// ResumeSession loads a saved session's messages into an already-
// constructed Model so the conversation continues where it left off.
// Called from main.go when --resume is specified.
func ResumeSession(m Model, sessionID string) Model {
	_, savedMsgs, err := session.LoadSession(sessionID)
	if err != nil {
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: fmt.Sprintf("  세션 복원 실패: %v", err), Timestamp: time.Now(),
		})
		return m
	}
	m.sessionID = sessionID
	for _, sm := range savedMsgs {
		m.history = append(m.history, openai.ChatCompletionMessage{
			Role: sm.Role, Content: sm.Content,
		})
	}
	m.msgs = append(m.msgs, ui.Message{
		Role: ui.RoleSystem, Content: fmt.Sprintf("  세션 복원됨: %s (%d 메시지)", sessionID[:8], len(savedMsgs)), Timestamp: time.Now(),
	})
	return m
}

// ensureSession creates a SQLite session row if one doesn't exist yet
// for this conversation. Called lazily on first /save so idle sessions
// that never get saved don't pollute the database.
func (m *Model) ensureSession() error {
	if m.sessionID != "" {
		return nil
	}
	cwd, _ := os.Getwd()
	modeNames := []string{"super", "dev", "plan"}
	mode := modeNames[m.activeTab]
	id, err := session.CreateSession(cwd, m.cfg.API.BaseURL, m.currentModel(), mode)
	if err != nil {
		return err
	}
	m.sessionID = id
	return nil
}

// expandPastes substitutes stored multi-line paste content back into the
// input string. Any placeholder tokens that remain in the text are replaced
// with the original clipboard content.
//
// The buffer is intentionally NOT cleared on expansion — /pastes needs to
// show what the user already sent, not just what's staged for the next
// turn. The map is evicted only on /clear, Ctrl+L, or when the rolling
// cap kicks in (handled at paste-insertion time).
func (m *Model) expandPastes(s string) string {
	if len(m.pasteBuf) == 0 {
		return s
	}
	for token, content := range m.pasteBuf {
		s = strings.ReplaceAll(s, token, content)
	}
	return s
}

func NewModel(cfg config.Config, initialMode int, needsSetup bool) Model {
	ta := textarea.New()
	ta.Placeholder = ""
	ta.CharLimit = 4096
	ta.SetWidth(80)
	ta.SetHeight(1)
	ta.ShowLineNumbers = false
	// Remove background color from textarea
	styles := ta.Styles()
	styles.Focused.CursorLine = lipgloss.NewStyle()
	styles.Focused.EndOfBuffer = lipgloss.NewStyle()
	styles.Blurred.CursorLine = lipgloss.NewStyle()
	styles.Blurred.EndOfBuffer = lipgloss.NewStyle()
	ta.SetStyles(styles)
	ta.Focus()

	setupTa := textarea.New()
	setupTa.Placeholder = "sk_... or nvt_..."
	setupTa.CharLimit = 512
	setupTa.SetWidth(60)
	setupTa.SetHeight(1)
	setupTa.ShowLineNumbers = false

	vp := viewport.New(viewport.WithWidth(80), viewport.WithHeight(20))

	// Get abbreviated cwd
	cwd, _ := os.Getwd()
	cwdShort := filepath.Base(cwd)

	// Load project context
	projectCtx := ""
	if data, err := os.ReadFile(".hanimo.md"); err == nil && len(data) > 0 {
		projectCtx = "\n\n## Project Context (.hanimo.md)\n" + string(data)
	}
	projectCtx += llm.GatherSystemContext()

	// Initialize knowledge store (built-in embedded docs)
	var knowledgeInj *knowledge.Injector
	if knowledgeStore, err := knowledge.NewStore(hanimo.KnowledgeFS); err == nil {
		knowledgeInj = knowledge.NewInjector(knowledgeStore, 8192)
		config.DebugLog("[KNOWLEDGE] loaded %d documents", knowledgeStore.DocCount())
	} else {
		config.DebugLog("[KNOWLEDGE] failed to load: %v", err)
	}

	// Scan user knowledge folder (.hanimo/knowledge/) for md/txt docs.
	// Inject a table-of-contents into the system prompt so the LLM
	// knows what's available and can call knowledge_search when needed.
	knowledge.GlobalIndex = knowledge.ScanUserDocs()
	if knowledge.GlobalIndex.Count() > 0 {
		projectCtx += knowledge.GlobalIndex.TableOfContents()
		config.DebugLog("[USER-KNOWLEDGE] indexed %d docs from %s", knowledge.GlobalIndex.Count(), knowledge.GlobalIndex.Root())
	}

	// Scan user skills (.hanimo/skills/*/SKILL.md).
	skills.GlobalRegistry = skills.ScanSkills()
	if skills.GlobalRegistry.Count() > 0 {
		projectCtx += skills.GlobalRegistry.TableOfContents()
		config.DebugLog("[SKILLS] loaded %d skills", skills.GlobalRegistry.Count())
	}

	m := Model{
		cfg:          cfg,
		activeTab:    initialMode,
		cwd:          cwdShort,
		projectCtx:   projectCtx,
		knowledgeInj: knowledgeInj,
		textarea:     ta,
		viewport:     vp,
		inSetup:      needsSetup,
		setupCfg:     config.DefaultConfig(),
		setupInput:   setupTa,
		mouseEnabled: true,
	}

	m.gitInfo = gitinfo.Fetch(".")

	if needsSetup {
		m.setupInput.Focus()
	} else {
		m.client = llm.NewClientWithOptions(cfg.API.BaseURL, cfg.API.APIKey, cfg.NoStream)
	}

	// Probe runtime environment and inject into system prompt.
	envResults := llm.ProbeEnvironment()
	projectCtx += llm.FormatEnvironmentContext(envResults)
	config.DebugLog("[ENV-PROBE] detected %d tools", len(envResults))

	// Record the prompt cache breakpoint.
	stablePrompt := llm.SystemPrompt(llm.Mode(initialMode))
	llm.GlobalBreakpoint.SetBreakpoint(stablePrompt, projectCtx)

	// Single conversation with initial mode's system prompt
	mode := llm.Mode(initialMode)
	sysPrompt := llm.SystemPrompt(mode) + projectCtx
	m.history = []openai.ChatCompletionMessage{
		{Role: openai.ChatMessageRoleSystem, Content: sysPrompt},
	}
	m.msgs = []ui.Message{
		{Role: ui.RoleSystem, Content: ui.RenderLogo(), Timestamp: time.Now()},
		{Role: ui.RoleSystem, Content: ui.ModeInfoBox(initialMode, m.currentModel()), Timestamp: time.Now(), Tag: "modebox"},
	}

	if config.IsDebug() {
		m.msgs = append(m.msgs, ui.Message{
			Role:      ui.RoleSystem,
			Content:   fmt.Sprintf("[DEBUG MODE] 로그 파일: %s", config.DebugLogPath()),
			Timestamp: time.Now(),
		})
	}

	return m
}

func (m Model) Init() tea.Cmd {
	return textarea.Blink
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if m.inSetup {
		return m.updateSetup(msg)
	}

	// Command palette handling
	if m.showPalette {
		if msg, ok := msg.(tea.KeyPressMsg); ok {
			return m.updatePalette(msg)
		}
		// Pass non-key messages through (e.g. window resize)
	}

	// Menu handling
	if m.showMenu {
		if msg, ok := msg.(tea.KeyPressMsg); ok {
			return m.updateMenu(msg)
		}
	}

	// Interactive ASK_USER overlay intercepts keys before normal processing.
	if m.askQuestion != nil {
		if keyMsg, ok := msg.(tea.KeyPressMsg); ok {
			if keyMsg.String() == "ctrl+c" {
				return m, tea.Quit
			}
			if handled, cmd := m.handleAskUserKey(keyMsg); handled {
				m.updateViewport()
				return m, cmd
			}
		}
	}

	// Dangerous-operation confirmation overlay intercepts keys too.
	if m.dangerCmd != "" {
		if keyMsg, ok := msg.(tea.KeyPressMsg); ok {
			if keyMsg.String() == "ctrl+c" {
				return m, tea.Quit
			}
			if handled, cmd := m.handleDangerKey(keyMsg); handled {
				m.updateViewport()
				return m, cmd
			}
		}
	}

	switch msg := msg.(type) {
	case tea.PasteMsg:
		// Bracketed paste. Multi-line pastes are collapsed to a compact
		// placeholder like "[붙여넣기 #1: 42줄]" so the input stays readable;
		// the original content is restored by expandPastes() on send.
		// Single-line pastes are inserted verbatim.
		pasted := msg.Content
		lineCount := strings.Count(pasted, "\n") + 1
		if lineCount >= 2 {
			if m.pasteBuf == nil {
				m.pasteBuf = map[string]string{}
			}
			// Rolling cap: keep at most 20 pastes per session so a
			// chatty user doesn't accumulate unbounded memory. When
			// we hit the cap, drop the oldest numbered token.
			const maxPastes = 20
			if len(m.pasteBuf) >= maxPastes {
				oldest := m.pasteCounter - maxPastes + 1
				if oldest > 0 {
					for token := range m.pasteBuf {
						if strings.Contains(token, fmt.Sprintf("#%d:", oldest)) {
							delete(m.pasteBuf, token)
							break
						}
					}
				}
			}
			m.pasteCounter++
			token := fmt.Sprintf("[붙여넣기 #%d: %d줄]", m.pasteCounter, lineCount)
			m.pasteBuf[token] = pasted
			m.textarea.InsertString(token)
		} else {
			m.textarea.InsertString(pasted)
		}
		lines := strings.Count(m.textarea.Value(), "\n") + 1
		if lines > m.textarea.Height() && lines <= 10 {
			m.textarea.SetHeight(lines)
			m.recalcLayout()
		}
		return m, nil

	case tea.KeyPressMsg:
		if m.streaming {
			switch msg.String() {
			case "ctrl+c", "esc":
				m.cancelStream()
				return m, nil
			// Scroll keys must work during streaming too so the user can
			// read back earlier context while tokens are still arriving.
			case "pgup", "pgdown":
				var vpCmd tea.Cmd
				m.viewport, vpCmd = m.viewport.Update(msg)
				return m, vpCmd
			case "alt+up":
				m.viewport.ScrollUp(3)
				return m, nil
			case "alt+down":
				m.viewport.ScrollDown(3)
				return m, nil
			case "home":
				m.viewport.GotoTop()
				return m, nil
			case "end":
				m.viewport.GotoBottom()
				return m, nil
			case "enter":
				// Queue message while streaming
				raw := strings.TrimSpace(m.textarea.Value())
				if raw != "" {
					expanded := m.expandPastes(raw)
					m.pendingQueue = append(m.pendingQueue, expanded)
					m.textarea.Reset()
					m.textarea.SetHeight(1)
					m.recalcLayout()
					// Show queued indicator with the compact (placeholder) form
					// so long pastes don't blow up the chat log.
					m.msgs = append(m.msgs, ui.Message{
						Role: ui.RoleUser, Content: raw + " [대기중]", Timestamp: time.Now(),
					})
					m.updateViewport()
				}
				return m, nil
			case "shift+enter", "ctrl+j", "ctrl+enter":
				m.textarea.InsertString("\n")
				return m, nil
			case "tab":
				return m, nil // ignore tab during streaming
			}
			// Forward other keys to textarea for typing
			var taCmd tea.Cmd
			m.textarea, taCmd = m.textarea.Update(msg)
			lines := strings.Count(m.textarea.Value(), "\n") + 1
			if lines > m.textarea.Height() && lines <= 10 {
				m.textarea.SetHeight(lines)
				m.recalcLayout()
			}
			return m, taCmd
		}

		switch msg.String() {
		case "ctrl+c":
			return m, tea.Quit

		case "esc":
			m.openMenu()
			return m, nil

		case "ctrl+k":
			m.showPalette = !m.showPalette
			m.paletteQuery = ""
			m.paletteSelected = 0
			return m, nil

		case "ctrl+l":
			// Keep system prompt, clear conversation
			m.history = m.history[:1]
			m.msgs = m.msgs[:0]
			m.msgs = append(m.msgs,
				ui.Message{Role: ui.RoleSystem, Content: ui.RenderLogo(), Timestamp: time.Now()},
				ui.Message{Role: ui.RoleSystem, Content: ui.ModeInfoBox(m.activeTab, m.currentModel()), Timestamp: time.Now(), Tag: "modebox"},
			)
			m.streamBuf = ""
			m.tokenCount = 0
			m.lastElapsed = 0
			m.pasteBuf = nil
			m.pasteCounter = 0
			m.recentToolNames = nil
			m.toolCallHistory = nil
			m.updateViewport()
			return m, nil

		case "ctrl+p":
			// Input history: cycle backwards (skip during overlays)
			if m.askQuestion != nil || m.dangerCmd != "" {
				return m, nil
			}
			if len(m.inputHistory) > 0 {
				if m.inputHistoryIdx > 0 {
					m.inputHistoryIdx--
				}
				m.textarea.Reset()
				m.textarea.InsertString(m.inputHistory[m.inputHistoryIdx])
			}
			return m, nil

		case "ctrl+n":
			// Input history: cycle forwards (skip during overlays)
			if m.askQuestion != nil || m.dangerCmd != "" {
				return m, nil
			}
			if len(m.inputHistory) > 0 {
				if m.inputHistoryIdx < len(m.inputHistory)-1 {
					m.inputHistoryIdx++
					m.textarea.Reset()
					m.textarea.InsertString(m.inputHistory[m.inputHistoryIdx])
				} else {
					m.inputHistoryIdx = len(m.inputHistory)
					m.textarea.Reset()
				}
			}
			return m, nil

		case "ctrl+b":
			m.mouseEnabled = !m.mouseEnabled
			label := "ON (scroll)"
			if !m.mouseEnabled {
				label = "OFF (text select enabled)"
			}
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("Mouse: %s", label), Timestamp: time.Now(),
			})
			m.updateViewport()
			return m, nil

		case "tab":
			// If an intent hint is active, accept it by jumping directly
			// to the recommended tab instead of cycling.
			if m.intentHint != "" {
				intent := agents.DetectIntentLocal(strings.TrimSpace(m.textarea.Value()))
				if target := intent.SuggestedTab(); target >= 0 {
					m.activeTab = target
					m.applyModeSwitch()
					m.intentHint = ""
					return m, tea.ClearScreen
				}
			}
			m.activeTab = (m.activeTab + 1) % llm.ModeCount
			m.intentHint = ""
			m.applyModeSwitch()
			return m, tea.ClearScreen

		case "shift+enter", "ctrl+j", "ctrl+enter":
			// Shift+Enter / Ctrl+J / Ctrl+Enter = newline
			m.textarea.InsertString("\n")
			lines := strings.Count(m.textarea.Value(), "\n") + 1
			if lines > m.textarea.Height() && lines <= 10 {
				m.textarea.SetHeight(lines)
				m.recalcLayout()
			}
			return m, nil

		case "enter":
			// Enter = send message
			input := strings.TrimSpace(m.textarea.Value())
			if input != "" {
				// Append to input history
				m.inputHistory = append(m.inputHistory, input)
				if len(m.inputHistory) > 100 {
					m.inputHistory = m.inputHistory[1:]
				}
				m.inputHistoryIdx = len(m.inputHistory)
				m.inputHistoryDraft = ""

				m.textarea.Reset()
				m.textarea.SetHeight(1)
				m.recalcLayout()
				if handled, cmd := m.handleSlashCommand(input); handled {
					return m, cmd
				}
				expanded := m.expandPastes(input)
				return m, m.sendMessage(expanded)
			}
			return m, nil

		case "up":
			// Arrow up: browse input history (only when not in overlays)
			if m.askQuestion == nil && m.dangerCmd == "" && len(m.inputHistory) > 0 {
				if m.inputHistoryIdx == len(m.inputHistory) {
					// Entering history — save draft
					m.inputHistoryDraft = m.textarea.Value()
				}
				if m.inputHistoryIdx > 0 {
					m.inputHistoryIdx--
					m.textarea.Reset()
					m.textarea.InsertString(m.inputHistory[m.inputHistoryIdx])
				}
				return m, nil
			}

		case "down":
			// Arrow down: browse history forward
			if m.askQuestion == nil && m.dangerCmd == "" && m.inputHistoryIdx < len(m.inputHistory) {
				m.inputHistoryIdx++
				m.textarea.Reset()
				if m.inputHistoryIdx == len(m.inputHistory) {
					// Back to draft
					m.textarea.InsertString(m.inputHistoryDraft)
				} else {
					m.textarea.InsertString(m.inputHistory[m.inputHistoryIdx])
				}
				return m, nil
			}

		case "pgup", "pgdown":
			var vpCmd tea.Cmd
			m.viewport, vpCmd = m.viewport.Update(msg)
			return m, vpCmd

		case "alt+up":
			m.viewport.ScrollUp(3)
			return m, nil
		case "alt+down":
			m.viewport.ScrollDown(3)
			return m, nil
		}

		// Default: forward to textarea
		var taCmd tea.Cmd
		m.textarea, taCmd = m.textarea.Update(msg)
		// Auto-grow/shrink textarea after content changes
		lines := strings.Count(m.textarea.Value(), "\n") + 1
		if lines > m.textarea.Height() && lines <= 10 {
			m.textarea.SetHeight(lines)
			m.recalcLayout()
		} else if lines < m.textarea.Height() {
			m.textarea.SetHeight(lines)
			m.recalcLayout()
		}
		return m, taCmd

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.ready = true
		m.recalcLayout()
		m.updateViewport()
		return m, nil

	case streamTickMsg:
		// Refresh spinner / elapsed / tok/s display while waiting for
		// the next chunk. Re-arm only while the stream is still live.
		if m.streaming {
			m.updateViewport()
			return m, streamTickCmd()
		}
		return m, nil

	case streamChunkMsg:
		if msg.err != nil {
			m.streaming = false
			m.streamCh = nil
			m.lastElapsed = time.Since(m.streamStart)
			config.DebugLog("[APP-STREAM] error after %v: %v", m.lastElapsed, msg.err)
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("Error: %v", msg.err), Timestamp: time.Now(),
			})
			m.streamBuf = ""
			m.updateViewport()
			return m, nil
		}
		if msg.done {
			m.streamCh = nil

			// Check if AI wants to call tools
			if len(msg.toolCalls) > 0 {
				config.DebugLog("[APP-STREAM] done reason=tool_call | toolCalls=%d | bufLen=%d", len(msg.toolCalls), len(m.streamBuf))
				if m.streamBuf != "" {
					m.msgs = append(m.msgs, ui.Message{
						Role: ui.RoleAssistant, Content: m.streamBuf, Timestamp: time.Now(),
					})
				}

				assistantMsg := openai.ChatCompletionMessage{
					Role:    openai.ChatMessageRoleAssistant,
					Content: m.streamBuf,
				}
				var oaiToolCalls []openai.ToolCall
				for _, tc := range msg.toolCalls {
					oaiToolCalls = append(oaiToolCalls, openai.ToolCall{
						ID:   tc.ID,
						Type: openai.ToolTypeFunction,
						Function: openai.FunctionCall{
							Name:      tc.Name,
							Arguments: tc.Arguments,
						},
					})
				}
				assistantMsg.ToolCalls = oaiToolCalls
				m.history = append(m.history, assistantMsg)

				for _, tc := range msg.toolCalls {
					status := fmt.Sprintf(">> %s(%s)", tc.Name, truncateArgs(tc.Arguments, 60))
					m.msgs = append(m.msgs, ui.Message{
						Role: ui.RoleTool, Content: status, Timestamp: time.Now(),
					})
				}
				m.streamBuf = ""
				m.updateViewport()

				// Dangerous-op detection: scan shell_exec calls for soft-dangerous
				// patterns and raise a confirmation overlay before executing.
				for _, tc := range msg.toolCalls {
					if tc.Name != "shell_exec" {
						continue
					}
					var parsed map[string]interface{}
					if err := json.Unmarshal([]byte(tc.Arguments), &parsed); err != nil {
						continue
					}
					cmdStr, _ := parsed["command"].(string)
					if cmdStr == "" {
						continue
					}
					if ok, reason := tools.IsDangerous(cmdStr); ok {
						m.dangerCmd = cmdStr
						m.dangerReason = reason
						m.dangerSelected = 1 // default to Deny for safety
						// Append a tool-result stub for each pending call so
						// history stays well-formed; execution is deferred
						// pending the user's decision. For simplicity we just
						// record the pending command and let the LLM resume
						// after resolveDanger sends the status message.
						for _, tc2 := range msg.toolCalls {
							m.history = append(m.history, openai.ChatCompletionMessage{
								Role:       openai.ChatMessageRoleTool,
								Content:    "[DEFERRED — awaiting user confirmation for dangerous operation]",
								ToolCallID: tc2.ID,
							})
						}
						m.updateViewport()
						return m, nil
					}
				}

				calls := msg.toolCalls
				// Tool-loop detection: stamp the per-turn history before
				// dispatching so repeated identical calls can be short-
				// circuited with a corrective system message instead of
				// actually executing the tool again.
				if m.toolCallHistory == nil {
					m.toolCallHistory = map[string]int{}
				}
				type loopDecision struct {
					blocked bool
					key     string
				}
				// Read-only tools are exempt from the consecutive-name
				// (args-drift) detector because "read 5 files in a row" is
				// a perfectly normal exploration pattern. The exact-match
				// axis still applies — five file_read calls with IDENTICAL
				// arguments is still a loop.
				readOnlyExempt := map[string]bool{
					"file_read":   true,
					"list_files":  true,
					"list_tree":   true,
					"grep_search": true,
					"glob_search": true,
				}
				decisions := make([]loopDecision, len(calls))
				for i, tc := range calls {
					key := tc.Name + ":" + tc.Arguments
					m.toolCallHistory[key]++
					// Exact-match axis: same name+args seen 3 times in a turn.
					if m.toolCallHistory[key] >= 3 {
						decisions[i] = loopDecision{blocked: true, key: key}
						config.DebugLog("[TOOL-LOOP] blocked repeat call name=%s count=%d", tc.Name, m.toolCallHistory[key])
						continue
					}
					// Args-drift axis: same tool name called 5+ times in a
					// row (args may differ slightly each time). Skipped for
					// read-only exploration tools.
					if readOnlyExempt[tc.Name] {
						continue
					}
					m.recentToolNames = append(m.recentToolNames, tc.Name)
					if len(m.recentToolNames) > 8 {
						m.recentToolNames = m.recentToolNames[len(m.recentToolNames)-8:]
					}
					if len(m.recentToolNames) >= 5 {
						run := 1
						for j := len(m.recentToolNames) - 2; j >= 0 && m.recentToolNames[j] == tc.Name; j-- {
							run++
						}
						if run >= 5 {
							decisions[i] = loopDecision{blocked: true, key: key}
							config.DebugLog("[TOOL-LOOP] blocked consecutive name=%s run=%d", tc.Name, run)
						}
					}
				}
				return m, func() tea.Msg {
					var results []toolResult
					for i, tc := range calls {
						var output string
						if decisions[i].blocked {
							output = "STOP: 같은 도구를 같은(또는 비슷한) 인자로 연속 호출했습니다. 지금 접근 방식이 동작하지 않습니다. 완전히 다른 접근을 시도하거나 ASK_USER로 사용자에게 방향을 물어보세요."
						} else {
							output = tools.Execute(tc.Name, tc.Arguments)
						}
						results = append(results, toolResult{
							callID: tc.ID,
							name:   tc.Name,
							args:   tc.Arguments,
							output: output,
						})
					}
					return toolResultMsg{results: results}
				}
			}

			// Check for ASK_USER interactive prompt before normal completion
			if q := agents.ParseAskUser(m.streamBuf); q != nil {
				m.streaming = false
				m.lastElapsed = time.Since(m.streamStart)
				// Persist the stripped narrative (if any) as assistant msg
				narrative := agents.StripAskUser(m.streamBuf)
				if narrative != "" {
					m.msgs = append(m.msgs, ui.Message{
						Role: ui.RoleAssistant, Content: narrative, Timestamp: time.Now(),
					})
					m.history = append(m.history, openai.ChatCompletionMessage{
						Role: openai.ChatMessageRoleAssistant, Content: m.streamBuf,
					})
				} else {
					m.history = append(m.history, openai.ChatCompletionMessage{
						Role: openai.ChatMessageRoleAssistant, Content: m.streamBuf,
					})
				}
				m.askQuestion = q
				m.askSelected = 0
				m.askInput = ""
				m.streamBuf = ""
				m.updateViewport()
				return m, nil
			}

			// Normal completion (no tool calls)
			m.streaming = false
			m.lastElapsed = time.Since(m.streamStart)
			config.DebugLog("[APP-STREAM] done reason=normal | elapsed=%v | tokens=%d | bufLen=%d", m.lastElapsed, m.tokenCount, len(m.streamBuf))
			if m.streamBuf != "" {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleAssistant, Content: m.streamBuf, Timestamp: time.Now(),
				})
				m.history = append(m.history, openai.ChatCompletionMessage{
					Role: openai.ChatMessageRoleAssistant, Content: m.streamBuf,
				})
			}

			// Plan mode: awaiting draft approval
			if m.planAwaitingApproval {
				m.planAwaitingApproval = false
				plan, err := agents.ParsePlan(m.streamBuf)
				if err != nil {
					m.msgs = append(m.msgs, ui.Message{
						Role: ui.RoleSystem, Content: fmt.Sprintf("  [PLAN] 계획 파싱 실패: %v", err), Timestamp: time.Now(),
					})
				} else {
					m.activePlan = plan
					m.msgs = append(m.msgs, ui.Message{
						Role: ui.RoleSystem, Content: plan.Render(), Timestamp: time.Now(),
					})
					m.msgs = append(m.msgs, ui.Message{
						Role: ui.RoleSystem, Content: "  /approve 로 승인  ·  /reject 로 거부", Timestamp: time.Now(),
					})
				}
				m.streamBuf = ""
				m.updateViewport()
				return m, nil
			}

			// Plan mode: step execution response
			if m.planExecuting && m.activePlan != nil && m.activePlan.Status == "executing" {
				stepDone, stepFailed, revise := agents.CheckPlanMarkers(m.streamBuf)
				if revise {
					// Attempt to re-parse the plan from the response; keep executing state.
					if newPlan, err := agents.ParsePlan(m.streamBuf); err == nil {
						newPlan.Status = "executing"
						newPlan.Current = 0
						m.activePlan = newPlan
						m.msgs = append(m.msgs, ui.Message{
							Role: ui.RoleSystem, Content: "  [PLAN] 계획 재구성됨", Timestamp: time.Now(),
						})
						m.msgs = append(m.msgs, ui.Message{
							Role: ui.RoleSystem, Content: newPlan.Render(), Timestamp: time.Now(),
						})
						m.streamBuf = ""
						m.updateViewport()
						return m, m.executeNextPlanStep()
					}
				}
				if stepFailed {
					if m.activePlan.Current < len(m.activePlan.Steps) {
						m.activePlan.Steps[m.activePlan.Current].Status = "failed"
					}
					m.activePlan.Status = "failed"
					m.planExecuting = false
					m.msgs = append(m.msgs, ui.Message{
						Role: ui.RoleSystem, Content: "  [PLAN] 단계 실패 — 실행 중단", Timestamp: time.Now(),
					})
					m.streamBuf = ""
					m.updateViewport()
					return m, nil
				}
				if stepDone {
					if m.activePlan.Current < len(m.activePlan.Steps) {
						m.activePlan.Steps[m.activePlan.Current].Status = "completed"
					}
					m.activePlan.Current++
					m.streamBuf = ""
					m.updateViewport()
					return m, m.executeNextPlanStep()
				}
			}

			// Deep Agent completion marker (TASK_COMPLETE alias)
			if strings.Contains(m.streamBuf, "[TASK_COMPLETE]") {
				m.autoMode = false
				m.autoTask = ""
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: "  [DEEP AGENT] 작업 완료", Timestamp: time.Now(),
				})
			}

			// Check auto mode markers
			if m.autoMode {
				complete, pause := agents.CheckAutoMarkers(m.streamBuf)
				if complete {
					m.autoMode = false
					m.autoTask = ""
					// Restore system prompt without auto suffix
					mode := llm.Mode(m.activeTab)
					m.history[0] = openai.ChatCompletionMessage{
						Role: openai.ChatMessageRoleSystem, Content: llm.SystemPrompt(mode) + m.projectCtx,
					}
					m.msgs = append(m.msgs, ui.Message{
						Role: ui.RoleSystem, Content: "  [AUTO MODE] 작업 완료", Timestamp: time.Now(),
					})
				} else if pause {
					m.autoMode = false
					m.autoTask = ""
					mode := llm.Mode(m.activeTab)
					m.history[0] = openai.ChatCompletionMessage{
						Role: openai.ChatMessageRoleSystem, Content: llm.SystemPrompt(mode) + m.projectCtx,
					}
					m.msgs = append(m.msgs, ui.Message{
						Role: ui.RoleSystem, Content: "  [AUTO MODE] 일시정지 — 사용자 입력 필요", Timestamp: time.Now(),
					})
				}
			}

			m.streamBuf = ""
			m.updateViewport()

			// Auto-send next queued message
			if len(m.pendingQueue) > 0 {
				next := m.pendingQueue[0]
				m.pendingQueue = m.pendingQueue[1:]
				return m, m.sendMessage(next)
			}
			return m, nil
		}
		m.streamBuf += msg.content
		m.tokenCount++
		m.lastChunkAt = time.Now()
		m.updateViewport()
		return m, m.waitForNextChunk()

	case toolResultMsg:
		config.DebugLog("[APP-TOOL] received %d tool results | toolIter=%d/%d", len(msg.results), m.toolIter+1, agents.MaxAutoIterations)
		for _, r := range msg.results {
			config.DebugLog("[APP-TOOL] %s | resultLen=%d", r.name, len(r.output))
			m.history = append(m.history, openai.ChatCompletionMessage{
				Role:       openai.ChatMessageRoleTool,
				Content:    r.output,
				ToolCallID: r.callID,
			})
			// file_edit / file_write get a diff box rendered from the
			// raw call arguments; everything else uses the generic
			// auto-collapsing preview.
			var preview string
			if diff := ui.FormatToolDiff(r.name, r.args, r.output); diff != "" {
				preview = diff
			} else {
				preview = ui.FormatToolResult(r.name, r.output)
			}
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleTool, Content: preview, Timestamp: time.Now(),
			})
		}
		m.streamBuf = ""
		m.toolIter++
		m.updateViewport()

		if m.toolIter >= agents.MaxAutoIterations {
			config.DebugLog("[APP-TOOL] loop limit reached (%d iterations)", agents.MaxAutoIterations)
			m.streaming = false
			m.lastElapsed = time.Since(m.streamStart)
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("[tool loop limit — %d iterations]", agents.MaxAutoIterations), Timestamp: time.Now(),
			})
			m.updateViewport()
			return m, nil
		}

		return m, m.continueAfterTools()

	// Forward mouse wheel events to viewport for touchpad scroll
	case tea.MouseWheelMsg:
		var vpCmd tea.Cmd
		m.viewport, vpCmd = m.viewport.Update(msg)
		return m, vpCmd
	}

	return m, nil
}

func (m Model) updateSetup(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyPressMsg:
		switch msg.String() {
		case "ctrl+c":
			return m, tea.Quit
		case "enter":
			input := strings.TrimSpace(m.setupInput.Value())
			if input != "" {
				m.setupCfg.API.APIKey = input
			}
			_ = config.Save(m.setupCfg)
			m.cfg = m.setupCfg
			m.client = llm.NewClientWithOptions(m.cfg.API.BaseURL, m.cfg.API.APIKey, m.cfg.NoStream)
			m.inSetup = false
			m.ready = true
			m.recalcLayout()
			m.textarea.Focus()
			m.updateViewport()
			return m, nil
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.ready = true
		m.setupInput.SetWidth(m.width - 10)
		m.recalcLayout()
		return m, nil
	}

	var cmd tea.Cmd
	m.setupInput, cmd = m.setupInput.Update(msg)
	return m, cmd
}

func (m *Model) handleSlashCommand(input string) (bool, tea.Cmd) {
	switch input {
	case "/setup":
		m.inSetup = true
		m.setupCfg = m.cfg
		m.setupInput.Reset()
		m.setupInput.Placeholder = "sk_... or nvt_..."
		m.setupInput.Focus()
		return true, nil

	case "/clear":
		m.history = m.history[:1]
		m.msgs = m.msgs[:0]
		m.msgs = append(m.msgs,
			ui.Message{Role: ui.RoleSystem, Content: ui.RenderLogo(), Timestamp: time.Now()},
			ui.Message{Role: ui.RoleSystem, Content: ui.ModeInfoBox(m.activeTab, m.currentModel()), Timestamp: time.Now(), Tag: "modebox"},
		)
		m.streamBuf = ""
		m.tokenCount = 0
		m.lastElapsed = 0
		m.pasteBuf = nil
		m.pasteCounter = 0
		m.recentToolNames = nil
		m.toolCallHistory = nil
		m.updateViewport()
		return true, nil

	case "/help":
		help := "  Enter — 전송    Shift+Enter — 줄바꿈    /clear — 대화삭제    Ctrl+C — 종료\n" +
			"  /model [name] — 모델 확인/변경    /provider [name] — 프로바이더 확인/변경\n" +
			"  /config — 현재 설정 표시    /usage — 토큰 사용량\n" +
			fmt.Sprintf("  /auto <task> — 자율 모드 (최대 %d회 반복, --max-iter 로 조정)\n", agents.MaxAutoIterations) +
			"  /plan <task> — 단계별 실행 계획 생성    /approve — 계획 승인/실행    /reject — 계획 거부\n" +
			"  /save [name] — 세션 저장    /load — 세션 목록    /search [keyword] — 세션 검색\n" +
			"  /remember key=value — 메모리 저장    /memories — 프로젝트 메모리 목록\n" +
			"  /checkpoint — 체크포인트 생성(git stash)    /rollback — 최근 체크포인트 복원    /checkpoints — 체크포인트 목록\n" +
			"  /lang — 언어 전환 (한국어/English)    Esc — 메뉴"
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: help, Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/lang", "/language":
		ui.ToggleLang()
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: fmt.Sprintf("  Language switched to %s", ui.LangLabel()), Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/checkpoint":
		// Stash current working tree + untracked files under a hanimo-
		// prefixed label so the user can roll back a risky auto/deep run.
		out, err := runCheckpoint("")
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: "  " + out, Timestamp: time.Now(),
		})
		if err != nil {
			config.DebugLog("[CHECKPOINT] %v", err)
		}
		m.updateViewport()
		return true, nil

	case "/rollback":
		out, err := runRollback()
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: "  " + out, Timestamp: time.Now(),
		})
		if err != nil {
			config.DebugLog("[ROLLBACK] %v", err)
		}
		m.updateViewport()
		return true, nil

	case "/checkpoints":
		out := listCheckpoints()
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: out, Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/pastes":
		// Preview the current multi-line paste buffer(s). Each token
		// shows its first ~3 lines so the user can sanity-check what
		// will actually be sent before hitting Enter.
		if len(m.pasteBuf) == 0 {
			m.msgs = append(m.msgs, ui.Message{
				Role:      ui.RoleSystem,
				Content:   "  저장된 붙여넣기 버퍼가 없습니다.",
				Timestamp: time.Now(),
			})
			m.updateViewport()
			return true, nil
		}
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("  📋 붙여넣기 버퍼 %d개 — 전송 시 실제 내용으로 교체됩니다.\n", len(m.pasteBuf)))
		for token, content := range m.pasteBuf {
			lines := strings.Split(content, "\n")
			sb.WriteString(fmt.Sprintf("\n  %s\n", token))
			preview := lines
			if len(preview) > 3 {
				preview = preview[:3]
			}
			for _, l := range preview {
				// Rune-based truncation so Korean/CJK characters
				// don't get cut mid-codepoint.
				if lr := []rune(l); len(lr) > 100 {
					l = string(lr[:100]) + "…"
				}
				sb.WriteString("    │ " + l + "\n")
			}
			if len(lines) > 3 {
				sb.WriteString(fmt.Sprintf("    │ ⋯ (%d줄 더)\n", len(lines)-3))
			}
		}
		m.msgs = append(m.msgs, ui.Message{
			Role:      ui.RoleSystem,
			Content:   sb.String(),
			Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil
	}

	// Commands with optional arguments (prefix match)
	parts := strings.SplitN(input, " ", 2)
	cmd := parts[0]
	arg := ""
	if len(parts) > 1 {
		arg = strings.TrimSpace(parts[1])
	}

	switch cmd {
	case "/model":
		if arg == "" {
			modelID := m.currentModel()
			displayName := modelID
			if info, ok := llm.Models[modelID]; ok {
				displayName = info.DisplayName
			}
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  현재 모델: %s (%s)", displayName, modelID), Timestamp: time.Now(),
			})
		} else {
			switch m.activeTab {
			case 1:
				m.cfg.Models.Dev = arg
			default:
				m.cfg.Models.Super = arg
			}
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  모델 변경: %s", arg), Timestamp: time.Now(),
			})
		}
		m.updateViewport()
		return true, nil

	case "/provider":
		if arg == "" {
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  현재 프로바이더: %s", m.cfg.API.BaseURL), Timestamp: time.Now(),
			})
		} else if strings.Contains(arg, "://") {
			// Raw URL passed directly — skip the named lookup and
			// point the client at it. API key is unchanged so the
			// user can prime their HANIMO_API_KEY before switching.
			m.cfg.API.BaseURL = arg
			m.client = llm.NewClientWithOptions(m.cfg.API.BaseURL, m.cfg.API.APIKey, m.cfg.NoStream)
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  프로바이더 변경: 커스텀 URL (%s)", arg), Timestamp: time.Now(),
			})
		} else if p, ok := m.cfg.Providers[arg]; ok {
			m.cfg.API.BaseURL = p.BaseURL
			if p.APIKey != "" {
				m.cfg.API.APIKey = p.APIKey
			}
			m.client = llm.NewClientWithOptions(m.cfg.API.BaseURL, m.cfg.API.APIKey, m.cfg.NoStream)
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  프로바이더 변경: %s (%s)", arg, p.BaseURL), Timestamp: time.Now(),
			})
		} else if url, ok := providers.DefaultBaseURLs[arg]; ok {
			m.cfg.API.BaseURL = url
			m.client = llm.NewClientWithOptions(m.cfg.API.BaseURL, m.cfg.API.APIKey, m.cfg.NoStream)
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  프로바이더 변경: %s (%s)", arg, url), Timestamp: time.Now(),
			})
		} else {
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  알 수 없는 프로바이더: %s — 이름 대신 전체 URL(https://...) 을 넣어도 됩니다", arg), Timestamp: time.Now(),
			})
		}
		m.updateViewport()
		return true, nil

	case "/config":
		modeNames := []string{"super", "dev", "plan"}
		modeName := modeNames[m.activeTab]
		cwd, _ := os.Getwd()
		info := fmt.Sprintf("  Provider: %s\n  Model (super): %s\n  Model (dev): %s\n  Mode: %s\n  Project: %s",
			m.cfg.API.BaseURL, m.cfg.Models.Super, m.cfg.Models.Dev, modeName, cwd)
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: info, Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/usage":
		elapsed := m.lastElapsed
		info := fmt.Sprintf("  토큰 수신: %d tokens\n  마지막 응답 시간: %v\n  %s", m.tokenCount, elapsed, config.CacheSummary())
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: info, Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/save":
		// Ensure a session exists, then bulk-save current history.
		if err := m.ensureSession(); err != nil {
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  세션 저장 실패: %v", err), Timestamp: time.Now(),
			})
			m.updateViewport()
			return true, nil
		}
		// Save every message in history to SQLite.
		for _, h := range m.history[1:] { // skip system prompt at [0]
			_ = session.SaveMessage(m.sessionID, h.Role, h.Content, "", "", 0, 0)
		}
		// Optionally name the session.
		if arg != "" {
			_ = session.NameSession(m.sessionID, arg)
		}
		label := m.sessionID[:8]
		if arg != "" {
			label = arg
		}
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: fmt.Sprintf("  세션 저장됨: %s", label), Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/load":
		sessions, err := session.ListSessions(20)
		if err != nil || len(sessions) == 0 {
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: "  저장된 세션이 없습니다.", Timestamp: time.Now(),
			})
			m.updateViewport()
			return true, nil
		}
		var sb strings.Builder
		sb.WriteString("  📋 최근 세션 목록\n\n")
		for i, s := range sessions {
			name := s.Name
			if name == "" {
				name = "(이름 없음)"
			}
			sb.WriteString(fmt.Sprintf("  %2d. %s — %s  [%s] %s\n",
				i+1, s.ID[:8], name, s.Mode, s.UpdatedAt.Format("01-02 15:04")))
		}
		sb.WriteString("\n  복원: /load <세션 ID 앞 8자리>")
		if arg != "" {
			// User passed an ID prefix — try to load it.
			for _, s := range sessions {
				if strings.HasPrefix(s.ID, arg) {
					_, savedMsgs, loadErr := session.LoadSession(s.ID)
					if loadErr != nil {
						m.msgs = append(m.msgs, ui.Message{
							Role: ui.RoleSystem, Content: fmt.Sprintf("  로드 실패: %v", loadErr), Timestamp: time.Now(),
						})
						break
					}
					m.sessionID = s.ID
					m.history = m.history[:1] // keep system prompt
					for _, sm := range savedMsgs {
						m.history = append(m.history, openai.ChatCompletionMessage{
							Role: sm.Role, Content: sm.Content,
						})
					}
					m.msgs = append(m.msgs, ui.Message{
						Role: ui.RoleSystem, Content: fmt.Sprintf("  세션 복원됨: %s (%d 메시지)", s.ID[:8], len(savedMsgs)), Timestamp: time.Now(),
					})
					m.updateViewport()
					return true, nil
				}
			}
		}
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: sb.String(), Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/search":
		if arg == "" {
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: "  사용법: /search <키워드>", Timestamp: time.Now(),
			})
			m.updateViewport()
			return true, nil
		}
		sessions, err := session.SearchSessions(arg)
		if err != nil || len(sessions) == 0 {
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  '%s' 관련 세션을 찾을 수 없습니다.", arg), Timestamp: time.Now(),
			})
			m.updateViewport()
			return true, nil
		}
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("  🔍 '%s' 검색 결과 (%d건)\n\n", arg, len(sessions)))
		for i, s := range sessions {
			name := s.Name
			if name == "" {
				name = "(이름 없음)"
			}
			sb.WriteString(fmt.Sprintf("  %2d. %s — %s  [%s] %s\n",
				i+1, s.ID[:8], name, s.Mode, s.UpdatedAt.Format("01-02 15:04")))
		}
		sb.WriteString("\n  복원: /load <세션 ID 앞 8자리>")
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: sb.String(), Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/remember":
		if arg == "" {
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: "  사용법: /remember key=value", Timestamp: time.Now(),
			})
		} else {
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  [메모리 저장 기능은 아직 구현 중입니다: %s]", arg), Timestamp: time.Now(),
			})
		}
		m.updateViewport()
		return true, nil

	case "/memories":
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: "  [메모리 목록 기능은 아직 구현 중입니다]", Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/theme":
		if arg == "" {
			var names []string
			for k, t := range ui.Themes {
				marker := "  "
				if k == ui.CurrentTheme {
					marker = "* "
				}
				names = append(names, fmt.Sprintf("  %s%s (%s)", marker, k, t.Name))
			}
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: "  테마 목록:\n" + strings.Join(names, "\n"), Timestamp: time.Now(),
			})
		} else {
			if ui.ApplyTheme(arg) {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: fmt.Sprintf("  테마 변경: %s", arg), Timestamp: time.Now(),
				})
			} else {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: fmt.Sprintf("  알 수 없는 테마: %s", arg), Timestamp: time.Now(),
				})
			}
		}
		m.updateViewport()
		return true, nil

	case "/diagnostics":
		cwd, _ := os.Getwd()
		target := arg
		result, _ := tools.RunDiagnostics(cwd, target)
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: result, Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/skill":
		if arg == "" || arg == "list" {
			reg := skills.GlobalRegistry
			if reg.Count() == 0 {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: "  등록된 스킬이 없습니다. .hanimo/skills/<name>/SKILL.md 를 만들어 주세요.", Timestamp: time.Now(),
				})
			} else {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: reg.TableOfContents(), Timestamp: time.Now(),
				})
			}
			m.updateViewport()
			return true, nil
		}
		if arg == "reload" {
			skills.GlobalRegistry = skills.ScanSkills()
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  스킬 재로드: %d개", skills.GlobalRegistry.Count()), Timestamp: time.Now(),
			})
			m.updateViewport()
			return true, nil
		}
		// /skill <name> [args...] — invoke a skill by injecting its
		// body into the conversation as a user message so the LLM
		// executes the skill workflow.
		parts := strings.SplitN(arg, " ", 2)
		skillName := parts[0]
		skillArgs := ""
		if len(parts) > 1 {
			skillArgs = parts[1]
		}
		s := skills.GlobalRegistry.Get(skillName)
		if s == nil {
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  스킬 '%s' 을 찾을 수 없습니다. /skill list 로 확인하세요.", skillName), Timestamp: time.Now(),
			})
			m.updateViewport()
			return true, nil
		}
		// Inject the skill body as a user message and send.
		prompt := skills.FormatSkillBody(s, skillArgs)
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: fmt.Sprintf("  ▶ 스킬 실행: %s", s.Name), Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, m.sendMessage(prompt)

	case "/knowledge":
		switch arg {
		case "reload":
			knowledge.GlobalIndex = knowledge.ScanUserDocs()
			cnt := knowledge.GlobalIndex.Count()
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  Knowledge 재색인 완료: %d 문서", cnt), Timestamp: time.Now(),
			})
		case "list", "":
			idx := knowledge.GlobalIndex
			if idx == nil || idx.Count() == 0 {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: "  .hanimo/knowledge/ 에 md/txt 파일이 없습니다.", Timestamp: time.Now(),
				})
			} else {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: idx.TableOfContents(), Timestamp: time.Now(),
				})
			}
		default:
			query := strings.TrimPrefix(arg, "search ")
			idx := knowledge.GlobalIndex
			if idx == nil || idx.Count() == 0 {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: "  .hanimo/knowledge/ 에 md/txt 파일이 없습니다.", Timestamp: time.Now(),
				})
			} else {
				results := idx.Search(query, 3)
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: knowledge.FormatSearchResults(results, query), Timestamp: time.Now(),
				})
			}
		}
		m.updateViewport()
		return true, nil

	case "/auto":
		if arg == "" {
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: "  사용법: /auto <task description>", Timestamp: time.Now(),
			})
			m.updateViewport()
			return true, nil
		}
		m.autoMode = true
		m.autoTask = arg
		// Inject auto prompt suffix into system message
		mode := llm.Mode(m.activeTab)
		sysPrompt := llm.SystemPrompt(mode) + m.projectCtx + agents.AutoPromptSuffix
		m.history[0] = openai.ChatCompletionMessage{
			Role: openai.ChatMessageRoleSystem, Content: sysPrompt,
		}
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: fmt.Sprintf("  [AUTO MODE] 자율 모드 시작: %s (최대 %d 회 반복)", arg, agents.MaxAutoIterations), Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, m.sendMessage(arg)

	case "/plan":
		if arg == "" {
			if m.activePlan != nil {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: m.activePlan.Render(), Timestamp: time.Now(),
				})
			} else {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: "  활성 계획 없음. /plan <task> 로 새 계획을 만드세요.", Timestamp: time.Now(),
				})
			}
			m.updateViewport()
			return true, nil
		}
		// Kick off plan creation: one-shot user message that asks the LLM to
		// reply with JSON. Do not append a new system message (history[0] already
		// contains the active system prompt); instead, prepend the planning
		// instructions to the user message so the LLM produces JSON only.
		m.activePlan = nil
		m.planAwaitingApproval = true
		m.planExecuting = false
		prompt := agents.PlanPromptPrefix + arg
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: fmt.Sprintf("  [PLAN] 계획 생성 중: %s", arg), Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, m.sendMessage(prompt)

	case "/approve":
		if m.activePlan != nil && m.activePlan.Status == "draft" {
			m.activePlan.Status = "executing"
			m.activePlan.Current = 0
			m.planExecuting = true
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: "  [PLAN] 승인됨 — 실행 시작", Timestamp: time.Now(),
			})
			m.updateViewport()
			return true, m.executeNextPlanStep()
		}
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: "  승인할 초안 계획이 없습니다.", Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/reject":
		if m.activePlan != nil && m.activePlan.Status == "draft" {
			m.activePlan = nil
			m.planAwaitingApproval = false
			m.planExecuting = false
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: "  [PLAN] 계획 거부됨", Timestamp: time.Now(),
			})
		} else {
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: "  거부할 초안 계획이 없습니다.", Timestamp: time.Now(),
			})
		}
		m.updateViewport()
		return true, nil

	case "/companion":
		if m.companionHub == nil {
			m.companionHub = companion.NewHub()
		}
		if m.companionServer == nil {
			port := 8420
			m.companionServer = companion.NewServer(m.companionHub, nil, port)
			m.companionServer.Start()
			_ = companion.OpenBrowser(fmt.Sprintf("http://localhost:%d", port))
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  Companion dashboard started at http://localhost:%d", port), Timestamp: time.Now(),
			})
		} else {
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: "  Companion dashboard already running", Timestamp: time.Now(),
			})
		}
		m.updateViewport()
		return true, nil

	case "/new":
		m.history = m.history[:1]
		m.msgs = m.msgs[:0]
		m.msgs = append(m.msgs,
			ui.Message{Role: ui.RoleSystem, Content: ui.RenderLogo(), Timestamp: time.Now()},
			ui.Message{Role: ui.RoleSystem, Content: ui.ModeInfoBox(m.activeTab, m.currentModel()), Timestamp: time.Now(), Tag: "modebox"},
		)
		m.tokenCount = 0
		m.lastElapsed = 0
		m.updateViewport()
		return true, nil

	case "/git":
		m.gitInfo = gitinfo.Fetch(".")
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: m.gitInfo.Summary(), Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/version":
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: fmt.Sprintf("hanimo %s", "v0.1.0"), Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/copy":
		target := ""
		for i := len(m.msgs) - 1; i >= 0; i-- {
			if m.msgs[i].Role == ui.RoleAssistant {
				target = m.msgs[i].Content
				break
			}
		}
		if target == "" {
			m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: "No AI response to copy.", Timestamp: time.Now()})
		} else {
			var cpCmd *exec.Cmd
			switch runtime.GOOS {
			case "darwin":
				cpCmd = exec.Command("pbcopy")
			case "linux":
				if _, err := exec.LookPath("xclip"); err == nil {
					cpCmd = exec.Command("xclip", "-selection", "clipboard")
				} else {
					cpCmd = exec.Command("xsel", "--clipboard", "--input")
				}
			default:
				cpCmd = exec.Command("pbcopy")
			}
			cpCmd.Stdin = strings.NewReader(target)
			if err := cpCmd.Run(); err != nil {
				m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: fmt.Sprintf("Copy failed: %v", err), Timestamp: time.Now()})
			} else {
				runes := []rune(target)
				preview := string(runes)
				if len(runes) > 60 {
					preview = string(runes[:60]) + "..."
				}
				m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: fmt.Sprintf("Copied to clipboard (%d chars): %s", len(runes), preview), Timestamp: time.Now()})
			}
		}
		m.updateViewport()
		return true, nil

	case "/export":
		filename := fmt.Sprintf("hanimo-session-%s.md", time.Now().Format("20060102-150405"))
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("# hanimo session (%s)\n\n", time.Now().Format("2006-01-02 15:04")))
		for _, msg := range m.msgs {
			switch msg.Role {
			case ui.RoleUser:
				sb.WriteString(fmt.Sprintf("## User\n\n%s\n\n", msg.Content))
			case ui.RoleAssistant:
				sb.WriteString(fmt.Sprintf("## AI\n\n%s\n\n", msg.Content))
			}
		}
		if err := os.WriteFile(filename, []byte(sb.String()), 0644); err != nil {
			m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: fmt.Sprintf("Export failed: %v", err), Timestamp: time.Now()})
		} else {
			m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: fmt.Sprintf("Session exported: %s", filename), Timestamp: time.Now()})
		}
		m.updateViewport()
		return true, nil

	case "/diff":
		result := tools.Execute("git_diff", `{"path":"."}`)
		m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: result, Timestamp: time.Now()})
		m.updateViewport()
		return true, nil

	case "/compact":
		beforeLen := len(m.history)
		m.history = llm.Compact(m.history)
		afterLen := len(m.history)
		m.msgs = append(m.msgs, ui.Message{
			Role:    ui.RoleSystem,
			Content: fmt.Sprintf("Compacted: %d → %d messages", beforeLen, afterLen),
			Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/init":
		profile := tools.GenerateProjectProfile(".")
		if err := os.WriteFile(".hanimo.md", []byte(profile), 0644); err != nil {
			m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: fmt.Sprintf("Failed to write .hanimo.md: %v", err), Timestamp: time.Now()})
		} else {
			m.projectCtx = "\n\n## Project Context (.hanimo.md)\n" + profile
			if len(m.history) > 0 {
				m.history[0].Content = llm.SystemPrompt(llm.Mode(m.activeTab)) + m.projectCtx
			}
			lines := strings.Count(profile, "\n")
			m.msgs = append(m.msgs, ui.Message{
				Role:    ui.RoleSystem,
				Content: fmt.Sprintf(".hanimo.md generated (%d lines). Project context loaded.", lines),
				Timestamp: time.Now(),
			})
		}
		m.updateViewport()
		return true, nil

	case "/forget":
		if arg == "" {
			m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: "Usage: /forget <key> — remove a memory entry by key", Timestamp: time.Now()})
		} else {
			m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: fmt.Sprintf("Memory key '%s' forgotten.", arg), Timestamp: time.Now()})
		}
		m.updateViewport()
		return true, nil

	case "/commands":
		cmds := tools.LoadCustomCommands()
		if len(cmds) == 0 {
			m.msgs = append(m.msgs, ui.Message{
				Role:    ui.RoleSystem,
				Content: "No custom commands. Add .md files to .hanimo/commands/ or ~/.hanimo/commands/",
				Timestamp: time.Now(),
			})
		} else {
			var lines []string
			lines = append(lines, "Custom commands:")
			for name := range cmds {
				lines = append(lines, fmt.Sprintf("  /%s", name))
			}
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: strings.Join(lines, "\n"), Timestamp: time.Now(),
			})
		}
		m.updateViewport()
		return true, nil

	case "/exit", "/quit":
		return true, tea.Quit

	case "/undo":
		count := 1
		if arg != "" {
			if arg == "list" {
				list := tools.FormatSnapshotList(20)
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: "Snapshots:\n" + list, Timestamp: time.Now(),
				})
				m.updateViewport()
				return true, nil
			}
			fmt.Sscanf(arg, "%d", &count)
		}
		result := tools.UndoLast(count)
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: result, Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/mcp":
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: "[MCP] No MCP servers configured. Check config.yaml mcp.servers section.", Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/multi":
		if arg == "" {
			m.multiEnabled = !m.multiEnabled
			label := "OFF"
			if m.multiEnabled {
				label = "ON"
			}
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("[MULTI] Multi-agent %s", label), Timestamp: time.Now(),
			})
			m.updateViewport()
			return true, nil
		}
		switch strings.ToLower(arg) {
		case "on":
			m.multiEnabled = true
			m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: "[MULTI] Multi-agent ON", Timestamp: time.Now()})
		case "off":
			m.multiEnabled = false
			m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: "[MULTI] Multi-agent OFF", Timestamp: time.Now()})
		case "review":
			m.multiEnabled = true
			m.multiAuto = false
			m.multiStrategy = multi.StrategyReview
			m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: "[MULTI] Strategy: Review (Agent1 generates -> Agent2 reviews)", Timestamp: time.Now()})
		case "consensus":
			m.multiEnabled = true
			m.multiAuto = false
			m.multiStrategy = multi.StrategyConsensus
			m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: "[MULTI] Strategy: Consensus (both models compare)", Timestamp: time.Now()})
		case "scan":
			m.multiEnabled = true
			m.multiAuto = false
			m.multiStrategy = multi.StrategyScan
			m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: "[MULTI] Strategy: Scan (parallel file exploration)", Timestamp: time.Now()})
		case "auto":
			m.multiEnabled = true
			m.multiAuto = true
			m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: "[MULTI] Strategy: Auto (auto-detect)", Timestamp: time.Now()})
		default:
			m.msgs = append(m.msgs, ui.Message{Role: ui.RoleSystem, Content: "[MULTI] Usage: /multi [on|off|review|consensus|scan|auto]", Timestamp: time.Now()})
		}
		m.updateViewport()
		return true, nil
	}

	return false, nil
}

// executeNextPlanStep advances the active plan by one step. If all steps are
// done, it marks the plan complete. Otherwise it sends a step-execution prompt
// to the LLM via sendMessage, so the existing streaming/tool pipeline handles
// the actual work.
func (m *Model) executeNextPlanStep() tea.Cmd {
	if m.activePlan == nil {
		return nil
	}
	if m.activePlan.Current >= len(m.activePlan.Steps) {
		m.activePlan.Status = "completed"
		m.planExecuting = false
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: "  [PLAN] 모든 단계 완료", Timestamp: time.Now(),
		})
		m.updateViewport()
		return nil
	}

	step := m.activePlan.Steps[m.activePlan.Current]
	m.activePlan.Steps[m.activePlan.Current].Status = "in_progress"

	prompt := fmt.Sprintf(agents.ExecutePromptPrefix,
		m.activePlan.Render(),
		m.activePlan.Current+1,
		len(m.activePlan.Steps),
		step.Title,
		step.Description,
	)

	m.msgs = append(m.msgs, ui.Message{
		Role: ui.RoleSystem,
		Content: fmt.Sprintf("  [PLAN] 단계 %d/%d 실행: %s",
			m.activePlan.Current+1, len(m.activePlan.Steps), step.Title),
		Timestamp: time.Now(),
	})
	m.updateViewport()

	return m.sendMessage(prompt)
}

func (m Model) View() tea.View {
	var content string

	if m.inSetup {
		content = m.viewSetup()
	} else if !m.ready {
		content = "\n  로딩중..."
	} else {
		vpContent := m.viewport.View()
		// Constrain viewport output to allocated height
		contentLines := strings.Split(vpContent, "\n")
		if len(contentLines) > m.viewport.Height() {
			contentLines = contentLines[:m.viewport.Height()]
			vpContent = strings.Join(contentLines, "\n")
		}

		// Input box with gray border
		inputBox := lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#9CA3AF")).
			Width(m.width - 4).
			Render(m.textarea.View())

		// Status bar below input — includes cwd and hints
		modelID := m.currentModel()
		displayModel := modelID
		if info, ok := llm.Models[modelID]; ok {
			displayModel = info.DisplayName
		}
		elapsed := m.lastElapsed
		if m.streaming {
			elapsed = time.Since(m.streamStart)
		}
		planProgress := ""
		if m.activePlan != nil && (m.activePlan.Status == "executing" || m.activePlan.Status == "draft") {
			planProgress = m.activePlan.Progress()
		}
		ctxWindow := 262144 // default fallback
		if cap := llm.GetCapability(displayModel); cap.ContextWindow > 0 {
			ctxWindow = cap.ContextWindow
		}
		statusBar := ui.RenderStatusBar(displayModel, m.tokenCount, elapsed, m.activeTab, m.cwd, m.width, config.IsDebug(), len(tools.ToolsForMode(m.activeTab)), m.autoMode, planProgress, m.gitInfo.Label(), ui.ContextPercent(m.tokenCount, ctxWindow))

		// Build the stack of anchor blocks rendered directly above the input.
		// Order (top → bottom):
		//   1. Intent hint (Super mode)
		//   2. ASK_USER question (if active)
		//   3. inputBox
		// This keeps context-sensitive prompts glued to the input instead of
		// floating in the middle of the screen.
		stack := []string{vpContent}

		if m.activeTab == int(llm.ModeSuper) && m.intentHint != "" {
			hintStyle := lipgloss.NewStyle().
				Foreground(lipgloss.Color("#F9E2AF")).
				Italic(true)
			stack = append(stack, hintStyle.Render("  "+m.intentHint))
		}

		if m.askQuestion != nil {
			var askBlock string
			if m.askQuestion.Type == agents.AskTypeText {
				askBlock = ui.RenderAskText(m.askQuestion.Question, m.askInput, m.width)
			} else {
				askBlock = ui.RenderAskUser(m.askQuestion.Question, m.askQuestion.Options, m.askSelected, m.width)
			}
			stack = append(stack, askBlock)
		}

		stack = append(stack, inputBox, statusBar)
		content = lipgloss.JoinVertical(lipgloss.Left, stack...)

		// Dangerous-op confirmation overlay
		if m.dangerCmd != "" {
			overlay := ui.RenderDangerConfirm(m.dangerCmd, m.dangerReason, m.dangerSelected, m.width)
			content = overlayCenter(content, overlay, m.width)
		}

		// Overlay menu if open
		if m.showMenu {
			menu := ui.RenderMenu(m.menuItems, m.menuSelected, m.menuAction, m.width)
			menuLines := strings.Split(menu, "\n")
			contentLinesList := strings.Split(content, "\n")
			startY := (len(contentLinesList) - len(menuLines)) / 3
			if startY < 1 {
				startY = 1
			}
			for i, mLine := range menuLines {
				row := startY + i
				if row < len(contentLinesList) {
					pad := (m.width - lipgloss.Width(mLine)) / 2
					if pad < 0 {
						pad = 0
					}
					contentLinesList[row] = strings.Repeat(" ", pad) + mLine
				}
			}
			content = strings.Join(contentLinesList, "\n")
		}

		// Overlay command palette if open
		if m.showPalette {
			filtered := ui.FuzzyFilter(m.paletteQuery, ui.PaletteItems)
			palette := ui.RenderPalette(filtered, m.paletteSelected, m.paletteQuery, m.width)
			// Center the palette overlay
			paletteLines := strings.Split(palette, "\n")
			contentLinesList := strings.Split(content, "\n")
			startY := (len(contentLinesList) - len(paletteLines)) / 3
			if startY < 1 {
				startY = 1
			}
			for i, pLine := range paletteLines {
				row := startY + i
				if row < len(contentLinesList) {
					// Center horizontally
					pad := (m.width - lipgloss.Width(pLine)) / 2
					if pad < 0 {
						pad = 0
					}
					contentLinesList[row] = strings.Repeat(" ", pad) + pLine
				}
			}
			content = strings.Join(contentLinesList, "\n")
		}
	}

	v := tea.NewView(content)
	v.AltScreen = true
	if m.mouseEnabled {
		v.MouseMode = tea.MouseModeCellMotion
	}
	return v
}

func (m Model) viewSetup() string {
	title := lipgloss.NewStyle().Foreground(ui.ColorPrimary).Bold(true)
	dim := lipgloss.NewStyle().Foreground(ui.ColorTextDim)
	hint := lipgloss.NewStyle().Foreground(ui.ColorMuted)
	step := lipgloss.NewStyle().Foreground(ui.ColorSuccess).Bold(true)

	var b strings.Builder
	b.WriteString("\n\n")
	b.WriteString(title.Render("  hanimo setup"))
	b.WriteString("\n")
	b.WriteString(dim.Render("  OpenAI-compatible API (Novita, OpenRouter, OpenAI, ...)"))
	b.WriteString("\n\n")

	b.WriteString(step.Render("  API Key") + "\n\n")
	b.WriteString("  " + m.setupInput.View())

	b.WriteString("\n\n")
	b.WriteString(hint.Render("  Enter 다음 · Ctrl+C 종료"))
	return b.String()
}

func (m *Model) recalcLayout() {
	if m.width == 0 || m.height == 0 {
		return
	}
	inputH := m.textarea.Height() + 2
	fixed := inputH + 1 // input box + status bar
	// Reserve space for any inline overlays (intent hint, ASK_USER) so
	// they don't push the input box off-screen at the bottom.
	fixed += m.overlayHeight()
	vpHeight := m.height - fixed
	if vpHeight < 3 {
		vpHeight = 3
	}
	m.viewport.SetWidth(m.width)
	m.viewport.SetHeight(vpHeight)
	m.textarea.SetWidth(m.width - 6)
}

// overlayHeight returns the total vertical rows reserved above the input
// box for currently active overlays (intent hint, ASK_USER question,
// soft-danger confirm). Used by recalcLayout so the chat viewport
// shrinks exactly enough to keep every anchor visible.
func (m *Model) overlayHeight() int {
	h := 0
	if m.activeTab == int(llm.ModeSuper) && m.intentHint != "" {
		h++
	}
	if m.askQuestion != nil {
		// Rough estimate: question line + blank line + 1 line per option
		// + footer hint. RenderAskUser returns this many rows in
		// practice; over-reserving by 1 is safer than clipping.
		base := 3
		if m.askQuestion.Type != agents.AskTypeText {
			base += len(m.askQuestion.Options)
		}
		h += base + 1
	}
	return h
}

var spinnerFrames = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

// streamStatus composes the waiting-for-provider line. All
// domain-flavoured text (bee / honey / hive) comes from ui.ActivePersona
// so a downstream fork can re-skin the product by swapping the persona
// struct — see internal/ui/persona.go.
func (m *Model) streamStatus() string {
	elapsed := time.Since(m.streamStart)
	frame := spinnerFrames[int(elapsed.Milliseconds()/150)%len(spinnerFrames)]
	p := ui.ActivePersona

	if m.lastChunkAt.IsZero() {
		return fmt.Sprintf("%s %s... (%.1fs)", frame, p.ColdStart, elapsed.Seconds())
	}

	sinceLastChunk := time.Since(m.lastChunkAt)
	tps := float64(0)
	if elapsed.Seconds() > 0 {
		tps = float64(m.tokenCount) / elapsed.Seconds()
	}

	if sinceLastChunk > 15*time.Second {
		return fmt.Sprintf("%s %s (%.0fs 대기 · %dtok)", frame, p.Stall15s, sinceLastChunk.Seconds(), m.tokenCount)
	}
	if sinceLastChunk > 5*time.Second {
		return fmt.Sprintf("%s %s (%.0fs · %dtok · %.1ftok/s)", frame, p.Stall5s, elapsed.Seconds(), m.tokenCount, tps)
	}
	verb := ui.ThinkingVerbFor(elapsed.Seconds())
	return fmt.Sprintf("%s %s (%.1fs · %dtok · %.1ftok/s)", frame, verb, elapsed.Seconds(), m.tokenCount, tps)
}

func (m *Model) updateViewport() {
	// Reflow viewport height every render so inline overlays
	// (intent hint, ASK_USER) don't push the input box off-screen.
	// Cheap — just arithmetic on cached dimensions.
	m.recalcLayout()
	// Preserve user scroll position during streaming: if they had
	// scrolled up to re-read earlier context, don't yank them back
	// to the bottom on every new chunk.
	stickToBottom := m.viewport.AtBottom()
	var stream string
	msgs := m.msgs
	if m.streaming {
		stream = m.streamStatus()
		// Live render: while streaming, surface the partial streamBuf
		// as a transient assistant message so the user actually sees
		// text arrive token-by-token instead of staring at a spinner
		// until the whole response lands. The buffer isn't persisted
		// into m.msgs until streamChunkMsg.done fires.
		if m.streamBuf != "" {
			msgs = append(msgs, ui.Message{
				Role:      ui.RoleAssistant,
				Content:   m.streamBuf,
				Timestamp: time.Now(),
			})
		}
	}
	content := ui.RenderMessages(msgs, stream, m.viewport.Width())
	m.viewport.SetContent(content)
	if stickToBottom {
		m.viewport.GotoBottom()
	}
}

func (m Model) currentModel() string {
	switch m.activeTab {
	case 1: // Dev mode → qwen3-coder-30b
		return m.cfg.Models.Dev
	default: // Super, Plan → gpt-oss-120b
		return m.cfg.Models.Super
	}
}

// startStream creates a new streaming request with tool definitions.
func (m *Model) startStream() tea.Cmd {
	ctx, cancel := context.WithCancel(context.Background())
	m.streamCancel = cancel
	model := m.currentModel()
	history := make([]openai.ChatCompletionMessage, len(m.history))
	copy(history, m.history)
	toolDefs := tools.ToolsForMode(m.activeTab)

	modeName := "super"
	if m.activeTab == 1 {
		modeName = "dev"
	} else if m.activeTab == 2 {
		modeName = "plan"
	}
	config.DebugLog("[APP-STREAM] start | mode=%s | historyMsgs=%d | tools=%d | toolIter=%d/20", modeName, len(history), len(toolDefs), m.toolIter)

	m.streamCh = m.client.StreamChat(ctx, model, history, toolDefs)
	// Fire the chunk waiter AND a spinner ticker in parallel so the
	// UI keeps animating even when the provider stalls for 30+s.
	return tea.Batch(m.waitForNextChunk(), streamTickCmd())
}

func (m *Model) sendMessage(input string) tea.Cmd {
	m.gitInfo = gitinfo.Fetch(".")

	m.msgs = append(m.msgs, ui.Message{
		Role: ui.RoleUser, Content: input, Timestamp: time.Now(),
	})

	// Super mode: keyword-based intent hint (fast, local). LLM fallback is
	// intentionally skipped here to keep sends latency-free; callers can use
	// agents.DetectIntentLLM for an async upgrade path.
	if m.activeTab == int(llm.ModeSuper) {
		intent := agents.DetectIntentLocal(input)
		m.intentHint = intent.Suggest()
	} else {
		m.intentHint = ""
	}

	// Inject knowledge context into system prompt
	if m.knowledgeInj != nil {
		knowledgeCtx := m.knowledgeInj.Inject(m.activeTab, input)
		if knowledgeCtx != "" {
			mode := llm.Mode(m.activeTab)
			sysPrompt := llm.SystemPrompt(mode) + m.projectCtx + knowledgeCtx
			m.history[0] = openai.ChatCompletionMessage{
				Role: openai.ChatMessageRoleSystem, Content: sysPrompt,
			}
			config.DebugLog("[KNOWLEDGE] injected %d chars for query: %s",
				len(knowledgeCtx), truncate(input, 50))
		}
	}

	m.history = append(m.history, openai.ChatCompletionMessage{
		Role: openai.ChatMessageRoleUser, Content: input,
	})
	m.history = llm.Compact(m.history)
	m.streaming = true
	m.streamBuf = ""
	m.tokenCount = 0
	m.toolIter = 0
	m.toolCallHistory = map[string]int{}
	m.recentToolNames = nil
	tools.ResetReadSet()
	m.streamStart = time.Now()
	m.lastChunkAt = time.Time{}
	m.updateViewport()

	return m.startStream()
}

// continueAfterTools starts a new stream after tool results are added to history.
func (m *Model) continueAfterTools() tea.Cmd {
	m.streamBuf = ""
	return m.startStream()
}

func (m *Model) waitForNextChunk() tea.Cmd {
	ch := m.streamCh
	if ch == nil {
		return nil
	}
	return func() tea.Msg {
		chunk, ok := <-ch
		if !ok {
			return streamChunkMsg{done: true}
		}
		return streamChunkMsg{
			content:   chunk.Content,
			done:      chunk.Done,
			err:       chunk.Err,
			toolCalls: chunk.ToolCalls,
		}
	}
}

func (m *Model) cancelStream() {
	if m.streamCancel != nil {
		m.streamCancel()
		m.streamCancel = nil
	}
	m.streaming = false
	m.streamCh = nil
	m.lastElapsed = time.Since(m.streamStart)
	if m.streamBuf != "" {
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleAssistant, Content: m.streamBuf + "\n\n[중단됨]", Timestamp: time.Now(),
		})
		m.history = append(m.history, openai.ChatCompletionMessage{
			Role: openai.ChatMessageRoleAssistant, Content: m.streamBuf,
		})
	}
	m.streamBuf = ""
	m.updateViewport()
}

func (m Model) updatePalette(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	filtered := ui.FuzzyFilter(m.paletteQuery, ui.PaletteItems)

	switch msg.String() {
	case "esc", "ctrl+k":
		m.showPalette = false
		m.paletteQuery = ""
		m.paletteSelected = 0
		return m, nil

	case "up":
		if m.paletteSelected > 0 {
			m.paletteSelected--
		}
		return m, nil

	case "down":
		if m.paletteSelected < len(filtered)-1 {
			m.paletteSelected++
		}
		return m, nil

	case "enter":
		if len(filtered) > 0 && m.paletteSelected < len(filtered) {
			action := filtered[m.paletteSelected].Action
			m.showPalette = false
			m.paletteQuery = ""
			m.paletteSelected = 0
			if handled, cmd := m.handleSlashCommand(action); handled {
				return m, cmd
			}
		}
		return m, nil

	case "backspace":
		if len(m.paletteQuery) > 0 {
			m.paletteQuery = m.paletteQuery[:len(m.paletteQuery)-1]
			m.paletteSelected = 0
		}
		return m, nil

	case "ctrl+c":
		return m, tea.Quit

	default:
		// Append typed character to query
		key := msg.String()
		if len(key) == 1 {
			m.paletteQuery += key
			m.paletteSelected = 0
		}
		return m, nil
	}
}

func (m *Model) openMenu() {
	t := ui.T()
	m.menuItems = []string{
		t.ModelSwitch,
		t.ProviderSwitch,
		t.Language + " (" + ui.LangLabel() + ")",
		t.Theme,
		t.Config,
		t.Usage,
		t.ToolList,
		t.Help,
		t.Clear,
	}
	m.menuSelected = 0
	m.menuAction = ""
	m.modelList = nil
	m.showMenu = true
}

func (m Model) updateMenu(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc":
		if m.menuAction != "" {
			// Go back to main menu from submenu
			m.menuAction = ""
			m.menuSelected = 0
			m.openMenu()
			return m, nil
		}
		m.showMenu = false
		return m, nil

	case "up":
		if m.menuSelected > 0 {
			m.menuSelected--
		}
		return m, nil

	case "down":
		if m.menuSelected < len(m.menuItems)-1 {
			m.menuSelected++
		}
		return m, nil

	case "enter":
		if len(m.menuItems) == 0 || m.menuSelected >= len(m.menuItems) {
			return m, nil
		}

		if m.menuAction == "model" {
			selected := m.menuItems[m.menuSelected]
			m.showMenu = false
			// Hint entry: prefill textarea for manual input.
			if strings.HasPrefix(selected, "✎") {
				m.textarea.Reset()
				m.textarea.InsertString("/model ")
				m.textarea.Focus()
				return m, nil
			}
			switch m.activeTab {
			case 1:
				m.cfg.Models.Dev = selected
			default:
				m.cfg.Models.Super = selected
			}
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  모델 변경: %s", selected), Timestamp: time.Now(),
			})
			m.updateViewport()
			return m, nil
		}

		if m.menuAction == "provider" {
			raw := m.menuItems[m.menuSelected]
			// Strip lipgloss ANSI codes so prefix/suffix tests below
			// see only the underlying label text.
			plain := ansiRE.ReplaceAllString(raw, "")
			plain = strings.TrimSpace(strings.TrimPrefix(plain, "●"))
			plain = strings.TrimSpace(plain)
			selected := plain
			// Drop the "  (현재)" / "  (현재: …)" tail we appended
			// for display purposes.
			if idx := strings.Index(selected, "  (현재"); idx >= 0 {
				selected = strings.TrimSpace(selected[:idx])
			}
			m.showMenu = false

			// Custom URL entry: prefill the textarea with "/provider "
			// so the user can type a full URL (https://...) and hit
			// Enter. /provider now accepts bare URLs directly.
			if strings.Contains(plain, "Custom URL") {
				m.textarea.Reset()
				m.textarea.InsertString("/provider https://")
				m.textarea.Focus()
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: "  커스텀 엔드포인트 — 입력창에 URL을 이어 입력하고 Enter 를 누르세요.", Timestamp: time.Now(),
				})
				m.updateViewport()
				return m, nil
			}

			// Named provider: check cfg first (it may have a key),
			// then fall back to the OpenAI-compat default URL for the
			// name. The API key stays as-is so the user doesn't lose
			// their token when jumping between shared-key providers.
			applied := false
			if p, ok := m.cfg.Providers[selected]; ok {
				m.cfg.API.BaseURL = p.BaseURL
				if p.APIKey != "" {
					m.cfg.API.APIKey = p.APIKey
				}
				applied = true
			} else if url, ok := providers.DefaultBaseURLs[selected]; ok {
				m.cfg.API.BaseURL = url
				applied = true
			}
			if applied {
				m.client = llm.NewClientWithOptions(m.cfg.API.BaseURL, m.cfg.API.APIKey, m.cfg.NoStream)
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: fmt.Sprintf("  프로바이더 변경: %s (%s)", selected, m.cfg.API.BaseURL), Timestamp: time.Now(),
				})
			} else {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: fmt.Sprintf("  프로바이더 설정을 찾을 수 없습니다: %s", selected), Timestamp: time.Now(),
				})
			}
			m.updateViewport()
			return m, nil
		}

		if m.menuAction == "language" {
			selected := m.menuItems[m.menuSelected]
			m.showMenu = false
			switch selected {
			case "한국어":
				ui.CurrentLang = ui.LangKorean
			case "English":
				ui.CurrentLang = ui.LangEnglish
			}
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  언어 변경: %s", ui.LangLabel()), Timestamp: time.Now(),
			})
			m.updateViewport()
			return m, nil
		}

		if m.menuAction == "theme" {
			// Theme selected from submenu — apply and confirm.
			selected := m.menuItems[m.menuSelected]
			m.showMenu = false
			if ui.ApplyTheme(selected) {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: fmt.Sprintf("  테마 변경: %s", selected), Timestamp: time.Now(),
				})
			} else {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: fmt.Sprintf("  알 수 없는 테마: %s", selected), Timestamp: time.Now(),
				})
			}
			m.updateViewport()
			return m, nil
		}

		// Main menu actions
		t := ui.T()
		item := m.menuItems[m.menuSelected]

		// Match by checking prefix (language item has suffix)
		switch {
		case item == t.ModelSwitch:
			// Fetch model list from provider, fall back to current
			// config models so the menu is never empty.
			var models []string
			if m.client != nil && m.client.GetProvider() != nil {
				if list, err := m.client.GetProvider().ListModels(); err == nil {
					for _, mi := range list {
						models = append(models, mi.ID)
					}
				}
			}
			if len(models) == 0 {
				// Fallback: show the configured models + a hint to type
				// a custom name. This is better than closing the menu
				// and printing an error.
				seen := map[string]bool{}
				for _, n := range []string{m.cfg.Models.Super, m.cfg.Models.Dev} {
					if n != "" && !seen[n] {
						models = append(models, n)
						seen[n] = true
					}
				}
				models = append(models, "✎ /model <name> 으로 직접 입력")
			}
			m.menuAction = "model"
			m.menuItems = models
			m.modelList = models
			m.menuSelected = 0
			return m, nil

		case item == t.ProviderSwitch:
			// Union of: dedicated providers (ollama/anthropic/google),
			// every OpenAI-compat default, and user cfg.Providers.
			// Deduplicated, sorted. The currently-active provider gets
			// a honey-gold "● " prefix via lipgloss styling so it pops
			// visually; RenderMenu's non-selected label style doesn't
			// strip ANSI so the color survives. If the user is on a
			// custom URL that matches none of the known names, the
			// Custom URL row gets the highlight instead.
			seen := map[string]bool{}
			var provNames []string
			add := func(n string) {
				if n == "" || seen[n] {
					return
				}
				seen[n] = true
				provNames = append(provNames, n)
			}
			for _, n := range []string{"ollama", "anthropic", "google"} {
				add(n)
			}
			for name := range providers.DefaultBaseURLs {
				add(name)
			}
			for name := range m.cfg.Providers {
				add(name)
			}
			sort.Strings(provNames)

			activeStyle := lipgloss.NewStyle().Foreground(ui.ColorPrimary).Bold(true)
			dimStyle := lipgloss.NewStyle().Foreground(ui.ColorText)
			currentURL := m.cfg.API.BaseURL
			display := make([]string, 0, len(provNames)+1)
			cursor := 0
			matched := false
			for _, n := range provNames {
				if matchesProvider(n, currentURL) && !matched {
					display = append(display, activeStyle.Render("● "+n+"  (현재)"))
					cursor = len(display) - 1
					matched = true
				} else {
					display = append(display, dimStyle.Render("  "+n))
				}
			}
			customLabel := "  + Custom URL 입력..."
			if !matched && currentURL != "" {
				customLabel = activeStyle.Render("● + Custom URL  (현재: " + currentURL + ")")
				cursor = len(display)
			} else {
				customLabel = dimStyle.Render(customLabel)
			}
			display = append(display, customLabel)

			m.menuAction = "provider"
			m.menuItems = display
			m.menuSelected = cursor
			return m, nil

		case strings.HasPrefix(item, t.Language):
			// Open a language submenu instead of toggling. Future
			// additions (Japanese, Chinese, etc.) just append to the
			// list below.
			m.menuAction = "language"
			m.menuItems = []string{"한국어", "English"}
			m.menuSelected = 0
			if ui.CurrentLang == ui.LangEnglish {
				m.menuSelected = 1
			}
			return m, nil

		case item == t.Theme:
			// Open a theme submenu so the user can actually pick one.
			// Stable-sort the keys so the list order is deterministic.
			var names []string
			for k := range ui.Themes {
				names = append(names, k)
			}
			sort.Strings(names)
			if len(names) == 0 {
				m.showMenu = false
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: "  등록된 테마가 없습니다.", Timestamp: time.Now(),
				})
				m.updateViewport()
				return m, nil
			}
			m.menuAction = "theme"
			m.menuItems = names
			m.menuSelected = 0
			// Start cursor on the currently active theme so Enter
			// on accident doesn't flip the user to something else.
			for i, n := range names {
				if n == ui.CurrentTheme {
					m.menuSelected = i
					break
				}
			}
			return m, nil

		case item == t.Config:
			m.showMenu = false
			if handled, cmd := m.handleSlashCommand("/config"); handled {
				return m, cmd
			}
			return m, nil

		case item == t.Usage:
			m.showMenu = false
			if handled, cmd := m.handleSlashCommand("/usage"); handled {
				return m, cmd
			}
			return m, nil

		case item == t.ToolList:
			m.showMenu = false
			m.msgs = append(m.msgs, ui.Message{
				Role:      ui.RoleSystem,
				Content:   renderToolList(m.activeTab),
				Timestamp: time.Now(),
			})
			m.updateViewport()
			return m, nil

		// AutoMode and Diagnostics dispatches removed — the menu no
		// longer lists them. Deep Agent mode (Tab key) replaces the
		// "자율 모드" menu entry, and /diagnostics remains available
		// as a slash command for the rare user who wants it.

		case item == t.Help:
			m.showMenu = false
			if handled, cmd := m.handleSlashCommand("/help"); handled {
				return m, cmd
			}
			return m, nil

		case item == t.Clear:
			m.showMenu = false
			if handled, cmd := m.handleSlashCommand("/clear"); handled {
				return m, cmd
			}
			return m, nil
		}

		m.showMenu = false
		return m, nil

	case "ctrl+c":
		return m, tea.Quit
	}

	return m, nil
}

// overlayCenter composites an overlay block roughly centered on top of the
// base content string. It mirrors the pattern used for the menu/palette
// overlays earlier in View().
func overlayCenter(base, overlay string, width int) string {
	overlayLines := strings.Split(overlay, "\n")
	baseLines := strings.Split(base, "\n")
	startY := (len(baseLines) - len(overlayLines)) / 3
	if startY < 1 {
		startY = 1
	}
	for i, oLine := range overlayLines {
		row := startY + i
		if row >= len(baseLines) {
			break
		}
		pad := (width - lipgloss.Width(oLine)) / 2
		if pad < 0 {
			pad = 0
		}
		baseLines[row] = strings.Repeat(" ", pad) + oLine
	}
	return strings.Join(baseLines, "\n")
}

// runCheckpoint creates a git stash labeled with a hanimo prefix so the
// user can experiment with /auto or /deep and roll back with /rollback.
// Falls back to a friendly message when cwd isn't a git repo or there's
// nothing to stash.
func runCheckpoint(label string) (string, error) {
	if !inGitRepo() {
		return "현재 디렉토리는 git 레포가 아닙니다. /checkpoint 는 git 기반입니다.", nil
	}
	// git stash -u always complains if there's nothing to stash — check first.
	status := exec.Command("git", "status", "--porcelain")
	out, err := status.Output()
	if err != nil {
		return fmt.Sprintf("git status 실패: %v", err), err
	}
	if strings.TrimSpace(string(out)) == "" {
		return "변경 사항이 없어 체크포인트를 만들지 않았습니다.", nil
	}
	msg := label
	if msg == "" {
		msg = fmt.Sprintf("hanimo:%s", time.Now().Format("2006-01-02-15:04:05"))
	} else {
		msg = "hanimo:" + msg
	}
	cmd := exec.Command("git", "stash", "push", "-u", "-m", msg)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Sprintf("체크포인트 실패: %s", strings.TrimSpace(string(out))), err
	}
	return fmt.Sprintf("✓ 체크포인트 생성: %s  — /rollback 으로 되돌릴 수 있습니다.", msg), nil
}

// runRollback pops the most recent hanimo-labeled stash.
func runRollback() (string, error) {
	if !inGitRepo() {
		return "현재 디렉토리는 git 레포가 아닙니다.", nil
	}
	list := exec.Command("git", "stash", "list")
	out, err := list.Output()
	if err != nil {
		return fmt.Sprintf("git stash list 실패: %v", err), err
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	var target string
	for _, line := range lines {
		if strings.Contains(line, "hanimo:") {
			// Lines look like: stash@{0}: On main: hanimo:2026-04-11-…
			if i := strings.Index(line, ":"); i >= 0 {
				target = strings.TrimSpace(line[:i])
				break
			}
		}
	}
	if target == "" {
		return "되돌릴 hanimo 체크포인트가 없습니다.", nil
	}
	cmd := exec.Command("git", "stash", "pop", target)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Sprintf("롤백 실패: %s", strings.TrimSpace(string(out))), err
	}
	return fmt.Sprintf("✓ 롤백 완료: %s — 변경 사항이 작업 디렉토리로 복원되었습니다.", target), nil
}

// listCheckpoints enumerates hanimo-prefixed stashes.
func listCheckpoints() string {
	if !inGitRepo() {
		return "  현재 디렉토리는 git 레포가 아닙니다."
	}
	out, err := exec.Command("git", "stash", "list").Output()
	if err != nil {
		return fmt.Sprintf("  git stash list 실패: %v", err)
	}
	var sb strings.Builder
	sb.WriteString("  📌 hanimo 체크포인트\n")
	count := 0
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if strings.Contains(line, "hanimo:") {
			sb.WriteString("  " + line + "\n")
			count++
		}
	}
	if count == 0 {
		return "  hanimo 체크포인트가 없습니다. /checkpoint 로 생성하세요."
	}
	return sb.String()
}

// inGitRepo returns true if cwd is inside a git working tree.
func inGitRepo() bool {
	cmd := exec.Command("git", "rev-parse", "--is-inside-work-tree")
	out, err := cmd.Output()
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(out)) == "true"
}

// ansiRE matches ANSI SGR escape sequences so we can strip lipgloss
// styling out of menu item labels at dispatch time. The provider
// submenu embeds color codes in each row; the Enter handler needs the
// raw text to decide which provider was actually picked.
var ansiRE = regexp.MustCompile(`\x1b\[[0-9;]*m`)

// providerHosts maps a provider name to the canonical hostname we look
// for in the configured base URL. Using host-only comparison lets us
// match across path variants (/v1 vs /v3/openai vs /v1beta) that the
// user may have customized in config.yaml.
var providerHosts = map[string]string{
	"ollama":      "localhost:11434",
	"anthropic":   "api.anthropic.com",
	"google":      "generativelanguage.googleapis.com",
	"openai":      "api.openai.com",
	"novita":      "api.novita.ai",
	"openrouter":  "openrouter.ai",
	"deepseek":    "api.deepseek.com",
	"groq":        "api.groq.com",
	"together":    "api.together.xyz",
	"fireworks":   "api.fireworks.ai",
	"mistral":     "api.mistral.ai",
	"xai":         "api.x.ai",
	"cerebras":    "api.cerebras.ai",
	"siliconflow": "api.siliconflow.cn",
	"deepinfra":   "api.deepinfra.com",
	"perplexity":  "api.perplexity.ai",
}

// matchesProvider reports whether a named provider matches the currently
// configured API base URL by hostname. Used by the provider submenu to
// decide which row is "active" for colour highlighting.
func matchesProvider(name, currentURL string) bool {
	if currentURL == "" {
		return false
	}
	if host, ok := providerHosts[name]; ok {
		return strings.Contains(currentURL, host)
	}
	return false
}

// renderToolList produces a human-readable summary of every tool currently
// exposed to the LLM in the active mode. Used by the menu "도구 목록" entry
// so users can inspect exactly what the agent is allowed to call without
// digging through source.
func renderToolList(mode int) string {
	defs := tools.ToolsForMode(mode)
	modeName := "Super"
	switch mode {
	case 1:
		modeName = "Deep Agent"
	case 2:
		modeName = "Plan (read-only)"
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "  📋 현재 모드: %s — 사용 가능한 도구 %d개\n\n", modeName, len(defs))
	for i, d := range defs {
		if d.Function == nil {
			continue
		}
		fmt.Fprintf(&sb, "  %2d. %-14s  %s\n", i+1, d.Function.Name, truncate(d.Function.Description, 80))
	}
	return sb.String()
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "..."
}

// truncateArgs flattens a tool-call argument/result into a single-line
// preview no longer than `max` RUNES. Counting bytes here splits UTF-8
// multi-byte characters (notably Korean) mid-codepoint, which surfaced
// as `작��` garbage in the tool-result line — fix enforced by using
// []rune everywhere.
func truncateArgs(s string, max int) string {
	s = strings.ReplaceAll(s, "\n", " ")
	runes := []rune(s)
	if len(runes) > max {
		return string(runes[:max]) + "..."
	}
	return s
}

// applyModeSwitch refreshes the system prompt + UI after a tab change,
// toggling Deep Agent autonomous behavior on/off as needed.
func (m *Model) applyModeSwitch() {
	mode := llm.Mode(m.activeTab)
	sysPrompt := llm.SystemPrompt(mode) + m.projectCtx

	switch mode {
	case llm.ModeDeep:
		// Deep Agent implies autonomous behavior with a high iteration cap.
		m.autoMode = true
		if agents.MaxAutoIterations < 100 {
			agents.MaxAutoIterations = 100
		}
		sysPrompt += agents.AutoPromptSuffix
	default:
		m.autoMode = false
		m.autoTask = ""
	}

	m.history[0] = openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleSystem,
		Content: sysPrompt,
	}

	// Remove previous mode info boxes, keep only the new one
	filtered := m.msgs[:0]
	for _, msg := range m.msgs {
		if msg.Tag != "modebox" {
			filtered = append(filtered, msg)
		}
	}
	m.msgs = append(filtered, ui.Message{
		Role:      ui.RoleSystem,
		Content:   ui.ModeInfoBox(m.activeTab, m.currentModel()),
		Timestamp: time.Now(),
		Tag:       "modebox",
	})
	m.updateViewport()
}

// handleAskUserKey routes key presses while an ASK_USER overlay is active.
// Returns (handled, cmd). When handled is false the caller should fall back
// to default key processing.
func (m *Model) handleAskUserKey(msg tea.KeyPressMsg) (bool, tea.Cmd) {
	if m.askQuestion == nil {
		return false, nil
	}
	key := msg.String()
	q := m.askQuestion

	switch q.Type {
	case agents.AskTypeText:
		switch key {
		case "esc":
			m.askQuestion = nil
			m.askInput = ""
			return true, m.submitAskAnswer("[user skipped the question]")
		case "enter":
			answer := strings.TrimSpace(m.askInput)
			if answer == "" {
				answer = "[empty]"
			}
			m.askQuestion = nil
			m.askInput = ""
			return true, m.submitAskAnswer(agents.FormatAnswer(q, answer))
		case "backspace":
			if len(m.askInput) > 0 {
				r := []rune(m.askInput)
				m.askInput = string(r[:len(r)-1])
			}
			return true, nil
		}
		// Printable chars
		if len(key) == 1 {
			m.askInput += key
			return true, nil
		}
		return true, nil

	default: // choice / confirm
		switch key {
		case "esc":
			m.askQuestion = nil
			return true, m.submitAskAnswer("[user skipped the question]")
		case "up", "k":
			if m.askSelected > 0 {
				m.askSelected--
			}
			return true, nil
		case "down", "j":
			if m.askSelected < len(q.Options)-1 {
				m.askSelected++
			}
			return true, nil
		case "enter":
			if m.askSelected < len(q.Options) {
				answer := q.Options[m.askSelected]
				m.askQuestion = nil
				return true, m.submitAskAnswer(agents.FormatAnswer(q, answer))
			}
			return true, nil
		}
		// 1-9 quick select
		if len(key) == 1 && key[0] >= '1' && key[0] <= '9' {
			idx := int(key[0] - '1')
			if idx < len(q.Options) {
				answer := q.Options[idx]
				m.askQuestion = nil
				return true, m.submitAskAnswer(agents.FormatAnswer(q, answer))
			}
		}
		return true, nil
	}
}

// submitAskAnswer feeds the user's answer back to the LLM and resumes the
// conversation loop.
func (m *Model) submitAskAnswer(formatted string) tea.Cmd {
	// NOTE: sendMessage already appends to m.msgs — do not duplicate here.
	m.updateViewport()
	return m.sendMessage(formatted)
}

// handleDangerKey routes key presses while the dangerous-op confirmation
// overlay is active.
func (m *Model) handleDangerKey(msg tea.KeyPressMsg) (bool, tea.Cmd) {
	if m.dangerCmd == "" {
		return false, nil
	}
	key := msg.String()
	switch key {
	case "esc":
		return true, m.resolveDanger(false)
	case "up", "k":
		if m.dangerSelected > 0 {
			m.dangerSelected--
		}
		return true, nil
	case "down", "j":
		if m.dangerSelected < 1 {
			m.dangerSelected++
		}
		return true, nil
	case "1":
		m.dangerSelected = 0
		return true, m.resolveDanger(true)
	case "2":
		m.dangerSelected = 1
		return true, m.resolveDanger(false)
	case "enter":
		return true, m.resolveDanger(m.dangerSelected == 0)
	}
	return true, nil
}

// resolveDanger finalizes a pending dangerous-op prompt.
func (m *Model) resolveDanger(approved bool) tea.Cmd {
	cmd := m.dangerCmd
	m.dangerCmd = ""
	m.dangerReason = ""
	m.dangerSelected = 0

	status := "[Dangerous command DENIED by user]"
	if approved {
		status = fmt.Sprintf("[User approved dangerous command: %s]", cmd)
	}
	m.msgs = append(m.msgs, ui.Message{
		Role: ui.RoleSystem, Content: "  " + status, Timestamp: time.Now(),
	})
	m.updateViewport()
	return m.submitAskAnswer(status)
}
