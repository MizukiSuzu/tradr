import { useStore } from '../store'

export default function Ticker() {
  const assets = useStore(s => s.assets)
  const priced = assets.filter(a => a.price > 0)

  if (priced.length === 0) return null

  const items = [...priced, ...priced] // duplicate for seamless loop

  return (
    <div style={{
      background: 'var(--bg3)',
      borderBottom: '1px solid var(--border)',
      overflow: 'hidden',
      height: 32,
      display: 'flex',
      alignItems: 'center',
    }}>
      <div style={{
        display: 'flex',
        animation: 'ticker 60s linear infinite',
        whiteSpace: 'nowrap',
      }}>
        {items.map((a, i) => (
          <span key={`${a.id}-${i}`} style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            padding: '0 20px',
            display: 'inline-flex',
            gap: 8,
            alignItems: 'center',
          }}>
            <span style={{ color: 'var(--text)', fontWeight: 700 }}>{a.symbol}</span>
            <span style={{ color: 'var(--muted)' }}>${a.price < 1 ? a.price.toFixed(4) : a.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span style={{ color: a.changePct >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {a.changePct >= 0 ? '▲' : '▼'} {Math.abs(a.changePct).toFixed(2)}%
            </span>
            <span style={{ color: 'var(--border)' }}>|</span>
          </span>
        ))}
      </div>
    </div>
  )
}
