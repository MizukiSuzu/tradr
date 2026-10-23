import type { Signal, Tone } from './types.ts'
import { logReturns } from './cone.ts'

export function sma(closes: number[], n: number, end = closes.length - 1): number | null {
  if (end + 1 < n) return null
  let sum = 0
  for (let i = end - n + 1; i <= end; i++) sum += closes[i]
  return sum / n
}

// Wilder's RSI
export function rsi(closes: number[], n = 14): number | null {
  if (closes.length < n + 1) return null
  let gain = 0, loss = 0
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gain += d; else loss -= d
  }
  gain /= n; loss /= n
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    gain = (gain * (n - 1) + Math.max(d, 0)) / n
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n
  }
  if (loss === 0) return gain === 0 ? 50 : 100
  return 100 - 100 / (1 + gain / loss)
}

export function realizedVol(closes: number[], n = 20, end = closes.length - 1): number | null {
  if (end < n) return null
  const r = logReturns(closes.slice(end - n, end + 1))
  const mean = r.reduce((a, b) => a + b, 0) / r.length
  const variance = r.reduce((a, b) => a + (b - mean) ** 2, 0) / r.length
  return Math.sqrt(variance) * Math.sqrt(252)
}

const fmtPct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`

function trendSignal(closes: number[]): Signal {
  const price = closes[closes.length - 1]
  const s50 = sma(closes, 50)
  const s200 = sma(closes, 200)
  if (s50 === null) return { id: 'trend', label: 'Trend', tone: 'neutral', detail: 'Not enough history for a 50-day average yet.' }
  if (s200 === null) {
    const tone: Tone = price > s50 ? 'bullish' : price < s50 ? 'bearish' : 'neutral'
    return { id: 'trend', label: 'Trend', tone, detail: `Price is ${price > s50 ? 'above' : 'below'} its 50-day average. Not enough history for the 200-day.` }
  }
  let cross = ''
  const p50 = sma(closes, 50, closes.length - 21)
  const p200 = sma(closes, 200, closes.length - 21)
  if (p50 !== null && p200 !== null) {
    if (p50 <= p200 && s50 > s200) cross = ' Golden cross in the last 20 days (50-day moved above 200-day).'
    if (p50 >= p200 && s50 < s200) cross = ' Death cross in the last 20 days (50-day moved below 200-day).'
  }
  if (price > s50 && s50 > s200) return { id: 'trend', label: 'Uptrend', tone: 'bullish', detail: `Price is above the 50-day, which is above the 200-day average.${cross}` }
  if (price < s50 && s50 < s200) return { id: 'trend', label: 'Downtrend', tone: 'bearish', detail: `Price is below the 50-day, which is below the 200-day average.${cross}` }
  return { id: 'trend', label: 'Mixed trend', tone: 'neutral', detail: `Price and its 50- and 200-day averages disagree on direction.${cross}` }
}

function momentumSignal(closes: number[]): Signal {
  if (closes.length < 21) return { id: 'momentum', label: 'Momentum', tone: 'neutral', detail: 'Not enough history.' }
  const ch = closes[closes.length - 1] / closes[closes.length - 21] - 1
  const tone: Tone = ch > 0.05 ? 'bullish' : ch < -0.05 ? 'bearish' : 'neutral'
  return { id: 'momentum', label: `Momentum ${fmtPct(ch)}`, tone, detail: `Price changed ${fmtPct(ch)} over the last 20 trading days.` }
}

function rsiSignal(closes: number[]): Signal {
  const v = rsi(closes)
  if (v === null) return { id: 'rsi', label: 'RSI', tone: 'neutral', detail: 'Not enough history.' }
  if (v > 70) return { id: 'rsi', label: `RSI ${v.toFixed(0)}`, tone: 'bearish', detail: 'Above 70: overbought. Strong recent gains often cool off.' }
  if (v < 30) return { id: 'rsi', label: `RSI ${v.toFixed(0)}`, tone: 'bullish', detail: 'Below 30: oversold. Sharp recent losses often bounce.' }
  return { id: 'rsi', label: `RSI ${v.toFixed(0)}`, tone: 'neutral', detail: 'Between 30 and 70: no stretched move either way.' }
}

function volatilitySignal(closes: number[]): Signal {
  const now = realizedVol(closes)
  if (now === null) return { id: 'volatility', label: 'Volatility', tone: 'neutral', detail: 'Not enough history.' }
  const past: number[] = []
  for (let end = Math.max(20, closes.length - 252); end < closes.length; end++) {
    const v = realizedVol(closes, 20, end)
    if (v !== null) past.push(v)
  }
  const rank = past.filter(v => v <= now).length / past.length
  const regime = rank < 0.25 ? 'Low' : rank > 0.75 ? 'High' : 'Normal'
  const widthNote = regime === 'High' ? 'expect a wider cone' : regime === 'Low' ? 'expect a narrower cone' : 'cone width is typical'
  return {
    id: 'volatility',
    label: `${regime} volatility`,
    tone: 'neutral',
    detail: `20-day volatility is ${(now * 100).toFixed(0)}% annualised, higher than ${(rank * 100).toFixed(0)}% of the past year; ${widthNote}.`,
  }
}

export function computeSignals(closes: number[]): Signal[] {
  return [trendSignal(closes), momentumSignal(closes), rsiSignal(closes), volatilitySignal(closes)]
}

export function toneCounts(signals: Signal[]): Record<Tone, number> {
  const c: Record<Tone, number> = { bullish: 0, neutral: 0, bearish: 0 }
  for (const s of signals) c[s.tone]++
  return c
}
