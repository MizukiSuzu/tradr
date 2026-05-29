import { useStore } from '../store'
import { Asset } from '../types'
import { CLASS_COLORS, STARTING_BALANCE } from '../assets'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  onTrade: (asset: Asset, type: 'buy' | 'sell') => void
}

export default function PortfolioTab({ onTrade }: Props) {
  const cash = useStore(s => s.cash)
  const holdings = useStore(s => s.holdings)
  const assets = useStore(s => s.assets)
  const totalValue = useStore(s => s.totalValue)
  const history = useStore(s => s.history)

  const total = totalValue()
  const invested = total - cash
  const pnl = total - STARTING_BALANCE
  const pnlPct = (pnl / STARTING_BALANCE) * 100
  const isUp = pnl >= 0

  const chartData = history.map(h => ({
    time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: h.value,
  }))

  return (
    <div style={{ animation: 'slideIn 0.3s ease' }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, margin: '28px 0 24px' }}>
        {[
          { label: 'Total Value', value: `$${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: 'var(--text)' },
          { label: 'Cash', value: `$${cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: 'var(--gold)' },
          { label: 'Invested', value: `$${invested.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: 'var(--accent2)' },
          { label: 'P&L', value: `${isUp ? '+' : ''}$${pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${isUp ? '+' : ''}${pnlPct.toFixed(2)}%)`, color: isUp ? 'var(--green)' : 'var(--red)' },
        ].map(card => (
          <div key={card.label} style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '16px 20px',
          }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
              {card.label.toUpperCase()}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color: card.color }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '20px',
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: 1, marginBottom: 16 }}>
            PORTFOLIO VALUE HISTORY
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isUp ? '#00ff88' : '#ff3b5c'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isUp ? '#00ff88' : '#ff3b5c'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: '#6b6b80' }} />
              <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: '#6b6b80' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                formatter={(v: any) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, 'Value']}
              />
              <Area type="monotone" dataKey="value" stroke={isUp ? '#00ff88' : '#ff3b5c'} strokeWidth={2} fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Holdings */}
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>
        HOLDINGS ({holdings.length})
      </div>

      {holdings.length === 0 ? (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '40px',
          textAlign: 'center',
          color: 'var(--muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
        }}>
          No holdings yet — go to Markets and start trading!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {holdings.map(h => {
            const asset = assets.find(a => a.id === h.assetId)
            if (!asset) return null
            const currentValue = asset.price * h.quantity
            const costBasis = h.avgBuyPrice * h.quantity
            const gain = currentValue - costBasis
            const gainPct = (gain / costBasis) * 100
            const isGain = gain >= 0

            return (
              <div key={h.assetId} style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '16px 20px',
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                alignItems: 'center',
                gap: 8,
              }}>
                {/* Asset */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${CLASS_COLORS[asset.class]}22`,
                    border: `1px solid ${CLASS_COLORS[asset.class]}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                    color: CLASS_COLORS[asset.class], flexShrink: 0,
                  }}>
                    {asset.symbol.slice(0, 3)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{asset.symbol}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                      {h.quantity} units
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>VALUE</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>
                    ${currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>AVG BUY</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    ${h.avgBuyPrice < 1 ? h.avgBuyPrice.toFixed(4) : h.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>P&L</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: isGain ? 'var(--green)' : 'var(--red)' }}>
                    {isGain ? '+' : ''}${gain.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    <br />
                    <span style={{ fontSize: 11 }}>({isGain ? '+' : ''}{gainPct.toFixed(2)}%)</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => onTrade(asset, 'buy')}
                    style={{
                      background: 'rgba(0,255,136,0.15)', color: 'var(--green)',
                      border: '1px solid rgba(0,255,136,0.3)', borderRadius: 6,
                      padding: '5px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    }}
                  >BUY</button>
                  <button
                    onClick={() => onTrade(asset, 'sell')}
                    style={{
                      background: 'rgba(255,59,92,0.15)', color: 'var(--red)',
                      border: '1px solid rgba(255,59,92,0.3)', borderRadius: 6,
                      padding: '5px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    }}
                  >SELL</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
