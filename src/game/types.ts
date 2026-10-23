export type Call = 'up' | 'down'
export type Mode = 'live' | 'replay'
export type Horizon = 5 | 21 | 63

export interface Prediction {
  id: string
  mode: Mode
  symbol: string
  horizon: Horizon
  call: Call
  startDate: string   // YYYY-MM-DD of the start bar
  startClose: number
  pUp: number         // cone probability of Up when the call was made, 0..1
  status: 'open' | 'won' | 'lost'
  endDate?: string
  endClose?: number
  points?: number
  resolvedAt?: number // ms timestamp; orders the streak
}

export interface Stats {
  score: number
  streak: number
  accuracy: number | null
  byMode: Record<Mode, { score: number; won: number; resolved: number }>
}

export const HORIZONS: { days: Horizon; label: string }[] = [
  { days: 5, label: '1 week' },
  { days: 21, label: '1 month' },
  { days: 63, label: '3 months' },
]

export function horizonLabel(h: number): string {
  return HORIZONS.find(x => x.days === h)?.label ?? `${h} days`
}
