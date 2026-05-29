import { useState, useEffect, useCallback } from 'react'
import { useStore } from './store'
import { fetchCryptoPrices, fetchStockPrices, getBondPrices } from './prices'
import Header from './components/Header'
import Ticker from './components/Ticker'
import MarketTab from './components/MarketTab'
import PortfolioTab from './components/PortfolioTab'
import TradeModal from './components/TradeModal'
import Toast from './components/Toast'
import { Asset } from './types'

export type Tab = 'market' | 'portfolio' | 'history'

export default function App() {
  const updatePrices = useStore(s => s.updatePrices)
  const [tab, setTab] = useState<Tab>('market')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [crypto, stocks, bonds] = await Promise.all([
      fetchCryptoPrices(),
      Promise.resolve(fetchStockPrices()),
      Promise.resolve(getBondPrices()),
    ])
    updatePrices({ ...crypto, ...stocks, ...bonds })
    setLoading(false)
  }, [updatePrices])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30_000) // refresh every 30s
    return () => clearInterval(interval)
  }, [refresh])

  const openTrade = (asset: Asset, type: 'buy' | 'sell') => {
    setSelectedAsset(asset)
    setTradeType(type)
  }

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header tab={tab} setTab={setTab} loading={loading} onRefresh={refresh} />
      <Ticker />
      <main style={{ flex: 1, maxWidth: 1200, margin: '0 auto', width: '100%', padding: '0 16px 40px' }}>
        {tab === 'market' && <MarketTab onTrade={openTrade} />}
        {tab === 'portfolio' && <PortfolioTab onTrade={openTrade} />}
        {tab === 'history' && <HistoryTab />}
      </main>
      {selectedAsset && (
        <TradeModal
          asset={selectedAsset}
          type={tradeType}
          onClose={() => setSelectedAsset(null)}
          onToast={showToast}
        />
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}

function HistoryTab() {
  const trades = useStore(s => s.trades)
  const assets = useStore(s => s.assets)

  if (trades.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--muted)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>No trades yet. Start trading!</div>
      </div>
    )
  }

  return (
    <div style={{ animation: 'slideIn 0.3s ease' }}>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 24, margin: '32px 0 20px', color: 'var(--accent)' }}>
        Trade History
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {trades.map(t => {
          const asset = assets.find(a => a.id === t.assetId)
          return (
            <div key={t.id} style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  background: t.type === 'buy' ? 'rgba(0,255,136,0.15)' : 'rgba(255,59,92,0.15)',
                  color: t.type === 'buy' ? 'var(--green)' : 'var(--red)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 4,
                  letterSpacing: 1,
                }}>
                  {t.type.toUpperCase()}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{asset?.symbol ?? t.assetId}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    {t.quantity} × ${t.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}>
                  ${t.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  {new Date(t.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
