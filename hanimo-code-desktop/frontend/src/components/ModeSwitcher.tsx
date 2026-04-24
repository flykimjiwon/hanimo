import { Sparkles, BrainCircuit, Lock } from 'lucide-react'

export type Mode = 'super' | 'deep' | 'plan'

interface Props {
  mode: Mode
  onChange: (m: Mode) => void
}

const items: { id: Mode; label: string; Icon: typeof Sparkles; tooltip: string }[] = [
  { id: 'super', label: 'Super', Icon: Sparkles, tooltip: '일반 코딩 · 도구 사용 허용' },
  { id: 'deep', label: 'Deep', Icon: BrainCircuit, tooltip: '자율 실행 최대 200회' },
  { id: 'plan', label: 'Plan', Icon: Lock, tooltip: '읽기 전용 · 계획 수립만' },
]

export default function ModeSwitcher({ mode, onChange }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-base)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: 2,
      }}
      role="radiogroup"
      aria-label="Agent mode"
    >
      {items.map(({ id, label, Icon, tooltip }) => {
        const on = mode === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            title={tooltip}
            onClick={() => onChange(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: 4,
              border: 'none',
              background: on ? 'var(--accent)' : 'transparent',
              color: on ? 'var(--accent-text, #1a1410)' : 'var(--fg-muted)',
              transition: 'background 0.15s, color 0.15s',
              fontFamily: 'var(--font-ui)',
            }}
            onMouseEnter={e => {
              if (!on) (e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-secondary)'
            }}
            onMouseLeave={e => {
              if (!on) (e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-muted)'
            }}
          >
            <Icon size={11} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
