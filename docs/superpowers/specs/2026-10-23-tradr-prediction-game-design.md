# TRADR Prediction Game — Design

Date: 2026-10-23
Status: Draft for review
Builds on: `2026-10-23-tradr-foresight-design.md` (forecast engine, market-data functions, watchlist, stock page, analyst chat — all kept)

## Goal

Replace paper trading with a prediction game. Players call whether a stock closes **Up** or **Down** over a horizon. The forecast cone sets the odds: calls the cone thought unlikely pay more. Two modes: **Replay** (instant rounds on hidden past data, so a one-time visitor can play) and **Live** (calls on today's last close that resolve on a later visit). Scores live in the browser.

## Decisions

| Topic | Decision |
|---|---|
| Prediction | Up or Down, over 1 week / 1 month / 3 months (5 / 21 / 63 trading days). |
| Points | Correct call pays `round(100 × (1 − p))`, where `p` is the cone's probability for the side called. Wrong or flat pays 0. No negative points. |
| Modes | Replay and Live. |
| Storage | Per browser (Zustand persist in localStorage). No accounts, no leaderboard, no database. |
| Removed | Cash, holdings, trades, limit orders, price alerts, TradeModal, PortfolioTab, History tab, notification drawer and bell, $100k header, delayed-quote polling and `api/quote.ts`. |
| Kept | Forecast engine (`src/forecast/`), `api/search.ts`, `api/history.ts`, `api/chat.ts`, watchlist, stock page forecast, ticker search, scrolling ticker, analyst chat, `NumberInput` (stock page "chance above" box). |

## Rules

### Points
- Let `pUp = probAbove(cone, cone.start)` for the round's horizon. `pDown = 1 − pUp`.
- Correct Up pays `round(100 × (1 − pUp))`; correct Down pays `round(100 × pUp)`.
- A call resolves from closes: Up wins if `endClose > startClose`; Down wins if `endClose < startClose`; `endClose === startClose` is a miss for either call.
- Example: cone says 65% Up. Correct Up pays 35, correct Down pays 65.

### Stats
- **Score:** sum of points over resolved calls.
- **Streak:** number of consecutive won calls, counting back from the most recently resolved call. Ordered by resolution time.
- **Accuracy:** won ÷ resolved, shown as a whole percent; "—" with no resolved calls.
- Replay and Live count toward the same stats; the Predictions tab also shows per-mode totals.

### Replay
- **New round:** pick a random ticker from the watchlist (fall back to `DEFAULT_WATCHLIST` if empty) and a random horizon-valid start.
- Start index `s` is chosen uniformly from indices where `s ≥ 252` (enough history for a cone), `s + horizon ≤ last index` (outcome known), and the start date is between 63 and 378 trading days before the last bar (about 3 months to 1.5 years ago). If no index qualifies, show "Not enough history for a replay on X" and offer another round.
- The chart shows the 126 bars up to and including `s`, plus the cone built from `closes.slice(0, s + 1)` only. The start date is hidden until reveal; the ticker is shown.
- After the call: reveal the real path for the horizon, a badge ("+65 · correct" or "0 · missed"), and the start date. Then **Next round**.
- Replay rounds resolve immediately and are saved as resolved predictions.

### Live
- Made from the stock page's **Make a call** panel. Start = the last bar in history (last close), using the currently selected horizon.
- At most one open Live call per (ticker, horizon). While one is open the panel shows "Called Up on {startDate} · resolves after {horizon} trading days" instead of the buttons.
- Resolution: when the stock page loads a ticker's history, or the resolver below runs, any open Live call on it whose start index + horizon exists in the bars is resolved at that bar's close.
- On app load, the app fetches history for every ticker with an open Live call (through the existing cache and rate limiter) and resolves what's due. Each newly resolved Live call shows a toast: "NVDA 1-month call: +42 correct" / "NVDA 1-month call: missed".

## Architecture

```
src/game/
  types.ts        Prediction, Call, Mode
  scoring.ts      pointsFor, resolveCall, pickReplayStart, stats   (pure, no React/network)
  game.test.ts    node:test
src/store.ts      rewritten: watchlist, predictions, makeLiveCall, recordReplay, resolveDue, reset; persist v3
src/components/
  CallPanel.tsx       stock page Up/Down panel
  ReplayTab.tsx       Replay mode
  PredictionsTab.tsx  open Live calls + resolved history + per-mode totals
  ConeChart.tsx       shared cone chart (stock page and Replay)
  Header.tsx          Score / Streak / Accuracy + Reset (confirm)
  StockPage.tsx       adds CallPanel; shows last close instead of a quote; Buy/Sell removed
  AnalystChat.tsx     unchanged component; summary adds the open call
src/App.tsx       tabs: watchlist | replay | predictions; no quote refresh; live-call resolver on load
src/forecast/summary.ts   accepts an optional open call instead of a trading position
```

### Types

```ts
type Call = 'up' | 'down'
type Mode = 'live' | 'replay'
interface Prediction {
  id: string
  mode: Mode
  symbol: string
  horizon: 5 | 21 | 63
  call: Call
  startDate: string      // YYYY-MM-DD of the start bar
  startClose: number
  pUp: number            // cone probability of Up at call time, 0..1
  status: 'open' | 'won' | 'lost'
  endDate?: string
  endClose?: number
  points?: number        // set when resolved
  resolvedAt?: number    // ms timestamp, orders the streak
}
```

### Functions (`src/game/scoring.ts`)

- `pointsFor(pUp: number, call: Call): number`
- `resolveCall(p: Prediction, bars: Bar[]): Prediction | null` — `null` while `p` is resolved already, or the bar `horizon` trading days after `startDate` doesn't exist yet. Locates the start bar by `startDate`; if that date is missing from `bars`, uses the first bar after it.
- `pickReplayStart(bars: Bar[], horizon: number, rng: () => number): number | null`
- `stats(ps: Prediction[]): { score: number; streak: number; accuracy: number | null; byMode: Record<Mode, { score: number; won: number; resolved: number }> }`

### Data use
- Twelve Data calls now come only from `/api/history` (1 credit each, cached on the CDN 6 h) and `/api/search` (free). Replay draws from the watchlist's already-cached histories, so rounds usually cost nothing.
- Stock page and watchlist show the last daily close and the change versus the previous close.

## Error handling
- History load failure: the stock page shows the error text (reopening the ticker retries, since failed fetches are evicted from the cache); Replay shows the error and the New round button tries again; Live calls stay open and retry on the next load.
- Rate limit: unchanged limiter and single 429 retry in `src/data.ts`.
- Reset: `window.confirm('Reset your score and all predictions?')` before clearing.

## Testing
`npm test` widens to `node --test "src/**/*.test.ts"`. `src/game/game.test.ts` checks:
- `pointsFor` for pUp 0.5, 0.65, 0.9 on both calls.
- `resolveCall`: up win, down win, flat miss, `null` before the horizon bar exists, missing start date uses next bar.
- `pickReplayStart`: result always satisfies the bounds; `null` when history is too short; deterministic for a seeded rng.
- Replay cone uses no future bars: cone from `slice(0, s + 1)` is unchanged when bars after `s` are altered.
- `stats`: score sum, streak resets on a loss and orders by `resolvedAt`, accuracy null with no resolved calls, per-mode totals.

Plus `tsc`, `npm run build`, and a browser check: one Replay round end to end, one Live call created and shown as open, Reset clears.

## Out of scope
Global leaderboard, accounts, server-side scoring, multiplayer, calls on custom horizons or price targets, notifications outside the app.
