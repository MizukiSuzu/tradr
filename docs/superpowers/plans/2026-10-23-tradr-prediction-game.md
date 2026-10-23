# TRADR Prediction Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace TRADR's paper trading with an Up/Down prediction game scored against the forecast cone, with instant Replay rounds and Live calls that resolve on later visits.

**Architecture:** Pure scoring functions in `src/game/` (tested with `node:test`). The Zustand store is rewritten around `predictions` and `watchlist`. Trading code, quote polling and `api/quote.ts` are deleted. A shared `ConeChart` component serves the stock page and the new Replay tab; a `CallPanel` on the stock page makes Live calls; a Predictions tab lists open and resolved calls.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Zustand 4 (persist), Recharts 2, Node 24 built-in test runner. Existing `src/forecast/` engine and `src/data.ts` history fetcher.

**Spec:** `docs/superpowers/specs/2026-10-23-tradr-prediction-game-design.md`

## Global Constraints

- **Git: the user runs every git write command** (add, commit, push, branch, checkout, stash, reset…). Never run them. Each task ends with "Hand off for commit": stop, list changed files, give the suggested commit message. Read-only git is fine.
- No new npm dependencies.
- Files under `src/game/` and `src/forecast/` import each other with explicit `.ts` extensions and use `import type` for type-only imports (Node runs them directly). Components import them without the extension.
- Horizons: `5`, `21`, `63` trading days, labelled `1 week`, `1 month`, `3 months`.
- Points: correct Up pays `round(100 × (1 − pUp))`, correct Down pays `round(100 × pUp)`; a miss or a flat close pays `0`. No negative points.
- Replay start index `s`: `s ≥ 252`, `s + horizon ≤ last index`, and `63 ≤ last − s ≤ 378`.
- Persisted store: name `tradr-portfolio`, version `3`; migration keeps only the old `watchlist`.
- Default watchlist: `['SPY', 'AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN']`.
- Disclaimer text, verbatim: `Statistical projection from past prices. Not financial advice.`
- Never tell the player which way to call; the analyst chat explains, it doesn't pick.
- Styling follows the existing inline-style pattern with CSS variables from `src/index.css`.

## File Map

| File | Responsibility |
|---|---|
| `src/game/types.ts` | `Call`, `Mode`, `Horizon`, `Prediction`, `Stats`, `HORIZONS`, `horizonLabel` |
| `src/game/scoring.ts` | `pointsFor`, `resolveCall`, `pickReplayStart`, `stats` |
| `src/game/game.test.ts` | Game tests |
| `src/store.ts` | Rewritten: watchlist, names, predictions, actions; persist v3 |
| `src/components/ConeChart.tsx` | Shared history + cone chart, optional revealed path |
| `src/components/CallPanel.tsx` | Stock page Up/Down Live call |
| `src/components/ReplayTab.tsx` | Replay mode |
| `src/components/PredictionsTab.tsx` | Open and resolved calls, per-mode totals |
| `src/App.tsx` | Rewritten: tabs watchlist / replay / predictions; live-call resolver; toasts |
| `src/components/Header.tsx` | Score / Streak / Accuracy / Reset |
| `src/components/StockPage.tsx` | Rewritten: last close, ConeChart, CallPanel, no trading |
| `src/forecast/summary.ts` | `openCall` instead of trading `position` |
| Delete | `src/types.ts`, `src/components/TradeModal.tsx`, `src/components/PortfolioTab.tsx`, `src/components/Loader.tsx`, `api/quote.ts` |

---

### Task 1: Game types and scoring

**Files:**
- Create: `src/game/types.ts`, `src/game/scoring.ts`
- Test: `src/game/game.test.ts`
- Modify: `package.json` (`test` script)

**Interfaces:**
- Consumes: `Bar` from `src/forecast/types.ts`; `buildCone`, `probAbove` from `src/forecast/cone.ts` (test only).
- Produces:
  - `type Call = 'up' | 'down'`, `type Mode = 'live' | 'replay'`, `type Horizon = 5 | 21 | 63`
  - `interface Prediction { id; mode; symbol; horizon: Horizon; call; startDate; startClose; pUp; status: 'open' | 'won' | 'lost'; endDate?; endClose?; points?; resolvedAt? }`
  - `interface Stats { score: number; streak: number; accuracy: number | null; byMode: Record<Mode, { score: number; won: number; resolved: number }> }`
  - `const HORIZONS: { days: Horizon; label: string }[]`, `horizonLabel(h: number): string`
  - `pointsFor(pUp: number, call: Call): number`
  - `resolveCall(p: Prediction, bars: Bar[], now?: number): Prediction | null`
  - `pickReplayStart(bars: Bar[], horizon: number, rng: () => number): number | null`
  - `stats(ps: Prediction[]): Stats`

- [ ] **Step 1: Widen the test script**

In `package.json`, change the `test` script to:
```json
    "test": "node --test \"src/**/*.test.ts\""
```

- [ ] **Step 2: Write the failing tests**

Create `src/game/game.test.ts`:
```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: the 17 forecast tests pass; `src/game/game.test.ts` FAILS with `Cannot find module` for `./scoring.ts`.

- [ ] **Step 4: Write `src/game/types.ts`**

```ts
export type Call = 'up' | 'down'
export type Mode = 'live' | 'replay'
export type Horizon = 5 | 21 | 63

