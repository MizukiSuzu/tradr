import { useStore } from '../store'
import { STARTING_BALANCE } from '../assets'
import { Tab } from '../App'

interface Props {
  tab: Tab
  setTab: (t: Tab) => void
  loading: boolean
  onRefresh: () => void
  notifOpen: boolean
  setNotifOpen: (v: boolean) => void
}

const TAB_ICONS: Record<Tab, string> = {
  market: '◈',
  portfolio: '⬡',
  history: '◷',
  traders: '◉',
}

export default function Header({ tab, setTab, loading, onRefresh, notifOpen, setNotifOpen }: Props) {
  const cash = useStore(s => s.cash)
  const totalValue = useStore(s => s.totalValue)
  const resetPortfolio = useStore(s => s.resetPortfolio)
  const lastUpdated = useStore(s => s.lastUpdated)
  const notifications = useStore(s => s.notifications)
  const unreadCount = notifications.length

  const total = totalValue()
  const pnl = total - STARTING_BALANCE
  const pnlPct = (pnl / STARTING_BALANCE) * 100
  const isUp = pnl >= 0

  const tabs: { id: Tab; label: string }[] = [
    { id: 'market', label: 'Markets' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'history', label: 'History' },
    { id: 'traders', label: 'Traders' },
  ]

  return (
    <header style={{
      background: 'linear-gradient(180deg, rgba(18,13,38,0.97) 0%, rgba(15,10,30,0.92) 100%)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(148,100,255,0.2)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 12px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #a78bfa 0%, #67e8f9 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px rgba(167,139,250,0.6), 0 0 40px rgba(167,139,250,0.2)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: '#0c0818' }}>T</span>
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16,
              letterSpacing: 4,
              background: 'linear-gradient(90deg, #c084fc 0%, #a78bfa 40%, #67e8f9 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              TRADR
            </span>
            <div style={{
              width: 1, height: 18,
              background: 'var(--border)',
              margin: '0 4px',
            }} />
            <span style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: 0.5 }}>
              Trading Playground
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Portfolio value */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: '8px 16px',
              textAlign: 'right',
            }}>
              <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 3, letterSpacing: 1.5 }}>PORTFOLIO</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18 }}>
                  ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: isUp ? 'var(--green)' : 'var(--red)',
                  fontWeight: 700,
                  background: isUp ? 'rgba(134,239,172,0.1)' : 'rgba(248,113,113,0.1)',
                  border: `1px solid ${isUp ? 'rgba(134,239,172,0.2)' : 'rgba(248,113,113,0.2)'}`,
                  borderRadius: 5,
                  padding: '1px 6px',
                }}>
                  {isUp ? '+' : ''}{pnlPct.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Cash badge */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(252,211,77,0.1), rgba(252,211,77,0.04))',
              border: '1px solid rgba(252,211,77,0.25)',
              borderRadius: 12,
              padding: '8px 16px',
              boxShadow: '0 0 20px rgba(252,211,77,0.06)',
            }}>
              <div style={{ fontSize: 9, color: 'rgba(252,211,77,0.6)', fontFamily: 'var(--font-mono)', marginBottom: 3, letterSpacing: 1.5 }}>CASH</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: 'var(--gold)' }}>
                ${cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Refresh */}
            {loading ? (
              <div style={{ position: 'relative', width: 34, height: 34 }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%',
                  border: '2px solid var(--faint)',
                }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%',
                  border: '2px solid transparent',
                  borderTopColor: 'var(--accent)',
                  borderRightColor: 'rgba(192,132,252,0.4)',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <div style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 6, height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  boxShadow: '0 0 8px var(--accent)',
                }} />
              </div>
            ) : (
              <button
                onClick={onRefresh}
                title="Refresh prices"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  width: 34, height: 34,
                  color: 'var(--muted)',
                  fontSize: 16,
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--accent)'
                  e.currentTarget.style.borderColor = 'var(--border-hi)'
                  e.currentTarget.style.boxShadow = 'var(--glow-accent)'
                  e.currentTarget.style.background = 'rgba(192,132,252,0.08)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--muted)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }}
              >
                ↻
              </button>
            )}

            {/* Bell */}
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              title="Notifications"
              style={{
                position: 'relative',
                background: notifOpen ? 'rgba(192,132,252,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${notifOpen ? 'rgba(192,132,252,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10,
                width: 34, height: 34,
                color: notifOpen ? 'var(--accent)' : 'var(--muted)',
                fontSize: 16,
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: notifOpen ? '0 0 16px rgba(192,132,252,0.25)' : 'none',
              }}
              onMouseEnter={e => {
                if (!notifOpen) {
                  e.currentTarget.style.color = 'var(--accent)'
                  e.currentTarget.style.borderColor = 'var(--border-hi)'
                  e.currentTarget.style.background = 'rgba(192,132,252,0.08)'
                }
              }}
              onMouseLeave={e => {
                if (!notifOpen) {
                  e.currentTarget.style.color = 'var(--muted)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }
              }}
            >
              🔔
              {unreadCount > 0 && (
                <div style={{
                  position: 'absolute', top: -5, right: -5,
                  minWidth: 16, height: 16, borderRadius: 8,
                  background: 'linear-gradient(135deg, #c084fc, #67e8f9)',
                  color: '#0c0818',
                  fontSize: 9, fontWeight: 800, fontFamily: 'var(--font-mono)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px',
                  boxShadow: '0 0 10px rgba(192,132,252,0.6)',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
            </button>

            {/* Reset */}
            <button
              onClick={() => { if (confirm('Reset your entire portfolio?')) resetPortfolio() }}
              style={{
                background: 'rgba(248,113,113,0.06)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 10,
                padding: '7px 14px',
                color: 'var(--red)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                letterSpacing: 1,
                fontWeight: 700,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(248,113,113,0.15)'
                e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)'
                e.currentTarget.style.boxShadow = '0 0 14px rgba(248,113,113,0.15)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(248,113,113,0.06)'
                e.currentTarget.style.borderColor = 'rgba(248,113,113,0.2)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              RESET
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, gap: 8 }}>
          <div style={{
            display: 'flex', gap: 2, padding: '4px',
            background: 'rgba(12,8,24,0.7)',
            borderRadius: 14,
            border: '1px solid var(--border)',
          }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '8px 22px',
                  borderRadius: 10,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: tab === t.id
                    ? 'linear-gradient(135deg, rgba(167,139,250,0.22), rgba(103,232,249,0.12))'
                    : 'transparent',
                  color: tab === t.id ? 'var(--accent)' : 'var(--muted)',
                  border: tab === t.id ? '1px solid rgba(192,132,252,0.35)' : '1px solid transparent',
                  transition: 'all 0.2s',
                  boxShadow: tab === t.id ? '0 0 16px rgba(192,132,252,0.2), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
                }}
                onMouseEnter={e => {
                  if (tab !== t.id) {
                    e.currentTarget.style.color = 'var(--text)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  }
                }}
                onMouseLeave={e => {
                  if (tab !== t.id) {
                    e.currentTarget.style.color = 'var(--muted)'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <span style={{ fontSize: 12, opacity: 0.7 }}>{TAB_ICONS[t.id]}</span>
                {t.label}
              </button>
            ))}
          </div>
          {lastUpdated && (
            <div style={{
              marginLeft: 'auto',
              fontSize: 10,
              color: 'var(--faint)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: 0.5,
            }}>
              Updated {new Date(lastUpdated).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}