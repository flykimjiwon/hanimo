import { useEffect, useRef, useState } from 'react'
import { Cpu, ChevronDown, RefreshCw, Search } from 'lucide-react'

interface ModelOption {
  id: string
  label: string
  provider?: string
  tier?: 'T1' | 'T2' | 'T3'
  group?: string
  hint?: string
}

interface Props {
  model: string
  onSelect?: (modelID: string) => void
}

/**
 * Tier mapping fallback when GetAvailableModels isn't reachable.
 */
function inferTier(model: string): 'T1' | 'T2' | 'T3' | null {
  const m = model.toLowerCase()
  if (!m) return null
  if (
    m.includes('claude-sonnet-4') ||
    m.includes('claude-opus') ||
    m.includes('gpt-5') ||
    m.includes('gemini-2.5-pro') ||
    m.includes('qwen3-coder-30b') ||
    m.includes('gpt-oss-120b')
  ) return 'T1'
  if (
    m.includes('llama-3.3') ||
    m.includes('deepseek') ||
    m.includes('mistral') ||
    m.includes('gemma-4') ||
    m.includes('gemini-2.5-flash')
  ) return 'T2'
  return 'T3'
}

function prettify(model: string): string {
  if (!model) return 'no model'
  const last = model.includes('/') ? model.split('/').pop()! : model
  return last.replace(/-a\d+b-instruct$/i, '').replace(/-instruct$/i, '')
}

export default function ProviderChip({ model, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<ModelOption[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const tier = inferTier(model)
  const display = prettify(model)

  function fetch() {
    setLoading(true)
    import('../../wailsjs/go/main/App').then(mod => {
      const fn = (mod as any).GetAvailableModels
      if (typeof fn !== 'function') { setLoading(false); return }
      fn().then((res: ModelOption[] | null) => {
        setModels(Array.isArray(res) ? res : [])
        setLoading(false)
      }).catch(() => setLoading(false))
    }).catch(() => setLoading(false))
  }

  // Open: fetch once. Close: reset filter.
  useEffect(() => {
    if (open) {
      fetch()
    } else {
      setFilter('')
    }
  }, [open])

  // Click outside to close
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  const filtered = filter
    ? models.filter(m => (m.label + ' ' + (m.provider || '') + ' ' + (m.id || '')).toLowerCase().includes(filter.toLowerCase()))
    : models

  // Group by m.group (Certified · Supported · Discovered)
  const grouped = filtered.reduce<Record<string, ModelOption[]>>((acc, m) => {
    const g = m.group || 'Other'
    if (!acc[g]) acc[g] = []
    acc[g].push(m)
    return acc
  }, {})

  function pick(m: ModelOption) {
    setOpen(false)
    onSelect?.(m.id)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={onSelect ? 'Switch model' : model}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: open ? 'var(--bg-active)' : 'var(--bg-base)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--fg-primary)',
          cursor: onSelect ? 'pointer' : 'default',
          fontFamily: 'var(--font-ui)',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <Cpu size={11} style={{ color: 'var(--fg-muted)' }} />
        <span>{display}</span>
        {tier && (
          <span style={{
            background: 'var(--accent-glow)', color: 'var(--accent)',
            padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700,
          }}>
            {tier}
          </span>
        )}
        {onSelect && (
          <ChevronDown
            size={11}
            style={{
              color: 'var(--fg-muted)',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s',
            }}
          />
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          width: 320,
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
          zIndex: 200,
          maxHeight: 420,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
          }}>
            <Search size={12} style={{ color: 'var(--fg-muted)' }} />
            <input
              autoFocus
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter models…"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'var(--fg-primary)',
                fontSize: 12,
                fontFamily: 'var(--font-ui)',
              }}
            />
            <button
              onClick={fetch}
              title="Refresh (re-poll Ollama tags)"
              aria-label="Refresh model list"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--fg-muted)', padding: 0, display: 'flex',
              }}
            >
              <RefreshCw size={12} className={loading ? 'spin' : ''} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {loading && (
              <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-dim)' }}>Loading…</div>
            )}
            {!loading && Object.keys(grouped).length === 0 && (
              <div style={{ padding: '12px', fontSize: 11, color: 'var(--fg-dim)' }}>
                No models. Ensure Ollama is running or set HANIMO_API_BASE_URL.
              </div>
            )}
            {Object.keys(grouped).map(g => (
              <div key={g}>
                <div style={{
                  padding: '6px 12px 2px',
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'var(--fg-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  {g}
                </div>
                {grouped[g].map(m => {
                  const active = m.id === model
                  return (
                    <button
                      key={m.id}
                      onClick={() => pick(m)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 12px',
                        background: active ? 'var(--bg-active)' : 'none',
                        border: 'none',
                        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                        cursor: 'pointer',
                        color: active ? 'var(--fg-primary)' : 'var(--fg-secondary)',
                        fontSize: 12.5,
                        fontFamily: 'var(--font-ui)',
                      }}
                      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                    >
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.label}
                      </span>
                      {m.tier && (
                        <span style={{
                          background: 'var(--accent-glow)', color: 'var(--accent)',
                          padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700,
                        }}>
                          {m.tier}
                        </span>
                      )}
                      {m.hint && (
                        <span style={{ fontSize: 9.5, color: 'var(--fg-dim)' }}>{m.hint}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