export interface Prediction {
  id: string
  mode: Mode
  symbol: string
  horizon: Horizon
  call: Call
  startDate: string   // YYYY-MM-DD of the start bar
  startClose: number
  pUp: number         // cone probability of Up when the call was made, 0..1
  status: 'open' | 'won' | 'lost'
  endDate?: string
  endClose?: number
  points?: number
  resolvedAt?: number // ms timestamp; orders the streak
}

export interface Stats {
  score: number
  streak: number
  accuracy: number | null
  byMode: Record<Mode, { score: number; won: number; resolved: number }>
}

export const HORIZONS: { days: Horizon; label: string }[] = [
  { days: 5, label: '1 week' },
  { days: 21, label: '1 month' },
  { days: 63, label: '3 months' },
]

export function horizonLabel(h: number): string {
  return HORIZONS.find(x => x.days === h)?.label ?? `${h} days`
}
```

- [ ] **Step 5: Write `src/game/scoring.ts`**

```ts
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
  if (start < 0) return null
  const end = bars[start + p.horizon]
  if (!end) return null
  const won = p.call === 'up' ? end.close > p.startClose : end.close < p.startClose
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: 25 tests PASS (17 forecast + 8 game), no warnings.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit -p .` → exit 0.

- [ ] **Step 8: Hand off for commit**

Files: `package.json`, `src/game/types.ts`, `src/game/scoring.ts`, `src/game/game.test.ts`.
Suggested message: `Add prediction game scoring with tests`

---

### Task 2: Replace trading with predictions (store, app shell, header, predictions tab)

After this task the app builds and runs with three tabs: Watchlist, Replay (temporary placeholder text until Task 4), Predictions. Trading is gone. The stock page still shows its forecast; the call panel arrives in Task 3.

**Files:**
- Rewrite: `src/store.ts`, `src/App.tsx`, `src/components/StockPage.tsx`
- Create: `src/components/PredictionsTab.tsx`
- Modify: `src/components/Header.tsx`, `src/forecast/summary.ts`, `src/forecast/forecast.test.ts` (summary test only), `src/data.ts`, `src/components/AnalystChat.tsx` (prompt wording)
- Delete: `src/types.ts`, `src/components/TradeModal.tsx`, `src/components/PortfolioTab.tsx`, `src/components/Loader.tsx`, `api/quote.ts`

**Interfaces:**
- Consumes: Task 1 types and `stats`, `resolveCall`, `horizonLabel`, `HORIZONS`; `fetchHistory`, `useHistory` from `src/data.ts`.
- Produces:
  - Store (`useStore`): `watchlist: string[]`, `names: Record<string, string>`, `predictions: Prediction[]`, `toggleWatch(symbol)`, `rememberName(symbol, name)`, `makeLiveCall(p: Omit<Prediction, 'id' | 'mode' | 'status'>): boolean`, `recordReplay(p: Prediction): void`, `resolveDue(symbol: string, bars: Bar[]): Prediction[]` (returns the newly resolved), `reset(): void`; exported `DEFAULT_WATCHLIST`.
  - `export type Tab = 'watchlist' | 'replay' | 'predictions'` in `App.tsx`.
  - `summarizeForecast({ symbol, name, cone, signals, track, openCall })` where `openCall: { call: Call; horizon: number; startDate: string; startClose: number } | null`.
  - `<StockPage symbol onBack onSummary onResolved />` where `onResolved: (ps: Prediction[]) => void`.

- [ ] **Step 1: Update the summary test first**

In `src/forecast/forecast.test.ts`, find the test `'summary is compact and mentions the key numbers'` and replace its body's `summarizeForecast({...})` call and the `3 shares` assertion so the test reads:
```ts
test('summary is compact and mentions the key numbers', () => {
  const bars = makeBars(600)
  const closes = bars.map(b => b.close)
  const s = summarizeForecast({
    symbol: 'TEST', name: 'Test Corp',
    cone: buildCone(closes, 21, { paths: 500 }),
    signals: computeSignals(closes),
    track: buildTrackRecord(bars, { paths: 300 }),
    openCall: { call: 'up', horizon: 21, startDate: '2024-05-01', startClose: 90 },
  })
  assert.ok(s.length < 2000)
  assert.match(s, /TEST/)
  assert.match(s, /95%/)
  assert.match(s, /inside/)
  assert.match(s, /called UP/)
})
```
Run `npm test` → this test FAILS (type/field mismatch or no "called UP").

- [ ] **Step 2: Update `src/forecast/summary.ts`**

Replace the whole file with:
```ts
import type { Cone, Signal, TrackRecord } from './types.ts'
import { probAbove } from './cone.ts'
import { toneCounts } from './signals.ts'

const usd = (x: number) => `$${x.toFixed(2)}`

