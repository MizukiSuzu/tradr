import { useEffect, useMemo, useState } from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useStore } from '../store'
import { useHistory } from '../data'
import { Asset } from '../types'
import { buildCone, probAbove } from '../forecast/cone'
import { computeSignals, toneCounts } from '../forecast/signals'
import { buildTrackRecord } from '../forecast/trackRecord'
import { summarizeForecast } from '../forecast/summary'
import { hashString } from '../forecast/rng'
import NumberInput from './NumberInput'

const HORIZONS = [
  { days: 5, label: '1 week' },
  { days: 21, label: '1 month' },
  { days: 63, label: '3 months' },
]
const DISCLAIMER = 'Statistical projection from past prices. Not financial advice.'
const usd = (x: number) => `$${x.toFixed(2)}`
const TONE_COLOR = { bullish: 'var(--green)', neutral: 'var(--muted)', bearish: 'var(--red)' }

interface Props {
  symbol: string
  onTrade: (asset: Asset, type: 'buy' | 'sell') => void
  onBack: () => void
  onSummary: (s: string | null) => void
}

export default function StockPage({ symbol, onTrade, onBack, onSummary }: Props) {
  const { bars, error, loading } = useHistory(symbol)
  const asset = useStore(s => s.assets.find(a => a.id === symbol))
  const holding = useStore(s => s.holdings.find(h => h.assetId === symbol))
  const watchlist = useStore(s => s.watchlist)
  const toggleWatch = useStore(s => s.toggleWatch)
  const [horizon, setHorizon] = useState(21)
  const [target, setTarget] = useState('')

  const closes = useMemo(() => bars?.map(b => b.close) ?? [], [bars])
  const seed = bars?.length ? hashString(symbol + bars[bars.length - 1].date) : 1

  const cone = useMemo(() => {
    if (closes.length < 22) return null
    return buildCone(closes, horizon, { seed })
  }, [closes, horizon, seed])
  const signals = useMemo(() => (closes.length ? computeSignals(closes) : []), [closes])
  const track = useMemo(() => (bars ? buildTrackRecord(bars, { seed }) : null), [bars, seed])

  const price = asset?.price || closes[closes.length - 1] || 0
  const name = asset?.name ?? symbol

  useEffect(() => {
    if (!cone || !track) { onSummary(null); return }
    onSummary(summarizeForecast({
      symbol, name, price, cone, signals, track,
      position: holding ? { quantity: holding.quantity, avgBuyPrice: holding.avgBuyPrice } : null,
    }))
  }, [symbol, name, price, cone, signals, track, holding?.quantity, holding?.avgBuyPrice])
  useEffect(() => () => onSummary(null), [])

  if (loading) return <Shell onBack={onBack} symbol={symbol}><div style={{ color: 'var(--muted)' }}>Loading history…</div></Shell>
  if (error || !bars) return <Shell onBack={onBack} symbol={symbol}><div style={{ color: 'var(--red)' }}>{error ?? 'No data'}</div></Shell>
  if (!cone) return <Shell onBack={onBack} symbol={symbol}><div style={{ color: 'var(--muted)' }}>Not enough price history to forecast {symbol}.</div></Shell>

  // Chart: last 126 trading days of history, then the cone
  const past = bars.slice(-126).map(b => ({ x: b.date.slice(5), close: b.close }))
  const future = cone.bands.slice(1).map(b => ({
    x: `+${b.step}d`, p50: b.p50, band95: [b.p025, b.p975], band68: [b.p16, b.p84],
  }))
  const join = { ...past[past.length - 1], p50: cone.start, band95: [cone.start, cone.start], band68: [cone.start, cone.start] }
  const chartData = [...past.slice(0, -1), join, ...future]

  const end = cone.bands[cone.horizon]
  const upProb = probAbove(cone, cone.start)
  const targetNum = parseFloat(target)
  const counts = toneCounts(signals)
  const horizonLabel = HORIZONS.find(h => h.days === horizon)!.label
  const hasQuote = !!asset && asset.price > 0
  const tradeAsset: Asset = asset ?? { id: symbol, symbol, name, class: 'stock', price, change24h: 0, changePct: 0 }

  return (
    <Shell onBack={onBack} symbol={symbol}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700 }}>{usd(price)}</div>
          {asset && <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: asset.changePct >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {asset.changePct >= 0 ? '▲' : '▼'} {Math.abs(asset.changePct).toFixed(2)}% today (delayed)
          </div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={() => toggleWatch(symbol)}>{watchlist.includes(symbol) ? '★ Watching' : '☆ Watch'}</Btn>
          <Btn onClick={() => onTrade(tradeAsset, 'buy')} color="var(--green)" disabled={!hasQuote} title={hasQuote ? undefined : 'Waiting for a live quote'}>Buy</Btn>
          <Btn onClick={() => onTrade(tradeAsset, 'sell')} color="var(--red)" disabled={!holding || !hasQuote} title={hasQuote ? undefined : 'Waiting for a live quote'}>Sell</Btn>
        </div>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Probability cone</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {HORIZONS.map(h => (
              <Btn key={h.days} onClick={() => setHorizon(h.days)} active={h.days === horizon}>{h.label}</Btn>
            ))}
          </div>
        </div>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid stroke="rgba(148,100,255,0.08)" vertical={false} />
              <XAxis dataKey="x" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval="preserveStartEnd" minTickGap={40} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--muted)' }} width={60} tickFormatter={v => `$${Number(v).toFixed(0)}`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => (Array.isArray(v) ? `${usd(v[0])} – ${usd(v[1])}` : usd(Number(v)))}
              />
              <Area dataKey="band95" name="95% range" stroke="none" fill="rgba(192,132,252,0.15)" isAnimationActive={false} />
              <Area dataKey="band68" name="68% range" stroke="none" fill="rgba(192,132,252,0.3)" isAnimationActive={false} />
              <Line dataKey="close" name="Close" stroke="var(--accent2)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
              <Line dataKey="p50" name="Median" stroke="var(--accent)" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
          In {horizonLabel}: median <b>{usd(end.p50)}</b>, 68% chance between <b>{usd(end.p16)}</b> and <b>{usd(end.p84)}</b>,
          95% chance between <b>{usd(end.p025)}</b> and <b>{usd(end.p975)}</b>.{' '}
          <b>{(upProb * 100).toFixed(0)}%</b> chance of ending above today's price.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
          Chance above
          <div style={{ width: 150 }}><NumberInput value={target} onChange={setTarget} placeholder="target $" /></div>
          {targetNum > 0 && <b style={{ color: 'var(--text)' }}>{(probAbove(cone, targetNum) * 100).toFixed(0)}%</b>}
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>
          Signals <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted)' }}>({counts.bullish} bullish · {counts.neutral} neutral · {counts.bearish} bearish)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {signals.map(s => (
            <div key={s.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border)', borderLeft: `3px solid ${TONE_COLOR[s.tone]}` }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{s.label}</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: TONE_COLOR[s.tone], letterSpacing: 1, margin: '2px 0 6px' }}>{s.tone.toUpperCase()}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{s.detail}</div>
            </div>
          ))}
        </div>
      </Card>

      {track && track.points.length > 0 && (
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Track record</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
            Each month, a 1-month cone built only from data available then. The actual price landed inside the 95% range{' '}
            <b style={{ color: 'var(--text)' }}>{track.in95}/{track.points.length}</b> times and inside the 68% range{' '}
            <b style={{ color: 'var(--text)' }}>{track.in68}/{track.points.length}</b> times.
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={track.points.map(p => ({ x: p.anchorDate.slice(0, 7), band95: [p.p025, p.p975], band68: [p.p16, p.p84], actual: p.actual }))}>
                <CartesianGrid stroke="rgba(148,100,255,0.08)" vertical={false} />
                <XAxis dataKey="x" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--muted)' }} width={60} tickFormatter={v => `$${Number(v).toFixed(0)}`} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => (Array.isArray(v) ? `${usd(v[0])} – ${usd(v[1])}` : usd(Number(v)))}
                />
                <Area dataKey="band95" name="Forecast 95%" stroke="none" fill="rgba(192,132,252,0.15)" isAnimationActive={false} />
                <Area dataKey="band68" name="Forecast 68%" stroke="none" fill="rgba(192,132,252,0.3)" isAnimationActive={false} />
                <Line dataKey="actual" name="Actual" stroke="var(--gold)" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)', marginTop: 8 }}>{DISCLAIMER}</div>
    </Shell>
  )
}

function Shell({ symbol, onBack, children }: { symbol: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div style={{ animation: 'slideIn 0.3s ease', padding: '24px 0' }}>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)', padding: 0, marginBottom: 8 }}>← Back</button>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28, margin: '0 0 8px' }}>{symbol}</h2>
      {children}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 18, marginBottom: 16, background: 'rgba(22,16,43,0.7)', border: '1px solid var(--border)', borderRadius: 14 }}>{children}</div>
}

function Btn({ children, onClick, color, active, disabled, title }: { children: React.ReactNode; onClick: () => void; color?: string; active?: boolean; disabled?: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
      color: color ?? (active ? 'var(--accent)' : 'var(--muted)'),
      background: active ? 'rgba(192,132,252,0.12)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? 'rgba(192,132,252,0.35)' : 'var(--border)'}`,
    }}>{children}</button>
  )
}
