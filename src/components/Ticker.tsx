import { useStore } from '../store'

export default function Ticker() {
  const assets = useStore(s => s.assets)
  const priced = assets.filter(a => a.price > 0)

  if (priced.length === 0) return null

  const items = [...priced, ...priced] // duplicate for seamless loop

  return (
    <div style={{
      background: 'rgba(15, 10, 30, 0.9)',
      borderBottom: '1px solid var(--border)',
      borderTop: '1px solid rgba(139,92,246,0.1)',
      padding: '7px 0',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Fade edges */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 60,
        background: 'linear-gradient(to right, var(--bg), transparent)',
        zIndex: 1, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 60,
        background: 'linear-gradient(to left, var(--bg), transparent)',
        zIndex: 1, pointerEvents: 'none',
      }} />

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
            <span style={{ color: 'var(--accent3)', fontWeight: 700 }}>{a.symbol}</span>
            <span style={{ color: 'var(--muted)' }}>${a.price < 1 ? a.price.toFixed(4) : a.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span style={{ color: a.changePct >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {a.changePct >= 0 ? '▲' : '▼'} {Math.abs(a.changePct).toFixed(2)}%
            </span>
            <span style={{ color: 'var(--faint)' }}>|</span>
          </span>
        ))}
      </div>
    </div>
  )
}
