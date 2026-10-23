# TRADR Foresight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace TRADR's simulated market with real US stock data, add a statistical forecast view (probability cone, signals, track record) per ticker, keep paper trading, and turn the chat into a single analyst that explains the forecast.

**Architecture:** Three new Vercel functions (`api/search.ts`, `api/quote.ts`, `api/history.ts`) proxy Twelve Data with the key server-side and CDN caching. A pure-TypeScript engine in `src/forecast/` turns daily closes into a cone, signals and a walk-forward track record. The existing Zustand store keeps trading logic; assets become real tickers keyed by symbol.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Zustand 4 (persist), Recharts 2, Vercel Node functions, Twelve Data REST API, Groq (existing `/api/chat`), Node 24 built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-23-tradr-foresight-design.md`

## Global Constraints

- **Git: the user runs every git write command** (add, commit, push, branch, checkout, stash, reset…). Never run them. Each task ends with "Hand off for commit": stop, list changed files, and give the suggested commit message. Read-only git (status, diff, log) is fine.
- No new npm dependencies. Tests use `node:test` + `node:assert/strict`, run by Node 24's built-in TypeScript type stripping.
- Files under `src/forecast/` must import each other with explicit `.ts` extensions (`./rng.ts`) and use `import type` for type-only imports, so Node can run them directly. `tsconfig.json` already has `allowImportingTsExtensions: true`.
- API keys only via `process.env` inside `api/`. Never `VITE_`-prefixed. Env names: `TWELVEDATA_API_KEY`, `GROQ_API_KEY`.
- Vercel functions use the default Node handler signature `export default async function handler(req, res)` (the Web `export POST` signature crashed on this project). `package.json` has `"type": "module"`.
- Files in `api/` starting with `_` are helpers, not routes. Inside `api/`, import siblings with a `.js` extension (`./_twelvedata.js`): Vercel compiles each file to `.js`, and Vite and tsc both resolve `.js` to the `.ts` source.
- Ticker input: `/^[A-Z0-9.\-]{1,10}$/` after uppercasing; max 8 symbols per quote call.
- Cache headers: search `s-maxage=86400`, quote `s-maxage=300`, history `s-maxage=21600`, each with `stale-while-revalidate=86400`.
- Disclaimer text, verbatim: `Statistical projection from past prices. Not financial advice.`
- No combined buy/sell rating anywhere. Signals are shown as tone counts only.
- Default watchlist: `['SPY', 'AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN']`. Starting balance `100_000`.
- Styling follows the existing inline-style pattern with CSS variables from `src/index.css` (`--bg2`, `--border`, `--accent`, `--accent2`, `--green`, `--red`, `--gold`, `--text`, `--muted`, `--faint`, `--font-mono`, `--font-sans`).

## File Map

| File | Responsibility |
|---|---|
| `src/forecast/types.ts` | `Bar`, `Cone`, `ConeBand`, `Signal`, `TrackRecord` types |
| `src/forecast/rng.ts` | Seeded PRNG + string hash |
| `src/forecast/cone.ts` | Block-bootstrap Monte Carlo cone, `probAbove` |
| `src/forecast/signals.ts` | SMA, RSI, trend/momentum/RSI/volatility signals |
| `src/forecast/trackRecord.ts` | Walk-forward backtest of the 21-day cone |
| `src/forecast/summary.ts` | Compact text summary for the analyst chat |
| `src/forecast/forecast.test.ts` | All engine tests |
| `api/_twelvedata.ts` | Shared upstream fetch, response helper, ticker validation |
| `api/search.ts`, `api/quote.ts`, `api/history.ts` | Thin Vercel routes |
| `vite.config.ts` | Dev middleware serving any `api/<name>.ts` |
| `src/data.ts` | Client fetchers, history cache + rate limiter, `useHistory` hook |
| `src/types.ts`, `src/store.ts` | Real-ticker assets, watchlist, persist v2 |
| `src/components/WatchlistTab.tsx` | Watchlist rows with sparkline + signal counts |
| `src/components/StockPage.tsx` | Cone chart, signals, track record, trade buttons |
| `src/components/SymbolSearch.tsx` | Header ticker search |
| `src/components/AnalystChat.tsx` | Single analyst chat (replaces `FloatingChat.tsx`) |
| Delete | `src/prices.ts`, `src/assets.ts`, `src/agents/`, `src/components/MarketTab.tsx`, `src/components/TradersTab.tsx`, `src/components/FloatingChat.tsx` |

---

### Task 1: Forecast types, seeded RNG and probability cone

**Files:**
- Create: `src/forecast/types.ts`, `src/forecast/rng.ts`, `src/forecast/cone.ts`
- Test: `src/forecast/forecast.test.ts`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Produces:
  - `interface Bar { date: string; close: number }` (dates `YYYY-MM-DD`, arrays always oldest first)
  - `interface ConeBand { step: number; p025: number; p16: number; p50: number; p84: number; p975: number }`
  - `interface Cone { start: number; horizon: number; bands: ConeBand[]; finals: number[] }` — `bands[0]` is step 0 (all = start); `finals` sorted ascending
  - `mulberry32(seed: number): () => number`, `hashString(s: string): number`
  - `logReturns(closes: number[]): number[]`
  - `buildCone(closes: number[], horizon: number, opts?: ConeOptions): Cone` where `ConeOptions = { paths?: number; lookback?: number; block?: number; seed?: number }` (defaults 5000, 252, 5, 1). Throws `Error('Not enough history')` if fewer than 21 returns.
  - `probAbove(cone: Cone, price: number): number` (0..1)

- [ ] **Step 1: Add the test script to `package.json`**

In `"scripts"`, add after `"preview"`:
```json
    "test": "node --test \"src/forecast/*.test.ts\""
```

- [ ] **Step 2: Write the failing tests**

Create `src/forecast/forecast.test.ts`:
```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module` for `./rng.ts`.

- [ ] **Step 4: Write `src/forecast/types.ts`**

```ts
export interface Bar { date: string; close: number }

export interface ConeBand { step: number; p025: number; p16: number; p50: number; p84: number; p975: number }

export interface Cone {
  start: number
  horizon: number
  bands: ConeBand[]   // bands[0] is today (all values = start)
  finals: number[]    // simulated prices at the horizon, sorted ascending
}

export type Tone = 'bullish' | 'neutral' | 'bearish'

export interface Signal {
  id: 'trend' | 'momentum' | 'rsi' | 'volatility'
  label: string
  tone: Tone
  detail: string
}

export interface TrackPoint {
  anchorDate: string
  start: number
  p025: number
  p16: number
  p84: number
  p975: number
  actual: number
  in68: boolean
  in95: boolean
}

export interface TrackRecord { points: TrackPoint[]; in68: number; in95: number; horizon: number }
```

- [ ] **Step 5: Write `src/forecast/rng.ts`**

```ts
// Small seeded PRNG so forecasts are stable across reloads and tests are deterministic.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// FNV-1a
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
```

- [ ] **Step 6: Write `src/forecast/cone.ts`**

```ts
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
```

Note: the constant-price test expects exactly `50`. `Math.exp(0) * 50 === 50`, so it holds.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test`
Expected: all 7 tests PASS.

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output, exit 0.

- [ ] **Step 9: Hand off for commit**

Files: `package.json`, `src/forecast/types.ts`, `src/forecast/rng.ts`, `src/forecast/cone.ts`, `src/forecast/forecast.test.ts`.
Suggested message: `Add seeded block-bootstrap forecast cone with tests`

---

### Task 2: Signals

**Files:**
- Create: `src/forecast/signals.ts`
- Test: append to `src/forecast/forecast.test.ts`

**Interfaces:**
- Consumes: `Signal`, `Tone` from `./types.ts`; `logReturns` from `./cone.ts`
- Produces:
  - `sma(closes: number[], n: number, end?: number): number | null` — mean of the `n` closes ending at index `end` (default last); `null` if not enough data
  - `rsi(closes: number[], n?: number): number | null` — Wilder RSI, default 14
  - `realizedVol(closes: number[], n?: number, end?: number): number | null` — annualised (×√252) stdev of the last `n` log returns, default 20
  - `computeSignals(closes: number[]): Signal[]` — always 4 signals in order trend, momentum, rsi, volatility
  - `toneCounts(signals: Signal[]): Record<Tone, number>`

