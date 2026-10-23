import type { Cone, Signal, TrackRecord } from './types.ts'
import { probAbove } from './cone.ts'
import { toneCounts } from './signals.ts'

const usd = (x: number) => `$${x.toFixed(2)}`

// Plain-text context for the analyst chat. Kept short: it counts toward /api/chat's 8,000-char limit.
export function summarizeForecast(input: {
  symbol: string
  name: string
  cone: Cone
  signals: Signal[]
  track: TrackRecord
  openCall: { call: 'up' | 'down'; horizon: number; startDate: string; startClose: number } | null
}): string {
  const { symbol, name, cone, signals, track, openCall } = input
  const end = cone.bands[cone.horizon]
  const counts = toneCounts(signals)
  const lines = [
    `Ticker: ${symbol} (${name}), last daily close ${usd(cone.start)}.`,
    `Forecast horizon: ${cone.horizon} trading days. Median ${usd(end.p50)}; 68% range ${usd(end.p16)}-${usd(end.p84)}; 95% range ${usd(end.p025)}-${usd(end.p975)}.`,
    `Chance of ending above the last daily close (${usd(cone.start)}): ${(probAbove(cone, cone.start) * 100).toFixed(0)}%.`,
    `Method: block-bootstrap Monte Carlo of the last year of daily returns.`,
    `Signals (${counts.bullish} bullish, ${counts.neutral} neutral, ${counts.bearish} bearish): ` +
      signals.map(s => `${s.label} [${s.tone}] - ${s.detail}`).join(' | '),
    track.points.length > 0
      ? `Track record (${track.horizon}-day cones, last ${track.points.length} months): actual price landed inside the 95% band ${track.in95}/${track.points.length} times and inside the 68% band ${track.in68}/${track.points.length} times.`
      : 'Track record: not enough history yet.',
    openCall
      ? `The player called ${openCall.call.toUpperCase()} on ${openCall.startDate} at ${usd(openCall.startClose)} over ${openCall.horizon} trading days; it is still open.`
      : 'The player has no open call on this ticker.',
  ]
  return lines.join('\n')
}
