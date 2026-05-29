# TRADR — Full Code Explanation

## What is TRADR?

**TRADR** is a browser-based paper trading simulator built with React, TypeScript, and Vite. It lets you practice buying and selling financial assets — crypto, stocks, bonds, and ETFs — using a simulated $100,000 starting balance, with no real money involved.

Prices for crypto assets are pulled live from the CoinGecko API every 30 seconds. Stock and bond prices are simulated with realistic random drift. Your portfolio data (cash, holdings, trade history) is saved to your browser's localStorage so it persists across page refreshes.

### Features at a glance

- **Live crypto prices** via CoinGecko (Bitcoin, Ethereum, Solana, and more — shown under fictional names)
- **Simulated stock & bond prices** with realistic drift
- **Buy and sell** any asset with automatic average cost tracking
- **Portfolio overview** with a value-over-time chart powered by Recharts
- **Trade history** log of every buy and sell
- **Scrolling ticker** showing live price changes across the top
- **Toast notifications** for trade confirmations and errors
- **Persistent state** — your portfolio survives page refresh via localStorage

### Tech stack

| Tool | Role |
|---|---|
| React + TypeScript | UI components and type safety |
| Vite | Fast dev server and build tool |
| Zustand | Global state management |
| Recharts | Portfolio value chart |
| CoinGecko API | Live crypto prices |

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [types.ts — Data Blueprints](#typests)
3. [assets.ts — The Asset Registry](#assetsts)
4. [prices.ts — Fetching Real Prices](#pricests)
5. [store.ts — The Brain of the App](#storets)
6. [index.css — Global Styles](#indexcss)
7. [main.tsx — App Entry Point](#maintsx)
8. [App.tsx — Root Component](#apptsx)
9. [components/Header.tsx](#headertsx)
10. [components/Ticker.tsx](#tickertsx)
11. [components/MarketTab.tsx](#markettabtsx)
12. [components/PortfolioTab.tsx](#portfoliotabtsx)
13. [components/TradeModal.tsx](#trademodaltsx)
14. [components/Toast.tsx](#toasttsx)
15. [Key Concepts Summary](#key-concepts-summary)

---

## Project Structure

```
TRADR/
├── index.html          ← The single HTML page the browser loads
├── vite.config.ts      ← Build tool configuration
├── package.json        ← Project dependencies and scripts
├── tsconfig.json       ← TypeScript settings
└── src/
    ├── main.tsx        ← Entry point: mounts React into the HTML
    ├── App.tsx         ← Root component: layout + logic hub
    ├── types.ts        ← TypeScript type definitions (data shapes)
    ├── assets.ts       ← List of all tradeable assets
    ├── prices.ts       ← Functions that fetch live prices
    ├── store.ts        ← Global state (portfolio, cash, trades)
    ├── index.css       ← Global styles and CSS variables
    └── components/
        ├── Header.tsx      ← Top navigation bar
        ├── Ticker.tsx      ← Scrolling price ticker
        ├── MarketTab.tsx   ← Markets list view
        ├── PortfolioTab.tsx← Portfolio overview
        ├── TradeModal.tsx  ← Buy/sell popup
        └── Toast.tsx       ← Success/error notification
```

**Why this structure?** Each file has one clear job. This is called **separation of concerns** — a core programming principle. If you need to change how prices are fetched, you only touch `prices.ts`. If you want to change the layout, you touch `App.tsx`.

---

## types.ts

This file defines the **shape** of your data using TypeScript. Think of these as blueprints or contracts — they tell the rest of the code exactly what fields an object will have.

```ts
export type AssetClass = 'crypto' | 'stock' | 'bond' | 'etf'
```
This is a **union type** — `AssetClass` can only be one of these four exact strings. If you try to assign `'banana'` to an `AssetClass`, TypeScript will give you an error immediately, before you even run the code. This prevents bugs.

```ts
export interface Asset {
  id: string           // internal unique key e.g. 'btc'
  symbol: string       // display ticker e.g. 'NEXCOIN'
  name: string         // full name e.g. 'NexCoin'
  class: AssetClass    // must be one of the four types above
  price: number        // current price in USD
  change24h: number    // dollar change over last 24 hours
  changePct: number    // percentage change over last 24 hours
  volume: string       // trading volume (displayed as text)
  marketCap: string    // market cap (displayed as text)
  realSymbol?: string  // the ? means this field is OPTIONAL
}
```
An `interface` describes the shape of an object. Every asset in the app must match this shape exactly. The `?` after `realSymbol` means it's optional — bonds don't need a real API symbol because their prices are simulated.

```ts
export interface Holding {
  assetId: string      // which asset you own (links to Asset.id)
  quantity: number     // how many units you hold
  avgBuyPrice: number  // average price you paid per unit
}
```
A `Holding` represents something you own in your portfolio. `avgBuyPrice` is recalculated each time you buy more of the same asset.

```ts
export interface Trade {
  id: string           // unique trade ID (timestamp-based)
  assetId: string      // which asset was traded
  type: 'buy' | 'sell' // direction of the trade
  quantity: number     // how many units
  price: number        // price at time of trade
  total: number        // quantity × price
  timestamp: number    // when the trade happened (Unix ms)
}
```
Every buy or sell action creates a `Trade` record. These stack up in your history tab.

```ts
export interface PortfolioSnapshot {
  timestamp: number    // when this snapshot was taken
  value: number        // total portfolio value at that moment
}
```
Every time prices refresh, we save a snapshot. These snapshots are used to draw the portfolio value chart over time.

---

## assets.ts

This file is the **registry** of all tradeable assets in the app.

```ts
import { Asset } from './types'
```
We import the `Asset` interface so TypeScript knows what shape each item in our list must have.

```ts
export const ASSETS: Asset[] = [
  { id: 'btc', symbol: 'NEXCOIN', name: 'NexCoin', class: 'crypto',
    price: 0, change24h: 0, changePct: 0,
    volume: '—', marketCap: '—', realSymbol: 'bitcoin' },
  ...
]
```
`ASSETS` is an array (`[]`) of `Asset` objects. Each asset starts with `price: 0` — the real price gets filled in later when we call the API. The `realSymbol` is what we send to CoinGecko's API (e.g. `'bitcoin'` not `'BTC'`).

**Why fictional names?** Because using real brand names like "Bitcoin" or "Apple" in a commercial app can create legal issues. `NEXCOIN` mirrors Bitcoin's price but uses a made-up name.

```ts
export const CLASS_COLORS: Record<string, string> = {
  crypto: '#7c3aed',
  stock: '#00ff88',
  bond: '#f5c842',
  etf: '#3b82f6',
}
```
`Record<string, string>` means "an object where both keys and values are strings." This maps each asset class to a color hex code. Used throughout the UI for consistent color-coding.

```ts
export const STARTING_BALANCE = 100_000
```
The underscores in `100_000` are just for readability — JavaScript ignores them. This is the same as writing `100000`.

---

## prices.ts

This file handles all **external data fetching** — getting real prices from APIs.

```ts
export async function fetchCryptoPrices(): Promise<Record<string, { price: number; change24h: number; changePct: number }>> {
```
- `async` — this function does something that takes time (network request), so it returns a Promise
- `Promise<...>` — the return type is a Promise that eventually resolves to an object
- `Record<string, { ... }>` — a dictionary where each key is an asset ID string, and each value is an object with price data

```ts
const cryptoAssets = ASSETS.filter(a => a.class === 'crypto' && a.realSymbol)
const ids = cryptoAssets.map(a => a.realSymbol).join(',')
```
- `.filter()` — creates a new array keeping only assets that are crypto AND have a realSymbol
- `.map()` — transforms each asset into just its `realSymbol` string
- `.join(',')` — turns the array into a comma-separated string like `"bitcoin,ethereum,solana"`

This builds the URL parameter CoinGecko needs: `?ids=bitcoin,ethereum,solana`

```ts
const res = await fetch(
  `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
  { headers: { 'Accept': 'application/json' } }
)
if (!res.ok) throw new Error('CoinGecko error')
const data = await res.json()
```
- `fetch()` — built-in browser function to make HTTP requests
- `await` — pauses here until the response comes back (without blocking the whole browser)
- `res.ok` — true if the HTTP status was 200-299 (success)
- `throw new Error(...)` — if the API fails, we jump to the `catch` block
- `res.json()` — parses the JSON text response into a JavaScript object

```ts
const changePct = raw.usd_24h_change ?? 0
```
The `??` is the **nullish coalescing operator**. It means "use `raw.usd_24h_change` unless it's `null` or `undefined`, in which case use `0`." Safer than `||` because `||` would also replace `0` (which is valid).

```ts
  } catch {
    return {}
  }
```
If anything goes wrong (no internet, API down, etc.), we catch the error and return an empty object `{}` instead of crashing the whole app.

```ts
const drift = (Math.random() - 0.5) * 0.006
```
For stocks (which we can't get free real-time prices for), we simulate movement. `Math.random()` gives 0–1, minus 0.5 gives -0.5 to +0.5, times 0.006 gives -0.003 to +0.003 — a ±0.3% random drift each refresh.

```ts
stockOffsets[asset.id] = Math.max(-0.05, Math.min(0.05, stockOffsets[asset.id]))
```
`Math.min` and `Math.max` clamp the accumulated offset so it never drifts more than ±5% from the base price. Without this, prices could drift to zero or infinity over time.

---

## store.ts

This is the **most important file** in the app. It manages all the data your app needs to remember — cash, holdings, trades, price history.

We use **Zustand**, a state management library. Think of it as a central database that lives in memory while the app runs.

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
```
- `create` — Zustand's main function for creating a store
- `persist` — a middleware (plugin) that automatically saves the store to `localStorage` so data survives page refresh

```ts
interface PortfolioStore {
  // State (data)
  cash: number
  holdings: Holding[]
  trades: Trade[]
  assets: Asset[]
  history: PortfolioSnapshot[]
  lastUpdated: number | null

  // Actions (functions that change the data)
  updatePrices: (...) => void
  buy: (...) => { ok: boolean; msg: string }
  sell: (...) => { ok: boolean; msg: string }
  ...
}
```
The interface defines both the **data** (state) and the **actions** (functions). This is the full contract of what the store contains. `number | null` means the value is either a number or null.

```ts
export const useStore = create<PortfolioStore>()(
  persist(
    (set, get) => ({ ... }),
    { name: 'marketsim-portfolio' }
  )
)
```
- `create<PortfolioStore>()` — creates a Zustand store typed to our interface
- `persist(...)` — wraps the store so it auto-saves to localStorage under the key `'marketsim-portfolio'`
- `set` — a function to update store values
- `get` — a function to read the current store values (useful inside actions)

```ts
updatePrices: (updates) => {
  set(s => ({
    assets: s.assets.map(a => {
      const u = updates[a.id]
      if (!u) return a
      return { ...a, price: u.price, change24h: u.change24h, changePct: u.changePct }
    }),
    lastUpdated: Date.now()
  }))
  get().recordSnapshot()
},
```
- `set(s => ...)` — the `s` is the current state, and we return what to change
- `s.assets.map(...)` — loops through every asset, returning an updated copy if we have new price data
- `{ ...a, price: u.price }` — the spread operator copies all of `a`'s fields, then overrides just `price`, `change24h`, and `changePct`
- `get().recordSnapshot()` — after prices update, save a portfolio snapshot for the chart

```ts
buy: (assetId, quantity) => {
  const { cash, assets, holdings } = get()
```
**Destructuring** — instead of writing `get().cash`, `get().assets`, `get().holdings` separately, we pull them all out in one line.

```ts
  const existing = holdings.find(h => h.assetId === assetId)
  let newHoldings: Holding[]
  if (existing) {
    const totalQty = existing.quantity + quantity
    const avgPrice = (existing.avgBuyPrice * existing.quantity + total) / totalQty
    newHoldings = holdings.map(h => h.assetId === assetId ? { ...h, quantity: totalQty, avgBuyPrice: avgPrice } : h)
  } else {
    newHoldings = [...holdings, { assetId, quantity, avgBuyPrice: asset.price }]
  }
```
If you already own this asset, we recalculate the **weighted average buy price**. For example: if you own 1 BTC at $50,000 and buy 1 more at $60,000, your new average is `(50000×1 + 60000×1) / 2 = $55,000`.

If you don't own it yet, we add a new holding to the array using the spread operator: `[...holdings, newItem]` — this creates a new array with all existing holdings plus the new one. We never mutate (directly change) the original array.

```ts
  const trade: Trade = { id: Date.now().toString(), assetId, type: 'buy', quantity, price: asset.price, total, timestamp: Date.now() }
  set(s => ({ cash: s.cash - total, holdings: newHoldings, trades: [trade, ...s.trades] }))
  return { ok: true, msg: `Bought ${quantity} ${asset.symbol}` }
```
- `Date.now().toString()` — current time in milliseconds as a string, used as a unique ID
- `[trade, ...s.trades]` — prepend the new trade to the front of the trades array (newest first)
- We return `{ ok: true, msg: ... }` so the UI knows the trade succeeded and can show a toast message

```ts
totalValue: () => {
  const { cash, holdings, assets } = get()
  const investedValue = holdings.reduce((sum, h) => {
    const asset = assets.find(a => a.id === h.assetId)
    return sum + (asset ? asset.price * h.quantity : 0)
  }, 0)
  return cash + investedValue
},
```
`.reduce()` is a powerful array method that accumulates a result. Here it starts with `sum = 0` and adds `price × quantity` for each holding. The final result is the total value of everything you own, which we add to your cash to get the full portfolio value.

```ts
recordSnapshot: () => {
  const total = get().totalValue()
  if (total === 0) return
  set(s => ({
    history: [...s.history.slice(-100), { timestamp: Date.now(), value: total }]
  }))
},
```
`.slice(-100)` keeps only the last 100 items. Without this, the history array would grow forever and slow things down.

---

## index.css

The global stylesheet. Everything here applies to the whole app.

```css
:root {
  --bg: #0a0a0f;
  --accent: #00ff88;
  ...
}
```
CSS variables (custom properties) defined on `:root` are available everywhere in the app. Instead of hardcoding `#00ff88` in 50 places, we write `var(--accent)`. If you want to change the accent color, you change it in one place.

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
```
The `*` selector targets every element. `box-sizing: border-box` means padding and borders are included in an element's total width — this prevents layout surprises. `margin: 0; padding: 0` removes browser default spacing.

```css
@keyframes ticker {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
```
This animates the price ticker scrolling left. We use `-50%` (not `-100%`) because the ticker duplicates its content — when the first copy scrolls off the left edge, the duplicate seamlessly takes over, creating an infinite loop effect.

```css
@keyframes slideIn {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```
Used when switching tabs — content slides up slightly and fades in, making transitions feel smooth instead of jarring.

---

## main.tsx

The **entry point** — the first file that runs.

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
```
We import React (required for JSX to work), ReactDOM (to render into the browser), our root component, and the global CSS.

```tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```
- `document.getElementById('root')` — finds the `<div id="root">` in `index.html`
- The `!` tells TypeScript "I promise this won't be null" (non-null assertion)
- `createRoot(...).render(...)` — mounts our React app into that div
- `<React.StrictMode>` — a development helper that warns about common mistakes (has no effect in production)

---

## App.tsx

The **root component** — the hub that connects everything together.

```tsx
export type Tab = 'market' | 'portfolio' | 'history'
```
Exported so other components (like `Header`) can use this type too.

```tsx
const updatePrices = useStore(s => s.updatePrices)
const [tab, setTab] = useState<Tab>('market')
const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
const [loading, setLoading] = useState(true)
```
- `useStore(s => s.updatePrices)` — subscribe to just one piece of the store. The `s =>` is a **selector** — it picks exactly what we need so the component only re-renders when that specific thing changes.
- `useState<Tab>('market')` — local state for which tab is active, starting as `'market'`
- `useState<Asset | null>(null)` — which asset's trade modal is open (null = closed)

```tsx
const refresh = useCallback(async () => {
  const [crypto, stocks, bonds] = await Promise.all([
    fetchCryptoPrices(),
    Promise.resolve(fetchStockPrices()),
    Promise.resolve(getBondPrices()),
  ])
  updatePrices({ ...crypto, ...stocks, ...bonds })
  setLoading(false)
}, [updatePrices])
```
- `useCallback` — memoizes this function so it doesn't get recreated on every render (important for the `useEffect` dependency array)
- `Promise.all([...])` — runs all three price fetches **simultaneously** rather than one after another, so they all finish faster
- `await` — waits until all three complete, then destructures the results
- `{ ...crypto, ...stocks, ...bonds }` — merges three objects into one

```tsx
useEffect(() => {
  refresh()
  const interval = setInterval(refresh, 30_000)
  return () => clearInterval(interval)
}, [refresh])
```
- `useEffect` runs after the component mounts (appears on screen)
- `refresh()` — fetch prices immediately on load
- `setInterval(refresh, 30_000)` — also fetch every 30 seconds automatically
- `return () => clearInterval(interval)` — the **cleanup function**. When the component unmounts, we stop the interval to prevent memory leaks. This is a very important pattern.

```tsx
{tab === 'market' && <MarketTab onTrade={openTrade} />}
{tab === 'portfolio' && <PortfolioTab onTrade={openTrade} />}
{tab === 'history' && <HistoryTab />}
```
**Conditional rendering** — React only renders a component if the condition is true. The `&&` operator means "if the left side is true, render the right side."

```tsx
{selectedAsset && (
  <TradeModal
    asset={selectedAsset}
    type={tradeType}
    onClose={() => setSelectedAsset(null)}
    onToast={showToast}
  />
)}
```
The modal only renders when `selectedAsset` is not null. `onClose={() => setSelectedAsset(null)}` passes a function as a prop — when the modal calls `onClose()`, it sets `selectedAsset` back to null, which hides the modal.

---

## Header.tsx

```tsx
interface Props {
  tab: Tab
  setTab: (t: Tab) => void
  loading: boolean
  onRefresh: () => void
}
```
**Props interface** — every component that receives data from a parent defines what it expects. `setTab: (t: Tab) => void` means "a function that takes a Tab and returns nothing."

```tsx
const total = totalValue()
const pnl = total - STARTING_BALANCE
const pnlPct = (pnl / STARTING_BALANCE) * 100
const isUp = pnl >= 0
```
These are **derived values** — calculated from existing state. `pnl` = profit and loss. `pnlPct` = percentage gain/loss from starting balance.

```tsx
onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
```
Inline hover effects using React's synthetic events. `e.currentTarget` is the element that has the event listener attached. This changes the color on hover without needing CSS classes.

---

## Ticker.tsx

```tsx
const items = [...priced, ...priced]
```
We duplicate the array by spreading it twice. This creates a seamless loop — when CSS animation scrolls the first copy off-screen, the duplicate is right behind it. The CSS `ticker` keyframe animates to `-50%` (not `-100%`) because the content is doubled.

```tsx
<div style={{
  display: 'flex',
  animation: 'ticker 60s linear infinite',
  whiteSpace: 'nowrap',
}}>
```
- `display: flex` — makes all ticker items sit side by side
- `animation: 'ticker 60s linear infinite'` — runs the `@keyframes ticker` animation over 60 seconds, smoothly, forever
- `whiteSpace: 'nowrap'` — prevents ticker items from wrapping to a new line

---

## MarketTab.tsx

```tsx
const [filter, setFilter] = useState<AssetClass | 'all'>('all')
const [search, setSearch] = useState('')
```
Two pieces of local state for filtering. Both live inside this component — they don't need to be in the global store because no other component cares about them.

```tsx
const filtered = assets.filter(a => {
  if (filter !== 'all' && a.class !== filter) return false
  if (search && !a.symbol.toLowerCase().includes(search.toLowerCase()) && ...) return false
  return true
})
```
`.filter()` returns a new array with only the items where the function returns `true`. We check two conditions — class filter and search text. `.toLowerCase()` on both sides makes the search case-insensitive.

```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr',
  ...
}}>
```
CSS Grid with fractional units (`fr`). `2fr` takes twice as much space as `1fr`. This creates a responsive table-like layout without using an actual HTML table.

```tsx
onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
```
Row hover highlight — changes background when mouse enters/leaves. This is a simple alternative to CSS `:hover` when you're using inline styles.

---

## PortfolioTab.tsx

```tsx
const gain = currentValue - costBasis
const gainPct = (gain / costBasis) * 100
```
**Per-holding P&L calculation.** `costBasis` is what you paid in total (`avgBuyPrice × quantity`). `currentValue` is what it's worth now (`currentPrice × quantity`). The difference is your gain or loss.

```tsx
<ResponsiveContainer width="100%" height={160}>
  <AreaChart data={chartData}>
    <defs>
      <linearGradient id="grad" ...>
```
This uses **Recharts**, a React charting library. `ResponsiveContainer` makes the chart resize with its parent. `linearGradient` defines a gradient fill that fades from the line color to transparent going downward — the classic trading chart look.

```tsx
tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
```
A function that formats Y-axis labels. `100000` becomes `$100k`. Makes the axis readable.

---

## TradeModal.tsx

```tsx
const qty = parseFloat(qty) || 0
```
`parseFloat` converts the string from the input into a number. If the string is empty or invalid, it returns `NaN`, and `NaN || 0` gives us `0` as a safe default.

```tsx
const canAfford = total <= cash
const hasEnough = holding ? holding.quantity >= quantity : false
```
These booleans drive whether the submit button is enabled and whether warning messages show. `holding ?` checks if the holding exists before trying to read its quantity (safe navigation).

```tsx
const setMaxBuy = () => {
  const maxQty = Math.floor((cash / asset.price) * 10000) / 10000
  setQty(maxQty.toString())
}
```
Calculates how many units you can afford with your available cash. `Math.floor(x * 10000) / 10000` rounds down to 4 decimal places — we always round **down** so we never try to buy slightly more than we can afford.

```tsx
onClick={e => e.stopPropagation()}
```
The outer div closes the modal when clicked (the overlay). But clicking inside the modal box itself should NOT close it. `stopPropagation()` prevents the click from "bubbling up" to the parent div's click handler. This is a very common pattern for modals.

---

## Toast.tsx

The simplest component in the app — just a styled notification box.

```tsx
interface Props {
  msg: string
  ok: boolean
}

export default function Toast({ msg, ok }: Props) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      ...
    }}>
      {ok ? '✓' : '✗'} {msg}
    </div>
  )
}
```
- `position: 'fixed'` — stays in the bottom-right corner even when you scroll
- `ok ? '✓' : '✗'` — ternary operator: if ok is true show checkmark, otherwise show X
- The component doesn't manage its own visibility — the parent (`App.tsx`) controls when it appears and disappears using `setTimeout`

---

## Key Concepts Summary

| Concept | Where it's used | What it means |
|---|---|---|
| `interface` | `types.ts`, `store.ts` | Defines the shape/contract of an object |
| `useState` | `App.tsx`, `MarketTab.tsx`, `TradeModal.tsx` | Local state that triggers re-renders when changed |
| `useEffect` | `App.tsx` | Runs side effects (timers, API calls) after render |
| `useCallback` | `App.tsx` | Memoizes a function so it doesn't change on every render |
| `useStore` | Most components | Reads from the global Zustand store |
| `set(s => ...)` | `store.ts` | Updates the Zustand store immutably |
| `async/await` | `App.tsx`, `prices.ts` | Handles asynchronous operations (network requests) |
| `Promise.all` | `App.tsx` | Runs multiple async tasks simultaneously |
| Spread `...` | Everywhere | Copies object/array and optionally overrides fields |
| `.filter()` | `MarketTab.tsx`, `prices.ts` | Returns new array with only matching items |
| `.map()` | `store.ts`, many places | Returns new array with each item transformed |
| `.reduce()` | `store.ts` | Reduces an array to a single value |
| Conditional `&&` | `App.tsx` | Only renders something if condition is true |
| Ternary `? :` | Throughout | Inline if/else for values and JSX |
| `stopPropagation` | `TradeModal.tsx` | Prevents click events from bubbling up to parents |
| CSS variables | `index.css` | Reusable design tokens, change once affects everywhere |

---

## What to Try Next

Now that you understand the code, try these exercises:

1. **Change the starting balance** — find `STARTING_BALANCE` in `assets.ts` and change it to `50000`. See what happens.

2. **Add a new asset** — copy one of the crypto entries in `ASSETS` and add a new fictional coin. Give it a new `id`, `symbol`, `name`, and `realSymbol` (use a CoinGecko ID like `'dogecoin'`).

3. **Change the refresh interval** — in `App.tsx`, find `30_000` and change it to `10_000` (10 seconds). Notice prices update faster.

4. **Add a new color theme** — in `index.css`, change `--accent` from `#00ff88` to `#ff6b35` (orange). See how many places it updates automatically.

5. **Read the Zustand docs** — [zustand.docs.pmnd.rs](https://zustand.docs.pmnd.rs) — understanding state management deeply will level you up fast.