import type { IncomingMessage, ServerResponse } from 'node:http'
import { send, query, td } from './_twelvedata.js'

const TYPES: Record<string, 'stock' | 'etf'> = { 'Common Stock': 'stock', ETF: 'etf' }

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' })
  const q = (query(req).get('q') ?? '').trim()
  if (q.length < 1 || q.length > 30) return send(res, 400, { error: 'Invalid query' })

  const r = await td('symbol_search', { symbol: q, outputsize: '20' })
  if (r.error) return send(res, r.status, { error: r.error })

  const results = (r.data.data ?? [])
    .filter((d: any) => d.country === 'United States' && TYPES[d.instrument_type])
    .slice(0, 10)
    .map((d: any) => ({ symbol: d.symbol, name: d.instrument_name, exchange: d.exchange, type: TYPES[d.instrument_type] }))
  send(res, 200, { results }, 86400)
}