// Plain-text context for the analyst chat. Kept short: it counts toward /api/chat's 8,000-char limit.
export function summarizeForecast(input: {
  symbol: string
  name: string
  cone: Cone
  signals: Signal[]
  track: TrackRecord
  openCall: { call: 'up' | 'down'; horizon: number; startDate: string; startClose: number } | null
}): string {
  const { symbol, name, cone, signals, track, openCall } = input
  const end = cone.bands[cone.horizon]
  const counts = toneCounts(signals)
  const lines = [
    `Ticker: ${symbol} (${name}), last daily close ${usd(cone.start)}.`,
    `Forecast horizon: ${cone.horizon} trading days. Median ${usd(end.p50)}; 68% range ${usd(end.p16)}-${usd(end.p84)}; 95% range ${usd(end.p025)}-${usd(end.p975)}.`,
    `Chance of ending above the last daily close (${usd(cone.start)}): ${(probAbove(cone, cone.start) * 100).toFixed(0)}%.`,
    `Method: block-bootstrap Monte Carlo of the last year of daily returns.`,
    `Signals (${counts.bullish} bullish, ${counts.neutral} neutral, ${counts.bearish} bearish): ` +
      signals.map(s => `${s.label} [${s.tone}] - ${s.detail}`).join(' | '),
    track.points.length > 0
      ? `Track record (${track.horizon}-day cones, last ${track.points.length} months): actual price landed inside the 95% band ${track.in95}/${track.points.length} times and inside the 68% band ${track.in68}/${track.points.length} times.`
      : 'Track record: not enough history yet.',
    openCall
      ? `The player called ${openCall.call.toUpperCase()} on ${openCall.startDate} at ${usd(openCall.startClose)} over ${openCall.horizon} trading days; it is still open.`
      : 'The player has no open call on this ticker.',
  ]
  return lines.join('\n')
}
```
Run `npm test` → all 25 PASS.

- [ ] **Step 3: Rewrite `src/store.ts`**

Replace the whole file with:
```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Bar } from './forecast/types'
import type { Prediction } from './game/types'
import { resolveCall } from './game/scoring'

export const DEFAULT_WATCHLIST = ['SPY', 'AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN']

interface GameStore {
  watchlist: string[]
  names: Record<string, string>   // display names remembered from search
  predictions: Prediction[]

  toggleWatch: (symbol: string) => void
  rememberName: (symbol: string, name: string) => void
  makeLiveCall: (p: Omit<Prediction, 'id' | 'mode' | 'status'>) => boolean
  recordReplay: (p: Prediction) => void
  resolveDue: (symbol: string, bars: Bar[]) => Prediction[]
  reset: () => void
}

export const useStore = create<GameStore>()(
  persist(
    (set, get) => ({
      watchlist: DEFAULT_WATCHLIST,
      names: {},
      predictions: [],

      toggleWatch: (symbol) => set(s => ({
        watchlist: s.watchlist.includes(symbol)
          ? s.watchlist.filter(x => x !== symbol)
          : [...s.watchlist, symbol],
      })),

      rememberName: (symbol, name) => set(s => ({ names: { ...s.names, [symbol]: name } })),

      // One open Live call per (ticker, horizon)
      makeLiveCall: (p) => {
        const exists = get().predictions.some(x =>
          x.mode === 'live' && x.status === 'open' && x.symbol === p.symbol && x.horizon === p.horizon)
        if (exists) return false
        const call: Prediction = { ...p, id: `live-${p.symbol}-${p.horizon}-${Date.now()}`, mode: 'live', status: 'open' }
        set(s => ({ predictions: [...s.predictions, call] }))
        return true
      },

      recordReplay: (p) => set(s => ({ predictions: [...s.predictions, p] })),

      resolveDue: (symbol, bars) => {
        const done: Prediction[] = []
        const next = get().predictions.map(p => {
          if (p.mode !== 'live' || p.symbol !== symbol) return p
          const r = resolveCall(p, bars)
          if (!r) return p
          done.push(r)
          return r
        })
        if (done.length) set({ predictions: next })
        return done
      },

      reset: () => set({ predictions: [] }),
    }),
    {
      name: 'tradr-portfolio',
      version: 3,
      // v2 held paper-trading state; keep only the watchlist
      migrate: (old: any) => ({ watchlist: Array.isArray(old?.watchlist) ? old.watchlist : DEFAULT_WATCHLIST }),
    }
  )
)
```

- [ ] **Step 4: Remove quote code from `src/data.ts`**

- Delete the `Quote` interface and the whole `fetchQuotes` function.
- In the `ponytail:` comment above the rate limiter, change "(history and quotes are both counted)" (or the equivalent words) to say only history is counted. Keep `rateLimit(cost = 1)` as is.

- [ ] **Step 5: Delete trading files**

Delete: `src/types.ts`, `src/components/TradeModal.tsx`, `src/components/PortfolioTab.tsx`, `src/components/Loader.tsx`, `api/quote.ts`.

- [ ] **Step 6: Rewrite `src/components/StockPage.tsx`**

Replace the whole file with (Task 3 adds `CallPanel` and `ConeChart`; for now the chart code stays inline):
```tsx
import { useEffect, useMemo, useState } from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useStore } from '../store'
import { useHistory } from '../data'
import { buildCone, probAbove } from '../forecast/cone'
import { computeSignals, toneCounts } from '../forecast/signals'
import { buildTrackRecord } from '../forecast/trackRecord'
import { summarizeForecast } from '../forecast/summary'
import { hashString } from '../forecast/rng'
import { HORIZONS } from '../game/types'
import type { Horizon, Prediction } from '../game/types'
import NumberInput from './NumberInput'