- [ ] **Step 1: Write the failing tests**

Append to `src/forecast/forecast.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module` for `./signals.ts`.

- [ ] **Step 3: Write `src/forecast/signals.ts`**

```ts
import type { Signal, Tone } from './types.ts'
import { logReturns } from './cone.ts'

export function sma(closes: number[], n: number, end = closes.length - 1): number | null {
  if (end + 1 < n) return null
  let sum = 0
  for (let i = end - n + 1; i <= end; i++) sum += closes[i]
  return sum / n
}

// Wilder's RSI
export function rsi(closes: number[], n = 14): number | null {
  if (closes.length < n + 1) return null
  let gain = 0, loss = 0
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gain += d; else loss -= d
  }
  gain /= n; loss /= n
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    gain = (gain * (n - 1) + Math.max(d, 0)) / n
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n
  }
  if (loss === 0) return gain === 0 ? 50 : 100
  return 100 - 100 / (1 + gain / loss)
}

export function realizedVol(closes: number[], n = 20, end = closes.length - 1): number | null {
  if (end < n) return null
  const r = logReturns(closes.slice(end - n, end + 1))
  const mean = r.reduce((a, b) => a + b, 0) / r.length
  const variance = r.reduce((a, b) => a + (b - mean) ** 2, 0) / r.length
  return Math.sqrt(variance) * Math.sqrt(252)
}

const fmtPct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`

function trendSignal(closes: number[]): Signal {
  const price = closes[closes.length - 1]
  const s50 = sma(closes, 50)
  const s200 = sma(closes, 200)
  if (s50 === null) return { id: 'trend', label: 'Trend', tone: 'neutral', detail: 'Not enough history for a 50-day average yet.' }
  if (s200 === null) {
    const tone: Tone = price > s50 ? 'bullish' : price < s50 ? 'bearish' : 'neutral'
    return { id: 'trend', label: 'Trend', tone, detail: `Price is ${price > s50 ? 'above' : 'below'} its 50-day average. Not enough history for the 200-day.` }
  }
  let cross = ''
  const p50 = sma(closes, 50, closes.length - 21)
  const p200 = sma(closes, 200, closes.length - 21)
  if (p50 !== null && p200 !== null) {
    if (p50 <= p200 && s50 > s200) cross = ' Golden cross in the last 20 days (50-day moved above 200-day).'
    if (p50 >= p200 && s50 < s200) cross = ' Death cross in the last 20 days (50-day moved below 200-day).'
  }
  if (price > s50 && s50 > s200) return { id: 'trend', label: 'Uptrend', tone: 'bullish', detail: `Price is above the 50-day, which is above the 200-day average.${cross}` }
  if (price < s50 && s50 < s200) return { id: 'trend', label: 'Downtrend', tone: 'bearish', detail: `Price is below the 50-day, which is below the 200-day average.${cross}` }
  return { id: 'trend', label: 'Mixed trend', tone: 'neutral', detail: `Price and its 50- and 200-day averages disagree on direction.${cross}` }
}

function momentumSignal(closes: number[]): Signal {
  if (closes.length < 21) return { id: 'momentum', label: 'Momentum', tone: 'neutral', detail: 'Not enough history.' }
  const ch = closes[closes.length - 1] / closes[closes.length - 21] - 1
  const tone: Tone = ch > 0.05 ? 'bullish' : ch < -0.05 ? 'bearish' : 'neutral'
  return { id: 'momentum', label: `Momentum ${fmtPct(ch)}`, tone, detail: `Price changed ${fmtPct(ch)} over the last 20 trading days.` }
}

function rsiSignal(closes: number[]): Signal {
  const v = rsi(closes)
  if (v === null) return { id: 'rsi', label: 'RSI', tone: 'neutral', detail: 'Not enough history.' }
  if (v > 70) return { id: 'rsi', label: `RSI ${v.toFixed(0)}`, tone: 'bearish', detail: 'Above 70: overbought. Strong recent gains often cool off.' }
  if (v < 30) return { id: 'rsi', label: `RSI ${v.toFixed(0)}`, tone: 'bullish', detail: 'Below 30: oversold. Sharp recent losses often bounce.' }
  return { id: 'rsi', label: `RSI ${v.toFixed(0)}`, tone: 'neutral', detail: 'Between 30 and 70: no stretched move either way.' }
}

function volatilitySignal(closes: number[]): Signal {
  const now = realizedVol(closes)
  if (now === null) return { id: 'volatility', label: 'Volatility', tone: 'neutral', detail: 'Not enough history.' }
  const past: number[] = []
  for (let end = Math.max(20, closes.length - 252); end < closes.length; end++) {
    const v = realizedVol(closes, 20, end)
    if (v !== null) past.push(v)
  }
  const rank = past.filter(v => v <= now).length / past.length
  const regime = rank < 0.25 ? 'Low' : rank > 0.75 ? 'High' : 'Normal'
  const widthNote = regime === 'High' ? 'expect a wider cone' : regime === 'Low' ? 'expect a narrower cone' : 'cone width is typical'
  return {
    id: 'volatility',
    label: `${regime} volatility`,
    tone: 'neutral',
    detail: `20-day volatility is ${(now * 100).toFixed(0)}% annualised, higher than ${(rank * 100).toFixed(0)}% of the past year; ${widthNote}.`,
  }
}

export function computeSignals(closes: number[]): Signal[] {
  return [trendSignal(closes), momentumSignal(closes), rsiSignal(closes), volatilitySignal(closes)]
}

