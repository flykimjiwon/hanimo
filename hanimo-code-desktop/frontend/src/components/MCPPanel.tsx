import { useEffect, useState } from 'react'
import { PlugZap, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react'

interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, any>
}

interface MCPServer {
  name: string
  transport: string
  command?: string
  url?: string
  connected: boolean
  error?: string
  tools: MCPTool[]
}

export default function MCPPanel() {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const loadServers = () => {
    setLoading(true)
    import('../../wailsjs/go/main/App').then(mod => {
      const fn = (mod as any).GetMCPServers
      if (typeof fn !== 'function') { setLoading(false); return }
      fn().then((res: MCPServer[] | null) => {
        setServers(Array.isArray(res) ? res : [])
        setLoading(false)
      }).catch(() => setLoading(false))
    }).catch(() => setLoading(false))
  }

  const refresh = () => {
    setLoading(true)
    // Drop expansion state — server set may have changed, stale keys would
    // pin closed groups open against the wrong rows.
    setExpanded(new Set())
    import('../../wailsjs/go/main/App').then((mod: any) => {
      const fn = mod.RefreshMCPServers || mod.GetMCPServers
      fn().then((res: MCPServer[] | null) => {
        setServers(Array.isArray(res) ? res : [])
        setLoading(false)
        import('./Toast').then(t => t.showToast('MCP servers reloaded', 'success'))
      }).catch((e: any) => {
        setLoading(false)
        import('./Toast').then(t => t.showToast(`Reload failed: ${e?.message || 'unknown'}`, 'info'))
      })
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadServers() }, [])

  function toggle(name: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  function invoke(srv: MCPServer, tool: MCPTool) {
    // Drop a /mcp hint into the chat — the agent will pick it up and fill args.
    import('../../wailsjs/go/main/App').then((mod: any) => {
      if (typeof mod.SendMessage === 'function') {
        mod.SendMessage(`/mcp ${srv.name} ${tool.name}`)
        import('./Toast').then(t => t.showToast(`Invoking: ${srv.name}.${tool.name}`, 'success'))
      }
    }).catch(() => {})
  }

  const totalTools = servers.reduce((acc, s) => acc + (s.tools?.length || 0), 0)

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
        <PlugZap size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)' }}>
          MCP Servers
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-dim)' }}>
          {servers.length} · {totalTools} tool{totalTools === 1 ? '' : 's'}
        </span>
        <button onClick={refresh} title="Reload MCP config" aria-label="Refresh" style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)',
          padding: 0, display: 'flex',
        }}>
          <RefreshCw size={12} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 14px' }}>
        {loading && (
          <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--fg-dim)' }}>Loading…</div>
        )}

        {!loading && servers.length === 0 && (
          <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--fg-dim)', lineHeight: 1.55 }}>
            아직 MCP 서버가 설정되지 않았습니다.<br />
            <code style={{
              fontSize: 10.5, background: 'var(--bg-active)', padding: '1px 4px', borderRadius: 3,
              color: 'var(--accent)',
            }}>~/.hanimo/config.yaml</code>의 <code style={{
              fontSize: 10.5, background: 'var(--bg-active)', padding: '1px 4px', borderRadius: 3,
              color: 'var(--accent)',
            }}>mcp.servers</code>에 추가하세요.
          </div>
        )}

        {servers.map(srv => {
          const open = expanded.has(srv.name)
          const dot = srv.connected ? 'var(--success, #3fb950)' : (srv.error ? 'var(--error, #f85149)' : 'var(--fg-dim)')
          return (
            <div key={srv.name} style={{ borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={() => toggle(srv.name)}
                title={srv.command || srv.url || srv.transport}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px 6px 6px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {open ? <ChevronDown size={11} style={{ color: 'var(--fg-muted)' }} />
                      : <ChevronRight size={11} style={{ color: 'var(--fg-muted)' }} />}
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                <span style={{
                  color: 'var(--fg-primary)', fontSize: 12.5, fontWeight: 500,
                  flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {srv.name}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, background: 'var(--bg-active)', color: 'var(--fg-muted)',
                  padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {srv.transport}
                </span>
                <span style={{ fontSize: 10, color: 'var(--fg-dim)', marginLeft: 4 }}>
                  {srv.tools?.length ?? 0}
                </span>
              </button>

              {open && (
                <div style={{ padding: '0 10px 8px 22px' }}>
                  {srv.error && (
                    <div style={{
                      fontSize: 10.5,
                      color: 'var(--error, #f85149)',
                      background: 'var(--bg-hover)',
                      padding: '4px 6px',
                      borderRadius: 3,
                      marginBottom: 6,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {srv.error}
                    </div>
                  )}
                  {!srv.tools || srv.tools.length === 0 ? (
                    <div style={{ fontSize: 10.5, color: 'var(--fg-dim)', padding: '2px 0' }}>
                      {srv.connected ? '도구 없음' : '연결 실패'}
                    </div>
                  ) : (
                    srv.tools.map(tool => (
                      <button
                        key={tool.name}
                        onClick={() => invoke(srv, tool)}
                        title={tool.description}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          padding: '4px 6px',
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
                        <span style={{
                          color: 'var(--fg-primary)', fontSize: 12, fontFamily: 'var(--font-code)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {tool.name}
                        </span>
                        {tool.description && (
                          <span style={{
                            fontSize: 10.5, color: 'var(--fg-muted)', lineHeight: 1.45,
                            display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
                            overflow: 'hidden',
                          }}>
                            {tool.description}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
