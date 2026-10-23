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
