import type { Cone, ConeBand } from './types.ts'
import { mulberry32 } from './rng.ts'

export interface ConeOptions { paths?: number; lookback?: number; block?: number; seed?: number }

export function logReturns(closes: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < closes.length; i++) out.push(Math.log(closes[i] / closes[i - 1]))
  return out
}

function pct(sorted: Float64Array | number[], p: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))
  return sorted[i]
}

// Block bootstrap: resample real daily returns in short blocks so calm and volatile
// stretches stay together. Captures fat tails without assuming a bell curve.
export function buildCone(closes: number[], horizon: number, opts: ConeOptions = {}): Cone {
  const { paths = 5000, lookback = 252, block = 5, seed = 1 } = opts
  const returns = logReturns(closes).slice(-lookback)
  if (returns.length < 21) throw new Error('Not enough history')

  const start = closes[closes.length - 1]
  const rnd = mulberry32(seed)
  const maxStart = returns.length - block
  // logs[step][path] = cumulative log return at step (step 1..horizon)
  const logs = Array.from({ length: horizon }, () => new Float64Array(paths))

  for (let p = 0; p < paths; p++) {
    let cum = 0
    let t = 0
    while (t < horizon) {
      const s = Math.floor(rnd() * (maxStart + 1))
      for (let k = 0; k < block && t < horizon; k++, t++) {
        cum += returns[s + k]
        logs[t][p] = cum
      }
    }
  }

  const bands: ConeBand[] = [{ step: 0, p025: start, p16: start, p50: start, p84: start, p975: start }]
  for (let t = 0; t < horizon; t++) {
    const col = logs[t].sort()
    bands.push({
      step: t + 1,
      p025: start * Math.exp(pct(col, 0.025)),
      p16: start * Math.exp(pct(col, 0.16)),
      p50: start * Math.exp(pct(col, 0.5)),
      p84: start * Math.exp(pct(col, 0.84)),
      p975: start * Math.exp(pct(col, 0.975)),
    })
  }
  const finals = Array.from(logs[horizon - 1], l => start * Math.exp(l))
  return { start, horizon, bands, finals }
}

// Share of simulated paths ending strictly above `price`.
export function probAbove(cone: Cone, price: number): number {
  const f = cone.finals
  let lo = 0, hi = f.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (f[mid] <= price) lo = mid + 1
    else hi = mid
  }
  return (f.length - lo) / f.length
}
