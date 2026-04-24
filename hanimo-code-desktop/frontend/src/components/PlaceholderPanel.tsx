import type { LucideIcon } from 'lucide-react'

interface Props {
  title: string
  Icon: LucideIcon
  shortDesc: string
  bullets?: string[]
  /** 'Phase 6' / 'Phase 7' etc. — when this feature lights up. */
  comingIn?: string
}

/**
 * PlaceholderPanel — shared scaffolding for activity panels whose backend
 * isn't wired yet (MCP / Skills / Subagents / Permissions). Keeps the
 * sidebar UX consistent and tells the user when the feature is expected.
 */
export default function PlaceholderPanel({ title, Icon, shortDesc, bullets, comingIn }: Props) {
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
        <Icon size={14} style={{ color: 'var(--accent)' }} />
        <span style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
          color: 'var(--fg-muted)',
        }}>
          {title}
        </span>
        {comingIn && (
          <span style={{
            marginLeft: 'auto',
            fontSize: 9,
            fontWeight: 700,
            background: 'var(--accent-glow)',
            color: 'var(--accent)',
            padding: '1px 6px',
            borderRadius: 3,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {comingIn}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        <p style={{ fontSize: 12.5, color: 'var(--fg-secondary)', lineHeight: 1.55, margin: 0 }}>
          {shortDesc}
        </p>
        {bullets && bullets.length > 0 && (
          <ul style={{
            margin: '12px 0 0',
            padding: 0,
            listStyle: 'none',
            fontSize: 12,
            color: 'var(--fg-muted)',
            lineHeight: 1.65,
          }}>
            {bullets.map((b, i) => (
              <li key={i} style={{ display: 'flex', gap: 6, padding: '2px 0' }}>
                <span style={{ color: 'var(--accent)' }}>•</span>
                <span style={{ flex: 1 }}>{b}</span>
              </li>
            ))}
          </ul>
        )}
        <div style={{
          marginTop: 18,
          padding: '8px 10px',
          background: 'var(--bg-hover)',
          borderRadius: 4,
          borderLeft: '2px solid var(--accent)',
          fontSize: 11,
          color: 'var(--fg-muted)',
          lineHeight: 1.5,
        }}>
          이 패널은 아직 데이터 소스가 연결되지 않았습니다. {comingIn ? `${comingIn}에서 활성화됩니다.` : '구현 예정'}
        </div>
      </div>
    </div>
  )
}
