import { useStore } from '../store'
import { STARTING_BALANCE } from '../assets'
import { Tab } from '../App'

interface Props {
  tab: Tab
  setTab: (t: Tab) => void
  loading: boolean
  onRefresh: () => void
}

export default function Header({ tab, setTab, loading, onRefresh }: Props) {
  const cash = useStore(s => s.cash)
  const totalValue = useStore(s => s.totalValue)
  const resetPortfolio = useStore(s => s.resetPortfolio)
  const lastUpdated = useStore(s => s.lastUpdated)

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
      background: 'rgba(22, 16, 43, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 12px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 30, height: 30,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #a78bfa 0%, #67e8f9 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 14px rgba(167,139,250,0.5)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11, color: '#0f0a1e' }}>T</span>
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15,
              letterSpacing: 3,
              background: 'linear-gradient(90deg, #c084fc, #67e8f9)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              TRADR
            </span>
            <span style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)', marginLeft: 4 }}>
              Trading Playground
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Portfolio value */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 2, letterSpacing: 1 }}>PORTFOLIO</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18 }}>
                  ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: isUp ? 'var(--green)' : 'var(--red)',
                  fontWeight: 700,
                }}>
                  {isUp ? '+' : ''}{pnlPct.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Cash badge */}
            <div style={{
              background: 'rgba(252, 211, 77, 0.08)',
              border: '1px solid rgba(252, 211, 77, 0.25)',
              borderRadius: 10,
              padding: '6px 14px',
            }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 2, letterSpacing: 1 }}>CASH</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: 'var(--gold)' }}>
                ${cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Orbital refresh indicator */}
            {loading ? (
              <div style={{ position: 'relative', width: 32, height: 32 }}>
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
                  boxShadow: '0 0 6px var(--accent)',
                }} />
              </div>
            ) : (
              <button
                onClick={onRefresh}
                title="Refresh prices"
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  width: 32, height: 32,
                  color: 'var(--muted)',
                  fontSize: 14,
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--accent)'
                  e.currentTarget.style.borderColor = 'var(--border-hi)'
                  e.currentTarget.style.boxShadow = 'var(--glow-accent)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--muted)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                ↻
              </button>
            )}

            {/* Reset */}
            <button
              onClick={() => { if (confirm('Reset your entire portfolio?')) resetPortfolio() }}
              style={{
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.25)',
                borderRadius: 8,
                padding: '6px 12px',
                color: 'var(--red)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                letterSpacing: 0.5,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
            >
              RESET
            </button>
          </div>
        </div>

        {/* Pill tab bar */}
        <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, gap: 8 }}>
          <div style={{
            display: 'flex', gap: 4, padding: '4px',
            background: 'rgba(15,10,30,0.6)',
            borderRadius: 12,
            border: '1px solid var(--border)',
          }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '7px 18px',
                  borderRadius: 9,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  fontSize: 13,
                  background: tab === t.id
                    ? 'linear-gradient(135deg, rgba(167,139,250,0.25), rgba(103,232,249,0.15))'
                    : 'transparent',
                  color: tab === t.id ? 'var(--accent)' : 'var(--muted)',
                  border: tab === t.id ? '1px solid var(--border-hi)' : '1px solid transparent',
                  transition: 'all 0.2s',
                  boxShadow: tab === t.id ? 'var(--glow-accent)' : 'none',
                }}
              >
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
