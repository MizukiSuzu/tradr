import { ASSETS } from './assets'

// Fetch crypto prices from CoinGecko (free, no key needed)
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
          changePct
        }
      }
    }
    return result
  } catch {
    return {}
  }
}

// Stock prices: use realistic mock based on known approximate values
// In a real app you'd use a paid stock API (Alpha Vantage, Polygon.io, etc.)
const STOCK_BASE_PRICES: Record<string, number> = {
  aapl: 213,
  msft: 449,
  nvda: 1090,
  tsla: 177,
  amzn: 210,
  goog: 178,
  spy: 540,
  qqq: 465,
}

const stockOffsets: Record<string, number> = {}

export function fetchStockPrices(): Record<string, { price: number; change24h: number; changePct: number }> {
  const result: Record<string, { price: number; change24h: number; changePct: number }> = {}
  const stockAssets = ASSETS.filter(a => (a.class === 'stock' || a.class === 'etf') && STOCK_BASE_PRICES[a.id])

  for (const asset of stockAssets) {
    const base = STOCK_BASE_PRICES[asset.id]
    // Small random drift each refresh (±0.3%)
    const drift = (Math.random() - 0.5) * 0.006
    stockOffsets[asset.id] = (stockOffsets[asset.id] ?? 0) + drift
    // Cap total offset at ±5%
    stockOffsets[asset.id] = Math.max(-0.05, Math.min(0.05, stockOffsets[asset.id]))

    const price = base * (1 + stockOffsets[asset.id])
    const changePct = stockOffsets[asset.id] * 100
    result[asset.id] = {
      price,
      change24h: base * stockOffsets[asset.id],
      changePct
    }
  }
  return result
}

export function getBondPrices(): Record<string, { price: number; change24h: number; changePct: number }> {
  return {
    us10y: { price: 98.5 + (Math.random() - 0.5) * 0.2, change24h: 0.1, changePct: 0.1 },
    us2y: { price: 99.2 + (Math.random() - 0.5) * 0.1, change24h: 0.05, changePct: 0.05 },
  }
}
