package app

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
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
	"github.com/flykimjiwon/hanimo/internal/config"
	"github.com/flykimjiwon/hanimo/internal/knowledge"
	"github.com/flykimjiwon/hanimo/internal/llm"
	"github.com/flykimjiwon/hanimo/internal/tools"
	"github.com/flykimjiwon/hanimo/internal/ui"
)

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
	pendingQueue []string // messages queued while streaming
	knowledgeInj *knowledge.Injector

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

	// Initialize knowledge store
	var knowledgeInj *knowledge.Injector
	if knowledgeStore, err := knowledge.NewStore(hanimo.KnowledgeFS); err == nil {
		knowledgeInj = knowledge.NewInjector(knowledgeStore, 8192)
		config.DebugLog("[KNOWLEDGE] loaded %d documents", knowledgeStore.DocCount())
	} else {
		config.DebugLog("[KNOWLEDGE] failed to load: %v", err)
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
	}

	if needsSetup {
		m.setupInput.Focus()
	} else {
		m.client = llm.NewClient(cfg.API.BaseURL, cfg.API.APIKey)
	}

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
	case tea.KeyPressMsg:
		if m.streaming {
			switch msg.String() {
			case "ctrl+c", "esc":
				m.cancelStream()
				return m, nil
			case "enter":
				// Queue message while streaming
				input := strings.TrimSpace(m.textarea.Value())
				if input != "" {
					m.pendingQueue = append(m.pendingQueue, input)
					m.textarea.Reset()
					m.textarea.SetHeight(1)
					m.recalcLayout()
					// Show queued indicator
					m.msgs = append(m.msgs, ui.Message{
						Role: ui.RoleUser, Content: input + " [대기중]", Timestamp: time.Now(),
					})
					m.updateViewport()
				}
				return m, nil
			case "shift+enter":
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
					return m, nil
				}
			}
			m.activeTab = (m.activeTab + 1) % llm.ModeCount
			m.intentHint = ""
			m.applyModeSwitch()
			return m, nil

		case "shift+enter":
			// Shift+Enter = newline
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
				m.textarea.Reset()
				m.textarea.SetHeight(1)
				m.recalcLayout()
				if handled, cmd := m.handleSlashCommand(input); handled {
					return m, cmd
				}
				return m, m.sendMessage(input)
			}
			return m, nil

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
				decisions := make([]loopDecision, len(calls))
				for i, tc := range calls {
					key := tc.Name + ":" + tc.Arguments
					m.toolCallHistory[key]++
					if m.toolCallHistory[key] >= 3 {
						decisions[i] = loopDecision{blocked: true, key: key}
						config.DebugLog("[TOOL-LOOP] blocked repeat call name=%s count=%d", tc.Name, m.toolCallHistory[key])
					}
				}
				return m, func() tea.Msg {
					var results []toolResult
					for i, tc := range calls {
						var output string
						if decisions[i].blocked {
							output = "STOP: You called this exact tool 3 times with the same arguments. The approach is not working. Try a COMPLETELY DIFFERENT approach or ASK_USER for guidance."
						} else {
							output = tools.Execute(tc.Name, tc.Arguments)
						}
						results = append(results, toolResult{
							callID: tc.ID,
							name:   tc.Name,
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
			preview := truncateArgs(r.output, 100)
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleTool, Content: fmt.Sprintf("<< %s: %s", r.name, preview), Timestamp: time.Now(),
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
			m.client = llm.NewClient(m.cfg.API.BaseURL, m.cfg.API.APIKey)
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
		} else {
			if p, ok := m.cfg.Providers[arg]; ok {
				m.cfg.API.BaseURL = p.BaseURL
				if p.APIKey != "" {
					m.cfg.API.APIKey = p.APIKey
				}
				m.client = llm.NewClient(m.cfg.API.BaseURL, m.cfg.API.APIKey)
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: fmt.Sprintf("  프로바이더 변경: %s (%s)", arg, p.BaseURL), Timestamp: time.Now(),
				})
			} else {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: fmt.Sprintf("  알 수 없는 프로바이더: %s", arg), Timestamp: time.Now(),
				})
			}
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
		info := fmt.Sprintf("  토큰 수신: %d tokens\n  마지막 응답 시간: %v", m.tokenCount, elapsed)
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: info, Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/save":
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: "  [세션 저장 기능은 아직 구현 중입니다]", Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/load":
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: "  [세션 로드 기능은 아직 구현 중입니다]", Timestamp: time.Now(),
		})
		m.updateViewport()
		return true, nil

	case "/search":
		m.msgs = append(m.msgs, ui.Message{
			Role: ui.RoleSystem, Content: "  [세션 검색 기능은 아직 구현 중입니다]", Timestamp: time.Now(),
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
		statusBar := ui.RenderStatusBar(displayModel, m.tokenCount, elapsed, m.activeTab, m.cwd, m.width, config.IsDebug(), len(tools.ToolsForMode(m.activeTab)), m.autoMode, planProgress)

		// Intent hint line (Super mode only) — shown directly above the input box.
		if m.activeTab == int(llm.ModeSuper) && m.intentHint != "" {
			hintStyle := lipgloss.NewStyle().
				Foreground(lipgloss.Color("#F9E2AF")).
				Italic(true)
			hintLine := hintStyle.Render("  " + m.intentHint)
			content = lipgloss.JoinVertical(lipgloss.Left, vpContent, hintLine, inputBox, statusBar)
		} else {
			content = lipgloss.JoinVertical(lipgloss.Left, vpContent, inputBox, statusBar)
		}

		// Interactive ASK_USER overlay — rendered as a centered box on top.
		if m.askQuestion != nil {
			var overlay string
			if m.askQuestion.Type == agents.AskTypeText {
				overlay = ui.RenderAskText(m.askQuestion.Question, m.askInput, m.width)
			} else {
				overlay = ui.RenderAskUser(m.askQuestion.Question, m.askQuestion.Options, m.askSelected, m.width)
			}
			content = overlayCenter(content, overlay, m.width)
		}

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
	v.MouseMode = tea.MouseModeCellMotion
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
	vpHeight := m.height - fixed
	if vpHeight < 3 {
		vpHeight = 3
	}
	m.viewport.SetWidth(m.width)
	m.viewport.SetHeight(vpHeight)
	m.textarea.SetWidth(m.width - 6)
}

var spinnerFrames = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

func (m *Model) streamStatus() string {
	elapsed := time.Since(m.streamStart)
	frame := spinnerFrames[int(elapsed.Milliseconds()/150)%len(spinnerFrames)]

	if m.lastChunkAt.IsZero() {
		// No chunks received yet
		return fmt.Sprintf("%s 연결중... (%.1fs)", frame, elapsed.Seconds())
	}

	sinceLastChunk := time.Since(m.lastChunkAt)
	tps := float64(0)
	if elapsed.Seconds() > 0 {
		tps = float64(m.tokenCount) / elapsed.Seconds()
	}

	if sinceLastChunk > 15*time.Second {
		return fmt.Sprintf("%s 응답없음 (%.0fs 대기중 · %dtok)", frame, sinceLastChunk.Seconds(), m.tokenCount)
	}
	if sinceLastChunk > 5*time.Second {
		return fmt.Sprintf("%s 응답지연... (%.0fs · %dtok · %.1ftok/s)", frame, elapsed.Seconds(), m.tokenCount, tps)
	}
	return fmt.Sprintf("%s 수신중 (%.1fs · %dtok · %.1ftok/s)", frame, elapsed.Seconds(), m.tokenCount, tps)
}

func (m *Model) updateViewport() {
	var stream string
	if m.streaming {
		stream = m.streamStatus()
	}
	content := ui.RenderMessages(m.msgs, stream, m.viewport.Width())
	m.viewport.SetContent(content)
	m.viewport.GotoBottom()
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
	return m.waitForNextChunk()
}

func (m *Model) sendMessage(input string) tea.Cmd {
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
		t.AutoMode,
		t.Diagnostics,
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
			// Model selected from submenu
			selected := m.menuItems[m.menuSelected]
			m.showMenu = false
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
			// Provider selected from submenu
			selected := m.menuItems[m.menuSelected]
			m.showMenu = false
			if p, ok := m.cfg.Providers[selected]; ok {
				m.cfg.API.BaseURL = p.BaseURL
				if p.APIKey != "" {
					m.cfg.API.APIKey = p.APIKey
				}
				m.client = llm.NewClient(m.cfg.API.BaseURL, m.cfg.API.APIKey)
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: fmt.Sprintf("  프로바이더 변경: %s (%s)", selected, p.BaseURL), Timestamp: time.Now(),
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
			// Fetch model list from provider
			var models []string
			if m.client != nil && m.client.GetProvider() != nil {
				if list, err := m.client.GetProvider().ListModels(); err == nil {
					for _, mi := range list {
						models = append(models, mi.ID)
					}
				}
			}
			if len(models) == 0 {
				// Fallback: show current model
				models = []string{m.currentModel()}
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: "  모델 목록을 가져올 수 없습니다. /model <name> 으로 직접 변경하세요.", Timestamp: time.Now(),
				})
				m.showMenu = false
				m.updateViewport()
				return m, nil
			}
			m.menuAction = "model"
			m.menuItems = models
			m.modelList = models
			m.menuSelected = 0
			return m, nil

		case item == t.ProviderSwitch:
			var provNames []string
			for name := range m.cfg.Providers {
				provNames = append(provNames, name)
			}
			if len(provNames) == 0 {
				m.msgs = append(m.msgs, ui.Message{
					Role: ui.RoleSystem, Content: "  등록된 프로바이더가 없습니다.", Timestamp: time.Now(),
				})
				m.showMenu = false
				m.updateViewport()
				return m, nil
			}
			m.menuAction = "provider"
			m.menuItems = provNames
			m.menuSelected = 0
			return m, nil

		case strings.HasPrefix(item, t.Language):
			ui.ToggleLang()
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: fmt.Sprintf("  Language switched to %s", ui.LangLabel()), Timestamp: time.Now(),
			})
			m.showMenu = false
			m.updateViewport()
			return m, nil

		case item == t.Theme:
			m.showMenu = false
			if handled, cmd := m.handleSlashCommand("/theme"); handled {
				return m, cmd
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

		case item == t.AutoMode:
			m.showMenu = false
			m.msgs = append(m.msgs, ui.Message{
				Role: ui.RoleSystem, Content: "  /auto <task> 로 자율 모드를 시작하세요.", Timestamp: time.Now(),
			})
			m.updateViewport()
			return m, nil

		case item == t.Diagnostics:
			m.showMenu = false
			if handled, cmd := m.handleSlashCommand("/diagnostics"); handled {
				return m, cmd
			}
			return m, nil

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

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "..."
}

func truncateArgs(s string, max int) string {
	s = strings.ReplaceAll(s, "\n", " ")
	if len(s) > max {
		return s[:max] + "..."
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
	m.msgs = append(m.msgs, ui.Message{
		Role: ui.RoleUser, Content: formatted, Timestamp: time.Now(),
	})
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
