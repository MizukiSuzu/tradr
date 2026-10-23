import { useStore } from '../store'
import { pointsFor } from '../game/scoring'
import { horizonLabel } from '../game/types'
import type { Call, Horizon } from '../game/types'

const usd = (x: number) => `$${x.toFixed(2)}`

interface Props { symbol: string; horizon: Horizon; pUp: number; startDate: string; startClose: number }

export default function CallPanel({ symbol, horizon, pUp, startDate, startClose }: Props) {
  const open = useStore(s => s.predictions.find(p =>
    p.mode === 'live' && p.status === 'open' && p.symbol === symbol && p.horizon === horizon))
  const makeLiveCall = useStore(s => s.makeLiveCall)

  const call = (c: Call) => makeLiveCall({ symbol, horizon, call: c, startDate, startClose, pUp })

  return (
    <div style={{ marginTop: 14, padding: 14, borderRadius: 12, border: '1px solid rgba(192,132,252,0.25)', background: 'rgba(192,132,252,0.05)' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Make a call · {horizonLabel(horizon)}</div>
      {open ? (
        <div role="status" style={{ fontSize: 13, color: 'var(--muted)' }}>
          You called <b style={{ color: 'var(--text)' }}>{open.call.toUpperCase()}</b> on {open.startDate} at {usd(open.startClose)} · resolves after {horizon} trading days.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Will {symbol} close above or below {usd(startClose)} in {horizonLabel(horizon)}? Points if you're right; a miss scores 0.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <CallButton onClick={() => call('up')} color="var(--green)" ariaLabel={`Call Up, ${pointsFor(pUp, 'up')} points if right`}>▲ Up +{pointsFor(pUp, 'up')}</CallButton>
            <CallButton onClick={() => call('down')} color="var(--red)" ariaLabel={`Call Down, ${pointsFor(pUp, 'down')} points if right`}>▼ Down +{pointsFor(pUp, 'down')}</CallButton>
          </div>
        </>
      )}
    </div>
  )
}

export function CallButton({ children, onClick, color, disabled, ariaLabel }: { children: React.ReactNode; onClick: () => void; color: string; disabled?: boolean; ariaLabel?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} style={{
      flex: 1, padding: '12px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono)',
      color, background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}`, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
    }}>{children}</button>
  )
}
