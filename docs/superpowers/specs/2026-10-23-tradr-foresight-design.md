# TRADR Foresight — Design

Date: 2026-10-23
Status: Draft for review

## Goal

Rebuild TRADR around real US stock data and statistical forecasting. Users look up any US ticker, see where its price is likely to go (as probability ranges, not point predictions), see how well those forecasts held up in the past, and paper-trade with a simulated $100,000. The AI chat explains the numbers; it does not produce them.

## Decisions

| Topic | Decision |
|---|---|
| Paper trading | Kept. Buys, sells and limit orders execute at real delayed quotes. |
| Markets | Any US stock or ETF ticker, via search. |
| Freshness | Quotes delayed up to ~15 min, refreshed every 5 min. Forecasts use daily closes. |
| Forecasting | Pure TypeScript statistics in the browser. No ML server, no LLM-generated numbers. |
| Data source | Twelve Data free plan (8 credits/min, 800/day; 1 credit per symbol per call). |
| Removed | Price simulation (GBM/O-U engines), CoinGecko and crypto, bonds, the five trader bots, leaderboard, Traders tab. |
| Chat | One "TRADR Analyst" assistant, grounded in the current ticker's forecast summary. |

## Architecture

```
Browser (React + Zustand)
 ├─ search   ──► /api/search?q=nvd           Twelve Data /symbol_search   s-maxage=86400
 ├─ quote    ──► /api/quote?symbols=A,B      Twelve Data /quote           s-maxage=300
 ├─ history  ──► /api/history?symbol=NVDA    Twelve Data /time_series     s-maxage=21600
 │                                           (interval=1day, outputsize=520)
 ├─ src/forecast/  pure functions on the history: cone, signals, track record
 └─ chat     ──► /api/chat                   Groq (existing), now receives a forecast summary
```

### Server functions (`api/`)

- Same shape as the existing `api/chat.ts`: default `(req, res)` Node handler, key read only from `process.env.TWELVEDATA_API_KEY`, inputs validated, responses trimmed to the fields the client uses.
- Ticker input: uppercase letters, digits, `.` and `-`, max 10 chars; `symbols` max 8 per call (matches the per-minute credit limit).
- Caching via `Cache-Control: public, s-maxage=…, stale-while-revalidate=…` so Vercel's CDN shares responses across visitors. No database.
- Upstream 429 or error: return the upstream status; the client keeps its last data and shows a "data may be stale" badge.
- The Vite dev middleware in `vite.config.ts` generalises from `/api/chat` to any `/api/<name>` so all four functions run under `npm run dev`.

### Forecast engine (`src/forecast/`)

Pure functions: arrays of `{ date, close }` in, plain objects out. No React, no network.

1. **Cone** — block bootstrap Monte Carlo. Take daily log returns from the last 252 trading days, resample them in 5-day blocks to build 5,000 paths over the chosen horizon (5, 21 or 63 trading days; shown as 1 week / 1 month / 3 months). Output per future day: 2.5th, 16th, 50th, 84th, 97.5th percentiles. Also: probability the price ends above today's close, and above/below a user-entered target. Seeded PRNG (seed = ticker + last date) so results are stable across reloads and tests are deterministic.
2. **Signals** — each returns `{ label, tone: 'bullish' | 'neutral' | 'bearish', detail }`:
   - Trend: close vs 50- and 200-day SMA; golden/death cross within the last 20 days.
   - Momentum: 20-day % change.
   - RSI(14): >70 overbought (bearish tone), <30 oversold (bullish tone), else neutral.
   - Volatility regime: 20-day realised volatility percentile within the last year: low (<25th), normal, high (>75th). Tone neutral; detail explains cone width.
   - Summary shown as counts (e.g. "2 bullish · 1 neutral · 1 bearish"). No combined buy/sell rating.
