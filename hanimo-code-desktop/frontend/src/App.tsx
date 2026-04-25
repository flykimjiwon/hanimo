import { useState, useEffect, useCallback, useRef } from 'react'
import { Hexagon, Palette } from 'lucide-react'
import { EventsOn } from '../wailsjs/runtime/runtime'
import ActivityBar from './components/ActivityBar'
import FileTree from './components/FileTree'
import SearchPanel from './components/SearchPanel'
import GitPanel from './components/GitPanel'
import Editor from './components/Editor'
import Terminal from './components/Terminal'
import ChatPanel from './components/ChatPanel'
import StatusBar from './components/StatusBar'
import ThemePicker from './components/ThemePicker'
import SettingsPanel from './components/SettingsPanel'
import QuickOpen from './components/QuickOpen'
import ResizeHandle from './components/ResizeHandle'
import GitGraph from './components/GitGraph'
import DiffView from './components/DiffView'
import ToastContainer from './components/Toast'
import AboutDialog from './components/AboutDialog'
import CommandPalette from './components/CommandPalette'
import type { Mode } from './components/ModeSwitcher'
import ProviderChip from './components/ProviderChip'
import ProblemsStrip from './components/ProblemsStrip'
import KnowledgePanel from './components/KnowledgePanel'
import SessionsPanel from './components/SessionsPanel'
import SkillsPanel from './components/SkillsPanel'
import MCPPanel from './components/MCPPanel'
import RunPanel from './components/RunPanel'
import PermissionsPanel from './components/PermissionsPanel'
import { setHashAnchors, type HashAnchor } from './components/hashAnchorGutter'
import type { EditorView } from '@codemirror/view'
import PlaceholderPanel from './components/PlaceholderPanel'
import { Share2, TriangleAlert } from 'lucide-react'

