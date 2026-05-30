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
// Geometric Brownian Motion with:
//   - Per-asset volatility and drift (annualised, scaled to 30s intervals)
//   - Volatility clustering (GARCH-lite)
//   - Sector correlation via shared random shocks
//   - Mean reversion for bonds (Ornstein-Uhlenbeck)
//   - Intraday volatility pattern
//   - Random shock events (earnings surprises, macro news, flash crashes)
// ---------------------------------------------------------------------------

const SECONDS_PER_YEAR = 252 * 6.5 * 3600
const REFRESH_SECONDS  = 30
const dt = REFRESH_SECONDS / SECONDS_PER_YEAR

// Volatility multiplier applied on top of annualVol.
// Set higher than 1.0 to make every tick feel more dramatic.
const VOL_AMPLIFIER = 6.0   // ← crank this up for chaos, down for calm

interface AssetParams {
  annualVol:   number
  annualDrift: number
  sector:      string
}

const ASSET_PARAMS: Record<string, AssetParams> = {
  // Stocks — bumped vols for drama
  aapl: { annualVol: 0.45, annualDrift: 0.10, sector: 'tech'     },
  msft: { annualVol: 0.42, annualDrift: 0.10, sector: 'tech'     },
  nvda: { annualVol: 0.90, annualDrift: 0.15, sector: 'tech'     },
  tsla: { annualVol: 1.00, annualDrift: 0.05, sector: 'ev'       },
  amzn: { annualVol: 0.50, annualDrift: 0.10, sector: 'tech'     },
  goog: { annualVol: 0.44, annualDrift: 0.10, sector: 'tech'     },
  meta: { annualVol: 0.58, annualDrift: 0.12, sector: 'tech'     },
  nflx: { annualVol: 0.65, annualDrift: 0.08, sector: 'media'    },
  jpm:  { annualVol: 0.36, annualDrift: 0.09, sector: 'finance'  },
  // ETFs — still lower, but no longer flat
  spy:  { annualVol: 0.28, annualDrift: 0.09, sector: 'market'   },
  qqq:  { annualVol: 0.35, annualDrift: 0.10, sector: 'market'   },
  gld:  { annualVol: 0.22, annualDrift: 0.05, sector: 'commodity' },
  uso:  { annualVol: 0.48, annualDrift: 0.03, sector: 'commodity' },
}

const STOCK_BASE_PRICES: Record<string, number> = {
  aapl: 213,
  msft: 449,
  nvda: 1090,
  tsla: 177,
  amzn: 210,
  goog: 178,
  meta: 585,
  nflx: 1020,
  jpm:  260,
  spy:  540,
  qqq:  465,
  gld:  245,
  uso:  72,
}

interface AssetState {
  price:        number
  vol:          number
  dailyOpen:    number
  lastDayReset: number
}

const state: Record<string, AssetState> = {}

// Wider clamp — allow ±80% swings from base before hard-stopping
const PRICE_CLAMP_LOW  = 0.20
const PRICE_CLAMP_HIGH = 1.80

// Correlation weights
const SECTOR_FACTOR_WEIGHT = 0.55
const MARKET_FACTOR_WEIGHT = 0.30

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

// ---------------------------------------------------------------------------
// SHOCK EVENTS — random dramatic price jolts
// ---------------------------------------------------------------------------
// Each tick every asset has a small chance of a shock event.
// Shocks are multiplicative jumps layered on top of normal GBM.
// ---------------------------------------------------------------------------

interface ShockEvent {
  label:       string   // flavour text (not shown in UI yet, but useful for debugging)
  magnitude:   number   // mean absolute move, e.g. 0.08 = ±8%
  direction:   1 | -1 | 0  // forced direction: 1=up, -1=down, 0=random
  probability: number   // per-tick probability this event fires
}

// Events that can hit any individual stock
const STOCK_SHOCKS: ShockEvent[] = [
  { label: 'earnings beat',        magnitude: 0.10, direction:  1, probability: 0.008 },
  { label: 'earnings miss',        magnitude: 0.10, direction: -1, probability: 0.008 },
  { label: 'analyst upgrade',      magnitude: 0.06, direction:  1, probability: 0.012 },
  { label: 'analyst downgrade',    magnitude: 0.06, direction: -1, probability: 0.012 },
  { label: 'short squeeze',        magnitude: 0.15, direction:  1, probability: 0.004 },
  { label: 'flash crash',          magnitude: 0.12, direction: -1, probability: 0.004 },
  { label: 'CEO drama',            magnitude: 0.09, direction:  0, probability: 0.006 },
]

// Whole-market events — when one fires it hits every asset simultaneously
const MARKET_SHOCKS: ShockEvent[] = [
  { label: 'Fed surprise hike',    magnitude: 0.04, direction: -1, probability: 0.003 },
  { label: 'Fed pivot rumour',     magnitude: 0.04, direction:  1, probability: 0.003 },
  { label: 'macro dump',           magnitude: 0.06, direction: -1, probability: 0.002 },
  { label: 'risk-on rally',        magnitude: 0.05, direction:  1, probability: 0.002 },
]

