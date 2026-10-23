import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Bar } from './forecast/types'
import type { Prediction } from './game/types'
import { resolveCall } from './game/scoring'

export const DEFAULT_WATCHLIST = ['SPY', 'AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN']

interface GameStore {
  watchlist: string[]
  names: Record<string, string>   // display names remembered from search
  predictions: Prediction[]

  toggleWatch: (symbol: string) => void
  rememberName: (symbol: string, name: string) => void
  makeLiveCall: (p: Omit<Prediction, 'id' | 'mode' | 'status'>) => boolean
  recordReplay: (p: Prediction) => void
  resolveDue: (symbol: string, bars: Bar[]) => Prediction[]
  reset: () => void
}

export const useStore = create<GameStore>()(
  persist(
    (set, get) => ({
      watchlist: DEFAULT_WATCHLIST,
      names: {},
      predictions: [],

      toggleWatch: (symbol) => set(s => ({
        watchlist: s.watchlist.includes(symbol)
          ? s.watchlist.filter(x => x !== symbol)
          : [...s.watchlist, symbol],
      })),

      rememberName: (symbol, name) => set(s => ({ names: { ...s.names, [symbol]: name } })),

      // One open Live call per (ticker, horizon)
      makeLiveCall: (p) => {
        const exists = get().predictions.some(x =>
          x.mode === 'live' && x.status === 'open' && x.symbol === p.symbol && x.horizon === p.horizon)
        if (exists) return false
        const call: Prediction = { ...p, id: `live-${p.symbol}-${p.horizon}-${Date.now()}`, mode: 'live', status: 'open' }
        set(s => ({ predictions: [...s.predictions, call] }))
        return true
      },

      recordReplay: (p) => set(s => ({ predictions: [...s.predictions, p] })),

      resolveDue: (symbol, bars) => {
        const done: Prediction[] = []
        const next = get().predictions.map(p => {
          if (p.mode !== 'live' || p.symbol !== symbol) return p
          const r = resolveCall(p, bars)
          if (!r) return p
          done.push(r)
          return r
        })
        if (done.length) set({ predictions: next })
        return done
      },

      reset: () => set({ predictions: [] }),
    }),
    {
      name: 'tradr-portfolio',
      version: 3,
      // v2 held paper-trading state; keep only the watchlist
      migrate: (old: any) => ({ watchlist: Array.isArray(old?.watchlist) ? old.watchlist : DEFAULT_WATCHLIST }),
    }
  )
)
