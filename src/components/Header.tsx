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
  ]

  return (
    <header style={{
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: 'var(--accent)',
              color: '#000',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              padding: '4px 10px',
              borderRadius: 6,
              letterSpacing: 1,
            }}>
              TRADEVAULT
            </div>
            <span style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
              Trading Playground
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Portfolio value */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>PORTFOLIO</div>
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

            {/* Cash */}
            <div style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 14px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>CASH</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>
                ${cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              title="Refresh prices"
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 12px',
                color: 'var(--muted)',
                fontSize: 14,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              {loading ? '⟳' : '↻'}
            </button>

            {/* Reset */}
            <button
              onClick={() => { if (confirm('Reset your entire portfolio?')) resetPortfolio() }}
              style={{
                background: 'rgba(255,59,92,0.1)',
                border: '1px solid rgba(255,59,92,0.3)',
                borderRadius: 8,
                padding: '6px 12px',
                color: 'var(--red)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,59,92,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,59,92,0.1)')}
            >
              RESET
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 24px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: 0.5,
                color: tab === t.id ? 'var(--accent)' : 'var(--muted)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              {t.label}
            </button>
          ))}
          {lastUpdated && (
            <div style={{
              marginLeft: 'auto',
              alignSelf: 'center',
              fontSize: 10,
              color: 'var(--muted)',
              fontFamily: 'var(--font-mono)',
              padding: '0 8px',
            }}>
              Updated {new Date(lastUpdated).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