function rollShock(events: ShockEvent[]): number {
  // Returns a multiplicative factor, e.g. 1.08 or 0.91, or 1.0 if no event fires
  for (const ev of events) {
    if (Math.random() < ev.probability) {
      const dir = ev.direction === 0 ? (Math.random() < 0.5 ? 1 : -1) : ev.direction
      // Gaussian-scaled magnitude so it's not always exactly the same size
      const size = ev.magnitude * (0.5 + Math.random())
      return 1 + dir * size
    }
  }
  return 1.0
}

// Market-wide shock factor — rolled once per tick, applied to everyone
let marketShockFactor = 1.0

// ---------------------------------------------------------------------------
// Intraday volatility curve
// ---------------------------------------------------------------------------
function intradayVolMultiplier(): number {
  const now = new Date()
  const etHour = (now.getUTCHours() - 4 + 24) % 24 + now.getUTCMinutes() / 60
  const marketOpen  = 9.5
  const marketClose = 16.0

  if (etHour < marketOpen || etHour > marketClose) return 0.5

  const progress = (etHour - marketOpen) / (marketClose - marketOpen)
  return 0.8 + 0.7 * Math.pow(Math.cos(Math.PI * (progress - 0.5)), 2)
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
  drawShocks()
  const volMult = intradayVolMultiplier()

  // Roll market-wide shock once per tick
  marketShockFactor = rollShock(MARKET_SHOCKS)

  const result: Record<string, { price: number; change24h: number; changePct: number }> = {}
  const stockAssets = ASSETS.filter(a => (a.class === 'stock' || a.class === 'etf') && ASSET_PARAMS[a.id])

  for (const asset of stockAssets) {
    const id = asset.id
    const params = ASSET_PARAMS[id]

    if (!state[id]) initAsset(id)
    const s = state[id]

    if (!isSameTradingDay(s.lastDayReset)) {
      s.dailyOpen    = s.price
      s.lastDayReset = Date.now()
    }

    // --- GBM with amplified vol ---
    const idioWeight = Math.sqrt(
      Math.max(0, 1 - SECTOR_FACTOR_WEIGHT ** 2 - MARKET_FACTOR_WEIGHT ** 2)
    )
    const epsilon =
      MARKET_FACTOR_WEIGHT  * marketShock +
      SECTOR_FACTOR_WEIGHT  * (sectorShocks[params.sector] ?? randn()) +
      idioWeight            * randn()

    const sigmaEff = s.vol * volMult * VOL_AMPLIFIER

    const drift = (params.annualDrift - 0.5 * sigmaEff ** 2) * dt
    const shock = sigmaEff * Math.sqrt(dt) * epsilon
    s.price = s.price * Math.exp(drift + shock)

    // Apply market-wide shock factor
    s.price *= marketShockFactor

    // Apply per-asset shock event
    const assetShockFactor = rollShock(STOCK_SHOCKS)
    s.price *= assetShockFactor

    // --- GARCH-lite: vol spikes on big moves ---
    const volLongRun  = params.annualVol
    const volRevSpeed = 0.015
    const volShockAmp = 0.25
    s.vol = s.vol * (1 - volRevSpeed) +
            volLongRun * volRevSpeed +
            volShockAmp * Math.abs(shock) * params.annualVol

    // Clamp to ±80% of base price
    const base = STOCK_BASE_PRICES[id]
    s.price = Math.max(base * PRICE_CLAMP_LOW, Math.min(base * PRICE_CLAMP_HIGH, s.price))

    const change24h = s.price - s.dailyOpen
    const changePct = (change24h / s.dailyOpen) * 100

    result[id] = { price: s.price, change24h, changePct }
  }

  return result
}

// ---------------------------------------------------------------------------
// BONDS — Ornstein-Uhlenbeck, slightly wilder than before
// ---------------------------------------------------------------------------

interface BondState {
  price:        number
  dailyOpen:    number
  lastDayReset: number
}

const BOND_PARAMS: Record<string, { fairValue: number; vol: number; revSpeed: number }> = {
  us10y: { fairValue: 98.50, vol: 0.12, revSpeed: 0.08 },
  us2y:  { fairValue: 99.20, vol: 0.07, revSpeed: 0.12 },
  us30y: { fairValue: 95.80, vol: 0.18, revSpeed: 0.05 },
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

    const theta = params.revSpeed
    const mu    = params.fairValue
    const sigma = params.vol
    const z     = randn()

    // Apply market-wide shock to bonds too (inverted — bad macro = bond rally)
    const bondMarketFactor = marketShockFactor > 1
      ? 1 - (marketShockFactor - 1) * 0.3   // stocks up → bonds slightly down
      : 1 + (1 - marketShockFactor) * 0.3   // stocks down → bonds slightly up

    s.price = s.price + theta * (mu - s.price) * dt + sigma * Math.sqrt(dt) * z
    s.price *= bondMarketFactor

    // Wider clamp for bonds too — ±8% from fair value
    s.price = Math.max(params.fairValue * 0.92, Math.min(params.fairValue * 1.08, s.price))

    const change24h = s.price - s.dailyOpen
    const changePct = (change24h / s.dailyOpen) * 100

    result[id] = { price: s.price, change24h, changePct }
  }

  return result
}