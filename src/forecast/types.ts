export interface Bar { date: string; close: number }

export interface ConeBand { step: number; p025: number; p16: number; p50: number; p84: number; p975: number }

export interface Cone {
  start: number
  horizon: number
  bands: ConeBand[]   // bands[0] is today (all values = start)
  finals: number[]    // simulated prices at the horizon, sorted ascending
}

export type Tone = 'bullish' | 'neutral' | 'bearish'

export interface Signal {
  id: 'trend' | 'momentum' | 'rsi' | 'volatility'
  label: string
  tone: Tone
  detail: string
}

export interface TrackPoint {
  anchorDate: string
  start: number
  p025: number
  p16: number
  p84: number
  p975: number
  actual: number
  in68: boolean
  in95: boolean
}

export interface TrackRecord { points: TrackPoint[]; in68: number; in95: number; horizon: number }