export function toneCounts(signals: Signal[]): Record<Tone, number> {
  const c: Record<Tone, number> = { bullish: 0, neutral: 0, bearish: 0 }
  for (const s of signals) c[s.tone]++
  return c
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS (7 from Task 1 + 6 new).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: exit 0.

- [ ] **Step 6: Hand off for commit**

Files: `src/forecast/signals.ts`, `src/forecast/forecast.test.ts`.
Suggested message: `Add trend, momentum, RSI and volatility signals`

---

### Task 3: Track record and chat summary

**Files:**
- Create: `src/forecast/trackRecord.ts`, `src/forecast/summary.ts`
- Test: append to `src/forecast/forecast.test.ts`

**Interfaces:**
- Consumes: `Bar`, `TrackRecord`, `TrackPoint`, `Cone`, `Signal` from `./types.ts`; `buildCone`, `probAbove` from `./cone.ts`; `toneCounts` from `./signals.ts`
- Produces:
  - `buildTrackRecord(bars: Bar[], opts?: { anchors?: number; horizon?: number; paths?: number; seed?: number }): TrackRecord` (defaults 12, 21, 2000, 1). Points oldest first. Anchor `i` (1..anchors) is index `bars.length - 1 - horizon * i`; skipped when that index < 252.
  - `summarizeForecast(input: { symbol: string; name: string; price: number; cone: Cone; signals: Signal[]; track: TrackRecord; position: { quantity: number; avgBuyPrice: number } | null }): string`

- [ ] **Step 1: Write the failing tests**

Append to `src/forecast/forecast.test.ts`:
```ts
import { buildTrackRecord } from './trackRecord.ts'
import { summarizeForecast } from './summary.ts'
import type { Bar } from './types.ts'

function makeBars(n: number): Bar[] {
  const closes = makeCloses(n)
  const t0 = Date.UTC(2023, 0, 2)
  return closes.map((close, i) => ({ date: new Date(t0 + i * 86400000).toISOString().slice(0, 10), close }))
}

test('track record has 12 ordered points with consistent totals', () => {
  const tr = buildTrackRecord(makeBars(600), { paths: 500 })
  assert.equal(tr.points.length, 12)
  assert.ok(tr.points[0].anchorDate < tr.points[11].anchorDate)
  assert.equal(tr.in95, tr.points.filter(p => p.in95).length)
  assert.equal(tr.in68, tr.points.filter(p => p.in68).length)
  assert.ok(tr.in68 <= tr.in95)
})

test('track record never reads data after the anchor', () => {
  const bars = makeBars(600)
  const a = buildTrackRecord(bars, { paths: 500 })
  // Change the final bar: only the newest point's `actual` may change; every cone must not.
  const changed = bars.map((b, i) => (i === bars.length - 1 ? { ...b, close: b.close * 3 } : b))
  const b = buildTrackRecord(changed, { paths: 500 })
  for (let i = 0; i < a.points.length; i++) {
    assert.equal(a.points[i].p025, b.points[i].p025)
    assert.equal(a.points[i].p975, b.points[i].p975)
  }
  assert.notEqual(a.points[11].actual, b.points[11].actual)
})

test('track record with short history returns fewer points', () => {
  const tr = buildTrackRecord(makeBars(300), { paths: 300 })
  assert.equal(tr.points.length, 2) // indices 278 and 257 are >= 252; 236 is not
})

test('summary is compact and mentions the key numbers', () => {
  const bars = makeBars(600)
  const closes = bars.map(b => b.close)
  const s = summarizeForecast({
    symbol: 'TEST', name: 'Test Corp', price: closes[closes.length - 1],
    cone: buildCone(closes, 21, { paths: 500 }),
    signals: computeSignals(closes),
    track: buildTrackRecord(bars, { paths: 300 }),
    position: { quantity: 3, avgBuyPrice: 90 },
  })
  assert.ok(s.length < 2000)
  assert.match(s, /TEST/)
  assert.match(s, /95%/)
  assert.match(s, /inside/)
  assert.match(s, /3 shares/)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module` for `./trackRecord.ts`.

- [ ] **Step 3: Write `src/forecast/trackRecord.ts`**

```ts
import type { Bar, TrackPoint, TrackRecord } from './types.ts'
import { buildCone } from './cone.ts'

const MIN_HISTORY = 252

// Walk-forward check: for each past anchor, build a cone from data up to that day only,
// then see where the price actually landed `horizon` trading days later.
export function buildTrackRecord(
  bars: Bar[],
  opts: { anchors?: number; horizon?: number; paths?: number; seed?: number } = {},
): TrackRecord {
  const { anchors = 12, horizon = 21, paths = 2000, seed = 1 } = opts
  const closes = bars.map(b => b.close)
  const points: TrackPoint[] = []

  for (let i = anchors; i >= 1; i--) {
    const idx = closes.length - 1 - horizon * i
    if (idx < MIN_HISTORY) continue
    const cone = buildCone(closes.slice(0, idx + 1), horizon, { paths, seed })
    const end = cone.bands[horizon]
    const actual = closes[idx + horizon]
    points.push({
      anchorDate: bars[idx].date,
      start: cone.start,
      p025: end.p025,
      p16: end.p16,
      p84: end.p84,
      p975: end.p975,
      actual,
      in68: actual >= end.p16 && actual <= end.p84,
      in95: actual >= end.p025 && actual <= end.p975,
    })
  }

  return {
    points,
    in68: points.filter(p => p.in68).length,
    in95: points.filter(p => p.in95).length,
    horizon,
  }
}
```

- [ ] **Step 4: Write `src/forecast/summary.ts`**

```ts
import type { Cone, Signal, TrackRecord } from './types.ts'
import { probAbove } from './cone.ts'
import { toneCounts } from './signals.ts'

const usd = (x: number) => `$${x.toFixed(2)}`

// Plain-text context for the analyst chat. Kept short: it counts toward /api/chat's 8,000-char limit.
export function summarizeForecast(input: {
  symbol: string
  name: string
  price: number
  cone: Cone
  signals: Signal[]
  track: TrackRecord
  position: { quantity: number; avgBuyPrice: number } | null
}): string {
  const { symbol, name, price, cone, signals, track, position } = input
  const end = cone.bands[cone.horizon]
  const counts = toneCounts(signals)
  const lines = [
    `Ticker: ${symbol} (${name}), last price ${usd(price)}.`,
    `Forecast horizon: ${cone.horizon} trading days. Median ${usd(end.p50)}; 68% range ${usd(end.p16)}-${usd(end.p84)}; 95% range ${usd(end.p025)}-${usd(end.p975)}.`,
    `Chance of ending above today's price: ${(probAbove(cone, cone.start) * 100).toFixed(0)}%.`,
    `Method: block-bootstrap Monte Carlo of the last year of daily returns.`,
    `Signals (${counts.bullish} bullish, ${counts.neutral} neutral, ${counts.bearish} bearish): ` +
      signals.map(s => `${s.label} [${s.tone}] - ${s.detail}`).join(' | '),
    track.points.length > 0
      ? `Track record (${track.horizon}-day cones, last ${track.points.length} months): actual price landed inside the 95% band ${track.in95}/${track.points.length} times and inside the 68% band ${track.in68}/${track.points.length} times.`
      : 'Track record: not enough history yet.',
    position
      ? `User holds ${position.quantity} shares at an average ${usd(position.avgBuyPrice)} (paper trading).`
      : 'User holds no position in this ticker.',
  ]
  return lines.join('\n')
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS (13 earlier + 4 new).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: exit 0.

- [ ] **Step 7: Hand off for commit**

Files: `src/forecast/trackRecord.ts`, `src/forecast/summary.ts`, `src/forecast/forecast.test.ts`.
Suggested message: `Add walk-forward track record and forecast summary`

---

### Task 4: Market data functions (`/api/search`, `/api/quote`, `/api/history`)

**Files:**
- Create: `api/_twelvedata.ts`, `api/search.ts`, `api/quote.ts`, `api/history.ts`
- Modify: `vite.config.ts` (generic dev middleware)
- Modify (user, not committed): local `.env` gets `TWELVEDATA_API_KEY=...`

**Interfaces:**
- Produces (HTTP, JSON):
  - `GET /api/search?q=nvd` → `{ results: { symbol: string; name: string; exchange: string; type: 'stock' | 'etf' }[] }`
  - `GET /api/quote?symbols=AAPL,MSFT` → `{ quotes: Record<string, { symbol: string; name: string; price: number; change: number; changePct: number; prevClose: number; marketOpen: boolean }> }`
  - `GET /api/history?symbol=AAPL` → `{ symbol: string; bars: { date: string; close: number }[] }` (oldest first, up to 500)
  - Errors: `{ error: string }` with 400 (bad input), 405 (not GET), 500 (missing key), or the upstream status (e.g. 429)

Twelve Data notes (verify against https://twelvedata.com/docs if a response shape differs):
- `GET https://api.twelvedata.com/symbol_search?symbol=nvd&outputsize=20` → `{ data: [{ symbol, instrument_name, exchange, instrument_type, country }] }`. Keep `country === 'United States'` and `instrument_type` of `Common Stock` (→ `stock`) or `ETF` (→ `etf`).
- `GET /quote?symbol=AAPL,MSFT&apikey=…` → one symbol: a quote object; several: `{ AAPL: {...}, MSFT: {...} }`. Quote fields are strings: `name`, `close`, `change`, `percent_change`, `previous_close`, `is_market_open` (boolean).
- `GET /time_series?symbol=AAPL&interval=1day&outputsize=500&apikey=…` → `{ values: [{ datetime, close, ... }] }`, **newest first**.
- Errors come back with HTTP 200 and a body like `{ status: 'error', code: 429, message: '...' }`. Always check `status === 'error'`.

- [ ] **Step 1: Add the key locally (user step)**

Ask the user to create a free key at https://twelvedata.com and add this line to `C:\Projects\TRADR\.env`:
```
TWELVEDATA_API_KEY=their_key_here
```
Do not read or print the key.

- [ ] **Step 2: Write `api/_twelvedata.ts`**

```ts
// Shared helpers for the Twelve Data proxy routes. Underscore prefix: not a route on Vercel.
import type { IncomingMessage, ServerResponse } from 'node:http'

export const TICKER = /^[A-Z0-9.\-]{1,10}$/

export function send(res: ServerResponse, status: number, body: unknown, cacheSeconds = 0) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  if (status === 200 && cacheSeconds > 0) {
    res.setHeader('Cache-Control', `public, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`)
  }
  res.end(JSON.stringify(body))
}

export function query(req: IncomingMessage): URLSearchParams {
  return new URL(req.url ?? '/', 'http://localhost').searchParams
}

// Returns parsed JSON, or { error, status } when the key is missing or Twelve Data reports an error.
export async function td(path: string, params: Record<string, string>): Promise<{ data?: any; error?: string; status: number }> {
  const apiKey = process.env.TWELVEDATA_API_KEY
  if (!apiKey) return { error: 'TWELVEDATA_API_KEY not set', status: 500 }
  const url = new URL(`https://api.twelvedata.com/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('apikey', apiKey)
  const r = await fetch(url)
  const data = await r.json().catch(() => null)
  if (!r.ok || !data || data.status === 'error') {
    return { error: data?.message ?? `Upstream error ${r.status}`, status: data?.code ?? (r.ok ? 502 : r.status) }
  }
  return { data, status: 200 }
}
```

- [ ] **Step 3: Write `api/search.ts`**

```ts
import type { IncomingMessage, ServerResponse } from 'node:http'
import { send, query, td } from './_twelvedata.js'

