import { useState, useEffect } from 'react'
import { useStore } from './store'
import { fetchHistory } from './data'
import type { SearchResult } from './data'
import type { Prediction } from './game/types'
import { horizonLabel } from './game/types'
import WatchlistTab from './components/WatchlistTab'
import StockPage from './components/StockPage'
import PredictionsTab from './components/PredictionsTab'
import ReplayTab from './components/ReplayTab'
import Header from './components/Header'
import Ticker from './components/Ticker'
import Toast from './components/Toast'
import AnalystChat from './components/AnalystChat'

export type Tab = 'watchlist' | 'replay' | 'predictions'

export default function App() {
  const rememberName = useStore(s => s.rememberName)
  const resolveDue = useStore(s => s.resolveDue)
  const [tab, setTab] = useState<Tab>('watchlist')
  const [viewing, setViewing] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [toasts, setToasts] = useState<{ id: string; msg: string; ok: boolean }[]>([])

  const showToast = (msg: string, ok: boolean) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, msg, ok }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }

  const announce = (ps: Prediction[]) => {
    for (const p of ps) {
      const label = `${p.symbol} ${horizonLabel(p.horizon)} call`
      showToast(p.status === 'won' ? `${label}: +${p.points} correct` : `${label}: missed`, p.status === 'won')
    }
  }

  // On load, resolve Live calls that came due since the last visit
  useEffect(() => {
    const symbols = [...new Set(useStore.getState().predictions
      .filter(p => p.mode === 'live' && p.status === 'open')
      .map(p => p.symbol))]
    for (const s of symbols) {
      fetchHistory(s).then(bars => announce(resolveDue(s, bars))).catch(() => { /* retried on the next load */ })
    }
  }, [])

  const openSymbol = (symbol: string) => { setViewing(symbol); window.scrollTo(0, 0) }
  const onSelectSymbol = (r: SearchResult) => {
    rememberName(r.symbol, r.name)
    openSymbol(r.symbol)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header tab={tab} setTab={t => { setViewing(null); setTab(t) }} onSelectSymbol={onSelectSymbol} />
      <Ticker />
      <main style={{ flex: 1, maxWidth: 1200, margin: '0 auto', width: '100%', padding: '0 20px 60px' }}>
        {viewing ? (
          <StockPage key={viewing} symbol={viewing} onBack={() => setViewing(null)} onSummary={setSummary} onResolved={announce} />
        ) : (
          <>
            {tab === 'watchlist'   && <WatchlistTab onOpen={openSymbol} />}
            {tab === 'replay'      && <ReplayTab />}
            {tab === 'predictions' && <PredictionsTab onOpen={openSymbol} />}
          </>
        )}
      </main>
      <AnalystChat summary={summary} symbol={viewing} />
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 9000 }}>
        {toasts.map(t => <Toast key={t.id} msg={t.msg} ok={t.ok} />)}
      </div>
    </div>
  )
}
