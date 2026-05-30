export type AssetClass = 'crypto' | 'stock' | 'bond' | 'etf'

export interface Asset {
  id: string
  symbol: string
  name: string
  class: AssetClass
  price: number
  change24h: number
  changePct: number
  volume: string
  marketCap: string
  realSymbol?: string // what to fetch from API
}

export interface Holding {
  assetId: string
  quantity: number
  avgBuyPrice: number
}

export interface Trade {
  id: string
  assetId: string
  type: 'buy' | 'sell'
  quantity: number
  price: number
  total: number
  timestamp: number
  reasoning?: string
  costBasis?: number  // avg buy price at time of sell — used for realized P&L
}

export interface PortfolioSnapshot {
  timestamp: number
  value: number
}

export interface PriceAlert {
  id: string
  assetId: string
  direction: 'above' | 'below'
  targetPrice: number
  createdAt: number
}

export interface LimitOrder {
  id: string
  assetId: string
  type: 'buy' | 'sell'
  quantity: number
  limitPrice: number
  reservedCash: number
  createdAt: number
}