import { useState, useEffect } from 'react'
import { Settings, X, Save, Check, Key, EyeOff, Eye, ExternalLink, Flag } from 'lucide-react'
import { GetSettings, SaveSettings, SetLanguage } from '../../wailsjs/go/main/App'

interface Props {
  open: boolean
  onClose: () => void
}

interface ProviderEntry {
  name: string
  label: string
  baseUrl: string
  envVar: string
  openaiCompatible: boolean
  hasKey: boolean
  keyHint: string
}

export default function SettingsPanel({ open, onClose }: Props) {
  const [baseURL, setBaseURL] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [saved, setSaved] = useState(false)
  const [language, setLanguageState] = useState('korean')
  const [customLang, setCustomLang] = useState('')
  const [providers, setProviders] = useState<ProviderEntry[]>([])
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({})
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [koreaMCP, setKoreaMCP] = useState<{ name: string; category: string; description: string; url: string; stack: string }[]>([])
  const [koreaMCPFilter, setKoreaMCPFilter] = useState('')

  function reloadProviders() {
    import('../../wailsjs/go/main/App').then((mod: any) => {
      if (typeof mod.GetProviders === 'function') {
        mod.GetProviders().then((rows: ProviderEntry[] | null) => {
          setProviders(Array.isArray(rows) ? rows : [])
        }).catch(() => {})
      }
    }).catch(() => {})
  }

  useEffect(() => {
    if (open) {
      GetSettings().then(s => {
        setBaseURL(s.baseURL || '')
        setApiKey(s.apiKey || '')
        setModel(s.model || '')
        const lang = s.language || 'korean'
        setLanguageState(lang)
        if (!['korean', 'english'].includes(lang)) setCustomLang(lang)
        setSaved(false)
      }).catch(() => {})
      reloadProviders()
      setProviderKeys({})
      // Korea MCP catalog (Phase 19)
      import('../../wailsjs/go/main/App').then((mod: any) => {
        if (typeof mod.GetKoreaMCPCatalog === 'function') {
          mod.GetKoreaMCPCatalog().then((rows: any[] | null) => {
            setKoreaMCP(Array.isArray(rows) ? rows : [])
          }).catch(() => {})
        }
      }).catch(() => {})
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])

  async function handleSave() {
    try {
      await SaveSettings(baseURL, apiKey, model)
      const lang = language === 'custom' ? customLang : language
      await SetLanguage(lang)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      import('./Toast').then(m => m.showToast('Save failed: ' + err, 'info'))
    }
  }

  async function saveProvider(name: string) {
    const key = providerKeys[name]
    if (!key) return
    const mod: any = await import('../../wailsjs/go/main/App')
    if (typeof mod.SaveProviderConfig !== 'function') {
      import('./Toast').then(t => t.showToast('Binding pending — wails dev', 'info'))
      return
    }
    try {
      await mod.SaveProviderConfig(name, key, '')
      setProviderKeys(prev => ({ ...prev, [name]: '' }))
      reloadProviders()
      import('./Toast').then(t => t.showToast(`Saved ${name} key`, 'success'))
    } catch (e: any) {
      import('./Toast').then(t => t.showToast(`Save failed: ${e?.message || 'unknown'}`, 'info'))
    }
  }

  async function clearProvider(name: string) {
    const mod: any = await import('../../wailsjs/go/main/App')
    if (typeof mod.ClearProviderKey !== 'function') return
    try {
      await mod.ClearProviderKey(name)
      reloadProviders()
      import('./Toast').then(t => t.showToast(`Cleared ${name} key`, 'success'))
    } catch (e: any) {
      import('./Toast').then(t => t.showToast(`Clear failed: ${e?.message || 'unknown'}`, 'info'))
    }
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 24, width: 600, maxHeight: '85vh',
        boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>Settings</span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', padding: 4
          }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
          {/* Active provider — single endpoint (legacy single-provider override) */}
          <Section title="Active endpoint" hint="현재 활성 프로바이더의 base_url + api_key. 모델 드롭다운에서 모델을 고르면 자동 채워집니다.">
            <Field label="API Base URL" value={baseURL} onChange={setBaseURL} placeholder="https://api.novita.ai/v3/openai" />
            <Field label="API Key" value={apiKey} onChange={setApiKey} placeholder="sk-..." type="password" />
            <Field label="Model" value={model} onChange={setModel} placeholder="qwen3-coder-30b" />
          </Section>

          {/* Multi-provider keys (Phase 15b) */}
          <Section
            title={`Provider keys (${providers.filter(p => p.hasKey).length} / ${providers.length})`}
            hint="프로바이더별 키를 저장해두면 모델 드롭다운에서 클릭만으로 바로 전환됩니다. 키는 ~/.hanimo/config.yaml의 providers.<name>.api_key에 저장됩니다."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {providers.map(p => {
                const entered = providerKeys[p.name] || ''
                const visible = !!showKey[p.name]
                const noKeyNeeded = !p.envVar
                return (
                  <div key={p.name} style={{
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '8px 10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: noKeyNeeded ? 0 : 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-primary)' }}>{p.label}</span>
                      {p.hasKey ? (
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          background: 'var(--success, #3fb950)', color: '#000',
                          padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>ready</span>
                      ) : (
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          background: 'var(--bg-active)', color: 'var(--fg-muted)',
                          padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>{noKeyNeeded ? 'local' : 'no key'}</span>
                      )}
                      {!p.openaiCompatible && (
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          background: 'var(--bg-active)', color: 'var(--fg-muted)',
                          padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>native API</span>
                      )}
                      <span style={{ flex: 1 }} />
                      {p.keyHint && (
                        <a href={p.keyHint.match(/https?:\/\/\S+/)?.[0] || '#'}
                          target="_blank" rel="noreferrer"
                          title={p.keyHint}
                          style={{ color: 'var(--fg-dim)', display: 'flex' }}
                          onClick={e => {
                            const url = p.keyHint.match(/https?:\/\/\S+/)?.[0]
                            if (!url) e.preventDefault()
                          }}
                        >
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    {!noKeyNeeded && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <input
                            value={entered}
                            onChange={e => setProviderKeys(prev => ({ ...prev, [p.name]: e.target.value }))}
                            placeholder={p.hasKey ? '•••••• (saved — type to replace)' : `paste key (env: $${p.envVar})`}
                            type={visible ? 'text' : 'password'}
                            style={{
                              width: '100%',
                              padding: '5px 28px 5px 8px',
                              borderRadius: 4,
                              background: 'var(--bg-panel)',
                              border: '1px solid var(--border)',
                              color: 'var(--fg-primary)',
                              fontSize: 11.5,
                              fontFamily: 'var(--font-code)',
                              outline: 'none',
                            }}
                            onKeyDown={e => { if (e.key === 'Enter' && entered) saveProvider(p.name) }}
                          />
                          <button
                            onClick={() => setShowKey(prev => ({ ...prev, [p.name]: !visible }))}
                            tabIndex={-1}
                            style={{
                              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--fg-dim)', padding: 2, display: 'flex',
                            }}
                          >
                            {visible ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                        </div>
                        <button
                          onClick={() => saveProvider(p.name)}
                          disabled={!entered}
                          style={{
                            padding: '4px 10px',
                            background: entered ? 'var(--accent)' : 'var(--bg-active)',
                            color: entered ? '#000' : 'var(--fg-dim)',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: entered ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', gap: 3,
                          }}
                        >
                          <Key size={10} /> Save
                        </button>
                        {p.hasKey && (
                          <button
                            onClick={() => clearProvider(p.name)}
                            title="Clear stored key"
                            style={{
                              padding: '4px 8px',
                              background: 'none',
                              border: '1px solid var(--border)',
                              borderRadius: 4,
                              fontSize: 11,
                              color: 'var(--fg-muted)',
                              cursor: 'pointer',
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {providers.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--fg-dim)', padding: '6px 4px' }}>
                  Loading providers…
                </div>
              )}
            </div>
          </Section>

          {/* Phase 19 — Korea MCP catalog */}
          <Section
            title={`🇰🇷 Korea MCP catalog (${koreaMCP.length})`}
            hint="한국 시장 특화 MCP 서버 모음 (법률/공공데이터/금융/부동산/지도/관광/기상/한국어 NLP 등). 각 항목은 별도 GitHub 레포 — README의 install/env 따라 ~/.hanimo/config.yaml의 mcp.servers에 추가하면 채팅에서 바로 호출됩니다."
          >
            <input
              value={koreaMCPFilter}
              onChange={e => setKoreaMCPFilter(e.target.value)}
              placeholder="카테고리/이름/설명으로 검색…"
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 6,
                background: 'var(--bg-base)', border: '1px solid var(--border)',
                color: 'var(--fg-primary)', fontSize: 12, fontFamily: 'var(--font-ui)', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
              {(() => {
                const f = koreaMCPFilter.trim().toLowerCase()
                const filtered = f ? koreaMCP.filter(e =>
                  (e.name + ' ' + e.category + ' ' + e.description).toLowerCase().includes(f)
                ) : koreaMCP
                const groups: Record<string, typeof koreaMCP> = {}
                for (const e of filtered) (groups[e.category] ??= []).push(e)
                return Object.keys(groups).map(cat => (
                  <div key={cat}>
                    <div style={{
                      fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: 'var(--fg-dim)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Flag size={10} />
                      {cat} <span style={{ color: 'var(--fg-dim)', fontWeight: 500 }}>· {groups[cat].length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                      {groups[cat].map(e => (
                        <a
                          key={e.name}
                          href={e.url}
                          target="_blank"
                          rel="noreferrer"
                          title={e.description}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '4px 8px',
                            background: 'var(--bg-base)',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            textDecoration: 'none',
                            color: 'var(--fg-secondary)',
                            transition: 'border-color 0.1s, color 0.1s',
                          }}
                          onMouseEnter={ev => {
                            (ev.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--accent)'
                            ;(ev.currentTarget as HTMLAnchorElement).style.color = 'var(--fg-primary)'
                          }}
                          onMouseLeave={ev => {
                            (ev.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'
                            ;(ev.currentTarget as HTMLAnchorElement).style.color = 'var(--fg-secondary)'
                          }}
                        >
                          <span style={{
                            fontSize: 11.5, fontFamily: 'var(--font-code)', fontWeight: 500,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            flex: '0 1 auto',
                          }}>
                            {e.name}
                          </span>
                          <span style={{
                            fontSize: 9, fontWeight: 700, background: 'var(--bg-active)', color: 'var(--fg-muted)',
                            padding: '1px 4px', borderRadius: 2, textTransform: 'uppercase',
                          }}>
                            {e.stack}
                          </span>
                          <span style={{
                            fontSize: 11, color: 'var(--fg-muted)', flex: 1, minWidth: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {e.description}
                          </span>
                          <ExternalLink size={10} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} />
                        </a>
                      ))}
                    </div>
                  </div>
                ))
              })()}
              {koreaMCP.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--fg-dim)', padding: '6px 4px' }}>Loading catalog…</div>
              )}
            </div>
            <a
              href="https://github.com/darjeeling/awesome-mcp-korea"
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 10.5, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex',
                alignItems: 'center', gap: 4, marginTop: 4,
              }}
            >
              <ExternalLink size={10} /> 전체 목록 (awesome-mcp-korea)
            </a>
          </Section>

          {/* Language */}
          <Section title="AI response language" hint="대화 응답 언어. 코드는 항상 영문 식별자.">
            <div style={{ display: 'flex', gap: 6 }}>
              {['korean', 'english', 'custom'].map(opt => (
                <button key={opt} onClick={() => setLanguageState(opt)} style={{
                  flex: 1, padding: '6px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  background: language === opt ? 'var(--accent-glow)' : 'var(--bg-active)',
                  color: language === opt ? 'var(--accent)' : 'var(--fg-muted)',
                  border: language === opt ? '1px solid var(--accent)' : '1px solid var(--border)',
                }}>
                  {opt === 'korean' ? '한국어' : opt === 'english' ? 'English' : 'Custom'}
                </button>
              ))}
            </div>
            {language === 'custom' && (
              <input value={customLang} onChange={e => setCustomLang(e.target.value)}
                placeholder="e.g. Japanese, Chinese, Spanish..."
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6, marginTop: 6,
                  background: 'var(--bg-base)', border: '1px solid var(--border)',
                  color: 'var(--fg-primary)', fontSize: 12, fontFamily: 'var(--font-ui)', outline: 'none',
                }}
              />
            )}
          </Section>
        </div>

        <button onClick={handleSave} style={{
          marginTop: 16,
          padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: saved ? 'var(--success)' : 'var(--accent)',
          color: '#000', fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-ui)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'background 0.2s',
        }}>
          {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save & Reconnect</>}
        </button>

        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--fg-dim)', lineHeight: 1.6 }}>
          ~/.hanimo/config.yaml에 저장 (TUI와 공유). Provider key는 providers.&lt;name&gt;.api_key.
        </div>
      </div>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--fg-muted)', marginBottom: 6,
      }}>{title}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginBottom: 8, lineHeight: 1.5 }}>{hint}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 4, display: 'block' }}>{label}</label>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} type={type}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 6,
          background: 'var(--bg-base)', border: '1px solid var(--border)',
          color: 'var(--fg-primary)', fontSize: 13, fontFamily: 'var(--font-code)',
          outline: 'none', transition: 'border-color 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
    </div>
  )
}
