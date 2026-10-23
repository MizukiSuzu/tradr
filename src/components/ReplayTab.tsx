import { useRef, useState } from 'react'
import { useStore, DEFAULT_WATCHLIST } from '../store'
import { fetchHistory } from '../data'
import { buildCone, probAbove } from '../forecast/cone'
import { hashString } from '../forecast/rng'
import type { Bar, Cone } from '../forecast/types'
import { pickReplayStart, resolveCall, pointsFor } from '../game/scoring'
import { HORIZONS, horizonLabel } from '../game/types'
import type { Call, Horizon, Prediction } from '../game/types'
import ConeChart from './ConeChart'
import { CallButton } from './CallPanel'
import { Card, Btn } from './StockPage'

const usd = (x: number) => `$${x.toFixed(2)}`

interface Round { symbol: string; bars: Bar[]; s: number; horizon: Horizon; cone: Cone; pUp: number }

export default function ReplayTab() {
  const watchlist = useStore(s => s.watchlist)
  const recordReplay = useStore(s => s.recordReplay)
  const [horizon, setHorizon] = useState<Horizon>(21)
  const [round, setRound] = useState<Round | null>(null)
  const [result, setResult] = useState<Prediction | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recordedKey = useRef<string | null>(null) // key of the round already recorded; blocks double-click double-scoring

  const newRound = async () => {
    const pool = watchlist.length ? watchlist : DEFAULT_WATCHLIST
    const symbol = pool[Math.floor(Math.random() * pool.length)]
    setBusy(true); setError(null); setResult(null); setRound(null)
    recordedKey.current = null
    try {
      const bars = await fetchHistory(symbol)
      const s = pickReplayStart(bars, horizon, Math.random)
      if (s === null) { setRound(null); setError(`Not enough history for a replay on ${symbol}. Try another round.`); return }
      const cone = buildCone(bars.slice(0, s + 1).map(b => b.close), horizon, { seed: hashString(symbol + bars[s].date) })
      setRound({ symbol, bars, s, horizon, cone, pUp: probAbove(cone, cone.start) })
    } catch (e: any) {
      setRound(null); setError(e?.message ?? 'Could not load history.')
    } finally {
      setBusy(false)
    }
  }

  const call = (c: Call) => {
    if (!round || result || busy) return
    const { symbol, bars, s, horizon: h, pUp } = round
    const key = `${symbol}-${bars[s].date}`
    if (recordedKey.current === key) return
    const p: Prediction = {
      id: `replay-${symbol}-${bars[s].date}-${Date.now()}`, mode: 'replay', symbol, horizon: h, call: c,
      startDate: bars[s].date, startClose: bars[s].close, pUp, status: 'open',
    }
    const r = resolveCall(p, bars)
    if (!r) return // cannot happen: pickReplayStart guarantees the horizon bar exists
    recordedKey.current = key
    recordReplay(r)
    setResult(r)
  }

  return (
    <div style={{ animation: 'slideIn 0.3s ease' }}>
      <div style={{ padding: '32px 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 2, marginBottom: 6 }}>INSTANT ROUNDS</div>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28, margin: 0 }}>Replay</h2>
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>A real past moment with the future hidden. Call it, then see what happened.</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {HORIZONS.map(h => (
            <Btn key={h.days} onClick={() => setHorizon(h.days)} active={h.days === horizon} pressed={h.days === horizon}>{h.label}</Btn>
          ))}
        </div>
      </div>

      {error && <div role="alert" style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {!round ? (
        <Btn onClick={newRound} disabled={busy}>{busy ? 'Loading…' : '▶ New round'}</Btn>
      ) : (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 700 }}>
              {round.symbol} · {horizonLabel(round.horizon)} ahead
              <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted)' }}> · start date {result ? round.bars[round.s].date : 'hidden'}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>start close {usd(round.bars[round.s].close)}</div>
          </div>

          <ConeChart
            past={round.bars.slice(Math.max(0, round.s - 125), round.s + 1)}
            cone={round.cone}
            actual={result ? round.bars.slice(round.s + 1, round.s + round.horizon + 1) : undefined}
            hideDates
          />

          <div style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0' }}>
            The cone gave <b style={{ color: 'var(--text)' }}>{(round.pUp * 100).toFixed(0)}%</b> odds of ending higher.
          </div>

          {!result ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <CallButton onClick={() => call('up')} color="var(--green)" ariaLabel={`Call Up, ${pointsFor(round.pUp, 'up')} points if right`}>▲ Up +{pointsFor(round.pUp, 'up')}</CallButton>
              <CallButton onClick={() => call('down')} color="var(--red)" ariaLabel={`Call Down, ${pointsFor(round.pUp, 'down')} points if right`}>▼ Down +{pointsFor(round.pUp, 'down')}</CallButton>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div role="status" style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 18, color: result.status === 'won' ? 'var(--green)' : 'var(--red)' }}>
                {result.status === 'won' ? `+${result.points} · correct` : '0 · missed'}
                <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted)', marginLeft: 10 }}>
                  {usd(result.startClose)} → {usd(result.endClose!)} on {result.endDate}
                </span>
              </div>
              <Btn onClick={newRound} disabled={busy}>{busy ? 'Loading…' : 'Next round →'}</Btn>
            </div>
          )}
        </Card>
      )}

      <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)', marginTop: 8 }}>
        Statistical projection from past prices. Not financial advice.
      </div>
    </div>
  )
}
