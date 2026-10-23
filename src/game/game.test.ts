import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pointsFor, resolveCall, pickReplayStart, stats } from './scoring.ts'
import type { Prediction } from './types.ts'
import type { Bar } from '../forecast/types.ts'
import { mulberry32 } from '../forecast/rng.ts'
import { buildCone } from '../forecast/cone.ts'

function bars(closes: number[]): Bar[] {
  const t0 = Date.UTC(2024, 0, 1)
  return closes.map((close, i) => ({ date: new Date(t0 + i * 86400000).toISOString().slice(0, 10), close }))
}

function open(over: Partial<Prediction> = {}): Prediction {
  return {
    id: 'p1', mode: 'live', symbol: 'TEST', horizon: 5, call: 'up',
    startDate: '2024-01-01', startClose: 100, pUp: 0.65, status: 'open', ...over,
  }
}

test('pointsFor pays the unlikely side more', () => {
  assert.equal(pointsFor(0.5, 'up'), 50)
  assert.equal(pointsFor(0.5, 'down'), 50)
  assert.equal(pointsFor(0.65, 'up'), 35)
  assert.equal(pointsFor(0.65, 'down'), 65)
  assert.equal(pointsFor(0.9, 'up'), 10)
  assert.equal(pointsFor(0.9, 'down'), 90)
})

test('resolveCall: up win, down win, flat miss', () => {
  const b = bars([100, 101, 102, 103, 104, 110, 90])
  const upWin = resolveCall(open(), b, 1)!
  assert.equal(upWin.status, 'won')
  assert.equal(upWin.endDate, b[5].date)
  assert.equal(upWin.endClose, 110)
  assert.equal(upWin.points, 35)
  assert.equal(upWin.resolvedAt, 1)

  const downLose = resolveCall(open({ call: 'down' }), b)!
  assert.equal(downLose.status, 'lost')
  assert.equal(downLose.points, 0)

  const downWin = resolveCall(open({ call: 'down', startDate: b[1].date, startClose: 101 }), b)!
  assert.equal(downWin.status, 'won')
  assert.equal(downWin.endClose, 90)
  assert.equal(downWin.points, 65)

  const flat = resolveCall(open(), bars([100, 1, 1, 1, 1, 100]))!
  assert.equal(flat.status, 'lost')
  assert.equal(flat.points, 0)
})

test('resolveCall: null before the horizon bar exists or when already resolved', () => {
  const b = bars([100, 101, 102, 103, 104])
  assert.equal(resolveCall(open(), b), null)
  assert.equal(resolveCall(open({ status: 'won' }), bars([100, 1, 1, 1, 1, 200])), null)
})

test('resolveCall: missing start date uses the next bar', () => {
  // Drop the 2024-01-02 bar so the start date is missing; the next bar (2024-01-03) becomes the start.
  const b = bars([100, 101, 102, 103, 104, 105, 106, 50]).filter((_, i) => i !== 1)
  const r = resolveCall(open({ startDate: '2024-01-02', horizon: 5, call: 'down', startClose: 101 }), b)!
  assert.equal(r.endClose, 50) // start index 1 (2024-01-03), +5 → index 6 (close 50)
  assert.equal(r.status, 'won')
})

test('resolveCall: start date before the history window stays open', () => {
  const b = bars([100, 101, 102, 103, 104, 105, 106])
  assert.equal(resolveCall(open({ startDate: '2023-12-01' }), b), null)
})

test('resolveCall uses the history close at the start (split-adjusted)', () => {
  // stored startClose 1000 (pre-split), history shows 100 → 110: Up should win
  const r = resolveCall(open({ startClose: 1000 }), bars([100, 101, 102, 103, 104, 110]))!
  assert.equal(r.status, 'won')
})

test('pickReplayStart respects every bound', () => {
  const b = bars(new Array(520).fill(100))
  const last = b.length - 1
  for (const h of [5, 21, 63]) {
    const rnd = mulberry32(h)
    for (let i = 0; i < 200; i++) {
      const s = pickReplayStart(b, h, rnd)!
      assert.ok(s >= 252, `s=${s} >= 252`)
      assert.ok(s + h <= last, `s+h=${s + h} <= ${last}`)
      assert.ok(last - s >= 63 && last - s <= 378, `last-s=${last - s}`)
    }
  }
})

test('pickReplayStart: null when history is too short, deterministic with a seed', () => {
  assert.equal(pickReplayStart(bars(new Array(300).fill(1)), 21, Math.random), null)
  const b = bars(new Array(520).fill(1))
  assert.equal(pickReplayStart(b, 21, mulberry32(9)), pickReplayStart(b, 21, mulberry32(9)))
})

test('replay cone ignores bars after the start', () => {
  const rnd = mulberry32(3)
  const closes = [100]
  for (let i = 1; i < 520; i++) closes.push(closes[i - 1] * Math.exp((rnd() - 0.5) * 0.04))
  const b = bars(closes)
  const s = pickReplayStart(b, 21, mulberry32(1))!
  const a = buildCone(b.slice(0, s + 1).map(x => x.close), 21, { paths: 300, seed: 1 })
  const altered = b.map((x, i) => (i > s ? { ...x, close: x.close * 5 } : x))
  const c = buildCone(altered.slice(0, s + 1).map(x => x.close), 21, { paths: 300, seed: 1 })
  assert.deepEqual(a.bands, c.bands)
})

test('stats: score, streak by resolvedAt, accuracy, per-mode totals', () => {
  assert.deepEqual(stats([]).accuracy, null)
  const ps: Prediction[] = [
    open({ id: 'a', mode: 'replay', status: 'won', points: 40, resolvedAt: 1 }),
    open({ id: 'b', mode: 'live', status: 'lost', points: 0, resolvedAt: 2 }),
    open({ id: 'c', mode: 'replay', status: 'won', points: 30, resolvedAt: 4 }),
    open({ id: 'd', mode: 'live', status: 'won', points: 20, resolvedAt: 3 }),
    open({ id: 'e', status: 'open' }),
  ]
  const s = stats(ps)
  assert.equal(s.score, 90)
  assert.equal(s.streak, 2) // order by resolvedAt: a(won) b(lost) d(won) c(won)
  assert.equal(s.accuracy, 0.75)
  assert.deepEqual(s.byMode.replay, { score: 70, won: 2, resolved: 2 })
  assert.deepEqual(s.byMode.live, { score: 20, won: 1, resolved: 2 })
})
