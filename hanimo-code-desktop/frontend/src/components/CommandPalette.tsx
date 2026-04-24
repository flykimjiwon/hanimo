import { useState, useEffect, useRef } from 'react'
import {
  Search,
  Files,
  GitBranch,
  Settings,
  Palette,
  Terminal,
  BookOpen,
  Download,
  Trash2,
  FolderOpen,
  SplitSquareHorizontal,
  Globe,
  Sparkles,
  BrainCircuit,
  Lock,
  Undo2,
  TriangleAlert,
  Sparkle,
  PlugZap,
  Share2,
  History,
  ShieldCheck,
} from 'lucide-react'
import { modKey } from '../utils'

interface Command {
  id: string
  label: string
  group?: string
  shortcut?: string
  icon: any
  action: () => void
}

interface Props {
  open: boolean
  onClose: () => void
  actions: {
    openFiles: () => void
    openSearch: () => void
    openGit: () => void
    openSettings: () => void
    openTheme: () => void
    toggleTerminal: () => void
    openQuickOpen: () => void
    clearChat: () => void
    exportChat: () => void
    openFolder: () => void
    toggleSplit: () => void
    openPreview?: (url: string) => void
    setMode?: (mode: 'super' | 'deep' | 'plan') => void
    undoLastEdit?: () => void
    showPanel?: (panel: string) => void
  }
}

export default function CommandPalette({ open, onClose, actions }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands: Command[] = [
    // ── Navigation ──────────────────────────────────────────────────────
    { id: 'quick-open', label: 'Go to File', group: 'Navigate', shortcut: `${modKey}+P`, icon: Search, action: () => { onClose(); actions.openQuickOpen() } },
    { id: 'open-folder', label: 'Open Folder', group: 'Navigate', shortcut: `${modKey}+O`, icon: FolderOpen, action: () => { onClose(); actions.openFolder() } },
    { id: 'explorer', label: 'Show Explorer', group: 'Navigate', shortcut: `${modKey}+1`, icon: Files, action: () => { onClose(); actions.openFiles() } },
    { id: 'search', label: 'Search in Files', group: 'Navigate', shortcut: `${modKey}+Shift+F`, icon: Search, action: () => { onClose(); actions.openSearch() } },
    { id: 'git', label: 'Show Git', group: 'Navigate', shortcut: `${modKey}+3`, icon: GitBranch, action: () => { onClose(); actions.openGit() } },
    { id: 'terminal', label: 'Toggle Terminal', group: 'Navigate', shortcut: `${modKey}+J`, icon: Terminal, action: () => { onClose(); actions.toggleTerminal() } },
    { id: 'split', label: 'Split Editor', group: 'Navigate', shortcut: `${modKey}+\\`, icon: SplitSquareHorizontal, action: () => { onClose(); actions.toggleSplit() } },

    // ── Agent ───────────────────────────────────────────────────────────
    { id: 'mode-super', label: 'Set Mode: Super (가벼운 코딩)', group: 'Agent', icon: Sparkles, action: () => { onClose(); actions.setMode?.('super') } },
    { id: 'mode-deep', label: 'Set Mode: Deep (자율 200회)', group: 'Agent', icon: BrainCircuit, action: () => { onClose(); actions.setMode?.('deep') } },
    { id: 'mode-plan', label: 'Set Mode: Plan (읽기 전용)', group: 'Agent', icon: Lock, action: () => { onClose(); actions.setMode?.('plan') } },
    { id: 'undo-edit', label: 'Undo Last AI Edit (↺)', group: 'Agent', icon: Undo2, action: () => { onClose(); actions.undoLastEdit?.() } },

    // ── Activity panels (Phase 5+ contents) ─────────────────────────────
    { id: 'panel-problems', label: 'Show LSP Problems', group: 'Panels', icon: TriangleAlert, action: () => { onClose(); actions.showPanel?.('problems') } },
    { id: 'panel-knowledge', label: 'Show Knowledge Packs', group: 'Panels', icon: BookOpen, action: () => { onClose(); actions.showPanel?.('knowledge') } },
    { id: 'panel-skills', label: 'Show Skills', group: 'Panels', icon: Sparkle, action: () => { onClose(); actions.showPanel?.('skills') } },
    { id: 'panel-mcp', label: 'Show MCP Servers', group: 'Panels', icon: PlugZap, action: () => { onClose(); actions.showPanel?.('mcp') } },
    { id: 'panel-subagents', label: 'Show Subagents', group: 'Panels', icon: Share2, action: () => { onClose(); actions.showPanel?.('subagents') } },
    { id: 'panel-sessions', label: 'Show Sessions', group: 'Panels', icon: History, action: () => { onClose(); actions.showPanel?.('sessions') } },
    { id: 'panel-permissions', label: 'Show Permissions', group: 'Panels', icon: ShieldCheck, action: () => { onClose(); actions.showPanel?.('permissions') } },

    // ── Workspace ───────────────────────────────────────────────────────
    { id: 'theme', label: 'Change Theme', group: 'Workspace', shortcut: `${modKey}+,`, icon: Palette, action: () => { onClose(); actions.openTheme() } },
    { id: 'settings', label: 'Open Settings', group: 'Workspace', icon: Settings, action: () => { onClose(); actions.openSettings() } },
    { id: 'preview', label: 'Open Preview (localhost:3000)', group: 'Workspace', icon: Globe, action: () => { onClose(); actions.openPreview?.('http://localhost:3000') } },
    { id: 'export-chat', label: 'Export Chat', group: 'Workspace', icon: Download, action: () => { onClose(); actions.exportChat() } },
    { id: 'clear-chat', label: 'Clear Chat', group: 'Workspace', icon: Trash2, action: () => { onClose(); actions.clearChat() } },
  ]

  // Multi-token AND fuzzy: every whitespace-separated token must appear in the label.
  // Lets users type "set deep" or "show mcp" without ordering the words exactly.
  const filtered = (() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    const tokens = q.split(/\s+/)
    return commands.filter(c => {
      const haystack = (c.label + ' ' + (c.group || '')).toLowerCase()
      return tokens.every(t => haystack.includes(t))
    })
  })()

  useEffect(() => {
    if (open) { setQuery(''); setSelected(0); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [open])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && filtered[selected]) filtered[selected].action()
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', paddingTop: 80,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 500, background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        overflow: 'hidden', maxHeight: 400,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ color: 'var(--fg-dim)', fontSize: 12 }}>&gt;</span>
          <input ref={inputRef}
            value={query} onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--fg-primary)', fontSize: 14, fontFamily: 'var(--font-ui)',
            }}
          />
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {filtered.map((cmd, i) => (
            <div key={cmd.id} onClick={cmd.action} style={{
              padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', fontSize: 13,
              background: i === selected ? 'var(--bg-active)' : 'transparent',
              color: i === selected ? 'var(--fg-primary)' : 'var(--fg-secondary)',
            }}
            onMouseEnter={() => setSelected(i)}
            >
              <cmd.icon size={15} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{cmd.label}</span>
              {cmd.shortcut && (
                <span style={{
                  fontSize: 10, color: 'var(--fg-dim)', fontFamily: 'var(--font-code)',
                  background: 'var(--bg-active)', padding: '2px 6px', borderRadius: 4,
                }}>{cmd.shortcut}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
