import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32, hashString } from './rng.ts'
import { buildCone, probAbove, logReturns } from './cone.ts'

// Deterministic, gently trending, noisy series for tests
export function makeCloses(n: number, seed = 7): number[] {
  const rnd = mulberry32(seed)
  const out = [100]
  for (let i = 1; i < n; i++) out.push(out[i - 1] * Math.exp(0.0004 + (rnd() - 0.5) * 0.04))
  return out
}

test('rng is deterministic per seed', () => {
  const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43)
  const sa = [a(), a(), a()], sb = [b(), b(), b()]
  assert.deepEqual(sa, sb)
  assert.notEqual(sa[0], c())
  assert.ok(sa.every(x => x >= 0 && x < 1))
  assert.equal(hashString('AAPL'), hashString('AAPL'))
  assert.notEqual(hashString('AAPL'), hashString('MSFT'))
})

test('logReturns length and values', () => {
  const r = logReturns([100, 110, 99])
  assert.equal(r.length, 2)
  assert.ok(Math.abs(r[0] - Math.log(1.1)) < 1e-12)
})

test('cone percentiles are ordered at every step', () => {
  const cone = buildCone(makeCloses(400), 21, { paths: 2000 })
  assert.equal(cone.bands.length, 22)
  assert.equal(cone.bands[0].p50, cone.start)
  for (const b of cone.bands) {
    assert.ok(b.p025 <= b.p16 && b.p16 <= b.p50 && b.p50 <= b.p84 && b.p84 <= b.p975, `step ${b.step}`)
  }
  const last = cone.bands[21]
  assert.ok(last.p975 - last.p025 > cone.bands[1].p975 - cone.bands[1].p025, 'cone widens')
})

test('constant prices give a zero-width cone', () => {
  const cone = buildCone(new Array(300).fill(50), 21, { paths: 500 })
  for (const b of cone.bands) {
    assert.equal(b.p025, 50)
    assert.equal(b.p975, 50)
  }
})

test('same seed gives identical cone, different seed differs', () => {
  const closes = makeCloses(400)
  const a = buildCone(closes, 21, { paths: 1000, seed: 5 })
  const b = buildCone(closes, 21, { paths: 1000, seed: 5 })
  const c = buildCone(closes, 21, { paths: 1000, seed: 6 })
  assert.deepEqual(a.bands, b.bands)
  assert.notDeepEqual(a.bands, c.bands)
})

test('probAbove is monotonic and bounded', () => {
  const cone = buildCone(makeCloses(400), 21, { paths: 2000 })
  assert.equal(probAbove(cone, 0), 1)
  assert.equal(probAbove(cone, 1e9), 0)
  assert.ok(probAbove(cone, cone.bands[21].p16) > probAbove(cone, cone.bands[21].p84))
})

test('too little history throws', () => {
  assert.throws(() => buildCone(makeCloses(10), 21), /Not enough history/)
})

import { sma, rsi, realizedVol, computeSignals, toneCounts } from './signals.ts'

test('sma basics', () => {
  assert.equal(sma([1, 2, 3, 4], 2), 3.5)
  assert.equal(sma([1, 2, 3, 4], 2, 1), 1.5)
  assert.equal(sma([1, 2], 3), null)
})

test('rsi on known series', () => {
  const up = Array.from({ length: 30 }, (_, i) => 100 + i)
  const down = Array.from({ length: 30 }, (_, i) => 100 - i)
  const alt = Array.from({ length: 15 }, (_, i) => (i % 2 === 0 ? 100 : 101)) // 14 changes: 7 up, 7 down
  assert.equal(rsi(up), 100)
  assert.equal(rsi(down), 0)
  assert.equal(rsi(alt), 50)
  assert.equal(rsi([1, 2, 3]), null)
})

test('realizedVol is zero for constant prices', () => {
  assert.equal(realizedVol(new Array(30).fill(10)), 0)
})

test('trend detects uptrend and golden cross', () => {
  // 230 flat days then a steady climb: 50-day SMA crosses above 200-day recently
  const closes = [...new Array(230).fill(100), ...Array.from({ length: 15 }, (_, i) => 100 + (i + 1) * 2)]
  const trend = computeSignals(closes).find(s => s.id === 'trend')!
  assert.equal(trend.tone, 'bullish')
  assert.match(trend.detail, /golden cross/i)
})

test('computeSignals always returns 4 signals and counts them', () => {
  const sigs = computeSignals(makeCloses(300))
  assert.deepEqual(sigs.map(s => s.id), ['trend', 'momentum', 'rsi', 'volatility'])
  const c = toneCounts(sigs)
  assert.equal(c.bullish + c.neutral + c.bearish, 4)
})

test('short history still returns 4 neutral-safe signals', () => {
  const sigs = computeSignals(makeCloses(40))
  assert.equal(sigs.length, 4)
  assert.equal(sigs[0].tone, 'neutral')
})
