import type { IncomingMessage, ServerResponse } from 'node:http'
import { send, query, td, TICKER } from './_twelvedata.js'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' })
  const symbol = (query(req).get('symbol') ?? '').toUpperCase()
  if (!TICKER.test(symbol)) return send(res, 400, { error: 'Invalid symbol' })

  const r = await td('time_series', { symbol, interval: '1day', outputsize: '500' })
  if (r.error) return send(res, r.status, { error: r.error })

  const bars = (r.data.values ?? [])
    .map((v: any) => ({ date: String(v.datetime).slice(0, 10), close: Number(v.close) }))
    .filter((b: { close: number }) => Number.isFinite(b.close) && b.close > 0)
    .reverse() // Twelve Data returns newest first; the engine expects oldest first
  send(res, 200, { symbol, bars }, 21600)
}