const DISCLAIMER = 'Statistical projection from past prices. Not financial advice.'
const usd = (x: number) => `$${x.toFixed(2)}`
const TONE_COLOR = { bullish: 'var(--green)', neutral: 'var(--muted)', bearish: 'var(--red)' }

interface Props {
  symbol: string
  onBack: () => void
  onSummary: (s: string | null) => void
  onResolved: (ps: Prediction[]) => void
}

export default function StockPage({ symbol, onBack, onSummary, onResolved }: Props) {
  const { bars, error, loading } = useHistory(symbol)
  const name = useStore(s => s.names[symbol]) ?? symbol
  const watchlist = useStore(s => s.watchlist)
  const toggleWatch = useStore(s => s.toggleWatch)
  const resolveDue = useStore(s => s.resolveDue)
  const openCall = useStore(s => s.predictions.find(p => p.mode === 'live' && p.status === 'open' && p.symbol === symbol))
  const [horizon, setHorizon] = useState<Horizon>(21)
  const [target, setTarget] = useState('')

  const closes = useMemo(() => bars?.map(b => b.close) ?? [], [bars])
  const seed = bars?.length ? hashString(symbol + bars[bars.length - 1].date) : 1

  const cone = useMemo(() => {
    if (closes.length < 22) return null
    return buildCone(closes, horizon, { seed })
  }, [closes, horizon, seed])
  const signals = useMemo(() => (closes.length ? computeSignals(closes) : []), [closes])
  const track = useMemo(() => (bars ? buildTrackRecord(bars, { seed }) : null), [bars, seed])

  // Resolve any due Live calls on this ticker once its history is loaded
  useEffect(() => {
    if (!bars) return
    const done = resolveDue(symbol, bars)
    if (done.length) onResolved(done)
  }, [bars, symbol])

  useEffect(() => {
    if (!cone || !track) { onSummary(null); return }
    onSummary(summarizeForecast({
      symbol, name, cone, signals, track,
      openCall: openCall ? { call: openCall.call, horizon: openCall.horizon, startDate: openCall.startDate, startClose: openCall.startClose } : null,
    }))
  }, [symbol, name, cone, signals, track, openCall?.id])
  useEffect(() => () => onSummary(null), [])

  if (loading) return <Shell onBack={onBack} symbol={symbol}><div style={{ color: 'var(--muted)' }}>Loading history…</div></Shell>
  if (error || !bars) return <Shell onBack={onBack} symbol={symbol}><div style={{ color: 'var(--red)' }}>{error ?? 'No data'}</div></Shell>
  if (!cone) return <Shell onBack={onBack} symbol={symbol}><div style={{ color: 'var(--muted)' }}>Not enough price history to forecast {symbol}.</div></Shell>

  const last = bars[bars.length - 1]
  const prev = bars[bars.length - 2]
  const changePct = prev ? (last.close / prev.close - 1) * 100 : 0

  const past = bars.slice(-126).map(b => ({ x: b.date.slice(5), close: b.close }))
  const future = cone.bands.slice(1).map(b => ({
    x: `+${b.step}d`, p50: b.p50, band95: [b.p025, b.p975], band68: [b.p16, b.p84],
  }))
  const join = { ...past[past.length - 1], p50: cone.start, band95: [cone.start, cone.start], band68: [cone.start, cone.start] }
  const chartData = [...past.slice(0, -1), join, ...future]

  const end = cone.bands[cone.horizon]
  const upProb = probAbove(cone, cone.start)
  const targetNum = parseFloat(target)
  const counts = toneCounts(signals)
  const horizonLabel = HORIZONS.find(h => h.days === horizon)!.label

  return (
    <Shell onBack={onBack} symbol={symbol}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700 }}>{usd(last.close)}</div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: changePct >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {changePct >= 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}% · close {last.date}
          </div>
        </div>
        <Btn onClick={() => toggleWatch(symbol)}>{watchlist.includes(symbol) ? '★ Watching' : '☆ Watch'}</Btn>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Probability cone</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {HORIZONS.map(h => (
              <Btn key={h.days} onClick={() => setHorizon(h.days)} active={h.days === horizon} pressed={h.days === horizon}>{h.label}</Btn>
            ))}
          </div>
        </div>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid stroke="rgba(148,100,255,0.08)" vertical={false} />
              <XAxis dataKey="x" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval="preserveStartEnd" minTickGap={40} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--muted)' }} width={60} tickFormatter={v => `$${Number(v).toFixed(0)}`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => (Array.isArray(v) ? `${usd(v[0])} – ${usd(v[1])}` : usd(Number(v)))}
              />
              <Area dataKey="band95" name="95% range" stroke="none" fill="rgba(192,132,252,0.15)" isAnimationActive={false} />
              <Area dataKey="band68" name="68% range" stroke="none" fill="rgba(192,132,252,0.3)" isAnimationActive={false} />
              <Line dataKey="close" name="Close" stroke="var(--accent2)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
              <Line dataKey="p50" name="Median" stroke="var(--accent)" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
          In {horizonLabel}: median <b>{usd(end.p50)}</b>, 68% chance between <b>{usd(end.p16)}</b> and <b>{usd(end.p84)}</b>,
          95% chance between <b>{usd(end.p025)}</b> and <b>{usd(end.p975)}</b>.{' '}
          <b>{(upProb * 100).toFixed(0)}%</b> chance of ending above the last close ({usd(cone.start)}).
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
          Chance above
          <div style={{ width: 150 }}><NumberInput value={target} onChange={setTarget} placeholder="target $" /></div>
          {targetNum > 0 && <b style={{ color: 'var(--text)' }}>{(probAbove(cone, targetNum) * 100).toFixed(0)}%</b>}
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>
          Signals <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted)' }}>({counts.bullish} bullish · {counts.neutral} neutral · {counts.bearish} bearish)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {signals.map(s => (
            <div key={s.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border)', borderLeft: `3px solid ${TONE_COLOR[s.tone]}` }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{s.label}</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: TONE_COLOR[s.tone], letterSpacing: 1, margin: '2px 0 6px' }}>{s.tone.toUpperCase()}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{s.detail}</div>
            </div>
          ))}
        </div>
      </Card>

      {track && track.points.length > 0 && (
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Track record</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
            Each month, a 1-month cone built only from data available then. The actual price landed inside the 95% range{' '}
            <b style={{ color: 'var(--text)' }}>{track.in95}/{track.points.length}</b> times and inside the 68% range{' '}
            <b style={{ color: 'var(--text)' }}>{track.in68}/{track.points.length}</b> times.
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={track.points.map(p => ({ x: p.anchorDate.slice(0, 7), band95: [p.p025, p.p975], band68: [p.p16, p.p84], actual: p.actual }))}>
                <CartesianGrid stroke="rgba(148,100,255,0.08)" vertical={false} />
                <XAxis dataKey="x" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--muted)' }} width={60} tickFormatter={v => `$${Number(v).toFixed(0)}`} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => (Array.isArray(v) ? `${usd(v[0])} – ${usd(v[1])}` : usd(Number(v)))}
                />
                <Area dataKey="band95" name="Forecast 95%" stroke="none" fill="rgba(192,132,252,0.15)" isAnimationActive={false} />
                <Area dataKey="band68" name="Forecast 68%" stroke="none" fill="rgba(192,132,252,0.3)" isAnimationActive={false} />
                <Line dataKey="actual" name="Actual" stroke="var(--gold)" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)', marginTop: 8 }}>{DISCLAIMER}</div>
    </Shell>
  )
}

