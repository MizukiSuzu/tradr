import { useStore } from '../store'
import { stats } from '../game/scoring'
import { horizonLabel } from '../game/types'
import type { Prediction } from '../game/types'

const usd = (x: number) => `$${x.toFixed(2)}`

export default function PredictionsTab({ onOpen }: { onOpen: (symbol: string) => void }) {
  const predictions = useStore(s => s.predictions)
  const st = stats(predictions)
  const open = predictions.filter(p => p.status === 'open')
  const resolved = predictions.filter(p => p.status !== 'open').sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))

  return (
    <div style={{ animation: 'slideIn 0.3s ease' }}>
      <div style={{ padding: '32px 0 24px' }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 2, marginBottom: 6 }}>YOUR CALLS</div>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28, margin: 0 }}>Predictions</h2>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>
          Replay {st.byMode.replay.score} pts ({st.byMode.replay.won}/{st.byMode.replay.resolved} right) · Live {st.byMode.live.score} pts ({st.byMode.live.won}/{st.byMode.live.resolved} right)
        </div>
      </div>

      <Section title={`Open live calls (${open.length})`}>
        {open.length === 0
          ? <Empty>No open calls. Open a ticker and make a call on today's close.</Empty>
          : open.map(p => <Row key={p.id} p={p} onOpen={onOpen} />)}
      </Section>

      <Section title={`Resolved (${resolved.length})`}>
        {resolved.length === 0
          ? <Empty>Nothing resolved yet. Play a Replay round for an instant result.</Empty>
          : resolved.map(p => <Row key={p.id} p={p} onOpen={onOpen} />)}
      </Section>
    </div>
  )
}

function Row({ p, onOpen }: { p: Prediction; onOpen: (s: string) => void }) {
  const color = p.status === 'won' ? 'var(--green)' : p.status === 'lost' ? 'var(--red)' : 'var(--gold)'
  const outcome = p.status === 'open'
    ? `resolves after ${p.horizon} trading days`
    : `${usd(p.startClose)} → ${usd(p.endClose!)} on ${p.endDate}`
  return (
    <button onClick={() => onOpen(p.symbol)} aria-label={`Open ${p.symbol} forecast`} style={{
      display: 'grid', gridTemplateColumns: '70px 90px 1fr auto', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
      padding: '12px 16px', marginBottom: 6, background: 'rgba(22,16,43,0.7)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${color}`, borderRadius: '0 12px 12px 0', color: 'var(--text)', cursor: 'pointer',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{p.symbol}</span>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{p.mode.toUpperCase()} · {horizonLabel(p.horizon)}</span>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
        Called <b style={{ color: 'var(--text)' }}>{p.call.toUpperCase()}</b> from {usd(p.startClose)} on {p.startDate} · {outcome}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>
        {p.status === 'open' ? 'OPEN' : p.status === 'won' ? `+${p.points}` : '0'}
      </span>
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1.5, marginBottom: 10 }}>{title.toUpperCase()}</div>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: 'var(--faint)', padding: '8px 0' }}>{children}</div>
}
