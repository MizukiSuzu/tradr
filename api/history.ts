import type { IncomingMessage, ServerResponse } from 'node:http'
import { send, query, td, TICKER } from './_twelvedata.js'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' })
  const symbol = (query(req).get('symbol') ?? '').toUpperCase()
  if (!TICKER.test(symbol)) return send(res, 400, { error: 'Invalid symbol' })

  const r = await td('time_series', { symbol, interval: '1day', outputsize: '640' })
  if (r.error) return send(res, r.status, { error: r.error })

  const bars = (r.data.values ?? [])
    .map((v: any) => ({ date: String(v.datetime).slice(0, 10), close: Number(v.close) }))
    .filter((b: { close: number }) => Number.isFinite(b.close) && b.close > 0)
    .reverse() // Twelve Data returns newest first; the engine expects oldest first
  const now = new Date()
  const nyDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now)
  const nyHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(now))
  if (bars.at(-1)?.date === nyDate && nyHour < 16) bars.pop() // today's bar isn't a close yet
  send(res, 200, { symbol, bars }, 21600)
}
