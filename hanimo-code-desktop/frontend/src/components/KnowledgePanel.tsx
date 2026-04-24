import { useEffect, useState } from 'react'
import { BookOpen, RefreshCw } from 'lucide-react'
import { GetKnowledgePacks, ToggleKnowledgePack } from '../../wailsjs/go/main/App'

interface Pack {
  id: string
  name: string
  category: string
  enabled: boolean
}

export default function KnowledgePanel() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const fetch = () => {
    setLoading(true)
    GetKnowledgePacks()
      .then(p => setPacks(p || []))
      .catch(() => setPacks([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch()
  }, [])

  function toggle(p: Pack) {
    const next = !p.enabled
    setPacks(prev => prev.map(x => x.id === p.id ? { ...x, enabled: next } : x))
    ToggleKnowledgePack(p.id, next).catch(() => {
      // revert on failure
      setPacks(prev => prev.map(x => x.id === p.id ? { ...x, enabled: !next } : x))
    })
  }

  const filtered = filter
    ? packs.filter(p => (p.name + ' ' + p.category).toLowerCase().includes(filter.toLowerCase()))
    : packs

  // Group by category
  const grouped = filtered.reduce<Record<string, Pack[]>>((acc, p) => {
    const cat = p.category || 'Misc'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  const enabledCount = packs.filter(p => p.enabled).length

  return (
    <div style={{
      height: '100%',
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <BookOpen size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)' }}>
          Knowledge Packs
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-dim)' }}>
          {enabledCount} / {packs.length}
        </span>
        <button onClick={fetch} title="Refresh" aria-label="Refresh" style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)',
          padding: 0, display: 'flex',
        }}>
          <RefreshCw size={12} />
        </button>
      </div>

      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Filter packs…"
        style={{
          margin: '8px 12px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '4px 8px',
          color: 'var(--fg-primary)',
          fontSize: 12,
          fontFamily: 'var(--font-ui)',
          outline: 'none',
        }}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 14px' }}>
        {loading && (
          <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--fg-dim)' }}>Loading…</div>
        )}
        {!loading && packs.length === 0 && (
          <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--fg-dim)' }}>
            No knowledge packs found. Set HANIMO_KNOWLEDGE or place docs at ../hanimo-code/knowledge/docs.
          </div>
        )}
        {Object.keys(grouped).sort().map(cat => (
          <div key={cat}>
            <div style={{
              padding: '6px 14px 2px',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--fg-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {cat}
              <span style={{ marginLeft: 6, color: 'var(--fg-dim)', fontWeight: 400 }}>
                ({grouped[cat].length})
              </span>
            </div>
            {grouped[cat].map(p => (
              <button
                key={p.id}
                onClick={() => toggle(p)}
                title={p.id}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: p.enabled ? 'var(--fg-primary)' : 'var(--fg-secondary)',
                  fontSize: 12.5,
                  fontFamily: 'var(--font-ui)',
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
              >
                <span style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  border: `1px solid ${p.enabled ? 'var(--accent)' : 'var(--fg-dim)'}`,
                  background: p.enabled ? 'var(--accent)' : 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {p.enabled && (
                    <span style={{ color: 'var(--accent-text, #1a1410)', fontSize: 9, lineHeight: 1, fontWeight: 700 }}>✓</span>
                  )}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