3. **Track record** — walk-forward backtest. For each of the last 12 monthly anchor dates, build a 21-day cone using only data up to that date, then check where the actual close 21 trading days later fell. Output per anchor: the cone, the actual price, inside-68 / inside-95 flags; plus totals ("11/12 inside 95%, 7/12 inside 68%"). Needs at least 252 + 12×21 days of history; with less, show fewer anchors and say so.

### Screens

- **Header** — ticker search with autocomplete; cash and total equity.
- **Watchlist tab** (replaces Market) — saved tickers with last close, day change, sparkline, signal counts. Default: SPY, AAPL, NVDA, MSFT, TSLA, AMZN. Add/remove persisted. Built from cached daily history; histories load in batches of at most 8 per minute.
- **Stock page** — price chart (Recharts) with the cone extending into the future and a horizon toggle; probability line; four signal cards; track-record chart with past cones over the actual price; Buy/Sell opening the existing `TradeModal`; disclaimer ("Statistical projection from past prices. Not financial advice.").
- **Portfolio tab** — unchanged features (holdings, equity curve, allocation, trade history), valued at real quotes. Delayed quotes only fetched for the viewed ticker and held positions.
- **Analyst chat** — `AnalystChat.tsx` (new, replaces `FloatingChat`) is the single assistant. Each request includes a compact JSON summary of the viewed ticker (cone percentiles at horizon, probabilities, signals, track record totals, the user's position). System prompt: explain what the numbers mean, never recommend specific trades or give personal financial advice, say when it doesn't know. `api/chat.ts` limits stay; the summary counts toward the 8,000-char message limit.

### State

- `store.ts` keeps cash, holdings, trades, limit orders, alerts; assets become ticker strings instead of entries in `assets.ts`.
- Persisted store version bumps; existing saved portfolios (simulated assets) reset to a fresh $100,000.
- Limit orders and alerts are checked whenever a quote for that ticker refreshes.

## Files

- Add: `api/search.ts`, `api/quote.ts`, `api/history.ts`, `api/_twelvedata.ts`, `src/data.ts`, `src/forecast/{cone,signals,trackRecord,rng,types,summary}.ts`, `src/forecast/forecast.test.ts`, `src/components/StockPage.tsx`, `src/components/WatchlistTab.tsx`, `src/components/SymbolSearch.tsx`, `src/components/AnalystChat.tsx`.
- Change: `vite.config.ts` (generic dev API middleware), `store.ts`, `types.ts`, `App.tsx`, `Header.tsx`, `PortfolioTab.tsx`, `TradeModal.tsx`, `Ticker.tsx` (scrolls watchlist last closes from cached history; no extra quote calls), `README.md`. `api/chat.ts` is unchanged.
- Remove: `src/prices.ts`, `src/assets.ts`, `src/agents/`, `src/components/TradersTab.tsx`, `src/components/MarketTab.tsx`, `src/components/FloatingChat.tsx`.

## Testing

- `src/forecast/forecast.test.ts`, run with `npm test` (runs `node --test "src/forecast/*.test.ts"`; Node 24 runs TypeScript directly; no new dependency). Checks:
  - Cone percentiles are ordered at every step; a constant price series gives a zero-width cone.
  - Same seed gives identical output.
  - RSI matches a hand-computed value on a fixed series; SMA cross detection on a constructed series.
  - Track record never reads data after its anchor date (truncate history after anchor and assert identical cone).
- `npx tsc --noEmit` and `npm run build` pass.
- Manual: `npm run dev`, search a ticker, view cone, place a trade, ask the analyst a question; then the same on a Vercel preview.

## Setup the user must do

- Create a free Twelve Data key; add `TWELVEDATA_API_KEY` to local `.env` and to Vercel (Production and Preview).
- Groq: `GROQ_API_KEY` must exist on Vercel (still missing as of 2026-10-23) for the analyst chat to work live.

## Out of scope

Crypto, intraday or live prices, ML models, user accounts or server-side portfolios, options, news or sentiment feeds.
