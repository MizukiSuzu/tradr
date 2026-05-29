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
}

export interface PortfolioSnapshot {
  timestamp: number
  value: number
}
