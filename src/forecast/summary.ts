import type { Cone, Signal, TrackRecord } from './types.ts'
import { probAbove } from './cone.ts'
import { toneCounts } from './signals.ts'

const usd = (x: number) => `$${x.toFixed(2)}`

// Plain-text context for the analyst chat. Kept short: it counts toward /api/chat's 8,000-char limit.
export function summarizeForecast(input: {
  symbol: string
  name: string
  price: number
  cone: Cone
  signals: Signal[]
  track: TrackRecord
  position: { quantity: number; avgBuyPrice: number } | null
}): string {
  const { symbol, name, price, cone, signals, track, position } = input
  const end = cone.bands[cone.horizon]
  const counts = toneCounts(signals)
  const lines = [
    `Ticker: ${symbol} (${name}), last price ${usd(price)}.`,
    `Forecast horizon: ${cone.horizon} trading days. Median ${usd(end.p50)}; 68% range ${usd(end.p16)}-${usd(end.p84)}; 95% range ${usd(end.p025)}-${usd(end.p975)}.`,
    `Chance of ending above today's price: ${(probAbove(cone, cone.start) * 100).toFixed(0)}%.`,
    `Method: block-bootstrap Monte Carlo of the last year of daily returns.`,
    `Signals (${counts.bullish} bullish, ${counts.neutral} neutral, ${counts.bearish} bearish): ` +
      signals.map(s => `${s.label} [${s.tone}] - ${s.detail}`).join(' | '),
    track.points.length > 0
      ? `Track record (${track.horizon}-day cones, last ${track.points.length} months): actual price landed inside the 95% band ${track.in95}/${track.points.length} times and inside the 68% band ${track.in68}/${track.points.length} times.`
      : 'Track record: not enough history yet.',
    position
      ? `User holds ${position.quantity} shares at an average ${usd(position.avgBuyPrice)} (paper trading).`
      : 'User holds no position in this ticker.',
  ]
  return lines.join('\n')
}
