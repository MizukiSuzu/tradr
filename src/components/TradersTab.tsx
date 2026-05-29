import { useState, useRef, useEffect } from 'react'
import { useAgentStore } from '../agents/agentStore'
import { useStore } from '../store'
import { STARTING_BALANCE, CLASS_COLORS } from '../assets'
import { AgentState } from '../agents/agentTypes'

const PERSONALITY_COLORS: Record<string, string> = {
  degen: '#7c3aed',
  value: '#3b82f6',
  analytical: '#00ff88',
  anxious: '#f5c842',
  momentum: '#ff6b35',
  sensei: '#e8a045',
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function pnlColor(val: number) {
  return val >= 0 ? 'var(--green)' : 'var(--red)'
}

// ─── Leaderboard strip ─────────────────────────────────────────────────────

function Leaderboard({ agents, playerValue }: { agents: AgentState[]; playerValue: number }) {
  const allEntries = [
    ...agents.filter(a => !a.personality.isMentor).map(a => ({ id: a.personality.id, name: a.personality.name, avatar: a.personality.avatar, value: a.totalValue, isPlayer: false })),
    { id: 'player', name: 'You', avatar: '👤', value: playerValue, isPlayer: true },
  ].sort((a, b) => b.value - a.value)

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 24,
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1, marginBottom: 14 }}>
        LEADERBOARD
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {allEntries.map((entry, rank) => {
          const pnl = entry.value - STARTING_BALANCE
          const pnlPct = (pnl / STARTING_BALANCE) * 100
          const color = entry.isPlayer ? 'var(--accent)' : (PERSONALITY_COLORS[entry.id] ?? 'var(--muted)')

          return (
            <div key={entry.id} style={{
              flex: '1 1 140px',
              background: entry.isPlayer ? 'rgba(0,255,136,0.06)' : 'var(--bg3)',
              border: `1px solid ${entry.isPlayer ? 'rgba(0,255,136,0.3)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', minWidth: 14 }}>#{rank + 1}</span>
              <span style={{ fontSize: 20 }}>{entry.avatar}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: pnlColor(pnl) }}>
                  {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, textAlign: 'right' }}>
                ${fmt(entry.value)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Trader card ───────────────────────────────────────────────────────────

function TraderCard({
  agent,
  assets,
  isSelected,
  onSelect,
}: {
  agent: AgentState
  assets: ReturnType<typeof useStore.getState>['assets']
  isSelected: boolean
  onSelect: () => void
}) {
  const { personality } = agent
  const pnl = agent.totalValue - STARTING_BALANCE
  const pnlPct = (pnl / STARTING_BALANCE) * 100
  const color = PERSONALITY_COLORS[personality.id] ?? 'var(--accent)'

  // Top 3 holdings by value
  const topHoldings = [...agent.holdings]
    .map(h => {
      const asset = assets.find(a => a.id === h.assetId)
      return { h, asset, val: asset ? asset.price * h.quantity : 0 }
    })
    .filter(x => x.asset)
    .sort((a, b) => b.val - a.val)
    .slice(0, 3)

  const lastTrade = agent.trades[0]
  const lastTradeAsset = lastTrade ? assets.find(a => a.id === lastTrade.assetId) : null

  return (
    <div
      onClick={onSelect}
      style={{
        background: isSelected ? `${color}18` : 'var(--bg2)',
        border: `1px solid ${isSelected ? color : 'var(--border)'}`,
        borderRadius: 12,
        padding: '16px 18px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        marginBottom: 10,
      }}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = color }}
      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{personality.avatar}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color }}>{personality.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{personality.bio}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {personality.isMentor ? (
            <div style={{
              background: `${color}22`,
              border: `1px solid ${color}66`,
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              color,
              letterSpacing: 0.5,
              fontFamily: 'var(--font-mono)',
            }}>
              MENTOR
            </div>
          ) : (
            <>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}>${fmt(agent.totalValue)}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: pnlColor(pnl), fontWeight: 700 }}>
                {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
              </div>
            </>
          )}
        </div>
      </div>

      {/* Holdings */}
      {!personality.isMentor && topHoldings.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {topHoldings.map(({ h, asset, val }) => {
            const assetPnl = asset!.price - h.avgBuyPrice
            return (
              <div key={h.assetId} style={{
                background: 'var(--bg3)',
                border: `1px solid ${CLASS_COLORS[asset!.class] ?? 'var(--border)'}30`,
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}>
                <span style={{ color: CLASS_COLORS[asset!.class] }}>{asset!.symbol}</span>
                <span style={{ color: 'var(--muted)', marginLeft: 6 }}>${fmt(val)}</span>
                <span style={{ color: pnlColor(assetPnl), marginLeft: 6 }}>
                  {assetPnl >= 0 ? '+' : ''}{(((asset!.price - h.avgBuyPrice) / h.avgBuyPrice) * 100).toFixed(1)}%
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Last trade */}
      {!personality.isMentor && lastTrade && lastTradeAsset && (
        <div style={{
          background: 'var(--bg3)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--muted)',
          borderLeft: `3px solid ${lastTrade.type === 'buy' ? 'var(--green)' : 'var(--red)'}`,
        }}>
          <span style={{ color: lastTrade.type === 'buy' ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginRight: 6 }}>
            {lastTrade.type.toUpperCase()}
          </span>
          {lastTrade.reasoning}
          <span style={{ display: 'block', marginTop: 2, color: 'var(--muted)', opacity: 0.6, fontSize: 10 }}>
            {new Date(lastTrade.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Mentor market observer note */}
      {personality.isMentor && (
        <div style={{
          background: 'var(--bg3)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--muted)',
          borderLeft: `3px solid ${color}`,
          marginBottom: 0,
        }}>
          Observing the market. Ask him anything.
        </div>
      )}

      {/* Chat button */}
      <button
        style={{
          marginTop: 12,
          width: '100%',
          background: isSelected ? color : 'var(--bg3)',
          color: isSelected ? '#000' : color,
          border: `1px solid ${color}`,
          borderRadius: 8,
          padding: '7px 0',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: 0.5,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {isSelected
          ? (personality.isMentor ? '📖 CONSULTING' : '💬 CHATTING')
          : (personality.isMentor ? '📖 ASK SENSEI' : '💬 CHAT')}
      </button>
    </div>
  )
}

// ─── Chat panel ────────────────────────────────────────────────────────────

function ChatPanel({ agent }: { agent: AgentState }) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const sendMessage = useAgentStore(s => s.sendMessage)
  const bottomRef = useRef<HTMLDivElement>(null)
  const color = PERSONALITY_COLORS[agent.personality.id] ?? 'var(--accent)'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [agent.chatHistory])

  const send = async () => {
    const msg = input.trim()
    if (!msg || sending) return
    setInput('')
    setSending(true)
    await sendMessage(agent.personality.id, msg)
    setSending(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--bg3)',
      }}>
        <span style={{ fontSize: 24 }}>{agent.personality.avatar}</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color }}>{agent.personality.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {agent.chatHistory.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-mono)', padding: '40px 0' }}>
            Say hi to {agent.personality.name}
          </div>
        )}
        {agent.chatHistory.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '80%',
              background: msg.role === 'user' ? 'var(--bg3)' : `${color}22`,
              border: `1px solid ${msg.role === 'user' ? 'var(--border)' : color + '55'}`,
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              padding: '10px 14px',
              fontSize: 13,
              lineHeight: 1.5,
              color: msg.role === 'agent' ? color : 'var(--text)',
            }}>
              {msg.content}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 3, opacity: 0.6 }}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{
              background: `${color}22`,
              border: `1px solid ${color}55`,
              borderRadius: '14px 14px 14px 4px',
              padding: '10px 16px',
              color,
              fontSize: 18,
              letterSpacing: 3,
            }}>
              <span style={{ animation: 'pulse 1s infinite' }}>•••</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: 8,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Message ${agent.personality.name}…`}
          disabled={sending}
          style={{
            flex: 1,
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 14px',
            color: 'var(--text)',
            fontSize: 13,
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          style={{
            background: input.trim() && !sending ? color : 'var(--bg3)',
            color: input.trim() && !sending ? '#000' : 'var(--muted)',
            border: `1px solid ${color}`,
            borderRadius: 8,
            padding: '0 16px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: 12,
            cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          SEND
        </button>
      </div>
    </div>
  )
}

// ─── Main tab ──────────────────────────────────────────────────────────────

export default function TradersTab() {
  const agents = useAgentStore(s => s.agents)
  const assets = useStore(s => s.assets)
  const totalValue = useStore(s => s.totalValue)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedAgent = agents.find(a => a.personality.id === selectedId) ?? null
  const playerValue = totalValue()

  if (agents.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--muted)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>Initialising traders…</div>
      </div>
    )
  }

  return (
    <div style={{ animation: 'slideIn 0.3s ease' }}>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 24, margin: '32px 0 20px', color: 'var(--accent)' }}>
        Community Traders
      </h2>

      <Leaderboard agents={agents} playerValue={playerValue} />

      <div style={{ display: 'grid', gridTemplateColumns: selectedAgent ? '1fr 1fr' : '1fr', gap: 20 }}>
        {/* Left: trader list */}
        <div>
          {agents.map(agent => (
            <TraderCard
              key={agent.personality.id}
              agent={agent}
              assets={assets}
              isSelected={selectedId === agent.personality.id}
              onSelect={() => setSelectedId(
                selectedId === agent.personality.id ? null : agent.personality.id
              )}
            />
          ))}
        </div>

        {/* Right: chat panel */}
        {selectedAgent && (
          <div style={{ position: 'sticky', top: 80, height: 'calc(100vh - 120px)' }}>
            <ChatPanel agent={selectedAgent} />
          </div>
        )}
      </div>
    </div>
  )
}