const TYPES: Record<string, 'stock' | 'etf'> = { 'Common Stock': 'stock', ETF: 'etf' }

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' })
  const q = (query(req).get('q') ?? '').trim()
  if (q.length < 1 || q.length > 30) return send(res, 400, { error: 'Invalid query' })

  const r = await td('symbol_search', { symbol: q, outputsize: '20' })
  if (r.error) return send(res, r.status, { error: r.error })

  const results = (r.data.data ?? [])
    .filter((d: any) => d.country === 'United States' && TYPES[d.instrument_type])
    .slice(0, 10)
    .map((d: any) => ({ symbol: d.symbol, name: d.instrument_name, exchange: d.exchange, type: TYPES[d.instrument_type] }))
  send(res, 200, { results }, 86400)
}
```

- [ ] **Step 4: Write `api/quote.ts`**

```ts
import type { IncomingMessage, ServerResponse } from 'node:http'
import { send, query, td, TICKER } from './_twelvedata.js'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' })
  const symbols = [...new Set((query(req).get('symbols') ?? '').toUpperCase().split(',').filter(Boolean))].sort()
  if (symbols.length === 0 || symbols.length > 8 || !symbols.every(s => TICKER.test(s))) {
    return send(res, 400, { error: 'Invalid symbols' })
  }

  const r = await td('quote', { symbol: symbols.join(',') })
  if (r.error) return send(res, r.status, { error: r.error })

  const raw: Record<string, any> = symbols.length === 1 ? { [symbols[0]]: r.data } : r.data
  const quotes: Record<string, unknown> = {}
  for (const s of symbols) {
    const q = raw[s]
    if (!q || q.status === 'error' || q.close == null) continue
    quotes[s] = {
      symbol: s,
      name: q.name ?? s,
      price: Number(q.close),
      change: Number(q.change),
      changePct: Number(q.percent_change),
      prevClose: Number(q.previous_close),
      marketOpen: Boolean(q.is_market_open),
    }
  }
  send(res, 200, { quotes }, 300)
}
```

- [ ] **Step 5: Write `api/history.ts`**

```ts
import type { IncomingMessage, ServerResponse } from 'node:http'
import { send, query, td, TICKER } from './_twelvedata.js'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' })
  const symbol = (query(req).get('symbol') ?? '').toUpperCase()
  if (!TICKER.test(symbol)) return send(res, 400, { error: 'Invalid symbol' })

  const r = await td('time_series', { symbol, interval: '1day', outputsize: '500' })
  if (r.error) return send(res, r.status, { error: r.error })

  const bars = (r.data.values ?? [])
    .map((v: any) => ({ date: String(v.datetime).slice(0, 10), close: Number(v.close) }))
    .filter((b: { close: number }) => Number.isFinite(b.close) && b.close > 0)
    .reverse() // Twelve Data returns newest first; the engine expects oldest first
  send(res, 200, { symbol, bars }, 21600)
}
```

- [ ] **Step 6: Generalise the dev middleware in `vite.config.ts`**

Replace the whole file with:
```ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  process.env.GROQ_API_KEY ??= env.GROQ_API_KEY
  process.env.TWELVEDATA_API_KEY ??= env.TWELVEDATA_API_KEY

  return {
    plugins: [
      react(),
      {
        // Dev only: serve api/<name>.ts the way Vercel does in production
        name: 'dev-api',
        configureServer(server) {
          server.middlewares.use('/api', async (req, res, next) => {
            const name = (req.url ?? '').split('?')[0].replace(/^\//, '')
            if (!/^[a-z]+$/.test(name)) return next()
            let raw = ''
            for await (const chunk of req) raw += chunk
            try { (req as any).body = raw ? JSON.parse(raw) : undefined } catch { (req as any).body = undefined }
            const { default: handler } = await server.ssrLoadModule(`/api/${name}.ts`)
            await handler(req, res)
          })
        },
      },
    ],
    resolve: {
      alias: { '@': '/src' }
    },
  }
})
```
Note: Connect strips the `/api` mount prefix, so `req.url` is `/quote?symbols=…`. The handlers only read the query string, so this works the same as on Vercel.

- [ ] **Step 7: Type-check and verify in dev**

Run: `npx tsc --noEmit -p .` → exit 0 (the `api/` folder is outside `include`, so also run `npx tsc --noEmit --module esnext --moduleResolution bundler --skipLibCheck --types node api/*.ts` → exit 0).

Start the dev server in the background: `npx vite --port 5199 --strictPort`. Then:
```bash
curl -s "localhost:5199/api/search?q=nvd" | head -c 300
curl -s "localhost:5199/api/quote?symbols=AAPL,MSFT" | head -c 400
curl -s "localhost:5199/api/history?symbol=AAPL" | head -c 200
curl -s -w ' %{http_code}' "localhost:5199/api/history?symbol=bad%20sym"
curl -s -w ' %{http_code}' "localhost:5199/api/chat"
```
Expected: NVDA in search results; both quotes with numeric `price`; history starts with the oldest date (~2 years ago); `{"error":"Invalid symbol"} 400`; chat still answers `{"error":"Method not allowed"} 405`. Stop the server afterwards.

- [ ] **Step 8: Hand off for commit**

Files: `api/_twelvedata.ts`, `api/search.ts`, `api/quote.ts`, `api/history.ts`, `vite.config.ts`.
Suggested message: `Add Twelve Data search, quote and history functions`
Remind the user: add `TWELVEDATA_API_KEY` to Vercel (Production and Preview) before pushing.

---

### Task 5: Client data layer

**Files:**
- Create: `src/data.ts`

**Interfaces:**
- Consumes: HTTP routes from Task 4; `Bar` from `./forecast/types.ts`
- Produces:
  - `interface Quote { symbol: string; name: string; price: number; change: number; changePct: number; prevClose: number; marketOpen: boolean }`
  - `interface SearchResult { symbol: string; name: string; exchange: string; type: 'stock' | 'etf' }`
  - `class ApiError extends Error { status: number }`
  - `searchSymbols(q: string): Promise<SearchResult[]>`
  - `fetchQuotes(symbols: string[]): Promise<Record<string, Quote>>` (splits into chunks of 8)
  - `fetchHistory(symbol: string): Promise<Bar[]>` (cached per session, rate-limited to 8 starts per 60 s)
  - `useHistory(symbol: string | null): { bars: Bar[] | null; error: string | null; loading: boolean }`

- [ ] **Step 1: Write `src/data.ts`**

```ts
import { useEffect, useState } from 'react'
import type { Bar } from './forecast/types'

export interface Quote { symbol: string; name: string; price: number; change: number; changePct: number; prevClose: number; marketOpen: boolean }
export interface SearchResult { symbol: string; name: string; exchange: string; type: 'stock' | 'etf' }

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function getJson(url: string): Promise<any> {
  const r = await fetch(url)
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new ApiError(body.error ?? `Request failed (${r.status})`, r.status)
  return body
}

export async function searchSymbols(q: string): Promise<SearchResult[]> {
  const body = await getJson(`/api/search?q=${encodeURIComponent(q)}`)
  return body.results
}

export async function fetchQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const unique = [...new Set(symbols)]
  const out: Record<string, Quote> = {}
  for (let i = 0; i < unique.length; i += 8) {
    const body = await getJson(`/api/quote?symbols=${unique.slice(i, i + 8).join(',')}`)
    Object.assign(out, body.quotes)
  }
  return out
}

// ponytail: per-tab limiter matching Twelve Data's free 8 credits/min; the CDN cache absorbs
// repeat visitors. A shared server-side budget would need a store (e.g. Vercel KV) if traffic grows.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 8
const starts: number[] = []
async function rateLimit() {
  for (;;) {
    const now = Date.now()
    while (starts.length && now - starts[0] > WINDOW_MS) starts.shift()
    if (starts.length < MAX_PER_WINDOW) { starts.push(now); return }
    await new Promise(r => setTimeout(r, WINDOW_MS - (now - starts[0]) + 50))
  }
}

const historyCache = new Map<string, Promise<Bar[]>>()

export function fetchHistory(symbol: string): Promise<Bar[]> {
  const key = symbol.toUpperCase()
  let p = historyCache.get(key)
  if (!p) {
    p = rateLimit()
      .then(() => getJson(`/api/history?symbol=${encodeURIComponent(key)}`))
      .then(body => body.bars as Bar[])
    p.catch(() => historyCache.delete(key)) // let a later call retry after an error
    historyCache.set(key, p)
  }
  return p
}

export function useHistory(symbol: string | null) {
  const [state, setState] = useState<{ bars: Bar[] | null; error: string | null; loading: boolean }>({ bars: null, error: null, loading: !!symbol })
  useEffect(() => {
    if (!symbol) return
    let alive = true
    setState({ bars: null, error: null, loading: true })
    fetchHistory(symbol)
      .then(bars => alive && setState({ bars, error: null, loading: false }))
      .catch((e: Error) => alive && setState({ bars: null, error: e.message, loading: false }))
    return () => { alive = false }
  }, [symbol])
  return state
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: exit 0.

- [ ] **Step 3: Hand off for commit**

Files: `src/data.ts`.
Suggested message: `Add client fetchers with history cache and rate limiting`

---

### Task 6: Switch the store to real tickers and remove the simulation

After this task the app builds and runs with the Portfolio and History tabs on real-ticker state; the watchlist and stock page arrive in Task 7, the chat in Task 8.

**Files:**
- Modify: `src/types.ts`, `src/store.ts`, `src/App.tsx`, `src/components/Header.tsx:1-40`, `src/components/PortfolioTab.tsx:1-10,127-133,430`, `src/components/TradeModal.tsx:13-18`
- Delete: `src/prices.ts`, `src/assets.ts`, `src/agents/` (3 files), `src/components/MarketTab.tsx`, `src/components/TradersTab.tsx`, `src/components/FloatingChat.tsx`

**Interfaces:**
- Consumes: `fetchQuotes`, `Quote` from `./data`
- Produces:
  - `type AssetClass = 'stock' | 'etf'`
  - `interface Asset { id: string; symbol: string; name: string; class: AssetClass; price: number; change24h: number; changePct: number }` — `id === symbol` (uppercase ticker)
  - Store additions: `STARTING_BALANCE` (exported const), `DEFAULT_WATCHLIST`, `watchlist: string[]`, `toggleWatch(symbol: string): void`, `upsertAssets(list: Asset[]): void`, `trackedSymbols(viewing: string | null): string[]` (viewing + holdings + pending orders + alerts, deduped)
  - `updatePrices(updates)` keeps its signature, keyed by symbol
  - `export type Tab = 'watchlist' | 'portfolio' | 'history'` in `App.tsx`

- [ ] **Step 1: Update `src/types.ts`**

Replace the first two declarations (`AssetClass` and `Asset`) with:
```ts
export type AssetClass = 'stock' | 'etf'

export interface Asset {
  id: string        // uppercase ticker, same as symbol
  symbol: string
  name: string
  class: AssetClass
  price: number
  change24h: number
  changePct: number
}
```
Leave `Holding`, `Trade`, `PortfolioSnapshot`, `PriceAlert`, `LimitOrder` unchanged.

- [ ] **Step 2: Update `src/store.ts`**

a) Replace the import line `import { ASSETS, STARTING_BALANCE } from './assets'` with:
```ts
export const STARTING_BALANCE = 100_000
export const DEFAULT_WATCHLIST = ['SPY', 'AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN']
```

b) In `interface PortfolioStore`, replace the `favourites: string[]` field with `watchlist: string[]`, and replace the `// Favourites` block (`toggleFavourite`) with:
```ts
  // Watchlist + real tickers
  toggleWatch: (symbol: string) => void
  upsertAssets: (list: Asset[]) => void
  trackedSymbols: (viewing: string | null) => string[]
```

c) In the initial state, change `assets: ASSETS,` to `assets: [],` and `favourites: [],` to `watchlist: DEFAULT_WATCHLIST,`.

d) Replace the `toggleFavourite` implementation with:
```ts
      toggleWatch: (symbol) => set(s => ({
        watchlist: s.watchlist.includes(symbol)
          ? s.watchlist.filter(x => x !== symbol)
          : [...s.watchlist, symbol],
      })),

      // Merge by id; never overwrite a known price with 0
      upsertAssets: (list) => set(s => {
        const byId = new Map(s.assets.map(a => [a.id, a]))
        for (const a of list) {
          const old = byId.get(a.id)
          byId.set(a.id, old && a.price === 0 ? { ...a, price: old.price, change24h: old.change24h, changePct: old.changePct } : a)
        }
        return { assets: [...byId.values()] }
      }),

      trackedSymbols: (viewing) => {
        const { holdings, pendingOrders, alerts } = get()
        return [...new Set([
          ...(viewing ? [viewing] : []),
          ...holdings.map(h => h.assetId),
          ...pendingOrders.map(o => o.assetId),
          ...alerts.map(a => a.assetId),
        ])]
      },
```

e) Replace `{ name: 'tradr-portfolio' }` at the bottom with:
```ts
    {
      name: 'tradr-portfolio',
      version: 2,
      // v1 held simulated assets (renamed tickers, bonds, crypto) that no longer exist: start fresh
      migrate: () => ({}),
    }
```

- [ ] **Step 3: Update `src/components/Header.tsx`**

- Line 2: replace `import { STARTING_BALANCE } from '../assets'` with `import { useStore, STARTING_BALANCE } from '../store'` and delete the separate `import { useStore } from '../store'` on line 1.
- Replace `TAB_ICONS` with:
```ts
const TAB_ICONS: Record<Tab, string> = {
  watchlist: '◈',
  portfolio: '⬡',
  history: '◷',
}
```
- Replace the `tabs` array with:
```ts
  const tabs: { id: Tab; label: string }[] = [
    { id: 'watchlist', label: 'Watchlist' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'history', label: 'History' },
  ]
```

- [ ] **Step 4: Update `src/components/PortfolioTab.tsx`**

- Line 4: replace `import { CLASS_COLORS, STARTING_BALANCE } from '../assets'` with `import { STARTING_BALANCE } from '../store'` (merge into the existing `useStore` import from `'../store'`).
- Replace the `PIE_CLASS_COLORS` object (lines 127-133) with:
```ts
  const PIE_CLASS_COLORS: Record<string, string> = {
    stock: '#67e8f9',
    etf:   '#fcd34d',
    cash:  '#7060a0',
  }
```
- Line 430: replace `CLASS_COLORS[asset.class]` with `PIE_CLASS_COLORS[asset.class]`.

- [ ] **Step 5: Update `src/components/TradeModal.tsx`**

Replace the `CLASS_GLOW` object with:
```ts
const CLASS_GLOW: Record<string, { from: string; to: string; glow: string }> = {
  stock: { from: '#67e8f9', to: '#a78bfa', glow: 'rgba(103,232,249,0.3)' },
  etf:   { from: '#fcd34d', to: '#f9a8d4', glow: 'rgba(252,211,77,0.3)' },
}
```
and change `CLASS_GLOW[asset.class] ?? CLASS_GLOW.crypto` to `CLASS_GLOW[asset.class] ?? CLASS_GLOW.stock`.

- [ ] **Step 6: Update `src/App.tsx`**

a) Replace the imports block (lines 1-13) with:
```ts
import { useState, useEffect, useCallback } from 'react'
import { useStore } from './store'
import { fetchQuotes } from './data'
import Header from './components/Header'
import Loader from './components/Loader'
import Ticker from './components/Ticker'
import PortfolioTab from './components/PortfolioTab'
import TradeModal from './components/TradeModal'
import Toast from './components/Toast'
import { Asset } from './types'
```

b) Change `export type Tab = 'market' | 'portfolio' | 'history' | 'traders'` to:
```ts
export type Tab = 'watchlist' | 'portfolio' | 'history'
```

c) In `App()`, delete the `assets`, `tickAgents`, `initAgents` selectors; change `useState<Tab>('market')` to `useState<Tab>('portfolio')` (Task 7 switches the default to `'watchlist'`); add:
```ts
  const upsertAssets = useStore(s => s.upsertAssets)
  const trackedSymbols = useStore(s => s.trackedSymbols)
  const [viewing, setViewing] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
```

d) Replace `refresh` and the effect that calls it with:
```ts
  // Delayed quotes only for what needs a live price: the viewed ticker, holdings, orders, alerts
  const refresh = useCallback(async () => {
    const symbols = trackedSymbols(viewing)
    if (symbols.length > 0) {
      try {
        const quotes = await fetchQuotes(symbols)
        const existing = useStore.getState().assets
        upsertAssets(Object.values(quotes).map(q => ({
          id: q.symbol,
          symbol: q.symbol,
          name: q.name,
          class: existing.find(a => a.id === q.symbol)?.class ?? 'stock',
          price: q.price,
          change24h: q.change,
          changePct: q.changePct,
        })))
        updatePrices(Object.fromEntries(Object.values(quotes).map(q => [q.symbol, { price: q.price, change24h: q.change, changePct: q.changePct }])))
        setStale(false)
      } catch {
        setStale(true) // keep last known prices
      }
    }
    setLoading(false)
  }, [viewing, trackedSymbols, upsertAssets, updatePrices])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 300_000)
    return () => clearInterval(interval)
  }, [refresh])
```

e) In the JSX `<main>`, replace the four tab lines with:
```tsx
        {stale && (
          <div style={{ margin: '16px 0 0', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--gold)', border: '1px solid rgba(252,211,77,0.3)' }}>
            Data may be stale: the market data provider is rate-limiting. Showing last known prices.
          </div>
        )}
        {tab === 'portfolio' && <PortfolioTab onTrade={openTrade} />}
        {tab === 'history'   && <HistoryTab />}
```
and delete `<FloatingChat />`.

`setViewing` stays unused until Task 7. That is fine: the tsconfig has no `noUnusedLocals`.

- [ ] **Step 7: Delete the simulation, bots and old tabs**

Delete: `src/prices.ts`, `src/assets.ts`, `src/agents/agentPersonalities.ts`, `src/agents/agentStore.ts`, `src/agents/agentTypes.ts`, `src/components/MarketTab.tsx`, `src/components/TradersTab.tsx`, `src/components/FloatingChat.tsx`.

Run: `grep -rn "assets'\|agents/\|prices'\|FloatingChat\|MarketTab\|TradersTab\|favourite" src`
Expected: no matches.

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: all exit 0.

Manual (dev server on 5199): app loads, Portfolio shows $100,000 cash, History tab says no trades. In devtools Application → Local Storage, `tradr-portfolio` has `"version":2`.

- [ ] **Step 9: Hand off for commit**

Files: `src/types.ts`, `src/store.ts`, `src/App.tsx`, `src/components/Header.tsx`, `src/components/PortfolioTab.tsx`, `src/components/TradeModal.tsx`, deleted files above.
Suggested message: `Switch to real tickers; remove price simulation and trader bots`

---

### Task 7: Watchlist, stock page and ticker search

**Files:**
- Create: `src/components/SymbolSearch.tsx`, `src/components/WatchlistTab.tsx`, `src/components/StockPage.tsx`
- Modify: `src/App.tsx`, `src/components/Header.tsx`, `src/components/Ticker.tsx`

**Interfaces:**
- Consumes: `useHistory`, `searchSymbols`, `SearchResult` from `../data`; `buildCone`, `probAbove` from `../forecast/cone`; `computeSignals`, `toneCounts` from `../forecast/signals`; `buildTrackRecord` from `../forecast/trackRecord`; `summarizeForecast` from `../forecast/summary`; `hashString` from `../forecast/rng`; store `watchlist`, `toggleWatch`, `upsertAssets`, `assets`, `holdings`
- Produces:
  - `<SymbolSearch onSelect={(r: SearchResult) => void} />`
  - `<WatchlistTab onOpen={(symbol: string) => void} />`
  - `<StockPage symbol={string} onTrade={(asset: Asset, type: 'buy' | 'sell') => void} onBack={() => void} onSummary={(s: string | null) => void} />`
  - Header prop `onSelectSymbol: (r: SearchResult) => void`

- [ ] **Step 1: Write `src/components/SymbolSearch.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { searchSymbols, SearchResult } from '../data'

export default function SymbolSearch({ onSelect }: { onSelect: (r: SearchResult) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 1) { setResults([]); return }
    const t = setTimeout(() => {
      searchSymbols(term).then(r => { setResults(r); setError(null) }).catch(e => setError(e.message))
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const pick = (r: SearchResult) => { onSelect(r); setQ(''); setResults([]) }

  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 320, margin: '0 16px' }}>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && results[0]) pick(results[0]) }}
        placeholder="Search any US ticker…"
        aria-label="Search ticker"
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
          color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 13,
        }}
      />
      {(results.length > 0 || error) && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 200,
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
        }}>
          {error && <div style={{ padding: 10, fontSize: 12, color: 'var(--red)' }}>{error}</div>}
          {results.map(r => (
            <button key={`${r.symbol}-${r.exchange}`} onClick={() => pick(r)} style={{
              display: 'flex', justifyContent: 'space-between', width: '100%', padding: '9px 12px',
              background: 'transparent', border: 'none', color: 'var(--text)', textAlign: 'left', cursor: 'pointer',
            }}>
              <span><b style={{ fontFamily: 'var(--font-mono)' }}>{r.symbol}</b> <span style={{ color: 'var(--muted)', fontSize: 12 }}>{r.name}</span></span>
              <span style={{ color: 'var(--faint)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{r.type.toUpperCase()} · {r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/WatchlistTab.tsx`**

```tsx
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
        style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}
      >✕</button>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/components/StockPage.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useStore } from '../store'
import { useHistory } from '../data'
import { Asset } from '../types'
import { buildCone, probAbove } from '../forecast/cone'
import { computeSignals, toneCounts } from '../forecast/signals'
import { buildTrackRecord } from '../forecast/trackRecord'
import { summarizeForecast } from '../forecast/summary'
import { hashString } from '../forecast/rng'
import NumberInput from './NumberInput'

const HORIZONS = [
  { days: 5, label: '1 week' },
  { days: 21, label: '1 month' },
  { days: 63, label: '3 months' },
]
const DISCLAIMER = 'Statistical projection from past prices. Not financial advice.'
const usd = (x: number) => `$${x.toFixed(2)}`
const TONE_COLOR = { bullish: 'var(--green)', neutral: 'var(--muted)', bearish: 'var(--red)' }

interface Props {
  symbol: string
  onTrade: (asset: Asset, type: 'buy' | 'sell') => void
  onBack: () => void
  onSummary: (s: string | null) => void
}

export default function StockPage({ symbol, onTrade, onBack, onSummary }: Props) {
  const { bars, error, loading } = useHistory(symbol)
  const asset = useStore(s => s.assets.find(a => a.id === symbol))
  const holding = useStore(s => s.holdings.find(h => h.assetId === symbol))
  const watchlist = useStore(s => s.watchlist)
  const toggleWatch = useStore(s => s.toggleWatch)
  const [horizon, setHorizon] = useState(21)
  const [target, setTarget] = useState('')

  const closes = useMemo(() => bars?.map(b => b.close) ?? [], [bars])
  const seed = bars?.length ? hashString(symbol + bars[bars.length - 1].date) : 1

  const cone = useMemo(() => {
    if (closes.length < 22) return null
    return buildCone(closes, horizon, { seed })
  }, [closes, horizon, seed])
  const signals = useMemo(() => (closes.length ? computeSignals(closes) : []), [closes])
  const track = useMemo(() => (bars ? buildTrackRecord(bars, { seed }) : null), [bars, seed])

  const price = asset?.price || closes[closes.length - 1] || 0
  const name = asset?.name ?? symbol

  useEffect(() => {
    if (!cone || !track) { onSummary(null); return }
    onSummary(summarizeForecast({
      symbol, name, price, cone, signals, track,
      position: holding ? { quantity: holding.quantity, avgBuyPrice: holding.avgBuyPrice } : null,
    }))
  }, [symbol, name, price, cone, signals, track, holding?.quantity, holding?.avgBuyPrice])
  useEffect(() => () => onSummary(null), [])

  if (loading) return <Shell onBack={onBack} symbol={symbol}><div style={{ color: 'var(--muted)' }}>Loading history…</div></Shell>
  if (error || !bars) return <Shell onBack={onBack} symbol={symbol}><div style={{ color: 'var(--red)' }}>{error ?? 'No data'}</div></Shell>
  if (!cone) return <Shell onBack={onBack} symbol={symbol}><div style={{ color: 'var(--muted)' }}>Not enough price history to forecast {symbol}.</div></Shell>

  // Chart: last 126 trading days of history, then the cone
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
  const tradeAsset: Asset = asset ?? { id: symbol, symbol, name, class: 'stock', price, change24h: 0, changePct: 0 }

  return (
    <Shell onBack={onBack} symbol={symbol}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700 }}>{usd(price)}</div>
          {asset && <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: asset.changePct >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {asset.changePct >= 0 ? '▲' : '▼'} {Math.abs(asset.changePct).toFixed(2)}% today (delayed)
          </div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={() => toggleWatch(symbol)}>{watchlist.includes(symbol) ? '★ Watching' : '☆ Watch'}</Btn>
          <Btn onClick={() => onTrade(tradeAsset, 'buy')} color="var(--green)" disabled={!price}>Buy</Btn>
          <Btn onClick={() => onTrade(tradeAsset, 'sell')} color="var(--red)" disabled={!holding}>Sell</Btn>
        </div>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Probability cone</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {HORIZONS.map(h => (
              <Btn key={h.days} onClick={() => setHorizon(h.days)} active={h.days === horizon}>{h.label}</Btn>
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
          <b>{(upProb * 100).toFixed(0)}%</b> chance of ending above today's price.
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

function Shell({ symbol, onBack, children }: { symbol: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div style={{ animation: 'slideIn 0.3s ease', padding: '24px 0' }}>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)', padding: 0, marginBottom: 8 }}>← Back</button>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28, margin: '0 0 8px' }}>{symbol}</h2>
      {children}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 18, marginBottom: 16, background: 'rgba(22,16,43,0.7)', border: '1px solid var(--border)', borderRadius: 14 }}>{children}</div>
}

function Btn({ children, onClick, color, active, disabled }: { children: React.ReactNode; onClick: () => void; color?: string; active?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
      color: color ?? (active ? 'var(--accent)' : 'var(--muted)'),
      background: active ? 'rgba(192,132,252,0.12)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? 'rgba(192,132,252,0.35)' : 'var(--border)'}`,
    }}>{children}</button>
  )
}
```

`NumberInput` (existing) takes `value: string`, `onChange(val: string)`, `placeholder?`; it has no `style` prop, so width is set by the wrapping `<div>`.

- [ ] **Step 4: Wire search into `src/components/Header.tsx`**

- Add imports: `import SymbolSearch from './SymbolSearch'` and `import type { SearchResult } from '../data'`.
- Add to `Props`: `onSelectSymbol: (r: SearchResult) => void`, and destructure it in the function signature.
- In the top row, directly after the logo block's closing `</div>` (the `</div>` right after the "Trading Playground" `<span>`, before `<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>`), insert:
```tsx
          <SymbolSearch onSelect={onSelectSymbol} />
```
- Change the "Trading Playground" text to `Market Foresight`.

- [ ] **Step 5: Wire views into `src/App.tsx`**

- Add imports:
```ts
import WatchlistTab from './components/WatchlistTab'
import StockPage from './components/StockPage'
import type { SearchResult } from './data'
```
- Change the default tab to `useState<Tab>('watchlist')`.
- Add state: `const [summary, setSummary] = useState<string | null>(null)` (used by Task 8).
- Add handlers:
```ts
  const openSymbol = (symbol: string) => { setViewing(symbol); window.scrollTo(0, 0) }
  const onSelectSymbol = (r: SearchResult) => {
    upsertAssets([{ id: r.symbol, symbol: r.symbol, name: r.name, class: r.type, price: 0, change24h: 0, changePct: 0 }])
    openSymbol(r.symbol)
  }
```
- Pass `onSelectSymbol={onSelectSymbol}` to `<Header … />`, and make the header's tab buttons also leave the stock page: change `setTab={setTab}` to `setTab={t => { setViewing(null); setTab(t) }}`.
- Replace the tab lines inside `<main>` (keep the stale banner above them) with:
```tsx
        {viewing ? (
          <StockPage symbol={viewing} onTrade={openTrade} onBack={() => setViewing(null)} onSummary={setSummary} />
        ) : (
          <>
            {tab === 'watchlist' && <WatchlistTab onOpen={openSymbol} />}
            {tab === 'portfolio' && <PortfolioTab onTrade={openTrade} />}
            {tab === 'history'   && <HistoryTab />}
          </>
        )}
```
`refresh` already depends on `viewing`, so opening a stock fetches its quote immediately.

- [ ] **Step 6: Make `src/components/Ticker.tsx` show watchlist closes**

Replace the first lines of the component (`const assets = …` through `const items = …`) with:
```tsx
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { fetchHistory } from '../data'

export default function Ticker() {
  const watchlist = useStore(s => s.watchlist)
  const [priced, setPriced] = useState<{ id: string; symbol: string; price: number; changePct: number }[]>([])

  // Uses cached daily history (shared with the watchlist rows), so no extra quote calls
  useEffect(() => {
    let alive = true
    Promise.allSettled(watchlist.map(fetchHistory)).then(results => {
      if (!alive) return
      setPriced(results.flatMap((r, i) => {
        if (r.status !== 'fulfilled' || r.value.length < 2) return []
        const [prev, last] = r.value.slice(-2)
        return [{ id: watchlist[i], symbol: watchlist[i], price: last.close, changePct: (last.close / prev.close - 1) * 100 }]
      }))
    })
    return () => { alive = false }
  }, [watchlist])

  if (priced.length === 0) return null

  const items = [...priced, ...priced] // duplicate for seamless loop
```
and delete the old `import { useStore } from '../store'` on line 1. The JSX below stays unchanged (it reads `a.id`, `a.symbol`, `a.price`, `a.changePct`).

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: all exit 0.

Manual, with the dev server:
1. Watchlist shows 6 rows with prices, sparklines and signal counts (the 7th+ history call waits up to a minute; with 6 it should not).
2. Search "nvd", pick NVDA: stock page shows the chart with history, a cone and a dashed median; horizon buttons change the cone width.
3. Signal cards show 4 cards; track record shows up to 12 months with "x/12" totals.
4. Buy 1 share: toast appears; Portfolio shows NVDA valued at the quote price; Sell is enabled on the stock page.
5. Remove a ticker from the watchlist with ✕; reload; it stays removed.
6. Disclaimer text appears under the stock page.

- [ ] **Step 8: Hand off for commit**

Files: `src/components/SymbolSearch.tsx`, `src/components/WatchlistTab.tsx`, `src/components/StockPage.tsx`, `src/App.tsx`, `src/components/Header.tsx`, `src/components/Ticker.tsx`.
Suggested message: `Add watchlist, stock forecast page and ticker search`

---

### Task 8: Analyst chat

**Files:**
- Create: `src/components/AnalystChat.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `summary: string | null` state from Task 7 (`App.tsx`); `POST /api/chat` with `{ messages: { role: 'system' | 'user' | 'assistant'; content: string }[] }` (max 12 messages, 8,000 chars each) returning Groq's `{ choices: [{ message: { content } }] }`
- Produces: `<AnalystChat summary={string | null} symbol={string | null} />`

- [ ] **Step 1: Write `src/components/AnalystChat.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'

interface Msg { role: 'user' | 'assistant'; content: string }

const BASE_PROMPT = `You are TRADR Analyst, the explainer inside TRADR, a paper-trading simulator with statistical forecasts.
Explain what the numbers below mean in plain language: the probability cone, the signals, and the track record.
Rules:
- Use only the data provided. If something isn't in it, say you don't know.
- Never tell the user to buy or sell, never give personal financial advice, and never claim certainty about future prices.
- Keep answers under 120 words. No headers. Short paragraphs or a short list are fine.`

export default function AnalystChat({ summary, symbol }: { summary: string | null; symbol: string | null }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    const next: Msg[] = [...msgs, { role: 'user', content: text }]
    setMsgs(next)
    setInput('')
    setBusy(true)
    const system = summary
      ? `${BASE_PROMPT}\n\nCurrent ticker data:\n${summary}`
      : `${BASE_PROMPT}\n\nNo ticker is open. Explain how TRADR's forecasts work in general, and suggest opening a ticker for specifics.`
    let reply = '[connection error — try again]'
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: system }, ...next.slice(-10)] }),
      })
      const data = await r.json()
      reply = data.choices?.[0]?.message?.content?.trim() || (data.error ? `[${data.error}]` : '[no response — try again]')
    } catch { /* keep default reply */ }
    setMsgs(m => [...m, { role: 'assistant', content: reply }])
    setBusy(false)
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 7000 }}>
      {open && (
        <div style={{
          width: 360, height: 460, marginBottom: 12, display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(180deg, #1a1035 0%, #110d24 100%)', border: '1px solid rgba(148,100,255,0.25)',
          borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 800 }}>TRADR Analyst</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
              {symbol ? `Explaining ${symbol}` : 'Open a ticker for specifics'} · not financial advice
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {msgs.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                Try: "What does the cone mean?" · "Why is volatility high?" · "How accurate has this been?"
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%',
                padding: '8px 11px', borderRadius: 10, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                background: m.role === 'user' ? 'rgba(192,132,252,0.18)' : 'rgba(255,255,255,0.05)',
              }}>{m.content}</div>
            ))}
            {busy && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Thinking…</div>}
            <div ref={bottomRef} />
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--border)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
              placeholder="Ask about this forecast…"
              aria-label="Message the analyst"
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13 }}
            />
            <button onClick={send} disabled={busy} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0c0818', fontWeight: 700, cursor: 'pointer' }}>Send</button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close analyst chat' : 'Open analyst chat'}
        style={{
          padding: '12px 18px', borderRadius: 999, border: '1px solid rgba(192,132,252,0.4)',
          background: 'linear-gradient(135deg, #a78bfa 0%, #67e8f9 100%)', color: '#0c0818', fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(167,139,250,0.35)',
        }}
      >{open ? 'Close' : 'Ask the Analyst'}</button>
    </div>
  )
}
```
It sits bottom-left so it never overlaps the toasts (bottom-right).

- [ ] **Step 2: Mount it in `src/App.tsx`**

Add `import AnalystChat from './components/AnalystChat'` and, where `<FloatingChat />` used to be (after `<NotificationDrawer … />`), add:
```tsx
      <AnalystChat summary={summary} symbol={viewing} />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: all exit 0.

