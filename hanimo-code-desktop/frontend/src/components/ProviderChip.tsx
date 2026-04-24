import { Cpu, ChevronDown } from 'lucide-react'

interface Props {
  model: string
  onClick?: () => void
}

/**
 * Tier mapping (mirrors docs/strategy/hanimo-certified-models-v0.2.4.md).
 * Returns 'T1' | 'T2' | 'T3' | null when unknown.
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

/**
 * Shorten long model ids like "qwen/qwen3-coder-30b-a3b-instruct" to "qwen3-coder-30b".
 */
function prettify(model: string): string {
  if (!model) return 'no model'
  const last = model.includes('/') ? model.split('/').pop()! : model
  return last.replace(/-a\d+b-instruct$/i, '').replace(/-instruct$/i, '')
}

export default function ProviderChip({ model, onClick }: Props) {
  const tier = inferTier(model)
  const display = prettify(model)

  return (
    <button
      type="button"
      onClick={onClick}
      title="Click to switch model (Phase 2 — coming soon)"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: 'var(--bg-base)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--fg-primary)',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'var(--font-ui)',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => {
        if (onClick) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
      }}
    >
      <Cpu size={11} style={{ color: 'var(--fg-muted)' }} />
      <span>{display}</span>
      {tier && (
        <span
          style={{
            background: 'var(--accent-glow)',
            color: 'var(--accent)',
            padding: '1px 5px',
            borderRadius: 3,
            fontSize: 9,
            fontWeight: 700,
          }}
        >
          {tier}
        </span>
      )}
      {onClick && <ChevronDown size={11} style={{ color: 'var(--fg-muted)' }} />}
    </button>
  )
}
