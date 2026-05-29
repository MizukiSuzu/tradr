import { ASSETS } from './assets'

// ---------------------------------------------------------------------------
// CRYPTO — live prices from CoinGecko (unchanged)
// ---------------------------------------------------------------------------
export async function fetchCryptoPrices(): Promise<Record<string, { price: number; change24h: number; changePct: number }>> {
  const cryptoAssets = ASSETS.filter(a => a.class === 'crypto' && a.realSymbol)
  const ids = cryptoAssets.map(a => a.realSymbol).join(',')

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (!res.ok) throw new Error('CoinGecko error')
    const data = await res.json()

    const result: Record<string, { price: number; change24h: number; changePct: number }> = {}
    for (const asset of cryptoAssets) {
      const raw = data[asset.realSymbol!]
      if (raw) {
        const price = raw.usd
        const changePct = raw.usd_24h_change ?? 0
        result[asset.id] = {
          price,
          change24h: price * (changePct / 100),
          changePct,
        }
      }
    }
    return result
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// MARKET SIMULATION ENGINE
// ---------------------------------------------------------------------------
// Implements Geometric Brownian Motion with:
//   - Per-asset volatility and drift (annualised, scaled to 30s intervals)
//   - Volatility clustering (big moves beget big moves — GARCH-lite)
//   - Sector correlation (stocks co-move via a shared market factor)
//   - Mean reversion for bonds (Ornstein-Uhlenbeck process)
//   - Intraday volatility pattern (higher at open/close, lower midday)
// ---------------------------------------------------------------------------

const SECONDS_PER_YEAR = 252 * 6.5 * 3600   // trading seconds per year
const REFRESH_SECONDS  = 30                   // how often we're called

// dt = fraction of a trading year that elapses each refresh tick
const dt = REFRESH_SECONDS / SECONDS_PER_YEAR

// Asset-level parameters
// annualVol:  annualised volatility (e.g. 0.30 = 30% per year, typical for equities)
// annualDrift: expected annual return, kept small / slightly positive for realism
// sector:     assets sharing a sector co-move via a common factor
interface AssetParams {
  annualVol:   number
  annualDrift: number
  sector:      string
}

const ASSET_PARAMS: Record<string, AssetParams> = {
  // Stocks — large-cap, ~20-40% annual vol
  aapl: { annualVol: 0.28, annualDrift: 0.10, sector: 'tech' },
  msft: { annualVol: 0.26, annualDrift: 0.10, sector: 'tech' },
  nvda: { annualVol: 0.55, annualDrift: 0.15, sector: 'tech' },
  tsla: { annualVol: 0.60, annualDrift: 0.05, sector: 'ev'   },
  amzn: { annualVol: 0.30, annualDrift: 0.10, sector: 'tech' },
  goog: { annualVol: 0.27, annualDrift: 0.10, sector: 'tech' },
  // ETFs — lower vol due to diversification
  spy:  { annualVol: 0.16, annualDrift: 0.09, sector: 'market' },
  qqq:  { annualVol: 0.20, annualDrift: 0.10, sector: 'market' },
}

const STOCK_BASE_PRICES: Record<string, number> = {
  aapl: 213,
  msft: 449,
  nvda: 1090,
  tsla: 177,
  amzn: 210,
  goog: 178,
  spy:  540,
  qqq:  465,
}

// Runtime state — persists across refresh calls in this module
interface AssetState {
  price:        number   // current simulated price
  vol:          number   // current (time-varying) volatility
  dailyOpen:    number   // price at start of today (for change24h calc)
  lastDayReset: number   // timestamp of last daily open reset
}

const state: Record<string, AssetState> = {}

// Correlation structure: sector factor weight
// Each asset's return = sectorFactor * factorWeight + idiosyncratic * sqrt(1 - factorWeight²)
const SECTOR_FACTOR_WEIGHT = 0.55   // 55% of return is correlated within sector
const MARKET_FACTOR_WEIGHT = 0.30   // additional 30% shared with whole market

// Shared random shocks drawn once per tick so sectors co-move
let marketShock = 0
const sectorShocks: Record<string, number> = {}

function drawShocks() {
  marketShock = randn()
  const sectors = [...new Set(Object.values(ASSET_PARAMS).map(p => p.sector))]
  for (const s of sectors) sectorShocks[s] = randn()
}

// Box-Muller normal random variate
function randn(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

// Intraday volatility multiplier — higher at open (9:30) and close (16:00) ET
function intradayVolMultiplier(): number {
  const now = new Date()
  // Convert to approximate ET hour (UTC-4 in summer, UTC-5 in winter — rough)
  const etHour = (now.getUTCHours() - 4 + 24) % 24 + now.getUTCMinutes() / 60
  const marketOpen  = 9.5   // 9:30 AM
  const marketClose = 16.0  // 4:00 PM

  if (etHour < marketOpen || etHour > marketClose) {
    // After-hours: ~40% of normal vol
    return 0.4
  }
  // U-shaped intraday curve: high at open, dips midday, rises at close
  const progress = (etHour - marketOpen) / (marketClose - marketOpen)  // 0 → 1
  // cos curve peaks at 0 and 1, troughs at 0.5
  return 0.7 + 0.6 * Math.pow(Math.cos(Math.PI * (progress - 0.5)), 2)
}

function initAsset(id: string) {
  const base = STOCK_BASE_PRICES[id]
  state[id] = {
    price:        base,
    vol:          ASSET_PARAMS[id].annualVol,
    dailyOpen:    base,
    lastDayReset: Date.now(),
  }
}

function isSameTradingDay(ts: number): boolean {
  const a = new Date(ts)
  const b = new Date()
  return a.getUTCFullYear() === b.getUTCFullYear() &&
         a.getUTCMonth()    === b.getUTCMonth()    &&
         a.getUTCDate()     === b.getUTCDate()
}

export function fetchStockPrices(): Record<string, { price: number; change24h: number; changePct: number }> {
  drawShocks()  // one set of correlated shocks for this tick
  const volMult = intradayVolMultiplier()

  const result: Record<string, { price: number; change24h: number; changePct: number }> = {}
  const stockAssets = ASSETS.filter(a => (a.class === 'stock' || a.class === 'etf') && ASSET_PARAMS[a.id])

  for (const asset of stockAssets) {
    const id = asset.id
    const params = ASSET_PARAMS[id]

    // Initialise state on first call
    if (!state[id]) initAsset(id)
    const s = state[id]

    // Reset daily open at start of each new trading day
    if (!isSameTradingDay(s.lastDayReset)) {
      s.dailyOpen    = s.price
      s.lastDayReset = Date.now()
    }

    // --- Geometric Brownian Motion with correlated shocks ---
    // Idiosyncratic component (unique to this asset)
    const idioWeight = Math.sqrt(
      Math.max(0, 1 - SECTOR_FACTOR_WEIGHT ** 2 - MARKET_FACTOR_WEIGHT ** 2)
    )
    const epsilon =
      MARKET_FACTOR_WEIGHT  * marketShock +
      SECTOR_FACTOR_WEIGHT  * (sectorShocks[params.sector] ?? randn()) +
      idioWeight            * randn()

    // Effective volatility this tick (scaled by intraday pattern)
    const sigmaEff = s.vol * volMult

    // GBM price update: S(t+dt) = S(t) * exp((mu - sigma²/2)*dt + sigma*sqrt(dt)*Z)
    const drift  = (params.annualDrift - 0.5 * sigmaEff ** 2) * dt
    const shock  = sigmaEff * Math.sqrt(dt) * epsilon
    s.price = s.price * Math.exp(drift + shock)

    // --- GARCH-lite volatility clustering ---
    // vol mean-reverts to long-run level; large shocks push it up
    const volLongRun  = params.annualVol
    const volRevSpeed = 0.02                      // speed of mean reversion
    const volShockAmp = 0.15                      // how much a big move increases vol
    s.vol = s.vol * (1 - volRevSpeed) +
            volLongRun * volRevSpeed +
            volShockAmp * Math.abs(shock) * params.annualVol

    // Clamp price to ±35% of base (prevents absurd values in long sessions)
    const base = STOCK_BASE_PRICES[id]
    s.price = Math.max(base * 0.65, Math.min(base * 1.35, s.price))

    const change24h  = s.price - s.dailyOpen
    const changePct  = (change24h / s.dailyOpen) * 100

    result[id] = { price: s.price, change24h, changePct }
  }

  return result
}

// ---------------------------------------------------------------------------
// BONDS — Ornstein-Uhlenbeck mean-reverting process
// Bonds have very low vol and revert strongly to their fair value
// ---------------------------------------------------------------------------

interface BondState {
  price:        number
  dailyOpen:    number
  lastDayReset: number
}

const BOND_PARAMS: Record<string, { fairValue: number; vol: number; revSpeed: number }> = {
  us10y: { fairValue: 98.50, vol: 0.04, revSpeed: 0.10 },
  us2y:  { fairValue: 99.20, vol: 0.02, revSpeed: 0.15 },
}

const bondState: Record<string, BondState> = {}

export function getBondPrices(): Record<string, { price: number; change24h: number; changePct: number }> {
  const result: Record<string, { price: number; change24h: number; changePct: number }> = {}

  for (const [id, params] of Object.entries(BOND_PARAMS)) {
    if (!bondState[id]) {
      bondState[id] = {
        price:        params.fairValue,
        dailyOpen:    params.fairValue,
        lastDayReset: Date.now(),
      }
    }
    const s = bondState[id]

    if (!isSameTradingDay(s.lastDayReset)) {
      s.dailyOpen    = s.price
      s.lastDayReset = Date.now()
    }

    // Ornstein-Uhlenbeck: dP = theta*(mu - P)*dt + sigma*sqrt(dt)*Z
    const theta = params.revSpeed
    const mu    = params.fairValue
    const sigma = params.vol
    const z     = randn()

    s.price = s.price + theta * (mu - s.price) * dt + sigma * Math.sqrt(dt) * z
    s.price = Math.max(params.fairValue * 0.97, Math.min(params.fairValue * 1.03, s.price))

    const change24h = s.price - s.dailyOpen
    const changePct = (change24h / s.dailyOpen) * 100

    result[id] = { price: s.price, change24h, changePct }
  }

  return result
}