export function Shell({ symbol, onBack, children }: { symbol: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div style={{ animation: 'slideIn 0.3s ease', padding: '24px 0' }}>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)', padding: 0, marginBottom: 8 }}>← Back</button>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28, margin: '0 0 8px' }}>{symbol}</h2>
      {children}
    </div>
  )
}

export function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 18, marginBottom: 16, background: 'rgba(22,16,43,0.7)', border: '1px solid var(--border)', borderRadius: 14 }}>{children}</div>
}

export function Btn({ children, onClick, color, active, pressed, disabled, title }: { children: React.ReactNode; onClick: () => void; color?: string; active?: boolean; pressed?: boolean; disabled?: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} aria-pressed={pressed} style={{
      padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
      color: color ?? (active ? 'var(--accent)' : 'var(--muted)'),
      background: active ? 'rgba(192,132,252,0.12)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? 'rgba(192,132,252,0.35)' : 'var(--border)'}`,
    }}>{children}</button>
  )
}
```

- [ ] **Step 7: Create `src/components/PredictionsTab.tsx`**

```tsx
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
```

- [ ] **Step 8: Update `src/components/Header.tsx`**

Read the file first. Then:
1. Replace everything from the first line through the end of the `tabs` array declaration (the line `]` after `{ id: 'history', label: 'History' },`) with:
```tsx
import { useStore } from '../store'
import { stats } from '../game/scoring'
import { Tab } from '../App'
import SymbolSearch from './SymbolSearch'
import type { SearchResult } from '../data'

interface Props {
  onSelectSymbol: (r: SearchResult) => void
  tab: Tab
  setTab: (t: Tab) => void
}

const TAB_ICONS: Record<Tab, string> = {
  watchlist: '◈',
  replay: '↺',
  predictions: '◎',
}

export default function Header({ tab, setTab, onSelectSymbol }: Props) {
  const predictions = useStore(s => s.predictions)
  const reset = useStore(s => s.reset)
  const st = stats(predictions)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'watchlist', label: 'Watchlist' },
    { id: 'replay', label: 'Replay' },
    { id: 'predictions', label: 'Predictions' },
  ]
```
2. Replace the whole right-hand group — the `<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>` that follows `<SymbolSearch onSelect={onSelectSymbol} />`, through its matching closing `</div>` (it contains the Portfolio value, Cash badge, Refresh, Bell and Reset blocks) — with:
```tsx
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Stat label="SCORE" value={String(st.score)} color="var(--accent)" />
            <Stat label="STREAK" value={String(st.streak)} color="var(--gold)" />
            <Stat label="ACCURACY" value={st.accuracy === null ? '—' : `${Math.round(st.accuracy * 100)}%`} color="var(--green)" />
            <button
              onClick={() => { if (window.confirm('Reset your score and all predictions?')) reset() }}
              style={{
                padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: 1,
                color: 'var(--red)', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', cursor: 'pointer',
              }}
            >RESET</button>
          </div>
