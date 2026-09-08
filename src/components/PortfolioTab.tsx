import { useState } from 'react'
import { useStore } from '../store'
import { Asset } from '../types'
import { CLASS_COLORS, STARTING_BALANCE } from '../assets'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface Props {
  onTrade: (asset: Asset, type: 'buy' | 'sell') => void
}

const STAT_CARDS = (total: number, cash: number, invested: number, pnl: number, pnlPct: number, isUp: boolean) => [
  {
    label: 'TOTAL VALUE',
    value: `$${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    sub: 'Portfolio worth',
    color: 'var(--accent)',
    glow: 'rgba(192,132,252,0.15)',
    border: 'rgba(192,132,252,0.3)',
    icon: '◈',
  },
  {
    label: 'CASH',
    value: `$${cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    sub: 'Available to deploy',
    color: 'var(--gold)',
    glow: 'rgba(252,211,77,0.12)',
    border: 'rgba(252,211,77,0.25)',
    icon: '◎',
  },
  {
    label: 'INVESTED',
    value: `$${invested.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    sub: 'Across all positions',
    color: 'var(--accent2)',
    glow: 'rgba(103,232,249,0.1)',
    border: 'rgba(103,232,249,0.2)',
    icon: '⬡',
  },
  {
    label: 'P&L',
    value: `${isUp ? '+' : ''}$${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    sub: `${isUp ? '+' : ''}${pnlPct.toFixed(2)}% all time`,
    color: isUp ? 'var(--green)' : 'var(--red)',
    glow: isUp ? 'rgba(134,239,172,0.1)' : 'rgba(248,113,113,0.1)',
    border: isUp ? 'rgba(134,239,172,0.25)' : 'rgba(248,113,113,0.25)',
    icon: isUp ? '▲' : '▼',
  },
]

export default function PortfolioTab({ onTrade }: Props) {
  const cash = useStore(s => s.cash)
  const holdings = useStore(s => s.holdings)
  const assets = useStore(s => s.assets)
  const totalValue = useStore(s => s.totalValue)
  const history = useStore(s => s.history)
  const pendingOrders = useStore(s => s.pendingOrders)
  const cancelLimitOrder = useStore(s => s.cancelLimitOrder)

  const total = totalValue()
  const invested = total - cash
  const pnl = total - STARTING_BALANCE
  const pnlPct = (pnl / STARTING_BALANCE) * 100
  const isUp = pnl >= 0

  const [timeframe, setTimeframe] = useState<'1m' | '1h' | '1d' | '1mo' | '1y'>('1m')

  type TF = typeof timeframe
  const TF_CONFIG: Record<TF, {
    label: string
    windowMs: number
    bucketMs: number
    tickFmt: (ts: number) => string
  }> = {
    '1m':  { label: '1M',  windowMs: 60 * 1000,           bucketMs: 0,              tickFmt: ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
    '1h':  { label: '1H',  windowMs: 60 * 60 * 1000,      bucketMs: 60 * 1000,      tickFmt: ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    '1d':  { label: '1D',  windowMs: 24 * 60 * 60 * 1000, bucketMs: 60 * 60 * 1000, tickFmt: ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    '1mo': { label: '1MO', windowMs: 30 * 24 * 60 * 60 * 1000, bucketMs: 24 * 60 * 60 * 1000, tickFmt: ts => new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }) },
    '1y':  { label: '1Y',  windowMs: 365 * 24 * 60 * 60 * 1000, bucketMs: 7 * 24 * 60 * 60 * 1000, tickFmt: ts => new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }) },
  }

  const chartData = (() => {
    if (history.length === 0) return []
    const cfg = TF_CONFIG[timeframe]
    const now = Date.now()

    // Filter to requested window; fall back to all history if fewer than 2 points inside
    const windowed = history.filter(h => h.timestamp >= now - cfg.windowMs)
    const source = windowed.length >= 2 ? windowed : history

    // Pick tick format based on the actual span of data we're showing
    const spanMs = source[source.length - 1].timestamp - source[0].timestamp
    const tickFmt = (ts: number) => {
      if (spanMs < 24 * 60 * 60 * 1000) {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
    }

    // 1m: no bucketing, show every raw point
    if (cfg.bucketMs === 0) {
      return source.map(h => ({ time: tickFmt(h.timestamp), value: h.value, ts: h.timestamp }))
    }

    // Auto-shrink bucket size if the whole session is shorter than the timeframe,
    // so we always get at least ~4 distinct buckets and the chart stays visible
    let bucketMs = cfg.bucketMs
    while (spanMs / bucketMs < 4 && bucketMs > 60 * 1000) {
      bucketMs = Math.floor(bucketMs / 4)
    }

    const buckets: Record<number, number> = {}
    for (const h of source) {
      const key = Math.floor(h.timestamp / bucketMs) * bucketMs
      buckets[key] = h.value
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([ts, value]) => ({ time: tickFmt(Number(ts)), value, ts: Number(ts) }))
  })()

  const statCards = STAT_CARDS(total, cash, invested, pnl, pnlPct, isUp)

  // Pie chart data
  const [pieView, setPieView] = useState<'class' | 'asset'>('class')
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null)

  const PIE_CLASS_COLORS: Record<string, string> = {
    crypto: '#a78bfa',
    stock:  '#67e8f9',
    etf:    '#fcd34d',
    bond:   '#86efac',
    cash:   '#7060a0',
  }

  const byClassData = (() => {
    const classMap: Record<string, number> = { cash }
    for (const h of holdings) {
      const asset = assets.find(a => a.id === h.assetId)
      if (!asset) continue
      classMap[asset.class] = (classMap[asset.class] ?? 0) + asset.price * h.quantity
    }
    return Object.entries(classMap)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name: name === 'cash' ? 'Cash' : name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: PIE_CLASS_COLORS[name] ?? '#a78bfa',
      }))
  })()

  const byAssetData = (() => {
    const rows = holdings
      .map(h => {
        const asset = assets.find(a => a.id === h.assetId)
        if (!asset) return null
        return { name: asset.symbol, value: asset.price * h.quantity, color: PIE_CLASS_COLORS[asset.class] ?? '#a78bfa' }
      })
      .filter(Boolean) as { name: string; value: number; color: string }[]
    rows.push({ name: 'Cash', value: cash, color: PIE_CLASS_COLORS.cash })
    return rows.filter(r => r.value > 0)
  })()

  const pieData = pieView === 'class' ? byClassData : byAssetData
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0)

  return (
    <div style={{ animation: 'slideIn 0.3s ease' }}>
      {/* Page header */}
      <div style={{ padding: '32px 0 28px' }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 2, marginBottom: 6 }}>OVERVIEW</div>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28, margin: 0 }}>Portfolio</h2>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        {statCards.map((card, i) => (
          <div key={card.label} style={{
            background: `linear-gradient(135deg, ${card.glow}, rgba(22,16,43,0.9))`,
            border: `1px solid ${card.border}`,
            borderRadius: 16,
            padding: '20px 22px',
            position: 'relative',
            overflow: 'hidden',
            animation: `slideIn 0.4s ease ${i * 0.06}s both`,
          }}>
            {/* Background icon */}
            <div style={{
              position: 'absolute', right: 16, top: 12,
              fontSize: 48, opacity: 0.06,
              fontFamily: 'var(--font-mono)',
              color: card.color,
              userSelect: 'none',
            }}>{card.icon}</div>

            <div style={{
              fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)',
              fontWeight: 700, letterSpacing: 1.5, marginBottom: 10,
            }}>{card.label}</div>

            <div style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22,
              color: card.color, marginBottom: 4,
            }}>{card.value}</div>

            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Allocation Pie Chart */}
      {pieTotal > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(26,18,50,0.9), rgba(18,14,40,0.85))',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '22px 24px',
          marginBottom: 28,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1.5, marginBottom: 4 }}>ALLOCATION</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16 }}>Portfolio Breakdown</div>
            </div>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(12,8,24,0.6)', borderRadius: 10, padding: 3, border: '1px solid var(--border)' }}>
              {(['class', 'asset'] as const).map(v => (
                <button key={v} onClick={() => setPieView(v)} style={{
                  padding: '5px 14px', borderRadius: 7,
                  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                  background: pieView === v ? 'rgba(192,132,252,0.2)' : 'transparent',
                  color: pieView === v ? 'var(--accent)' : 'var(--muted)',
                  border: pieView === v ? '1px solid rgba(192,132,252,0.4)' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}>
                  {v === 'class' ? 'By Class' : 'By Asset'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ flexShrink: 0 }}>
              <PieChart width={180} height={180}>
                <Pie
                  data={pieData}
                  cx={90} cy={90}
                  innerRadius={52} outerRadius={80}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="rgba(12,8,24,0.8)"
                  onMouseEnter={(_, index) => setHoveredSlice(pieData[index]?.name ?? null)}
                  onMouseLeave={() => setHoveredSlice(null)}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.color}
                      opacity={hoveredSlice === null || hoveredSlice === entry.name ? 1 : 0.35}
                      style={{ transition: 'opacity 0.2s', cursor: 'pointer' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </div>

            {/* Legend */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pieData.map(entry => {
                const pct = ((entry.value / pieTotal) * 100).toFixed(1)
                const isHovered = hoveredSlice === entry.name
                return (
                  <div
                    key={entry.name}
                    onMouseEnter={() => setHoveredSlice(entry.name)}
                    onMouseLeave={() => setHoveredSlice(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 10px', borderRadius: 8,
                      background: isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                      transition: 'background 0.15s',
                      cursor: 'default',
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: entry.color, flexShrink: 0, boxShadow: `0 0 6px ${entry.color}80` }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{entry.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>${entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: entry.color, minWidth: 42, textAlign: 'right' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 1 && (() => {
        const values = chartData.map(d => d.value)
        const minVal = Math.min(...values)
        const maxVal = Math.max(...values)
        const range = maxVal - minVal
        // If nearly flat (< 0.5% swing), use ±2% window so movement is visible
        const pad = range < maxVal * 0.005 ? maxVal * 0.02 : range * 0.15
        const yMin = Math.max(0, Math.floor((minVal - pad) / 100) * 100)
        const yMax = Math.ceil((maxVal + pad) / 100) * 100
        return (
        <div style={{
          background: 'rgba(22,16,43,0.7)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '22px 22px 14px',
          marginBottom: 28,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1.5, marginBottom: 4 }}>PORTFOLIO VALUE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color: isUp ? 'var(--green)' : 'var(--red)' }}>
                  {isUp ? '+' : ''}{pnlPct.toFixed(2)}%
                </div>
                <div style={{
                  background: isUp ? 'rgba(134,239,172,0.1)' : 'rgba(248,113,113,0.1)',
                  border: `1px solid ${isUp ? 'rgba(134,239,172,0.3)' : 'rgba(248,113,113,0.3)'}`,
                  borderRadius: 6, padding: '3px 9px',
                  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                  color: isUp ? 'var(--green)' : 'var(--red)',
                }}>
                  {isUp ? '▲ PROFIT' : '▼ LOSS'}
                </div>
              </div>
            </div>
            {/* Timeframe selector */}
            <div style={{ display: 'flex', gap: 3, background: 'rgba(12,8,24,0.6)', borderRadius: 10, padding: 3, border: '1px solid var(--border)' }}>
              {(['1m', '1h', '1d', '1mo', '1y'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 7,
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                    background: timeframe === tf ? 'rgba(192,132,252,0.2)' : 'transparent',
                    color: timeframe === tf ? 'var(--accent)' : 'var(--muted)',
                    border: timeframe === tf ? '1px solid rgba(192,132,252,0.4)' : '1px solid transparent',
                    transition: 'all 0.15s',
                    cursor: 'pointer',
                  }}
                >
                  {TF_CONFIG[tf].label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isUp ? '#86efac' : '#f87171'} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={isUp ? '#86efac' : '#f87171'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" interval="preserveStartEnd" tick={{ fontFamily: 'Space Mono', fontSize: 9, fill: '#7c6fa0' }} axisLine={false} tickLine={false} />
              <YAxis domain={[yMin, yMax]} tick={{ fontFamily: 'Space Mono', fontSize: 9, fill: '#7c6fa0' }} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(22,16,43,0.95)', border: '1px solid rgba(148,100,255,0.3)',
                  borderRadius: 10, fontFamily: 'Space Mono', fontSize: 12,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}
                formatter={(v: any) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, 'Value']}
              />
              <Area type="monotone" dataKey="value" stroke={isUp ? '#86efac' : '#f87171'} strokeWidth={2} fill="url(#portfolioGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )
      })()}

      {/* Holdings header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1.5, fontWeight: 700 }}>POSITIONS </span>
          <span style={{
            background: 'rgba(192,132,252,0.12)', color: 'var(--accent)',
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            padding: '2px 8px', borderRadius: 4, marginLeft: 6,
          }}>{holdings.length}</span>
        </div>
      </div>

      {holdings.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '60px 20px', gap: 16,
          background: 'rgba(22,16,43,0.5)', border: '1px solid var(--border)', borderRadius: 16,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'rgba(192,132,252,0.08)', border: '1px solid rgba(192,132,252,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
          }}>◈</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)', letterSpacing: 1 }}>NO POSITIONS</div>
          <div style={{ fontSize: 13, color: 'var(--faint)' }}>Go to Markets to start building your portfolio</div>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            padding: '8px 18px',
            color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: 1, fontWeight: 700, marginBottom: 6,
          }}>
            <span>ASSET</span>
            <span style={{ textAlign: 'right' }}>VALUE</span>
            <span style={{ textAlign: 'right' }}>AVG BUY</span>
            <span style={{ textAlign: 'right' }}>P&L</span>
            <span style={{ textAlign: 'right' }}>ACTION</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {holdings.map((h, i) => {
              const asset = assets.find(a => a.id === h.assetId)
              if (!asset) return null
              const currentValue = asset.price * h.quantity
              const costBasis = h.avgBuyPrice * h.quantity
              const gain = currentValue - costBasis
              const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0
              const isGain = gain >= 0
              const color = CLASS_COLORS[asset.class] ?? 'var(--accent)'

              return (
                <div key={h.assetId} style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                  padding: '16px 18px',
                  background: 'rgba(22,16,43,0.7)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  alignItems: 'center',
                  gap: 8,
                  animation: `slideIn 0.35s ease ${i * 0.05}s both`,
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--border-hi)'
                    e.currentTarget.style.boxShadow = 'var(--glow-accent)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {/* Asset */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: `${color}18`,
                      border: `1px solid ${color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                      color, flexShrink: 0,
                    }}>
                      {asset.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{asset.symbol}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                        {h.quantity} units
                      </div>
                    </div>
                  </div>

                  {/* Current value */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15 }}>
                      ${currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      ${asset.price < 1 ? asset.price.toFixed(4) : asset.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} /unit
                    </div>
                  </div>

                  {/* Avg buy */}
                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--muted)' }}>
                    ${h.avgBuyPrice < 1 ? h.avgBuyPrice.toFixed(4) : h.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>

                  {/* P&L */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: isGain ? 'var(--green)' : 'var(--red)' }}>
                      {isGain ? '+' : ''}${Math.abs(gain).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <div style={{
                      display: 'inline-block', marginTop: 3,
                      background: isGain ? 'rgba(134,239,172,0.12)' : 'rgba(248,113,113,0.12)',
                      color: isGain ? 'var(--green)' : 'var(--red)',
                      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 4,
                    }}>
                      {isGain ? '+' : ''}{gainPct.toFixed(2)}%
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => onTrade(asset, 'buy')} style={{
                      background: 'rgba(134,239,172,0.12)', color: 'var(--green)',
                      border: '1px solid rgba(134,239,172,0.3)', borderRadius: 7,
                      padding: '6px 13px', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      transition: 'background 0.2s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(134,239,172,0.25)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(134,239,172,0.12)')}
                    >BUY</button>
                    <button onClick={() => onTrade(asset, 'sell')} style={{
                      background: 'rgba(248,113,113,0.12)', color: 'var(--red)',
                      border: '1px solid rgba(248,113,113,0.3)', borderRadius: 7,
                      padding: '6px 13px', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      transition: 'background 0.2s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.25)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.12)')}
                    >SELL</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Pending Limit Orders */}
      {pendingOrders.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1.5, fontWeight: 700 }}>PENDING ORDERS</span>
            <span style={{
              background: 'rgba(103,232,249,0.12)', color: 'var(--accent2)',
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              padding: '2px 8px', borderRadius: 4,
            }}>{pendingOrders.length}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pendingOrders.map((order, i) => {
              const asset = assets.find(a => a.id === order.assetId)
              if (!asset) return null
              const isBuy = order.type === 'buy'
              const priceStr = order.limitPrice < 1
                ? order.limitPrice.toFixed(4)
                : order.limitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })
              const estimatedTotal = order.limitPrice * order.quantity

              return (
                <div key={order.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr auto',
                  padding: '14px 18px',
                  background: 'rgba(22,16,43,0.7)',
                  border: `1px solid ${isBuy ? 'rgba(103,232,249,0.2)' : 'rgba(252,211,77,0.2)'}`,
                  borderLeft: `3px solid ${isBuy ? 'var(--accent2)' : 'var(--gold)'}`,
                  borderRadius: '0 12px 12px 0',
                  alignItems: 'center',
                  animation: `slideIn 0.35s ease ${i * 0.05}s both`,
                }}>
                  {/* Asset + type */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: isBuy ? 'rgba(103,232,249,0.1)' : 'rgba(252,211,77,0.1)',
                      border: `1px solid ${isBuy ? 'rgba(103,232,249,0.3)' : 'rgba(252,211,77,0.3)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, flexShrink: 0,
                    }}>
                      ⏳
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{asset.symbol}</span>
                        <span style={{
                          background: isBuy ? 'rgba(103,232,249,0.15)' : 'rgba(252,211,77,0.15)',
                          color: isBuy ? 'var(--accent2)' : 'var(--gold)',
                          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                          padding: '2px 7px', borderRadius: 4, letterSpacing: 1,
                        }}>LIMIT {order.type.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {order.quantity} units
                      </div>
                    </div>
                  </div>

                  {/* Limit price */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>LIMIT PRICE</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: isBuy ? 'var(--accent2)' : 'var(--gold)' }}>
                      ${priceStr}
                    </div>
                  </div>

                  {/* Estimated total */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>EST. TOTAL</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>
                      ${estimatedTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Cancel */}
                  <button
                    onClick={() => cancelLimitOrder(order.id)}
                    style={{
                      background: 'rgba(248,113,113,0.08)',
                      color: 'var(--red)',
                      border: '1px solid rgba(248,113,113,0.25)',
                      borderRadius: 7,
                      padding: '6px 12px',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
                  >
                    CANCEL
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}