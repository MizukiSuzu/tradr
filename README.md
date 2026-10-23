# TRADR

A stock prediction game built on real market data. Pick any US stock or ETF, see where its price is statistically likely to go, and call **Up** or **Down**. The forecast sets the odds: calls it thought unlikely pay more. Play instant **Replay** rounds on hidden past data, or make **Live** calls on today's close that resolve on a later visit.

**Live demo:** https://tradr-ashy.vercel.app

## Features

- **Any US ticker**: search stocks and ETFs; real daily prices via Twelve Data
- **Probability cone**: 5,000 simulated paths from the stock's own last year of daily returns (block bootstrap), shown as 68% and 95% ranges, plus "chance above $X"
- **Signals**: trend (50/200-day averages, golden/death crosses), 20-day momentum, RSI(14), volatility regime, each explained in one sentence
- **Track record**: for each of the last 12 months, a cone built only from data available then, compared with where the price actually landed
- **Prediction game**: call Up or Down over 1 week, 1 month or 3 months. A correct call pays `100 × (1 − the cone's probability for that side)`; a miss scores 0. Score, streak and accuracy are kept in your browser
- **Replay and Live**: Replay drops you at a random past date with the future hidden and scores you instantly; Live calls use today's close and resolve when you come back
- **TRADR Analyst**: AI chat (Groq) that explains the numbers on screen; it never tells you which way to call

Forecasts are statistical projections from past prices, not financial advice.

## Tech stack

| Tool | Role |
|---|---|
| React 18 + TypeScript + Vite | UI and build |
| Zustand + persist | Watchlist and prediction state in localStorage |
| Recharts | Price, cone and track-record charts |
| Vercel functions (`api/`) | Server-side proxies that keep API keys off the client, with CDN caching |
| Twelve Data API | Symbol search and daily history |
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

runs the forecast and game tests with Node's built-in test runner.

## Project structure

```
api/
├── _twelvedata.ts       # Shared upstream fetch + validation (not a route)
├── search.ts            # GET /api/search?q=
├── history.ts           # GET /api/history?symbol=
└── chat.ts              # POST /api/chat (Groq)
src/
├── forecast/            # Pure TS engine: cone, signals, track record, chat summary + tests
├── game/              # Scoring: points, resolution, replay start, stats + tests
├── data.ts              # Client fetchers, history cache, rate limiter
├── store.ts             # Watchlist and predictions
└── components/          # Watchlist, StockPage, Replay, Predictions, AnalystChat, …
```

## How the forecast works

1. Take the last 252 daily log returns.
2. Build 5,000 future paths by stitching together random 5-day blocks of those real returns. Blocks keep calm and volatile stretches together, and real returns keep fat tails a bell curve would miss.
3. At each future day, read the 2.5th, 16th, 50th, 84th and 97.5th percentiles: the median and the 68% and 95% ranges.
4. Track record: repeat steps 1-3 at 12 past monthly dates (with fewer paths per anchor) using only data up to each date, then check where the price really was 21 trading days later.

Results are seeded by ticker and date, so the same data gives the same cone.

## Environment variables

| Name | Where | Used by |
|---|---|---|
| `TWELVEDATA_API_KEY` | `.env` and Vercel | `api/search.ts`, `api/history.ts` |
| `GROQ_API_KEY` | `.env` and Vercel | `api/chat.ts` |

Keys are read only on the server. Don't prefix them with `VITE_`: Vite would inline them into the public bundle.