```
3. Delete the `{lastUpdated && ( … )}` block at the end of the tab bar.
4. Add this component at the end of the file:
```tsx
function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '6px 14px', minWidth: 76 }}>
      <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color }}>{value}</div>
    </div>
  )
}
```

- [ ] **Step 9: Rewrite `src/App.tsx`**

Replace the whole file with:
```tsx
import { useState, useEffect } from 'react'
import { useStore } from './store'
import { fetchHistory } from './data'
import type { SearchResult } from './data'
import type { Prediction } from './game/types'
import { horizonLabel } from './game/types'
import WatchlistTab from './components/WatchlistTab'
import StockPage from './components/StockPage'
import PredictionsTab from './components/PredictionsTab'
import Header from './components/Header'
import Ticker from './components/Ticker'
import Toast from './components/Toast'
import AnalystChat from './components/AnalystChat'

export type Tab = 'watchlist' | 'replay' | 'predictions'

export default function App() {
  const rememberName = useStore(s => s.rememberName)
  const resolveDue = useStore(s => s.resolveDue)
  const [tab, setTab] = useState<Tab>('watchlist')
  const [viewing, setViewing] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [toasts, setToasts] = useState<{ id: string; msg: string; ok: boolean }[]>([])

  const showToast = (msg: string, ok: boolean) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, msg, ok }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }

  const announce = (ps: Prediction[]) => {
    for (const p of ps) {
      const label = `${p.symbol} ${horizonLabel(p.horizon)} call`
      showToast(p.status === 'won' ? `${label}: +${p.points} correct` : `${label}: missed`, p.status === 'won')
    }
  }

  // On load, resolve Live calls that came due since the last visit
  useEffect(() => {
    const symbols = [...new Set(useStore.getState().predictions
      .filter(p => p.mode === 'live' && p.status === 'open')
      .map(p => p.symbol))]
    for (const s of symbols) {
      fetchHistory(s).then(bars => announce(resolveDue(s, bars))).catch(() => { /* retried on the next load */ })
    }
  }, [])

  const openSymbol = (symbol: string) => { setViewing(symbol); window.scrollTo(0, 0) }
  const onSelectSymbol = (r: SearchResult) => {
    rememberName(r.symbol, r.name)
    openSymbol(r.symbol)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header tab={tab} setTab={t => { setViewing(null); setTab(t) }} onSelectSymbol={onSelectSymbol} />
      <Ticker />
      <main style={{ flex: 1, maxWidth: 1200, margin: '0 auto', width: '100%', padding: '0 20px 60px' }}>
        {viewing ? (
          <StockPage key={viewing} symbol={viewing} onBack={() => setViewing(null)} onSummary={setSummary} onResolved={announce} />
        ) : (
          <>
            {tab === 'watchlist'   && <WatchlistTab onOpen={openSymbol} />}
            {tab === 'replay'      && <div style={{ padding: '32px 0', color: 'var(--muted)' }}>Replay arrives in the next task.</div>}
            {tab === 'predictions' && <PredictionsTab onOpen={openSymbol} />}
          </>
        )}
      </main>
      <AnalystChat summary={summary} symbol={viewing} />
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 9000 }}>
        {toasts.map(t => <Toast key={t.id} msg={t.msg} ok={t.ok} />)}
      </div>
    </div>
  )
}
```
(Task 4 replaces the Replay placeholder line.)

- [ ] **Step 10: Update the analyst prompt wording**

In `src/components/AnalystChat.tsx`, in `BASE_PROMPT`:
- change `a paper-trading simulator with statistical forecasts` to `a stock prediction game with statistical forecasts, where players call Up or Down and earn more points for calls the forecast thought unlikely`;
- change the rule that forbids telling the user to buy or sell so it also says never tell the player which way to call (Up or Down).
Leave the rest of the file unchanged.

- [ ] **Step 11: Check for leftovers**

Run: `grep -rn "TradeModal\|PortfolioTab\|Loader\|fetchQuotes\|holdings\|STARTING_BALANCE\|from '../types'\|from './types'" src api`
Expected: no matches (hits inside `src/forecast/` or `src/game/` importing their own `./types.ts` are fine — check each).

- [ ] **Step 12: Verify**

Run: `npx tsc --noEmit -p .`, `npm test` (25 pass), `npm run build`, then `rm -rf dist`.

Manual (dev server on 5199): app loads with Watchlist / Replay / Predictions tabs and Score 0 · Streak 0 · Accuracy —; Predictions tab shows both empty states; Reset asks for confirmation.

- [ ] **Step 13: Hand off for commit**

Files: everything above, including deletions (`git add -A src api package.json`).
Suggested message: `Replace paper trading with prediction store, header stats and predictions tab`

---

### Task 3: Shared cone chart and Live call panel

**Files:**
- Create: `src/components/ConeChart.tsx`, `src/components/CallPanel.tsx`
- Modify: `src/components/StockPage.tsx`

**Interfaces:**
- Consumes: `Bar`, `Cone` from `src/forecast/types`; store `predictions`, `makeLiveCall`; `pointsFor`; `HORIZONS`, `horizonLabel`, `Horizon`.
- Produces:
  - `<ConeChart past={Bar[]} cone={Cone} actual?={Bar[]} hideDates?={boolean} />` — `past` ends at the cone's start bar; `actual` (optional) is the bars after the start, drawn as a gold "Actual" line over the cone; `hideDates` labels past points `-Nd` instead of dates.
  - `<CallPanel symbol={string} horizon={Horizon} pUp={number} startDate={string} startClose={number} />`

- [ ] **Step 1: Create `src/components/ConeChart.tsx`**

```tsx
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Bar, Cone } from '../forecast/types'

