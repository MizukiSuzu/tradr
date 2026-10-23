import type { Bar } from '../forecast/types.ts'
import type { Call, Prediction, Stats } from './types.ts'

const MIN_HISTORY = 252   // bars needed before a start for a one-year cone
const REPLAY_MIN_AGO = 63 // ~3 months
const REPLAY_MAX_AGO = 378 // ~1.5 years

// Correct calls pay more when the cone thought they were unlikely.
export function pointsFor(pUp: number, call: Call): number {
  return Math.round(100 * (call === 'up' ? 1 - pUp : pUp))
}

// Resolves an open call once the bar `horizon` trading days after its start exists.
export function resolveCall(p: Prediction, bars: Bar[], now = Date.now()): Prediction | null {
  if (p.status !== 'open') return null
  const start = bars.findIndex(b => b.date >= p.startDate)
  if (start < 0 || (start === 0 && bars[0].date > p.startDate)) return null // start predates the history window
  const end = bars[start + p.horizon]
  if (!end) return null
  const startClose = bars[start].close // history is split-adjusted; the stored startClose may not be
  const won = p.call === 'up' ? end.close > startClose : end.close < startClose
  return {
    ...p,
    status: won ? 'won' : 'lost',
    endDate: end.date,
    endClose: end.close,
    points: won ? pointsFor(p.pUp, p.call) : 0,
    resolvedAt: now,
  }
}

export function pickReplayStart(bars: Bar[], horizon: number, rng: () => number): number | null {
  const last = bars.length - 1
  const lo = Math.max(MIN_HISTORY, last - REPLAY_MAX_AGO)
  const hi = Math.min(last - horizon, last - REPLAY_MIN_AGO)
  if (hi < lo) return null
  return lo + Math.floor(rng() * (hi - lo + 1))
}

export function stats(ps: Prediction[]): Stats {
  const resolved = ps
    .filter(p => p.status !== 'open')
    .sort((a, b) => (a.resolvedAt ?? 0) - (b.resolvedAt ?? 0))
  const byMode: Stats['byMode'] = {
    live: { score: 0, won: 0, resolved: 0 },
    replay: { score: 0, won: 0, resolved: 0 },
  }
  let score = 0
  let won = 0
  for (const p of resolved) {
    const m = byMode[p.mode]
    const pts = p.points ?? 0
    m.resolved++
    m.score += pts
    score += pts
    if (p.status === 'won') { won++; m.won++ }
  }
  let streak = 0
  for (let i = resolved.length - 1; i >= 0 && resolved[i].status === 'won'; i--) streak++
  return { score, streak, accuracy: resolved.length ? won / resolved.length : null, byMode }
}
