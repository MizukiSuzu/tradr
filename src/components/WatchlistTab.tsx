import { useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'
import { useStore } from '../store'
import { useHistory } from '../data'
import { computeSignals, toneCounts } from '../forecast/signals'

export default function WatchlistTab({ onOpen }: { onOpen: (symbol: string) => void }) {
  const watchlist = useStore(s => s.watchlist)
  return (
    <div style={{ animation: 'slideIn 0.3s ease' }}>
      <div style={{ padding: '32px 0 24px' }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 2, marginBottom: 6 }}>FORESIGHT</div>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28, margin: 0 }}>Watchlist</h2>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>Daily closes. Open a ticker for its forecast. Search above to add more.</div>
      </div>
      {watchlist.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Your watchlist is empty. Search for a ticker to add one.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {watchlist.map(sym => <Row key={sym} symbol={sym} onOpen={onOpen} />)}
      </div>
    </div>
  )
}

function Row({ symbol, onOpen }: { symbol: string; onOpen: (s: string) => void }) {
  const { bars, error, loading } = useHistory(symbol)
  const toggleWatch = useStore(s => s.toggleWatch)

  const view = useMemo(() => {
    if (!bars || bars.length < 2) return null
    const closes = bars.map(b => b.close)
    const last = closes[closes.length - 1]
    const prev = closes[closes.length - 2]
    return {
      last,
      changePct: (last / prev - 1) * 100,
      spark: bars.slice(-60).map(b => ({ v: b.close })),
      counts: toneCounts(computeSignals(closes)),
      date: bars[bars.length - 1].date,
    }
  }, [bars])

  const up = (view?.changePct ?? 0) >= 0
  return (
    <div
      onClick={() => onOpen(symbol)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${symbol} forecast`}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { if (e.key === ' ') e.preventDefault(); onOpen(symbol) }
      }}
      style={{
        display: 'grid', gridTemplateColumns: '1fr 120px 110px 170px 28px', alignItems: 'center', gap: 16,
        padding: '14px 18px', background: 'rgba(22,16,43,0.7)', border: '1px solid var(--border)',
        borderRadius: 12, cursor: 'pointer',
      }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-mono)' }}>{symbol}</div>
        <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>
          {loading ? 'Loading…' : error ? error : `Close ${view?.date}`}
        </div>
      </div>
      <div style={{ height: 36 }}>
        {view && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={view.spark}>
              <YAxis domain={['dataMin', 'dataMax']} hide />
              <Line dataKey="v" dot={false} strokeWidth={1.5} stroke={up ? 'var(--green)' : 'var(--red)'} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
        <div style={{ fontWeight: 700 }}>{view ? `$${view.last.toFixed(2)}` : '—'}</div>
        <div style={{ fontSize: 12, color: up ? 'var(--green)' : 'var(--red)' }}>
          {view ? `${up ? '▲' : '▼'} ${Math.abs(view.changePct).toFixed(2)}%` : ''}
        </div>
      </div>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
        {view && <>
          <span style={{ color: 'var(--green)' }}>{view.counts.bullish} bull</span> ·{' '}
          <span>{view.counts.neutral} neutral</span> ·{' '}
          <span style={{ color: 'var(--red)' }}>{view.counts.bearish} bear</span>
        </>}
      </div>
      <button
        aria-label={`Remove ${symbol} from watchlist`}
        onClick={e => { e.stopPropagation(); toggleWatch(symbol) }}
        onKeyDown={e => e.stopPropagation()}
        style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}
      >✕</button>
    </div>
  )
}