const usd = (x: number) => `$${x.toFixed(2)}`

export default function ConeChart({ past, cone, actual, hideDates }: { past: Bar[]; cone: Cone; actual?: Bar[]; hideDates?: boolean }) {
  const pastPts = past.map((b, i) => ({ x: hideDates ? `-${past.length - 1 - i}d` : b.date.slice(5), close: b.close }))
  const future = cone.bands.slice(1).map((b, i) => ({
    x: `+${b.step}d`, p50: b.p50, band95: [b.p025, b.p975], band68: [b.p16, b.p84], actual: actual?.[i]?.close,
  }))
  const join = {
    ...pastPts[pastPts.length - 1],
    p50: cone.start, band95: [cone.start, cone.start], band68: [cone.start, cone.start],
    actual: actual ? cone.start : undefined,
  }
  const data = [...pastPts.slice(0, -1), join, ...future]

  return (
    <div style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid stroke="rgba(148,100,255,0.08)" vertical={false} />
          <XAxis dataKey="x" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval="preserveStartEnd" minTickGap={40} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--muted)' }} width={60} tickFormatter={v => `$${Number(v).toFixed(0)}`} />
          <Tooltip
            contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            formatter={(v: any) => (Array.isArray(v) ? `${usd(v[0])} – ${usd(v[1])}` : usd(Number(v)))}
          />
          <Area dataKey="band95" name="95% range" stroke="none" fill="rgba(192,132,252,0.15)" isAnimationActive={false} />
          <Area dataKey="band68" name="68% range" stroke="none" fill="rgba(192,132,252,0.3)" isAnimationActive={false} />
          <Line dataKey="close" name="Close" stroke="var(--accent2)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <Line dataKey="p50" name="Median" stroke="var(--accent)" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          {actual && <Line dataKey="actual" name="Actual" stroke="var(--gold)" dot={false} strokeWidth={2} animationDuration={900} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/CallPanel.tsx`**

```tsx
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
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          You called <b style={{ color: 'var(--text)' }}>{open.call.toUpperCase()}</b> on {open.startDate} at {usd(open.startClose)} · resolves after {horizon} trading days.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Will {symbol} close above or below {usd(startClose)} in {horizonLabel(horizon)}? Points if you're right; a miss scores 0.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <CallButton onClick={() => call('up')} color="var(--green)">▲ Up +{pointsFor(pUp, 'up')}</CallButton>
            <CallButton onClick={() => call('down')} color="var(--red)">▼ Down +{pointsFor(pUp, 'down')}</CallButton>
          </div>
        </>
      )}
    </div>
  )
}

export function CallButton({ children, onClick, color, disabled }: { children: React.ReactNode; onClick: () => void; color: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 1, padding: '12px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono)',
      color, background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}`, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
    }}>{children}</button>
  )
}
```

- [ ] **Step 3: Use both in `src/components/StockPage.tsx`**

1. Add imports: `import ConeChart from './ConeChart'` and `import CallPanel from './CallPanel'`.
2. Remove the now-unused Recharts imports that only the cone chart used — keep `ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid` only if the track-record chart still uses them (it does: keep the import line as is).
3. Delete the `past`, `future`, `join`, `chartData` constants.
4. Replace the `<div style={{ height: 320 }}> … </div>` block that wraps the cone `ResponsiveContainer` with:
```tsx
        <ConeChart past={bars.slice(-126)} cone={cone} />