function App() {
  const [activePanel, setActivePanel] = useState('files')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [showTheme, setShowTheme] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [cursor, setCursor] = useState({ line: 1, col: 1, lang: 'Plain Text' })
  const [showQuickOpen, setShowQuickOpen] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [splitFile, setSplitFile] = useState<string | null>(null)
  const [diffFile, setDiffFile] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('hanimo-mode') as Mode) || 'super')
  const [currentModel, setCurrentModel] = useState<string>('qwen3:8b')

  useEffect(() => { localStorage.setItem('hanimo-mode', mode) }, [mode])

  // Pull current model name from chatEngine on startup. Using GetModel
  // (not GetConfig) keeps App.tsx and ChatPanel reading the same source —
  // otherwise SwitchModel updates the ribbon but the chat header lags.
  useEffect(() => {
    import('../wailsjs/go/main/App').then(m => {
      const g = (m as any).GetModel
      if (typeof g === 'function') {
        g().then((name: string) => {
          if (typeof name === 'string' && name) setCurrentModel(name)
        }).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  // EditorView ref for hash-anchor gutter dispatching.
  const editorViewRef = useRef<EditorView | null>(null)

  // Subscribe to hash:anchor events from the Go backend (emitted by hashline_edit
  // tool). Phase 8 wiring — backend emit comes online with hashline integration.
  useEffect(() => {
    const cancel = EventsOn('hash:anchor', (raw: any) => {
      const list: HashAnchor[] = Array.isArray(raw)
        ? raw.filter((a: any) => a && typeof a.line === 'number' && typeof a.hash === 'string')
        : (raw && typeof raw.line === 'number') ? [raw] : []
      if (editorViewRef.current) setHashAnchors(editorViewRef.current, list)
    })
    return cancel
  }, [])

  // Resizable panel sizes
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [terminalHeight, setTerminalHeight] = useState(200)
  const [chatWidth, setChatWidth] = useState(360)
  const [showTerminal, setShowTerminal] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  function handlePanelSelect(panel: string) {
    if (panel === 'settings') { setShowTheme(true); return }
    if (panel === 'account') { setShowSettings(true); return }
    if (panel === 'webpreview') {
      setPreviewUrl(prev => prev ? null : 'http://localhost:3000')
      return
    }
    setActivePanel(prev => prev === panel ? '' : panel)
  }

  const sidebarOpen = [
    'files', 'search', 'git',
    'knowledge', 'sessions',
    'problems', 'skills', 'mcp', 'subagents', 'permissions', 'run',
  ].includes(activePanel)

  const resizeSidebar = useCallback((d: number) => setSidebarWidth(w => Math.max(160, Math.min(400, w + d))), [])
  const resizeTerminal = useCallback((d: number) => setTerminalHeight(h => Math.max(80, Math.min(500, h - d))), [])
  const resizeChat = useCallback((d: number) => setChatWidth(w => Math.max(260, Math.min(600, w - d))), [])

  // Native menu events
  useEffect(() => {
    const cancels = [
      EventsOn('menu:settings', () => setShowSettings(true)),
      EventsOn('menu:theme', () => setShowTheme(true)),
      EventsOn('menu:quickopen', () => setShowQuickOpen(true)),
      EventsOn('menu:terminal', () => setShowTerminal(t => !t)),
      EventsOn('menu:panel', (panel: string) => handlePanelSelect(panel)),
      EventsOn('menu:findinfiles', () => setActivePanel('search')),
      EventsOn('menu:about', () => setShowAbout(true)),
      EventsOn('preview:open', (url: string) => setPreviewUrl(url)),
      EventsOn('menu:openfolder', () => {
        import('../wailsjs/go/main/App').then(({ OpenFolder }) => {
          OpenFolder().then(dir => { if (dir) window.location.reload() })
        })
      }),
    ]
    return () => cancels.forEach(fn => fn())
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === '1') { e.preventDefault(); handlePanelSelect('files') }
      if (mod && e.key === '2') { e.preventDefault(); handlePanelSelect('search') }
      if (mod && e.key === '3') { e.preventDefault(); handlePanelSelect('git') }
      if (mod && e.key === ',') { e.preventDefault(); setShowTheme(true) }
      if (mod && e.shiftKey && e.key === 'f') { e.preventDefault(); setActivePanel('search') }
      if (mod && e.key === 'b') { e.preventDefault(); handlePanelSelect('files') }
      if (mod && e.key === 'p') { e.preventDefault(); setShowQuickOpen(true) }
      if (mod && e.key === '`') { e.preventDefault(); setShowTerminal(t => !t) }
      if (mod && e.key === 'j') { e.preventDefault(); setShowTerminal(t => !t) }
      if (mod && e.shiftKey && e.key === 'p') { e.preventDefault(); setShowCommandPalette(true) }
      if (mod && e.key === '\\') { e.preventDefault(); setSplitFile(prev => prev ? null : selectedFile) }
      if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); document.documentElement.style.fontSize = (parseFloat(getComputedStyle(document.documentElement).fontSize) + 1) + 'px' }
      if (mod && e.key === '-') { e.preventDefault(); document.documentElement.style.fontSize = Math.max(10, parseFloat(getComputedStyle(document.documentElement).fontSize) - 1) + 'px' }
      if (mod && e.key === '0') { e.preventDefault(); document.documentElement.style.fontSize = '13px' }
      if (e.key === 'F11') { e.preventDefault(); document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Ribbon — Brand · Mode · Model chip · Theme */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--bg-activity)',
          borderBottom: '1px solid var(--border)',
          padding: '0 10px',
          minHeight: 38,
          paddingLeft: navigator.platform.includes('Mac') ? 80 : 10,
          userSelect: 'none',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>
          <Hexagon size={16} style={{ color: 'var(--accent)' }} />
          <span>hanimo</span>
          <span style={{ fontSize: 10.5, color: 'var(--fg-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>
            desktop
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <ProviderChip
          model={currentModel}
          onSelect={async (id) => {
            try {
              const mod: any = await import('../wailsjs/go/main/App')
              if (typeof mod.SwitchModel !== 'function') {
                const t = await import('./components/Toast')
                t.showToast('SwitchModel binding pending — Wails dev required', 'info')
                return
              }
              const newModel = await mod.SwitchModel(id)
              setCurrentModel(newModel || id)
              const t = await import('./components/Toast')
              t.showToast(`Switched to ${newModel || id}`, 'success')
            } catch (e: any) {
              const t = await import('./components/Toast')
              t.showToast(`Switch failed: ${e?.message || 'unknown'}`, 'info')
            }
          }}
        />
        <button
          type="button"
          onClick={() => setShowTheme(true)}
          title="Theme (Cmd+,)"
          aria-label="Theme"
          style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 7px',
            color: 'var(--fg-muted)',
            cursor: 'pointer',
            fontFamily: 'var(--font-ui)',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-muted)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
          }}
        >
          <Palette size={12} />
        </button>
      </div>


      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ActivityBar active={activePanel} onSelect={handlePanelSelect} />

        {/* Sidebar */}
        {sidebarOpen && (
          <>
            <div style={{ width: sidebarWidth, flexShrink: 0, overflow: 'hidden' }}>
              {activePanel === 'files' && <FileTree onFileSelect={setSelectedFile} selectedFile={selectedFile || ''} />}
              {activePanel === 'search' && <SearchPanel onFileSelect={setSelectedFile} />}
              {activePanel === 'git' && <GitPanel onFileSelect={(path) => setDiffFile(path)} />}
              {activePanel === 'knowledge' && <KnowledgePanel />}
              {activePanel === 'sessions' && <SessionsPanel />}
              {activePanel === 'problems' && (
                <PlaceholderPanel
                  title="LSP Problems"
                  Icon={TriangleAlert}
                  shortDesc="현재 파일의 진단(에러·경고·힌트)을 모아 보는 패널입니다. ProblemsStrip은 이미 활성화되어 있어 카운트는 에디터 하단에서 즉시 확인 가능합니다."
                  bullets={[
                    'gopls · tsserver · pyright 자동 감지',
                    '파일 변경 시 3초 polling',
                    '클릭 시 해당 라인으로 점프',
                  ]}
                  comingIn="Phase 6"
                />
              )}
              {activePanel === 'skills' && <SkillsPanel />}
              {activePanel === 'mcp' && <MCPPanel />}
              {activePanel === 'subagents' && (
                <PlaceholderPanel
                  title="Subagents"
                  Icon={Share2}
                  shortDesc="컨텍스트 분기 + 요약 반환. 큰 작업을 여러 서브에이전트로 분할해 토큰 폭주를 막고 병렬 진행."
                  bullets={[
                    '실행 중 서브에이전트 라이브 스트림',
                    'git worktree로 동시 실험',
                    '결과 머지 / 충돌 해소',
                  ]}
                  comingIn="Phase 8"
                />
              )}
              {activePanel === 'permissions' && <PermissionsPanel />}
              {activePanel === 'run' && <RunPanel />}
            </div>
            <ResizeHandle direction="horizontal" onResize={resizeSidebar} />
          </>
        )}

        {/* Center: Editor + Terminal */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            const path = e.dataTransfer.getData('text/plain')
            if (path) { e.preventDefault(); setSelectedFile(path) }
          }}
        >
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
            {diffFile ? (
              <DiffView filePath={diffFile} onClose={() => setDiffFile(null)} />
            ) : activePanel === 'git' ? (
              <GitGraph />
            ) : (
              <>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <Editor filePath={selectedFile} onCursorChange={(l, c, lang) => setCursor({ line: l, col: c, lang })}
                    onAskAI={(prompt) => { import('../wailsjs/go/main/App').then(m => m.SendMessage(prompt)) }}
                    onEditorReady={view => { editorViewRef.current = view }} />
                </div>
                {splitFile && !previewUrl && (
                  <>
                    <div style={{ width: 3, background: 'transparent', borderLeft: '1px solid var(--border)', cursor: 'col-resize' }} />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <Editor filePath={splitFile} onCursorChange={(l, c, lang) => setCursor({ line: l, col: c, lang })}
                        onAskAI={(prompt) => { import('../wailsjs/go/main/App').then(m => m.SendMessage(prompt)) }} />
                    </div>
                  </>
                )}
                {previewUrl && (
                  <>
                    <div style={{ width: 3, background: 'transparent', borderLeft: '1px solid var(--border)' }} />
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        height: 32, background: 'var(--bg-activity)', display: 'flex', alignItems: 'center',
                        padding: '0 12px', gap: 8, borderBottom: '1px solid var(--border)', fontSize: 12,
                      }}>
                        <span style={{ color: 'var(--success)', fontSize: 10 }}>●</span>
                        <input value={previewUrl} onChange={e => setPreviewUrl(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const f = document.getElementById('preview-frame') as HTMLIFrameElement
                              if (f) f.src = previewUrl || ''
                            }
                          }}
                          style={{
                            flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border)',
                            borderRadius: 4, padding: '2px 8px', color: 'var(--fg-primary)',
                            fontFamily: 'var(--font-code)', fontSize: 11, outline: 'none',
                          }}
                        />
                        <button title="Reload" onClick={() => {
                          const f = document.getElementById('preview-frame') as HTMLIFrameElement
                          if (f) f.src = previewUrl || ''
                        }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-dim)', fontSize: 13 }}>↻</button>
                        <button title="Close preview" onClick={() => setPreviewUrl(null)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-dim)', fontSize: 14
                        }}>×</button>
                      </div>
                      <iframe id="preview-frame" src={previewUrl} style={{
                        flex: 1, border: 'none', background: '#fff', width: '100%',
                      }} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          {/* Problems Strip — LSP diagnostics + hash-anchor status */}
          <ProblemsStrip filePath={selectedFile} />
          {/* Terminal toggle bar */}
          <div onClick={() => setShowTerminal(t => !t)} style={{
            height: 22, background: 'var(--bg-activity)', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', padding: '0 12px', cursor: 'pointer',
            fontSize: 10, color: 'var(--fg-muted)', gap: 6, flexShrink: 0,
          }}>
            <span style={{ fontSize: 8 }}>{showTerminal ? '▼' : '▶'}</span>
            Terminal
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-code)', fontSize: 9, color: 'var(--fg-dim)' }}>⌘J</span>
          </div>
          {showTerminal && (
            <>
              <ResizeHandle direction="vertical" onResize={resizeTerminal} />
              <div style={{ height: terminalHeight, flexShrink: 0, overflow: 'hidden' }}>
                <Terminal />
              </div>
            </>
          )}
        </div>

        {/* Chat resize handle + panel */}
        <ResizeHandle direction="horizontal" onResize={resizeChat} />
        <div style={{
          width: chatWidth, flexShrink: 0,
          background: 'var(--bg-panel)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
        }}>
          <ChatPanel mode={mode} onModeChange={setMode} model={currentModel} />
        </div>
      </div>

      <StatusBar line={cursor.line} col={cursor.col} lang={cursor.lang}
        onGitClick={() => setActivePanel('git')}
        onSettingsClick={() => setShowSettings(true)} />

      <ThemePicker open={showTheme} onClose={() => setShowTheme(false)} />
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
      <QuickOpen open={showQuickOpen} onClose={() => setShowQuickOpen(false)} onSelect={setSelectedFile} />
      <ToastContainer />
      <AboutDialog open={showAbout} onClose={() => setShowAbout(false)} />
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        actions={{
          openFiles: () => setActivePanel('files'),
          openSearch: () => setActivePanel('search'),
          openGit: () => setActivePanel('git'),
          openSettings: () => setShowSettings(true),
          openTheme: () => setShowTheme(true),
          toggleTerminal: () => setShowTerminal(t => !t),
          openQuickOpen: () => setShowQuickOpen(true),
          clearChat: () => { import('../wailsjs/go/main/App').then(m => m.ClearChat()) },
          exportChat: () => { import('../wailsjs/go/main/App').then(m => m.ExportChat()) },
          openFolder: () => { import('../wailsjs/go/main/App').then(m => m.OpenFolder().then(d => { if(d) window.location.reload() })) },
          toggleSplit: () => setSplitFile(prev => prev ? null : selectedFile),
          openPreview: (url: string) => setPreviewUrl(url),
          setMode: (m: 'super' | 'deep' | 'plan') => setMode(m),
          undoLastEdit: async () => {
            try {
              const mod: any = await import('../wailsjs/go/main/App')
              if (typeof mod.UndoLastEdit !== 'function') {
                const t = await import('./components/Toast')
                t.showToast('Undo binding pending — Wails dev required', 'info')
                return
              }
              const path = await mod.UndoLastEdit()
              const t = await import('./components/Toast')
              t.showToast(`Reverted ${path}`, 'success')
            } catch (e: any) {
              const t = await import('./components/Toast')
              t.showToast(`Undo failed: ${e?.message || 'no edit to undo'}`, 'info')
            }
          },
          showPanel: (panel: string) => setActivePanel(panel),
        }}
      />
    </div>
  )
}

export default App
