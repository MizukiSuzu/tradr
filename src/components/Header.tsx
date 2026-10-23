import { useStore } from '../store'
import { stats } from '../game/scoring'
import { Tab } from '../App'
import SymbolSearch from './SymbolSearch'
import type { SearchResult } from '../data'

interface Props {
  onSelectSymbol: (r: SearchResult) => void
  tab: Tab
  setTab: (t: Tab) => void
}

const TAB_ICONS: Record<Tab, string> = {
  watchlist: '◈',
  replay: '↺',
  predictions: '◎',
}

export default function Header({ tab, setTab, onSelectSymbol }: Props) {
  const predictions = useStore(s => s.predictions)
  const reset = useStore(s => s.reset)
  const st = stats(predictions)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'watchlist', label: 'Watchlist' },
    { id: 'replay', label: 'Replay' },
    { id: 'predictions', label: 'Predictions' },
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
              Market Foresight
            </span>
          </div>
          <SymbolSearch onSelect={onSelectSymbol} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Stat label="SCORE" value={String(st.score)} color="var(--accent)" />
            <Stat label="STREAK" value={String(st.streak)} color="var(--gold)" />
            <Stat label="ACCURACY" value={st.accuracy === null ? '—' : `${Math.round(st.accuracy * 100)}%`} color="var(--green)" />
            <button
              onClick={() => { if (window.confirm('Reset your score and all predictions?')) reset() }}
              style={{
                padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: 1,
                color: 'var(--red)', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', cursor: 'pointer',
              }}
            >RESET</button>
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
        </div>
      </div>
    </header>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '6px 14px', minWidth: 76 }}>
      <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color }}>{value}</div>
    </div>
  )
}
