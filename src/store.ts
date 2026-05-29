import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Asset, Holding, Trade, PortfolioSnapshot } from './types'
import { ASSETS, STARTING_BALANCE } from './assets'

interface PortfolioStore {
  cash: number
  holdings: Holding[]
  trades: Trade[]
  assets: Asset[]
  history: PortfolioSnapshot[]
  lastUpdated: number | null

  updatePrices: (updates: Record<string, { price: number; change24h: number; changePct: number }>) => void
  buy: (assetId: string, quantity: number) => { ok: boolean; msg: string }
  sell: (assetId: string, quantity: number) => { ok: boolean; msg: string }
  getHolding: (assetId: string) => Holding | undefined
  totalValue: () => number
  resetPortfolio: () => void
  recordSnapshot: () => void
}

export const useStore = create<PortfolioStore>()(
  persist(
    (set, get) => ({
      cash: STARTING_BALANCE,
      holdings: [],
      trades: [],
      assets: ASSETS,
      history: [],
      lastUpdated: null,

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

      buy: (assetId, quantity) => {
        const { cash, assets, holdings } = get()
        const asset = assets.find(a => a.id === assetId)
        if (!asset || asset.price === 0) return { ok: false, msg: 'Price not available' }
        const total = asset.price * quantity
        if (total > cash) return { ok: false, msg: 'Insufficient funds' }

        const existing = holdings.find(h => h.assetId === assetId)
        let newHoldings: Holding[]
        if (existing) {
          const totalQty = existing.quantity + quantity
          const avgPrice = (existing.avgBuyPrice * existing.quantity + total) / totalQty
          newHoldings = holdings.map(h => h.assetId === assetId ? { ...h, quantity: totalQty, avgBuyPrice: avgPrice } : h)
        } else {
          newHoldings = [...holdings, { assetId, quantity, avgBuyPrice: asset.price }]
        }

        const trade: Trade = { id: Date.now().toString(), assetId, type: 'buy', quantity, price: asset.price, total, timestamp: Date.now() }
        set(s => ({ cash: s.cash - total, holdings: newHoldings, trades: [trade, ...s.trades] }))
        return { ok: true, msg: `Bought ${quantity} ${asset.symbol}` }
      },

      sell: (assetId, quantity) => {
        const { assets, holdings } = get()
        const asset = assets.find(a => a.id === assetId)
        const holding = holdings.find(h => h.assetId === assetId)
        if (!asset || asset.price === 0) return { ok: false, msg: 'Price not available' }
        if (!holding || holding.quantity < quantity) return { ok: false, msg: 'Not enough holdings' }

        const total = asset.price * quantity
        const newQty = holding.quantity - quantity
        const newHoldings = newQty === 0
          ? holdings.filter(h => h.assetId !== assetId)
          : holdings.map(h => h.assetId === assetId ? { ...h, quantity: newQty } : h)

        const trade: Trade = { id: Date.now().toString(), assetId, type: 'sell', quantity, price: asset.price, total, timestamp: Date.now() }
        set(s => ({ cash: s.cash + total, holdings: newHoldings, trades: [trade, ...s.trades] }))
        return { ok: true, msg: `Sold ${quantity} ${asset.symbol}` }
      },

      getHolding: (assetId) => get().holdings.find(h => h.assetId === assetId),

      totalValue: () => {
        const { cash, holdings, assets } = get()
        const investedValue = holdings.reduce((sum, h) => {
          const asset = assets.find(a => a.id === h.assetId)
          return sum + (asset ? asset.price * h.quantity : 0)
        }, 0)
        return cash + investedValue
      },

      recordSnapshot: () => {
        const total = get().totalValue()
        if (total === 0) return
        set(s => ({
          history: [...s.history.slice(-100), { timestamp: Date.now(), value: total }]
        }))
      },

      resetPortfolio: () => set({
        cash: STARTING_BALANCE,
        holdings: [],
        trades: [],
        history: [],
        lastUpdated: null
      }),
    }),
    { name: 'marketsim-portfolio' }
  )
)