Manual, with the dev server (needs `GROQ_API_KEY` in `.env`):
1. On the watchlist (no ticker), ask "how do your forecasts work?": the answer explains in general terms.
2. Open AAPL, ask "how accurate has this been?": the answer quotes the x/12 totals shown on the page.
3. Ask "should I buy?": the answer declines to recommend and explains the signals instead.

- [ ] **Step 4: Hand off for commit**

Files: `src/components/AnalystChat.tsx`, `src/App.tsx`.
Suggested message: `Add TRADR Analyst chat grounded in the forecast`

---

### Task 9: README and release check

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-23-tradr-foresight-design.md` (Files section: `AnalystChat.tsx` replaces `FloatingChat.tsx`; history cache `s-maxage=21600`)

- [ ] **Step 1: Rewrite `README.md`**

Replace the whole file with:
````markdown
# TRADR

Market foresight and paper trading for any US stock or ETF. TRADR pulls real daily prices, projects where a price is likely to be in a week, a month or three months as probability ranges, and shows how well those projections held up in the past. Practice trading with a simulated $100,000. No real money involved.

**Live demo:** https://tradr-ashy.vercel.app

## Features

- **Any US ticker**: search stocks and ETFs; real prices via Twelve Data (quotes delayed, refreshed every 5 minutes)
- **Probability cone**: 5,000 simulated paths from the stock's own last year of daily returns (block bootstrap), shown as 68% and 95% ranges, plus "chance above $X"
- **Signals**: trend (50/200-day averages, golden/death crosses), 20-day momentum, RSI(14), volatility regime, each explained in one sentence
- **Track record**: for each of the last 12 months, a cone built only from data available then, compared with where the price actually landed
- **Paper trading**: market and limit orders, price alerts, fractional shares, portfolio charts, realized P&L
- **TRADR Analyst**: AI chat (Groq) that explains the numbers on screen; it never recommends trades

Forecasts are statistical projections from past prices, not financial advice.

## Tech stack

| Tool | Role |
|---|---|
| React 18 + TypeScript + Vite | UI and build |
| Zustand + persist | Portfolio state in localStorage |
| Recharts | Price, cone and track-record charts |
| Vercel functions (`api/`) | Server-side proxies that keep API keys off the client, with CDN caching |
| Twelve Data API | Symbol search, delayed quotes, daily history |
| Groq API | Analyst chat |

## Getting started

```bash
npm install
```

Create `.env` with:

```
TWELVEDATA_API_KEY=your_twelve_data_key
GROQ_API_KEY=your_groq_key
```

Free keys: [twelvedata.com](https://twelvedata.com), [console.groq.com](https://console.groq.com). Then:

```bash
npm run dev
```

The Vite dev server also serves the `api/` functions, so no Vercel CLI is needed locally.

```bash
npm test
```

runs the forecast engine tests with Node's built-in test runner.

## Project structure

```
api/
├── _twelvedata.ts       # Shared upstream fetch + validation (not a route)
├── search.ts            # GET /api/search?q=
├── quote.ts             # GET /api/quote?symbols=
├── history.ts           # GET /api/history?symbol=
└── chat.ts              # POST /api/chat (Groq)
src/
├── forecast/            # Pure TS engine: cone, signals, track record, chat summary + tests
├── data.ts              # Client fetchers, history cache, rate limiter
├── store.ts             # Portfolio, orders, alerts, watchlist
└── components/          # Watchlist, StockPage, Portfolio, TradeModal, AnalystChat, …
```

## How the forecast works

1. Take the last 252 daily log returns.
2. Build 5,000 future paths by stitching together random 5-day blocks of those real returns. Blocks keep calm and volatile stretches together, and real returns keep fat tails a bell curve would miss.
3. At each future day, read the 2.5th, 16th, 50th, 84th and 97.5th percentiles: the median and the 68% and 95% ranges.
4. Track record: repeat steps 1-3 at 12 past monthly dates using only data up to each date, then check where the price really was 21 trading days later.

Results are seeded by ticker and date, so the same data gives the same cone.

## Environment variables

| Name | Where | Used by |
|---|---|---|
| `TWELVEDATA_API_KEY` | `.env` and Vercel | `api/search.ts`, `api/quote.ts`, `api/history.ts` |
| `GROQ_API_KEY` | `.env` and Vercel | `api/chat.ts` |

Keys are read only on the server. Don't prefix them with `VITE_`: Vite would inline them into the public bundle.
````

- [ ] **Step 2: Update the spec's Files section**

In `docs/superpowers/specs/2026-10-23-tradr-foresight-design.md`:
- In "Files → Add", add `src/data.ts`, `src/components/SymbolSearch.tsx`, `src/components/AnalystChat.tsx`, `src/forecast/{types,summary}.ts`, `api/_twelvedata.ts`.
- In "Files → Change", remove `FloatingChat.tsx (system prompt stays client-built, as today)`.
- In "Files → Remove", add `src/components/FloatingChat.tsx`.
- In "Architecture", change the history line's `cached until next market close` to `s-maxage=21600`.

- [ ] **Step 3: Final verification**

Run:
```bash
npx tsc --noEmit -p .
npm test
npm run build
grep -c "gsk_\|TWELVEDATA" dist/assets/*.js
```
Expected: first three exit 0; the grep prints `0` (no keys or key names in the client bundle). Then `rm -rf dist`.

Re-run the manual checks from Task 7 Step 7 and Task 8 Step 3 once end to end.

- [ ] **Step 4: Hand off for commit and deploy**

Files: `README.md`, `docs/superpowers/specs/2026-10-23-tradr-foresight-design.md`.
Suggested message: `Rewrite README for TRADR Foresight`

Before the user pushes, confirm with them that Vercel has both `TWELVEDATA_API_KEY` and `GROQ_API_KEY` for Production (`npx vercel env ls` shows names only). After their push and deploy, check:
```bash
curl -s "https://tradr-ashy.vercel.app/api/history?symbol=AAPL" | head -c 200
curl -s -X POST https://tradr-ashy.vercel.app/api/chat -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"hi"}]}' | head -c 200
```
Expected: bars JSON, and a Groq completion.
