import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Asset, Holding, Trade, PortfolioSnapshot, PriceAlert, LimitOrder } from './types'
import { ASSETS, STARTING_BALANCE } from './assets'

interface PortfolioStore {
  cash: number
  holdings: Holding[]
  trades: Trade[]
  assets: Asset[]
  history: PortfolioSnapshot[]
  lastUpdated: number | null
  alerts: PriceAlert[]
  pendingOrders: LimitOrder[]
  triggeredAlerts: { msg: string; id: string }[]
  executedOrders: { msg: string; id: string }[]
  favourites: string[]
  notifications: { id: string; msg: string; ok: boolean; timestamp: number }[]

  updatePrices: (updates: Record<string, { price: number; change24h: number; changePct: number }>) => void
  buy: (assetId: string, quantity: number) => { ok: boolean; msg: string }
  sell: (assetId: string, quantity: number) => { ok: boolean; msg: string }
  getHolding: (assetId: string) => Holding | undefined
  totalValue: () => number
  resetPortfolio: () => void
  recordSnapshot: () => void

  // Alerts
  addAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt'>) => void
  removeAlert: (id: string) => void
  checkAlerts: (assets: Asset[]) => void
  dismissTriggeredAlert: (id: string) => void

  // Limit orders
  placeLimitOrder: (order: Omit<LimitOrder, 'id' | 'createdAt'>) => { ok: boolean; msg: string }
  cancelLimitOrder: (id: string) => void
  executePendingOrders: (assets: Asset[]) => void
  dismissExecutedOrder: (id: string) => void

  // Favourites
  toggleFavourite: (assetId: string) => void

  // Notifications
  addNotification: (msg: string, ok: boolean) => void
  clearNotifications: () => void
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
      alerts: [],
      pendingOrders: [],
      triggeredAlerts: [],
      executedOrders: [],
      favourites: [],
      notifications: [],

      updatePrices: (updates) => {
        set(s => ({
          assets: s.assets.map(a => {
            const u = updates[a.id]
            if (!u) return a
            return { ...a, price: u.price, change24h: u.change24h, changePct: u.changePct }
          }),
          lastUpdated: Date.now()
        }))
        const newAssets = get().assets
        get().checkAlerts(newAssets)
        get().executePendingOrders(newAssets)
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

        const trade: Trade = { id: Date.now().toString(), assetId, type: 'sell', quantity, price: asset.price, total, timestamp: Date.now(), costBasis: holding.avgBuyPrice }
        set(s => ({ cash: s.cash + total, holdings: newHoldings, trades: [trade, ...s.trades] }))
        return { ok: true, msg: `Sold ${quantity} ${asset.symbol}` }
      },

      getHolding: (assetId) => get().holdings.find(h => h.assetId === assetId),

