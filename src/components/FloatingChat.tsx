import { useState, useRef, useEffect } from 'react'
import { useAgentStore } from '../agents/agentStore'
import { AgentState } from '../agents/agentTypes'

const COLORS: Record<string, string> = {
  degen:      '#c084fc',
  value:      '#67e8f9',
  analytical: '#a78bfa',
  anxious:    '#fcd34d',
  momentum:   '#f9a8d4',
  sensei:     '#86efac',
}

export default function FloatingChat() {
  const agents = useAgentStore(s => s.agents)
  const sendMessage = useAgentStore(s => s.sendMessage)

  const [trayOpen, setTrayOpen]   = useState(false)
  const [openId, setOpenId]       = useState<string | null>(null)
  const [input, setInput]         = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const openAgent = agents.find(a => a.personality.id === openId) ?? null
  const color = openId ? (COLORS[openId] ?? 'var(--accent)') : 'var(--accent)'

  // Count total unread across all agents
  const totalUnread = agents.filter(a => {
    const last = a.chatHistory[a.chatHistory.length - 1]
    return last && last.role === 'agent' && a.personality.id !== openId
  }).length

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [openAgent?.chatHistory, openAgent?.isTyping])

  // Close on outside click
  useEffect(() => {
    if (!trayOpen && !openId) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-floating-chat]')) {
        setTrayOpen(false)
        setOpenId(null)
      }
    }
    setTimeout(() => document.addEventListener('click', handler), 0)
    return () => document.removeEventListener('click', handler)
  }, [trayOpen, openId])

  const send = () => {
    if (!input.trim() || !openId || openAgent?.isTyping) return
    sendMessage(openId, input.trim())
    setInput('')
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const selectAgent = (id: string) => {
    setOpenId(id)
    setTrayOpen(false)
    setInput('')
  }

  const openTray = () => {
    if (openId) {
      setOpenId(null)
    } else {
      setTrayOpen(v => !v)
    }
  }

  return (
    <div data-floating-chat style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 7000, pointerEvents: 'none' }}>

      {/* ── Chat popup ── */}
      {openAgent && (
        <div
          data-floating-chat
          style={{
            position: 'absolute',
            bottom: 68,
            right: 0,
            width: 300,
            height: 420,
            borderRadius: 18,
            background: 'linear-gradient(180deg, #1a1035 0%, #110d24 100%)',
            border: `1px solid ${color}40`,
            boxShadow: `0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px ${color}20, inset 0 1px 0 ${color}15`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            pointerEvents: 'all',
            animation: 'floatChatIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            transformOrigin: 'bottom right',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '12px 14px 10px',
            borderBottom: `1px solid ${color}20`,
            background: `linear-gradient(135deg, ${color}10, transparent)`,
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            {/* Back to tray */}
            <button
              onClick={() => { setOpenId(null); setTrayOpen(true) }}
              data-floating-chat
              style={{
                width: 26, height: 26, borderRadius: 7,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--muted)', fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, cursor: 'pointer',
              }}
            >‹</button>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: `${color}18`, border: `1px solid ${color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, flexShrink: 0,
            }}>
              {openAgent.personality.avatar}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{openAgent.personality.name}</div>
              <div style={{ fontSize: 10, color: openAgent.isTyping ? color : 'var(--faint)', fontFamily: 'var(--font-mono)', letterSpacing: 0.5 }}>
                {openAgent.isTyping ? 'typing…' : 'online'}
              </div>
            </div>
            <button
              onClick={() => { setOpenId(null); setTrayOpen(false) }}
              data-floating-chat
              style={{
                width: 26, height: 26, borderRadius: 7,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--muted)', fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, cursor: 'pointer',
              }}
            >✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {openAgent.chatHistory.length === 0 && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0.5,
              }}>
                <div style={{ fontSize: 28 }}>{openAgent.personality.avatar}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  say something to<br />{openAgent.personality.name}
                </div>
              </div>
            )}

            {openAgent.chatHistory.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  background: msg.role === 'user'
                    ? 'rgba(255,255,255,0.07)'
                    : `linear-gradient(135deg, ${color}18, ${color}08)`,
                  border: `1px solid ${msg.role === 'user' ? 'rgba(255,255,255,0.1)' : color + '35'}`,
                  borderRadius: msg.role === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                  padding: '8px 11px',
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: 'var(--text)',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {openAgent.isTyping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  background: `linear-gradient(135deg, ${color}18, ${color}08)`,
                  border: `1px solid ${color}35`,
                  borderRadius: '14px 14px 14px 3px',
                  padding: '9px 13px',
                  display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: color, opacity: 0.7,
                      animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 10px',
            borderTop: `1px solid ${color}15`,
            display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0,
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Message…"
              disabled={!!openAgent.isTyping}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${input ? color + '40' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: 12.5,
                color: 'var(--text)',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = color + '60' }}
              onBlur={e => { e.currentTarget.style.borderColor = input ? color + '40' : 'rgba(255,255,255,0.08)' }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || !!openAgent.isTyping}
              style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: input.trim() && !openAgent.isTyping ? color : 'rgba(255,255,255,0.06)',
                border: 'none',
                color: input.trim() && !openAgent.isTyping ? '#0f0a1e' : 'var(--faint)',
                fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
                boxShadow: input.trim() && !openAgent.isTyping ? `0 0 12px ${color}50` : 'none',
                cursor: input.trim() && !openAgent.isTyping ? 'pointer' : 'default',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
                <path d="M12 6.5L1 1l2.5 5.5L1 12l11-5.5Z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Agent selector tray ── */}
      {trayOpen && !openId && (
        <div
          data-floating-chat
          style={{
            position: 'absolute',
            bottom: 68,
            right: 0,
            width: 220,
            borderRadius: 16,
            background: 'linear-gradient(180deg, #1a1035 0%, #110d24 100%)',
            border: '1px solid rgba(192,132,252,0.2)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            overflow: 'hidden',
            pointerEvents: 'all',
            animation: 'floatChatIn 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            transformOrigin: 'bottom right',
          }}
        >
          <div style={{
            padding: '12px 14px 8px',
            fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)',
            letterSpacing: 1.5, fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            CHAT WITH
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 0' }}>
            {agents.map(agent => {
              const id = agent.personality.id
              const c = COLORS[id] ?? 'var(--accent)'
              const hasUnread = (() => {
                const last = agent.chatHistory[agent.chatHistory.length - 1]
                return last && last.role === 'agent'
              })()

              return (
                <button
                  key={id}
                  data-floating-chat
                  onClick={() => selectAgent(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${c}12` }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: `${c}18`, border: `1px solid ${c}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0, position: 'relative',
                  }}>
                    {agent.personality.avatar}
                    {hasUnread && (
                      <div style={{
                        position: 'absolute', top: -2, right: -2,
                        width: 8, height: 8, borderRadius: '50%',
                        background: c, boxShadow: `0 0 5px ${c}`,
                        border: '1.5px solid #110d24',
                      }} />
                    )}
                    {agent.isTyping && (
                      <div style={{
                        position: 'absolute', inset: -3, borderRadius: 12,
                        border: `1.5px solid ${c}`,
                        animation: 'typingRing 1s ease-in-out infinite',
                        pointerEvents: 'none',
                      }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: c }}>{agent.personality.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--faint)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                      {agent.isTyping ? 'typing…' : agent.chatHistory.length > 0 ? `${agent.chatHistory.length} msgs` : 'say hi'}
                    </div>
                  </div>
                  {hasUnread && (
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: c, flexShrink: 0,
                    }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Single chat bubble FAB ── */}
      <button
        data-floating-chat
        onClick={openTray}
        title="Chat with traders"
        style={{
          position: 'relative',
          width: 52, height: 52,
          borderRadius: '50%',
          background: openId
            ? `radial-gradient(circle at 40% 35%, ${color}50, ${color}20)`
            : trayOpen
              ? 'radial-gradient(circle at 40% 35%, rgba(192,132,252,0.5), rgba(192,132,252,0.2))'
              : 'radial-gradient(circle at 40% 35%, rgba(192,132,252,0.28), rgba(15,10,30,0.95))',
          border: `2px solid ${openId ? color : trayOpen ? 'rgba(192,132,252,0.9)' : 'rgba(192,132,252,0.55)'}`,
          boxShadow: openId || trayOpen
            ? `0 0 20px rgba(192,132,252,0.6), 0 4px 16px rgba(0,0,0,0.5)`
            : `0 0 8px rgba(192,132,252,0.3), 0 4px 12px rgba(0,0,0,0.4)`,
          fontSize: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          transform: openId || trayOpen ? 'scale(1.1)' : 'scale(1)',
          pointerEvents: 'all',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { if (!openId && !trayOpen) e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { if (!openId && !trayOpen) e.currentTarget.style.transform = 'scale(1)' }}
      >
        {openId ? openAgent?.personality.avatar : '💬'}

        {/* Unread badge */}
        {totalUnread > 0 && !openId && (
          <div style={{
            position: 'absolute', top: 1, right: 1,
            minWidth: 16, height: 16, borderRadius: 8,
            background: '#c084fc',
            boxShadow: '0 0 8px #c084fc',
            border: '1.5px solid #110d24',
            fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: '#0f0a1e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
            pointerEvents: 'none',
          }}>
            {totalUnread}
          </div>
        )}

        {/* Typing pulse ring when an agent is typing */}
        {agents.some(a => a.isTyping) && !openId && (
          <div style={{
            position: 'absolute', inset: -4, borderRadius: '50%',
            border: '2px solid #c084fc',
            animation: 'typingRing 1s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}
      </button>
    </div>
  )
}