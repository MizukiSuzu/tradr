import type { Bar, TrackPoint, TrackRecord } from './types.ts'
import { buildCone } from './cone.ts'

const MIN_HISTORY = 252

// Walk-forward check: for each past anchor, build a cone from data up to that day only,
// then see where the price actually landed `horizon` trading days later.
export function buildTrackRecord(
  bars: Bar[],
  opts: { anchors?: number; horizon?: number; paths?: number; seed?: number } = {},
): TrackRecord {
  const { anchors = 12, horizon = 21, paths = 2000, seed = 1 } = opts
  const closes = bars.map(b => b.close)
  const points: TrackPoint[] = []

  for (let i = anchors; i >= 1; i--) {
    const idx = closes.length - 1 - horizon * i
    if (idx < MIN_HISTORY) continue
    const cone = buildCone(closes.slice(0, idx + 1), horizon, { paths, seed })
    const end = cone.bands[horizon]
    const actual = closes[idx + horizon]
    points.push({
      anchorDate: bars[idx].date,
      start: cone.start,
      p025: end.p025,
      p16: end.p16,
      p84: end.p84,
      p975: end.p975,
      actual,
      in68: actual >= end.p16 && actual <= end.p84,
      in95: actual >= end.p025 && actual <= end.p975,
    })
  }

  return {
    points,
    in68: points.filter(p => p.in68).length,
    in95: points.filter(p => p.in95).length,
    horizon,
  }
}
