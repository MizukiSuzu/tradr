import { useEffect, useState } from 'react'
import type { Bar } from './forecast/types'

export interface Quote { symbol: string; name: string; price: number; change: number; changePct: number; prevClose: number; marketOpen: boolean }
export interface SearchResult { symbol: string; name: string; exchange: string; type: 'stock' | 'etf' }

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function getJson(url: string): Promise<any> {
  const r = await fetch(url)
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new ApiError(body.error ?? `Request failed (${r.status})`, r.status)
  return body
}

export async function searchSymbols(q: string): Promise<SearchResult[]> {
  const body = await getJson(`/api/search?q=${encodeURIComponent(q)}`)
  return body.results
}

export async function fetchQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const unique = [...new Set(symbols)]
  const out: Record<string, Quote> = {}
  for (let i = 0; i < unique.length; i += 8) {
    const body = await getJson(`/api/quote?symbols=${unique.slice(i, i + 8).join(',')}`)
    Object.assign(out, body.quotes)
  }
  return out
}

// ponytail: per-tab limiter matching Twelve Data's free 8 credits/min; the CDN cache absorbs
// repeat visitors. A shared server-side budget would need a store (e.g. Vercel KV) if traffic grows.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 8
const starts: number[] = []
async function rateLimit() {
  for (;;) {
    const now = Date.now()
    while (starts.length && now - starts[0] > WINDOW_MS) starts.shift()
    if (starts.length < MAX_PER_WINDOW) { starts.push(now); return }
    await new Promise(r => setTimeout(r, WINDOW_MS - (now - starts[0]) + 50))
  }
}

const historyCache = new Map<string, Promise<Bar[]>>()

export function fetchHistory(symbol: string): Promise<Bar[]> {
  const key = symbol.toUpperCase()
  let p = historyCache.get(key)
  if (!p) {
    p = rateLimit()
      .then(() => getJson(`/api/history?symbol=${encodeURIComponent(key)}`))
      .then(body => body.bars as Bar[])
    p.catch(() => historyCache.delete(key)) // let a later call retry after an error
    historyCache.set(key, p)
  }
  return p
}

export function useHistory(symbol: string | null) {
  const [state, setState] = useState<{ symbol: string | null; bars: Bar[] | null; error: string | null }>({ symbol: null, bars: null, error: null })
  useEffect(() => {
    if (!symbol) return
    let alive = true
    fetchHistory(symbol)
      .then(bars => alive && setState({ symbol, bars, error: null }))
      .catch((e: Error) => alive && setState({ symbol, bars: null, error: e.message }))
    return () => { alive = false }
  }, [symbol])
  // Stored state is tagged with its symbol, so a render for a new symbol never returns the old one's data.
  return state.symbol === symbol
    ? { bars: state.bars, error: state.error, loading: false }
    : { bars: null, error: null, loading: !!symbol }
}
