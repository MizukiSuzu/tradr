# TRADR

A browser-based paper trading simulator built with React, TypeScript, and Vite. Trade crypto, stocks, bonds, and ETFs with a simulated $100,000 starting balance — no real money involved.

---

## Features

- **Live crypto prices** via CoinGecko, refreshed every 30 seconds
- **Simulated stock & ETF prices** powered by Geometric Brownian Motion with sector correlations and GARCH-lite volatility clustering
- **Simulated bond prices** using an Ornstein-Uhlenbeck mean-reversion process
- **Market and limit orders** — queue buys/sells to trigger at a target price
- **Price alerts** — get notified when any asset crosses a threshold you set
- **Fractional shares** — buy partial units of any asset
- **Portfolio overview** — equity curve chart, allocation pie, unrealized P&L per position
- **Trade history** with realized P&L shown on every sell
- **AI trader agents** — five autonomous traders with distinct personalities that trade in real time. Chat with any of them (powered by Groq / Llama 3)
- **Agent leaderboard** — see how you rank against the bots
- **Scrolling ticker** across the top showing live prices
- **Persistent state** via localStorage — your portfolio survives page refresh

---

## Tech Stack

| Tool | Role |
|---|---|
| React + TypeScript | UI and type safety |
| Vite | Dev server and build |
| Zustand + persist | Global state with localStorage persistence |
| Recharts | Charts (portfolio equity curve, allocation pie) |
| CoinGecko API | Live crypto prices |
| Groq API (Llama 3.1 8B) | AI trader agent chat |

---

## Getting Started

```bash
# Install dependencies
npm install

# Create your .env file
cp .env.example .env
# Add your Groq API key: VITE_GROQ_API_KEY=your_key_here

# Start dev server
npm run dev
```

Get a free Groq API key at [console.groq.com](https://console.groq.com). Without it the chat feature will show a connection error, but everything else works fine.

---

## Project Structure

```
src/
├── main.tsx              # App entry point
├── App.tsx               # Root layout, price refresh loop, tab routing
├── types.ts              # TypeScript interfaces (Asset, Trade, Holding, etc.)
├── assets.ts             # Asset registry — all tradeable instruments
├── store.ts              # Zustand store — portfolio state, buy/sell, alerts, limit orders
├── prices.ts             # CoinGecko fetch + GBM stock engine + O-U bond engine
├── index.css             # Global styles and CSS variables
├── agents/
│   ├── agentTypes.ts     # Agent type definitions
│   ├── agentPersonalities.ts  # The five trader characters + Sensei
│   └── agentStore.ts     # Agent state, trading logic, Groq chat integration
└── components/
    ├── Header.tsx         # Top nav bar
    ├── Ticker.tsx         # Scrolling price ticker
    ├── MarketTab.tsx      # Asset list with search and filters
    ├── PortfolioTab.tsx   # Holdings, charts, pending orders
    ├── TradersTab.tsx     # AI agents, leaderboard, chat
    ├── TradeModal.tsx     # Buy/sell modal with market and limit order modes
    ├── Loader.tsx         # Initial loading screen
    └── Toast.tsx          # Trade confirmation / alert toasts
```

---

## The Simulation Engine

Stock and ETF prices are simulated using **Geometric Brownian Motion**:

```
S(t+dt) = S(t) × exp((μ - σ²/2)·dt + σ·√dt·Z)
```

Where each asset has calibrated annual volatility (σ) and drift (μ). Realistic touches include:

- **Sector correlation** — tech stocks co-move via shared random shocks
- **GARCH-lite volatility clustering** — big moves push vol higher temporarily
- **Intraday vol curve** — volatility peaks at open and close, dips at midday

Bond prices use an **Ornstein-Uhlenbeck** mean-reverting process, giving them the stable, low-vol behaviour bonds actually have.

---

## AI Traders

Five agents trade autonomously every 30 seconds alongside you:

| Agent | Style | Trades |
|---|---|---|
| 🦍 Chad Degen | Buys every dip, never sells | Crypto only, high frequency |
| 👓 Margaret Vale | Value investor, takes profits | Bonds + ETFs, rare trades |
| 📊 Dev Sharma | Quant-driven, diversified | Stocks, medium frequency |
| 🌙 Luna Park | Impulsive, second-guesses everything | Crypto + stocks |
| 🚀 Rex Momentum | Pure trend-following | Stocks + crypto |
| 🧧 Sensei Stocks | Market sage — observes, never trades | — |

You can chat with any of them. Each responds in character with awareness of their current portfolio and live market conditions.

---

## Environment Variables

```
VITE_GROQ_API_KEY=your_groq_api_key
```

**Never commit your `.env` file.** It's in `.gitignore` by default.