import { useState, useEffect, useCallback } from 'react'
import { useStore } from './store'
import { fetchCryptoPrices, fetchStockPrices, getBondPrices } from './prices'
import Header from './components/Header'
import Loader from './components/Loader'
import Ticker from './components/Ticker'
import MarketTab from './components/MarketTab'
import PortfolioTab from './components/PortfolioTab'
import TradeModal from './components/TradeModal'
import Toast from './components/Toast'
import TradersTab from './components/TradersTab'
import { useAgentStore } from './agents/agentStore'
import { Asset } from './types'

export type Tab = 'market' | 'portfolio' | 'history' | 'traders'

export default function App() {
  const updatePrices = useStore(s => s.updatePrices)
  const assets = useStore(s => s.assets)
  const tickAgents = useAgentStore(s => s.tickAgents)
  const initAgents = useAgentStore(s => s.initAgents)
  const triggeredAlerts = useStore(s => s.triggeredAlerts)
  const dismissTriggeredAlert = useStore(s => s.dismissTriggeredAlert)
  const executedOrders = useStore(s => s.executedOrders)
  const dismissExecutedOrder = useStore(s => s.dismissExecutedOrder)
  const [tab, setTab] = useState<Tab>('market')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy')
  const [toasts, setToasts] = useState<{ id: string; msg: string; ok: boolean }[]>([])
  const [loading, setLoading] = useState(true)

  // Watch for triggered price alerts
  useEffect(() => {
    if (triggeredAlerts.length > 0) {
      const latest = triggeredAlerts[triggeredAlerts.length - 1]
      showToast('🔔 ' + latest.msg, true)
      dismissTriggeredAlert(latest.id)
    }
  }, [triggeredAlerts])

  // Watch for executed limit orders
  useEffect(() => {
    if (executedOrders.length > 0) {
      const latest = executedOrders[executedOrders.length - 1]
      showToast('⏳ ' + latest.msg, true)
      dismissExecutedOrder(latest.id)
    }
  }, [executedOrders])

  const refresh = useCallback(async () => {
    const [crypto, stocks, bonds] = await Promise.all([
      fetchCryptoPrices(),
      Promise.resolve(fetchStockPrices()),
      Promise.resolve(getBondPrices()),
    ])
    updatePrices({ ...crypto, ...stocks, ...bonds })
    tickAgents(useStore.getState().assets)
    setLoading(false)
  }, [updatePrices, tickAgents])

  useEffect(() => {
    initAgents(assets)
    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [refresh])

  const openTrade = (asset: Asset, type: 'buy' | 'sell') => {
    setSelectedAsset(asset)
    setTradeType(type)
  }

  const showToast = (msg: string, ok: boolean) => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, msg, ok }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {loading && <Loader />}
      <Header tab={tab} setTab={setTab} loading={loading} onRefresh={refresh} />
      <Ticker />
      <main style={{ flex: 1, maxWidth: 1200, margin: '0 auto', width: '100%', padding: '0 20px 60px' }}>
        {tab === 'market'    && <MarketTab onTrade={openTrade} />}
        {tab === 'portfolio' && <PortfolioTab onTrade={openTrade} />}
        {tab === 'history'   && <HistoryTab />}
        {tab === 'traders'   && <TradersTab />}
      </main>
      {selectedAsset && (
        <TradeModal
          asset={selectedAsset}
          type={tradeType}
          onClose={() => setSelectedAsset(null)}
          onToast={showToast}
        />
      )}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 9000 }}>
        {toasts.map(t => <Toast key={t.id} msg={t.msg} ok={t.ok} />)}
      </div>
    </div>
  )
}

function HistoryTab() {
  const trades = useStore(s => s.trades)
  const assets = useStore(s => s.assets)

  // Realized P&L: sum of all sell trades where costBasis is known
  const realizedPnl = trades
    .filter(t => t.type === 'sell' && t.costBasis != null)
    .reduce((sum, t) => sum + (t.price - t.costBasis!) * t.quantity, 0)
  const hasRealizedPnl = trades.some(t => t.type === 'sell' && t.costBasis != null)

  if (trades.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 20px', gap: 20 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'rgba(192,132,252,0.08)',
          border: '1px solid rgba(192,132,252,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
        }}>📋</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)', letterSpacing: 1 }}>NO TRADES YET</div>
        <div style={{ fontSize: 13, color: 'var(--faint)' }}>Head to Markets to make your first move</div>
      </div>
    )
  }

  return (
    <div style={{ animation: 'slideIn 0.3s ease' }}>
      <div style={{ padding: '32px 0 24px', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 2, marginBottom: 6 }}>ACTIVITY</div>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28, margin: 0 }}>Trade History</h2>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>
          {trades.length} total trade{trades.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Realized P&L summary card */}
      {hasRealizedPnl && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', marginBottom: 20,
          background: realizedPnl >= 0 ? 'rgba(134,239,172,0.06)' : 'rgba(248,113,113,0.06)',
          border: `1px solid ${realizedPnl >= 0 ? 'rgba(134,239,172,0.2)' : 'rgba(248,113,113,0.2)'}`,
          borderRadius: 14,
        }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1.5, marginBottom: 4 }}>REALIZED P&L</div>
            <div style={{ fontSize: 11, color: 'var(--faint)' }}>From closed positions</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22,
              color: realizedPnl >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {realizedPnl >= 0 ? '+' : ''}${Math.abs(realizedPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {trades.map((t, i) => {
          const asset = assets.find(a => a.id === t.assetId)
          const isBuy = t.type === 'buy'
          // Realized P&L for this sell trade
          const tradeRealizedPnl = !isBuy && t.costBasis != null
            ? (t.price - t.costBasis) * t.quantity
            : null

          return (
            <div key={t.id} style={{
              display: 'grid',
              gridTemplateColumns: '36px 1fr 1fr auto',
              alignItems: 'center',
              gap: 16,
              padding: '14px 18px',
              background: 'rgba(22,16,43,0.7)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${isBuy ? 'var(--green)' : 'var(--red)'}`,
              borderRadius: '0 12px 12px 0',
              animation: `slideIn 0.3s ease ${Math.min(i * 0.03, 0.3)}s both`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: isBuy ? 'rgba(134,239,172,0.12)' : 'rgba(248,113,113,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>
                {isBuy ? '▲' : '▼'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{asset?.symbol ?? t.assetId}</span>
                  <span style={{
                    background: isBuy ? 'rgba(134,239,172,0.15)' : 'rgba(248,113,113,0.15)',
                    color: isBuy ? 'var(--green)' : 'var(--red)',
                    fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                    padding: '2px 7px', borderRadius: 4, letterSpacing: 1,
                  }}>{t.type.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  {t.quantity} × ${t.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}>
                  ${t.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                {/* Realized P&L badge on sells */}
                {tradeRealizedPnl != null && (
                  <div style={{
                    display: 'inline-block', marginTop: 4,
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    color: tradeRealizedPnl >= 0 ? 'var(--green)' : 'var(--red)',
                    background: tradeRealizedPnl >= 0 ? 'rgba(134,239,172,0.1)' : 'rgba(248,113,113,0.1)',
                    border: `1px solid ${tradeRealizedPnl >= 0 ? 'rgba(134,239,172,0.25)' : 'rgba(248,113,113,0.25)'}`,
                    borderRadius: 5, padding: '2px 7px',
                  }}>
                    {tradeRealizedPnl >= 0 ? '+' : ''}${Math.abs(tradeRealizedPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })} realized
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>
                {new Date(t.timestamp).toLocaleDateString()}<br />
                {new Date(t.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}