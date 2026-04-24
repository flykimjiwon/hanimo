import { useEffect, useState } from 'react'
import { History, RefreshCw, Save } from 'lucide-react'
import { ListSessions, LoadSession, SaveSession } from '../../wailsjs/go/main/App'
import { showToast } from './Toast'

interface Session {
  id: string
  title: string
  createdAt: string
  messages: number
}

export default function SessionsPanel() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const fetch = () => {
    setLoading(true)
    ListSessions()
      .then(s => setSessions(s || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch()
  }, [])

  function load(id: string) {
    LoadSession(id)
      .then(() => showToast('Session loaded', 'success'))
      .catch(e => showToast(`Load failed: ${e?.message || 'unknown'}`, 'info'))
  }

  function save() {
    const title = prompt('Save current chat as session — title?')
    if (!title) return
    SaveSession(title)
      .then(() => { showToast('Saved', 'success'); fetch() })
      .catch(e => showToast(`Save failed: ${e?.message || 'unknown'}`, 'info'))
  }

  const filtered = filter
    ? sessions.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()))
    : sessions

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
        <History size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)' }}>
          Sessions
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-dim)' }}>
          {sessions.length}
        </span>
        <button onClick={save} title="Save current chat" aria-label="Save current chat" style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)',
          padding: 0, display: 'flex',
        }}>
          <Save size={12} />
        </button>
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
        placeholder="Filter sessions…"
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
        {!loading && sessions.length === 0 && (
          <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--fg-dim)' }}>
            No saved sessions yet. Save the current chat with the disk icon above.
          </div>
        )}
        {filtered.map(s => (
          <button
            key={s.id}
            onClick={() => load(s.id)}
            title={`${s.id} · ${s.createdAt}`}
            style={{
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: '6px 14px',
              background: 'none',
              border: 'none',
              borderLeft: '2px solid transparent',
              cursor: 'pointer',
              color: 'var(--fg-primary)',
              fontSize: 12.5,
              fontFamily: 'var(--font-ui)',
              transition: 'background 0.1s, border-color 0.1s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'
              ;(e.currentTarget as HTMLButtonElement).style.borderLeftColor = 'var(--accent)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'none'
              ;(e.currentTarget as HTMLButtonElement).style.borderLeftColor = 'transparent'
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.title}
            </span>
            <span style={{ fontSize: 10, color: 'var(--fg-dim)' }}>
              {s.messages} msgs · {s.createdAt}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
