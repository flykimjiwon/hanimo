import { useEffect, useState } from 'react'
import { Sparkle, RefreshCw } from 'lucide-react'

interface Skill {
  name: string
  description: string
  path: string
  source: 'project' | 'global'
}

export default function SkillsPanel() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const fetch = () => {
    setLoading(true)
    import('../../wailsjs/go/main/App').then(mod => {
      const fn = (mod as any).GetSkills
      if (typeof fn !== 'function') { setLoading(false); return }
      fn().then((res: Skill[] | null) => {
        setSkills(Array.isArray(res) ? res : [])
        setLoading(false)
      }).catch(() => setLoading(false))
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetch() }, [])

  function run(s: Skill) {
    // Insert /skill <name> into the chat input area as a hint. The actual
    // skill body load + invocation is the agent's job once /skill triggers.
    import('../../wailsjs/go/main/App').then((mod: any) => {
      if (typeof mod.SendMessage === 'function') {
        mod.SendMessage(`/skill ${s.name}`)
        import('./Toast').then(t => t.showToast(`Invoking skill: ${s.name}`, 'success'))
      }
    }).catch(() => {})
  }

  const filtered = filter
    ? skills.filter(s => (s.name + ' ' + s.description).toLowerCase().includes(filter.toLowerCase()))
    : skills

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
        <Sparkle size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)' }}>
          Skills
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-dim)' }}>
          {skills.length}
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
        placeholder="Filter skills…"
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
        {!loading && skills.length === 0 && (
          <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--fg-dim)', lineHeight: 1.55 }}>
            아직 등록된 skill이 없습니다.<br />
            <code style={{
              fontSize: 10.5, background: 'var(--bg-active)', padding: '1px 4px', borderRadius: 3,
              color: 'var(--accent)',
            }}>.hanimo/skills/&lt;name&gt;/SKILL.md</code> 또는 <code style={{
              fontSize: 10.5, background: 'var(--bg-active)', padding: '1px 4px', borderRadius: 3,
              color: 'var(--accent)',
            }}>~/.hanimo/skills/</code>에 추가하세요.
          </div>
        )}
        {filtered.map(s => (
          <button
            key={s.path}
            onClick={() => run(s)}
            title={s.path}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                color: 'var(--fg-primary)', fontSize: 12.5, fontWeight: 500,
                flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.name}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700,
                background: s.source === 'project' ? 'var(--accent-glow)' : 'var(--bg-active)',
                color: s.source === 'project' ? 'var(--accent)' : 'var(--fg-muted)',
                padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {s.source}
              </span>
            </div>
            {s.description && (
              <span style={{
                fontSize: 10.5, color: 'var(--fg-muted)', lineHeight: 1.45,
                display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
                overflow: 'hidden',
              }}>
                {s.description}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
