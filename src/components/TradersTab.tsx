import { useState, useRef, useEffect } from 'react'
import { useAgentStore } from '../agents/agentStore'
import { useStore } from '../store'
import { STARTING_BALANCE } from '../assets'
import { AgentState } from '../agents/agentTypes'

const PERSONALITY_COLORS: Record<string, string> = {
  degen:      '#c084fc',
  value:      '#67e8f9',
  analytical: '#a78bfa',
  anxious:    '#fcd34d',
  momentum:   '#f9a8d4',
  sensei:     '#86efac',
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function pnlColor(val: number) {
  return val >= 0 ? 'var(--green)' : 'var(--red)'
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

function Leaderboard({ agents, playerValue }: { agents: AgentState[]; playerValue: number }) {
  const allEntries = [
    ...agents.filter(a => !a.personality.isMentor).map(a => ({
      id: a.personality.id, name: a.personality.name, avatar: a.personality.avatar,
      value: a.totalValue, isPlayer: false,
    })),
    { id: 'player', name: 'You', avatar: '👤', value: playerValue, isPlayer: true },
  ].sort((a, b) => b.value - a.value)

  const max = allEntries[0]?.value ?? 1

  return (
    <div style={{
      background: 'rgba(22,16,43,0.7)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '22px 22px', marginBottom: 28,
    }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1.5, fontWeight: 700, marginBottom: 18 }}>
        LEADERBOARD
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {allEntries.map((entry, rank) => {
          const pnl = entry.value - STARTING_BALANCE
          const pnlPct = (pnl / STARTING_BALANCE) * 100
          const color = entry.isPlayer ? 'var(--accent)' : (PERSONALITY_COLORS[entry.id] ?? 'var(--muted)')
          const barWidth = (entry.value / max) * 100

          return (
            <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Rank */}
              <div style={{
                width: 28, textAlign: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: rank === 0 ? 'var(--gold)' : 'var(--faint)', fontWeight: 700,
              }}>
                {rank === 0 ? '★' : `#${rank + 1}`}
              </div>

              {/* Avatar + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 130, flexShrink: 0 }}>
                <span style={{ fontSize: 18 }}>{entry.avatar}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color }}>{entry.name}</span>
                {entry.isPlayer && (
                  <span style={{ background: 'rgba(192,132,252,0.15)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 5px', borderRadius: 3, fontWeight: 700 }}>YOU</span>
                )}
              </div>

              {/* Bar */}
              <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${barWidth}%`,
                  background: entry.isPlayer
                    ? 'linear-gradient(90deg, #c084fc, #67e8f9)'
                    : color,
                  opacity: 0.8,
                  transition: 'width 0.8s ease',
                }} />
              </div>

              {/* Value + pnl */}
              <div style={{ textAlign: 'right', width: 130, flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>${fmt(entry.value)}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: pnlColor(pnl) }}>
                  {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Active trader card (no portfolio) ───────────────────────────────────────

function TraderCard({ agent, assets, isSelected, onSelect }: {
  agent: AgentState
  assets: ReturnType<typeof useStore.getState>['assets']
  isSelected: boolean
  onSelect: () => void
}) {
  const { personality } = agent
  const color = PERSONALITY_COLORS[personality.id] ?? 'var(--accent)'

  const lastTrade = agent.trades[0]
  const lastTradeAsset = lastTrade ? assets.find(a => a.id === lastTrade.assetId) : null

  return (
    <div onClick={onSelect} style={{
      background: isSelected ? `${color}14` : 'rgba(22,16,43,0.7)',
      border: `1px solid ${isSelected ? color + '80' : 'var(--border)'}`,
      borderRadius: 16, padding: '16px 18px',
      cursor: 'pointer', transition: 'all 0.2s',
      boxShadow: isSelected ? `0 0 24px ${color}22` : 'none',
    }}
      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = color + '60'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
      onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' } }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: `${color}18`, border: `1.5px solid ${color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>{personality.avatar}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color }}>{personality.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{personality.bio}</div>
        </div>
        {personality.isMentor && (
          <div style={{
            background: `${color}18`, border: `1px solid ${color}55`,
            borderRadius: 8, padding: '4px 10px',
            fontSize: 9, fontWeight: 700, color,
            fontFamily: 'var(--font-mono)', letterSpacing: 1, flexShrink: 0,
          }}>MENTOR</div>
        )}
      </div>

      {/* Last trade / mentor note */}
      {!personality.isMentor && lastTrade && lastTradeAsset ? (
        <div style={{
          background: 'rgba(15,10,30,0.6)', borderRadius: 10, padding: '9px 12px',
          borderLeft: `3px solid ${lastTrade.type === 'buy' ? 'var(--green)' : 'var(--red)'}`,
          marginBottom: 12,
        }}>
          <span style={{ color: lastTrade.type === 'buy' ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, marginRight: 8 }}>
            {lastTrade.type.toUpperCase()} {lastTradeAsset.symbol}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>{lastTrade.reasoning}</span>
          <div style={{ marginTop: 3, fontSize: 9, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>
            {new Date(lastTrade.timestamp).toLocaleTimeString()}
          </div>
        </div>
      ) : personality.isMentor ? (
        <div style={{
          background: 'rgba(15,10,30,0.6)', borderRadius: 10, padding: '9px 12px',
          borderLeft: `3px solid ${color}`, marginBottom: 12,
          fontSize: 12, color: 'var(--muted)',
        }}>
          Observing the market. Ask him anything.
        </div>
      ) : (
        <div style={{ marginBottom: 12, fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)', padding: '6px 0' }}>
          No trades yet
        </div>
      )}

      {/* Chat button */}
      <button style={{
        width: '100%', padding: '8px',
        borderRadius: 10,
        background: isSelected ? color : 'transparent',
        color: isSelected ? '#0f0a1e' : color,
        border: `1px solid ${color}80`,
        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11, letterSpacing: 0.5,
        transition: 'all 0.2s',
        boxShadow: isSelected ? `0 0 16px ${color}40` : 'none',
        cursor: 'pointer',
      }}>
        {isSelected
          ? (personality.isMentor ? '📖 CONSULTING' : '💬 CHATTING')
          : (personality.isMentor ? '📖 ASK SENSEI' : '💬 CHAT')}
      </button>
    </div>
  )
}

// ─── Chat panel ──────────────────────────────────────────────────────────────

function ChatPanel({ agent }: { agent: AgentState }) {
  const [input, setInput] = useState('')
  const sendMessage = useAgentStore(s => s.sendMessage)
  const bottomRef = useRef<HTMLDivElement>(null)
  const color = PERSONALITY_COLORS[agent.personality.id] ?? 'var(--accent)'
  const sending = agent.isTyping ?? false

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [agent.chatHistory, sending])

  const send = async () => {
    const msg = input.trim()
    if (!msg || sending) return
    setInput('')
    sendMessage(agent.personality.id, msg)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(22,16,43,0.7)', border: '1px solid var(--border)',
      borderRadius: 16, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: `linear-gradient(90deg, ${color}12, transparent)`,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${color}18`, border: `1px solid ${color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>{agent.personality.avatar}</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color }}>{agent.personality.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>ONLINE</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {agent.chatHistory.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 12, fontFamily: 'var(--font-mono)', padding: '40px 0' }}>
            Say hi to {agent.personality.name}
          </div>
        )}
        {agent.chatHistory.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '82%',
              background: msg.role === 'user'
                ? 'rgba(30,23,53,0.9)'
                : `linear-gradient(135deg, ${color}1a, ${color}0a)`,
              border: `1px solid ${msg.role === 'user' ? 'var(--border)' : color + '45'}`,
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '11px 15px',
              fontSize: 13, lineHeight: 1.55,
              color: 'var(--text)',
              boxShadow: msg.role === 'agent' ? `0 0 14px ${color}15` : 'none',
            }}>
              {msg.content}
            </div>
            <div style={{ fontSize: 9, color: 'var(--faint)', fontFamily: 'var(--font-mono)', marginTop: 4, opacity: 0.7 }}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontSize: 18, lineHeight: 1 }}>{agent.personality.avatar}</div>
            <div style={{
              background: `linear-gradient(135deg, ${color}1a, ${color}0a)`,
              border: `1px solid ${color}45`,
              borderRadius: '16px 16px 16px 4px',
              padding: '12px 16px',
              display: 'flex', gap: 5, alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: color,
                  opacity: 0.7,
                  animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Message ${agent.personality.name}…`}
          disabled={sending}
          style={{
            flex: 1, background: 'rgba(15,10,30,0.8)',
            border: '1px solid var(--border)', borderRadius: 10,
            padding: '10px 14px', color: 'var(--text)',
            fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = color + '80')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        <button onClick={send} disabled={!input.trim() || sending} style={{
          background: input.trim() && !sending
            ? `linear-gradient(135deg, ${color}, ${color}aa)`
            : 'var(--bg3)',
          color: input.trim() && !sending ? '#0f0a1e' : 'var(--muted)',
          border: `1px solid ${color}60`,
          borderRadius: 10, padding: '0 18px',
          fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12,
          cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
          boxShadow: input.trim() && !sending ? `0 0 12px ${color}40` : 'none',
        }}>
          ↑
        </button>
      </div>
    </div>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function TradersTab() {
  const agents = useAgentStore(s => s.agents)
  const assets = useStore(s => s.assets)
  const totalValue = useStore(s => s.totalValue)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedAgent = agents.find(a => a.personality.id === selectedId) ?? null
  const playerValue = totalValue()

  if (agents.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '100px 20px', gap: 16 }}>
        <div style={{ fontSize: 40, animation: 'pulse 1.5s infinite' }}>⏳</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)', letterSpacing: 1 }}>INITIALISING TRADERS</div>
      </div>
    )
  }

  const activeTraders = agents.filter(a => !a.personality.isMentor)
  const mentor = agents.find(a => a.personality.isMentor)

  return (
    <div style={{ animation: 'slideIn 0.3s ease' }}>
      {/* Page header */}
      <div style={{ padding: '32px 0 24px', borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 2, marginBottom: 6 }}>COMMUNITY</div>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28, margin: 0 }}>Traders</h2>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>
          {activeTraders.length} active traders · {mentor ? '1 mentor' : ''}
        </div>
      </div>

      <Leaderboard agents={agents} playerValue={playerValue} />

      {/* Active traders section */}
      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1.5, fontWeight: 700, marginBottom: 16 }}>
        ACTIVE TRADERS
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        {/* Left: trader cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {agents.map(agent => (
            <TraderCard
              key={agent.personality.id}
              agent={agent}
              assets={assets}
              isSelected={selectedId === agent.personality.id}
              onSelect={() => setSelectedId(selectedId === agent.personality.id ? null : agent.personality.id)}
            />
          ))}
        </div>

        {/* Right: chat panel or idle state */}
        <div style={{ position: 'sticky', top: 80, height: 'calc(100vh - 120px)' }}>
          {selectedAgent ? (
            <ChatPanel agent={selectedAgent} />
          ) : (
            <div style={{
              height: '100%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(22,16,43,0.4)',
              border: '1px dashed var(--border)',
              borderRadius: 16,
              gap: 16,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: 'rgba(192,132,252,0.07)',
                border: '1px solid rgba(192,132,252,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
              }}>💬</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', letterSpacing: 1, textAlign: 'center' }}>
                SELECT A TRADER<br />
                <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 400, letterSpacing: 0 }}>to start chatting</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}