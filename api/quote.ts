import type { IncomingMessage, ServerResponse } from 'node:http'
import { send, query, td, TICKER } from './_twelvedata.js'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' })
  const symbols = [...new Set((query(req).get('symbols') ?? '').toUpperCase().split(',').filter(Boolean))].sort()
  if (symbols.length === 0 || symbols.length > 8 || !symbols.every(s => TICKER.test(s))) {
    return send(res, 400, { error: 'Invalid symbols' })
  }

  const r = await td('quote', { symbol: symbols.join(',') })
  if (r.error) return send(res, r.status, { error: r.error })

  const raw: Record<string, any> = symbols.length === 1 ? { [symbols[0]]: r.data } : r.data
  const quotes: Record<string, unknown> = {}
  for (const s of symbols) {
    const q = raw[s]
    if (!q || q.status === 'error' || q.close == null) continue
    quotes[s] = {
      symbol: s,
      name: q.name ?? s,
      price: Number(q.close),
      change: Number(q.change),
      changePct: Number(q.percent_change),
      prevClose: Number(q.previous_close),
      marketOpen: Boolean(q.is_market_open),
    }
  }
  send(res, 200, { quotes }, 300)
}
