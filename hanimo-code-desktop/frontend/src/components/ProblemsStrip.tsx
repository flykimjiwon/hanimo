import { useEffect, useState } from 'react'
import { Bug, CircleX, TriangleAlert, Info, Lock } from 'lucide-react'

interface Problem {
  severity: 'error' | 'warning' | 'hint'
  message?: string
  line?: number
  col?: number
}

interface Props {
  /** Optional explicit problems (skips internal polling). */
  problems?: Problem[]
  /** When set, the component polls GetProblems(filePath) every 3s. */
  filePath?: string | null
  /** Active hash-anchor indicator — shows which line/anchor is currently locked for edit. */
  anchor?: { line: number; hash: string } | null
  /** LSP server label, e.g. 'gopls' · 'tsserver' · null if not attached. */
  lspServer?: string | null
  onClick?: (severity: 'error' | 'warning' | 'hint') => void
}

/**
 * ProblemsStrip — between editor and terminal.
 * Shows LSP diagnostic counts (errors/warnings/hints) and the currently locked
 * hash-anchor. Empty state "0 problems" when no diagnostics.
 */
export default function ProblemsStrip({ problems, filePath = null, anchor = null, lspServer = null, onClick }: Props) {
  const [polled, setPolled] = useState<Problem[]>([])

  // Poll Go GetProblems(filePath) every 3s when no explicit problems prop.
  useEffect(() => {
    if (problems !== undefined) return
    if (!filePath) { setPolled([]); return }
    let cancelled = false
    const fetch = () => {
      import('../../wailsjs/go/main/App').then(mod => {
        const fn = (mod as any).GetProblems
        if (typeof fn !== 'function') return
        fn(filePath).then((res: Problem[] | null) => {
          if (cancelled) return
          setPolled(Array.isArray(res) ? res : [])
        }).catch(() => {})
      }).catch(() => {})
    }
    fetch()
    const id = setInterval(fetch, 3000)
    return () => { cancelled = true; clearInterval(id) }
  }, [filePath, problems])

  const list = problems ?? polled
  const errorCount = list.filter(p => p.severity === 'error').length
  const warnCount = list.filter(p => p.severity === 'warning').length
  const hintCount = list.filter(p => p.severity === 'hint').length

  const pill = (severity: 'error' | 'warning' | 'hint', count: number, Icon: typeof CircleX, color: string) => {
    const active = count > 0
    return (
      <button
        type="button"
        onClick={() => onClick?.(severity)}
        disabled={!active}
        title={`${count} ${severity}${count === 1 ? '' : 's'}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          background: 'none',
          border: 'none',
          cursor: active ? 'pointer' : 'default',
          padding: 0,
          color: active ? color : 'var(--fg-muted)',
          fontFamily: 'var(--font-ui)',
          fontSize: 11,
          opacity: active ? 1 : 0.55,
        }}
      >
        <Icon size={12} />
        <span>{count}</span>
      </button>
    )
  }

  return (
    <div
      style={{
        background: 'var(--bg-activity)',
        borderTop: '1px solid var(--border)',
        padding: '4px 14px',
        display: 'flex',
        gap: 14,
        fontSize: 11,
        color: 'var(--fg-muted)',
        alignItems: 'center',
        fontFamily: 'var(--font-ui)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--fg-muted)' }}>
        <Bug size={12} />
        <span>Problems</span>
      </div>
      {pill('error', errorCount, CircleX, 'var(--error)')}
      {pill('warning', warnCount, TriangleAlert, 'var(--warning)')}
      {pill('hint', hintCount, Info, 'var(--accent)')}

      <div style={{ flex: 1 }} />

      {lspServer && (
        <span style={{ color: 'var(--success)', fontSize: 10 }}>
          ● {lspServer}
        </span>
      )}
      {anchor && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--accent)',
            fontFamily: 'var(--font-code)',
            fontSize: 10.5,
          }}
          title="Hash-anchored edit in progress — agent can't overwrite this file silently"
        >
          <Lock size={11} />
          <span>line {anchor.line} · {anchor.hash}</span>
        </div>
      )}
    </div>
  )
}
