// Shared helpers for the Twelve Data proxy routes. Underscore prefix: not a route on Vercel.
import type { IncomingMessage, ServerResponse } from 'node:http'

export const TICKER = /^[A-Z0-9.\-]{1,10}$/

export function send(res: ServerResponse, status: number, body: unknown, cacheSeconds = 0) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  if (status === 200 && cacheSeconds > 0) {
    res.setHeader('Cache-Control', `public, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`)
  }
  res.end(JSON.stringify(body))
}

export function query(req: IncomingMessage): URLSearchParams {
  return new URL(req.url ?? '/', 'http://localhost').searchParams
}

// Returns parsed JSON, or { error, status } when the key is missing or Twelve Data reports an error.
export async function td(path: string, params: Record<string, string>): Promise<{ data?: any; error?: string; status: number }> {
  const apiKey = process.env.TWELVEDATA_API_KEY
  if (!apiKey) return { error: 'TWELVEDATA_API_KEY not set', status: 500 }
  const url = new URL(`https://api.twelvedata.com/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('apikey', apiKey)
  const r = await fetch(url)
  const data = await r.json().catch(() => null)
  if (!r.ok || !data || data.status === 'error') {
    const code = data?.code
    const valid = Number.isInteger(code) && code >= 400 && code < 600
    return { error: data?.message ?? `Upstream error ${r.status}`, status: valid ? code : (r.ok ? 502 : r.status) }
  }
  return { data, status: 200 }
}