      totalValue: () => {
        const { cash, holdings, assets, pendingOrders } = get()
        const investedValue = holdings.reduce((sum, h) => {
          const asset = assets.find(a => a.id === h.assetId)
          return sum + (asset ? asset.price * h.quantity : 0)
        }, 0)
        const reservedCash = pendingOrders.filter(o => o.type === 'buy').reduce((s, o) => s + o.reservedCash, 0)
        return cash + investedValue + reservedCash
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
        lastUpdated: null,
        alerts: [],
        pendingOrders: [],
        triggeredAlerts: [],
        executedOrders: [],
      }),

      // ── Alerts ──────────────────────────────────────────────────────────────

      addAlert: (alertData) => {
        const alert: PriceAlert = { ...alertData, id: `alert-${Date.now()}`, createdAt: Date.now() }
        set(s => ({ alerts: [...s.alerts, alert] }))
      },

      removeAlert: (id) => set(s => ({ alerts: s.alerts.filter(a => a.id !== id) })),

      checkAlerts: (assets) => {
        const { alerts } = get()
        if (alerts.length === 0) return

        const triggered: PriceAlert[] = []
        for (const alert of alerts) {
          const asset = assets.find(a => a.id === alert.assetId)
          if (!asset || asset.price === 0) continue
          const hit = alert.direction === 'above'
            ? asset.price >= alert.targetPrice
            : asset.price <= alert.targetPrice
          if (hit) triggered.push(alert)
        }

        if (triggered.length > 0) {
          const triggeredIds = triggered.map(a => a.id)
          const newTriggered = triggered.map(a => {
            const asset = assets.find(x => x.id === a.assetId)!
            const arrow = a.direction === 'above' ? '↑' : '↓'
            const priceStr = a.targetPrice < 1 ? a.targetPrice.toFixed(4) : a.targetPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })
            return { msg: `${asset.symbol} crossed $${priceStr} ${arrow}`, id: a.id }
          })
          set(s => ({
            alerts: s.alerts.filter(a => !triggeredIds.includes(a.id)),
            triggeredAlerts: [...s.triggeredAlerts, ...newTriggered],
          }))
        }
      },

      dismissTriggeredAlert: (id) => set(s => ({ triggeredAlerts: s.triggeredAlerts.filter(a => a.id !== id) })),

      // ── Limit orders ────────────────────────────────────────────────────────

      placeLimitOrder: (orderData) => {
        const { cash, holdings, assets } = get()
        const asset = assets.find(a => a.id === orderData.assetId)
        if (!asset) return { ok: false, msg: 'Asset not found' }

        if (orderData.type === 'buy') {
          const cost = orderData.limitPrice * orderData.quantity
          if (cost > cash) return { ok: false, msg: 'Insufficient funds for limit order' }
          const order: LimitOrder = { ...orderData, id: `limit-${Date.now()}`, createdAt: Date.now() }
          set(s => ({ cash: s.cash - order.reservedCash, pendingOrders: [...s.pendingOrders, order] }))
          return { ok: true, msg: `Limit buy queued: ${orderData.quantity} ${asset.symbol} @ $${orderData.limitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` }
        } else {
          const holding = holdings.find(h => h.assetId === orderData.assetId)
          if (!holding || holding.quantity < orderData.quantity) return { ok: false, msg: 'Not enough holdings for limit sell' }
          const order: LimitOrder = { ...orderData, id: `limit-${Date.now()}`, createdAt: Date.now() }
          set(s => ({ pendingOrders: [...s.pendingOrders, order] }))
          return { ok: true, msg: `Limit sell queued: ${orderData.quantity} ${asset.symbol} @ $${orderData.limitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` }
        }
      },

      cancelLimitOrder: (id) => {
        const order = get().pendingOrders.find(o => o.id === id)
        if (!order) return
        if (order.type === 'buy') {
          set(s => ({ cash: s.cash + order.reservedCash, pendingOrders: s.pendingOrders.filter(o => o.id !== id) }))
        } else {
          set(s => ({ pendingOrders: s.pendingOrders.filter(o => o.id !== id) }))
        }
      },

      executePendingOrders: (assets) => {
        const { pendingOrders } = get()
        if (pendingOrders.length === 0) return

        const newExecutedMsgs: { msg: string; id: string }[] = []

        for (const order of pendingOrders) {
          const asset = assets.find(a => a.id === order.assetId)
          if (!asset || asset.price === 0) continue

          const shouldExecute = order.type === 'buy'
            ? asset.price <= order.limitPrice
            : asset.price >= order.limitPrice

          if (!shouldExecute) continue

          const total = asset.price * order.quantity
          const priceStr = asset.price < 1 ? asset.price.toFixed(4) : asset.price.toLocaleString(undefined, { maximumFractionDigits: 2 })
          const msgId = `exec-${order.id}`
          newExecutedMsgs.push({ msg: `Limit order filled: ${order.type === 'buy' ? 'bought' : 'sold'} ${order.quantity} ${asset.symbol} @ $${priceStr}`, id: msgId })

          if (order.type === 'buy') {
            const existing = get().holdings.find(h => h.assetId === order.assetId)
            let newHoldings: Holding[]
            if (existing) {
              const totalQty = existing.quantity + order.quantity
              const avgPrice = (existing.avgBuyPrice * existing.quantity + total) / totalQty
              newHoldings = get().holdings.map(h => h.assetId === order.assetId ? { ...h, quantity: totalQty, avgBuyPrice: avgPrice } : h)
            } else {
              newHoldings = [...get().holdings, { assetId: order.assetId, quantity: order.quantity, avgBuyPrice: asset.price }]
            }
            const refund = order.reservedCash - total
            const trade: Trade = { id: Date.now().toString(), assetId: order.assetId, type: 'buy', quantity: order.quantity, price: asset.price, total, timestamp: Date.now() }
            set(s => ({
              cash: s.cash + (refund > 0 ? refund : 0),
              holdings: newHoldings,
              trades: [trade, ...s.trades],
              pendingOrders: s.pendingOrders.filter(o => o.id !== order.id),
            }))
          } else {
            const holding = get().holdings.find(h => h.assetId === order.assetId)
            if (!holding || holding.quantity < order.quantity) {
              set(s => ({ pendingOrders: s.pendingOrders.filter(o => o.id !== order.id) }))
              continue
            }
            const newQty = holding.quantity - order.quantity
            const newHoldings = newQty === 0
              ? get().holdings.filter(h => h.assetId !== order.assetId)
              : get().holdings.map(h => h.assetId === order.assetId ? { ...h, quantity: newQty } : h)
            const trade: Trade = { id: Date.now().toString(), assetId: order.assetId, type: 'sell', quantity: order.quantity, price: asset.price, total, timestamp: Date.now(), costBasis: holding.avgBuyPrice }
            set(s => ({
              cash: s.cash + total,
              holdings: newHoldings,
              trades: [trade, ...s.trades],
              pendingOrders: s.pendingOrders.filter(o => o.id !== order.id),
            }))
          }
        }

        if (newExecutedMsgs.length > 0) {
          set(s => ({ executedOrders: [...s.executedOrders, ...newExecutedMsgs] }))
        }
      },

      dismissExecutedOrder: (id) => set(s => ({ executedOrders: s.executedOrders.filter(o => o.id !== id) })),

      // ── Favourites ──────────────────────────────────────────────────────────

      toggleFavourite: (assetId) => set(s => ({
        favourites: s.favourites.includes(assetId)
          ? s.favourites.filter(id => id !== assetId)
          : [...s.favourites, assetId]
      })),

      addNotification: (msg, ok) => set(s => ({
        notifications: [
          { id: Date.now().toString(), msg, ok, timestamp: Date.now() },
          ...s.notifications,
        ].slice(0, 100), // keep last 100
      })),
      clearNotifications: () => set({ notifications: [] }),
    }),
    { name: 'tradr-portfolio' }
  )
)