```
5. Directly after the "Chance above" `<div>` (still inside the same `<Card>`), add:
```tsx
        <CallPanel symbol={symbol} horizon={horizon} pUp={upProb} startDate={last.date} startClose={last.close} />
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p .`, `npm test` (25 pass), `npm run build`, `rm -rf dist`.

Manual: open a ticker; Up and Down buttons show point values that add up to 100 (±1 from rounding); click Up → panel switches to "You called UP on {date} at {price}…"; switch horizon → buttons return for the new horizon; Predictions tab lists the open call; reload → it is still open.

- [ ] **Step 5: Hand off for commit**

Files: `src/components/ConeChart.tsx`, `src/components/CallPanel.tsx`, `src/components/StockPage.tsx`.
Suggested message: `Add Live call panel and shared cone chart`

---

### Task 4: Replay mode

**Files:**
- Create: `src/components/ReplayTab.tsx`
- Modify: `src/App.tsx` (replace the Replay placeholder)

**Interfaces:**
- Consumes: `fetchHistory`; `buildCone`, `probAbove`, `hashString`; `pickReplayStart`, `resolveCall`, `pointsFor`; `HORIZONS`, `horizonLabel`, `Horizon`, `Call`, `Prediction`; store `watchlist`, `recordReplay`; `DEFAULT_WATCHLIST`; `ConeChart`; `CallButton` from `./CallPanel`; `Card`, `Btn` from `./StockPage`.
- Produces: `<ReplayTab />`.

- [ ] **Step 1: Create `src/components/ReplayTab.tsx`**

```tsx
import { useState } from 'react'
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

  const newRound = async () => {
    const pool = watchlist.length ? watchlist : DEFAULT_WATCHLIST
    const symbol = pool[Math.floor(Math.random() * pool.length)]
    setBusy(true); setError(null); setResult(null)
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
    if (!round || result) return
    const { symbol, bars, s, horizon: h, pUp } = round
    const p: Prediction = {
      id: `replay-${symbol}-${bars[s].date}-${Date.now()}`, mode: 'replay', symbol, horizon: h, call: c,
      startDate: bars[s].date, startClose: bars[s].close, pUp, status: 'open',
    }
    const r = resolveCall(p, bars)
    if (!r) return // cannot happen: pickReplayStart guarantees the horizon bar exists
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

      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

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
              <CallButton onClick={() => call('up')} color="var(--green)">▲ Up +{pointsFor(round.pUp, 'up')}</CallButton>
              <CallButton onClick={() => call('down')} color="var(--red)">▼ Down +{pointsFor(round.pUp, 'down')}</CallButton>
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
```

- [ ] **Step 2: Mount it in `src/App.tsx`**

- Add `import ReplayTab from './components/ReplayTab'`.
- Replace the placeholder line `{tab === 'replay' && <div …>Replay arrives in the next task.</div>}` with:
```tsx
            {tab === 'replay'      && <ReplayTab />}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p .`, `npm test` (25 pass), `npm run build`, `rm -rf dist`.

Manual: Replay tab → New round → chart shows `-125d … -0d` labels, cone, "start date hidden", Up/Down point buttons; click one → gold Actual line animates over the cone, badge shows points or "0 · missed", start date appears; header Score/Accuracy/Streak update; Next round works; switching horizon applies to the next round; Predictions tab lists the replay as resolved.

- [ ] **Step 4: Hand off for commit**

Files: `src/components/ReplayTab.tsx`, `src/App.tsx`.
Suggested message: `Add Replay mode`

---

### Task 5: Docs and release check

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-23-tradr-prediction-game-design.md`

- [ ] **Step 1: Update `README.md`**

Read it first. Then:
1. Replace the intro paragraph under `# TRADR` with:
```markdown
A stock prediction game built on real market data. Pick any US stock or ETF, see where its price is statistically likely to go, and call **Up** or **Down**. The forecast sets the odds: calls it thought unlikely pay more. Play instant **Replay** rounds on hidden past data, or make **Live** calls on today's close that resolve on a later visit.
```
2. In **Features**, replace the "Paper trading" bullet with these two bullets:
```markdown
- **Prediction game**: call Up or Down over 1 week, 1 month or 3 months. A correct call pays `100 × (1 − the cone's probability for that side)`; a miss scores 0. Score, streak and accuracy are kept in your browser
- **Replay and Live**: Replay drops you at a random past date with the future hidden and scores you instantly; Live calls use today's close and resolve when you come back
```
   and change the TRADR Analyst bullet's ending from "it never recommends trades" to "it never tells you which way to call".
3. In the Twelve Data row of **Tech stack**, change "Symbol search, delayed quotes, daily history" to "Symbol search and daily history".
4. In **Project structure**, delete the `quote.ts` line under `api/`, add `├── game/              # Scoring: points, resolution, replay start, stats + tests` under `src/`, change the `store.ts` comment to `# Watchlist and predictions`, and change the components comment to `# Watchlist, StockPage, Replay, Predictions, AnalystChat, …`.
5. In **Environment variables**, change the `TWELVEDATA_API_KEY` "Used by" cell to `` `api/search.ts`, `api/history.ts` ``.
6. Change "runs the forecast engine tests" to "runs the forecast and game tests".

- [ ] **Step 2: Align the spec with what shipped**

In `docs/superpowers/specs/2026-10-23-tradr-prediction-game-design.md`, Live section, change "when a ticker's history is loaded (stock page, watchlist row, or the resolver below)" to "when the stock page loads a ticker's history, or the resolver below runs". In Architecture, add `ConeChart.tsx` (shared chart) to the components list. In Error handling, change the history-failure bullet to: "History load failure: the stock page shows the error text (reopening the ticker retries, since failed fetches are evicted from the cache); Replay shows the error and the New round button tries again; Live calls stay open and retry on the next load."

- [ ] **Step 3: Final verification**

```bash
npx tsc --noEmit -p .
npx tsc --noEmit --target ES2020 --module esnext --moduleResolution bundler --skipLibCheck --types node api/*.ts
npm test
npm run build
grep -c "gsk_\|TWELVEDATA" dist/assets/*.js
```
Expected: exit 0 for all; 25 tests pass; grep prints 0. Then `rm -rf dist`.

- [ ] **Step 4: Hand off for commit and deploy**

Files: `README.md`, the spec.
Suggested message: `Document the prediction game`
After the user pushes, check the live site: one Replay round end to end, one Live call shown as open, Reset clears.
