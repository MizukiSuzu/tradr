import { useState } from 'react'
import { useStore } from '../store'
import { Asset } from '../types'
import NumberInput from './NumberInput'

interface Props {
  asset: Asset
  type: 'buy' | 'sell'
  onClose: () => void
  onToast: (msg: string, ok: boolean) => void
}

const CLASS_GLOW: Record<string, { from: string; to: string; glow: string }> = {
  crypto: { from: '#a78bfa', to: '#67e8f9', glow: 'rgba(167,139,250,0.35)' },
  stock:  { from: '#67e8f9', to: '#a78bfa', glow: 'rgba(103,232,249,0.3)' },
  etf:    { from: '#fcd34d', to: '#f9a8d4', glow: 'rgba(252,211,77,0.3)' },
  bond:   { from: '#86efac', to: '#67e8f9', glow: 'rgba(134,239,172,0.3)' },
}

export default function TradeModal({ asset, type: initialType, onClose, onToast }: Props) {
  const [type, setType] = useState(initialType)
  const [orderMode, setOrderMode] = useState<'market' | 'limit'>('market')
  const [qty, setQty] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [confirming, setConfirming] = useState(false)
  const cash = useStore(s => s.cash)
  const buy = useStore(s => s.buy)
  const sell = useStore(s => s.sell)
  const placeLimitOrder = useStore(s => s.placeLimitOrder)
  const holding = useStore(s => s.holdings.find(h => h.assetId === asset.id))

  const quantity = parseFloat(qty) || 0
  const effectivePrice = orderMode === 'limit' ? (parseFloat(limitPrice) || 0) : asset.price
  const total = quantity * effectivePrice
  const canAfford = total <= cash
  const hasEnough = holding ? holding.quantity >= quantity : false

  const isBuy = type === 'buy'
  const isLimit = orderMode === 'limit'
  const palette = CLASS_GLOW[asset.class] ?? CLASS_GLOW.crypto

  const accentColor = isBuy ? '#c084fc' : '#f87171'
  const accentGlow = isBuy ? 'rgba(192,132,252,0.3)' : 'rgba(248,113,113,0.3)'
  const accentBg = isBuy
    ? 'linear-gradient(135deg, rgba(167,139,250,0.25), rgba(103,232,249,0.12))'
    : 'rgba(248,113,113,0.18)'
  const accentBorder = isBuy ? 'rgba(192,132,252,0.5)' : 'rgba(248,113,113,0.5)'

  const canSubmit = quantity > 0 && (
    isLimit
      ? (effectivePrice > 0 && (isBuy ? canAfford : hasEnough))
      : (isBuy ? canAfford : hasEnough)
  )

  const handleSubmit = () => {
    if (!canSubmit) return
    setConfirming(true)
    setTimeout(() => {
      let result: { ok: boolean; msg: string }
      if (isLimit) {
        result = placeLimitOrder({
          assetId: asset.id, type, quantity,
          limitPrice: effectivePrice,
          reservedCash: isBuy ? total : 0,
        })
      } else {
        result = isBuy ? buy(asset.id, quantity) : sell(asset.id, quantity)
      }
      onToast(result.msg, result.ok)
      if (result.ok) onClose()
      else setConfirming(false)
    }, 700)
  }

  const setMaxBuy = () => {
    const p = isLimit ? (parseFloat(limitPrice) || asset.price) : asset.price
    setQty(String(Math.floor((cash / p) * 10000) / 10000))
  }
  const setMaxSell = () => { if (holding) setQty(String(holding.quantity)) }

  const fmtPrice = (p: number) =>
    p < 1 ? p.toFixed(4) : p.toLocaleString(undefined, { maximumFractionDigits: 2 })

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(8,4,20,0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          position: 'relative',
          animation: 'modalIn 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Outer glow ring */}
        <div style={{
          position: 'absolute', inset: -1,
          borderRadius: 24,
          background: `linear-gradient(135deg, ${palette.from}55, ${palette.to}33)`,
          zIndex: -1,
          filter: `blur(1px)`,
        }} />

        {/* Main card */}
        <div style={{
          background: 'linear-gradient(165deg, #1c1438 0%, #110d24 50%, #0f0a1e 100%)',
          borderRadius: 22,
          border: `1px solid ${palette.from}40`,
          overflow: 'hidden',
          boxShadow: `0 0 60px ${palette.glow}, 0 24px 60px rgba(0,0,0,0.7)`,
        }}>

          {/* ── Header band ── */}
          <div style={{
            padding: '22px 24px 20px',
            background: `linear-gradient(135deg, ${palette.from}14 0%, transparent 60%)`,
            borderBottom: `1px solid ${palette.from}20`,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Big blurred bg letter */}
            <div style={{
              position: 'absolute', right: -8, top: -10,
              fontFamily: 'var(--font-mono)', fontWeight: 900,
              fontSize: 88, letterSpacing: -4,
              color: palette.from, opacity: 0.06,
              userSelect: 'none', lineHeight: 1,
              pointerEvents: 'none',
            }}>
              {asset.symbol.slice(0, 4)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                {/* Asset class pill */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: `${palette.from}18`,
                  border: `1px solid ${palette.from}35`,
                  borderRadius: 20, padding: '3px 10px',
                  marginBottom: 8,
                }}>
                  <div style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: palette.from,
                    boxShadow: `0 0 6px ${palette.from}`,
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9,
                    color: palette.from, fontWeight: 700, letterSpacing: 1.5,
                  }}>
                    {asset.class.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <h2 style={{
                    fontFamily: 'var(--font-mono)', fontWeight: 700,
                    fontSize: 26, letterSpacing: -0.5,
                    background: `linear-gradient(90deg, ${palette.from}, ${palette.to})`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>{asset.symbol}</h2>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{asset.name}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  width: 34, height: 34,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--muted)', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.09)'
                  e.currentTarget.style.color = 'var(--text)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  e.currentTarget.style.color = 'var(--muted)'
                }}
              >✕</button>
            </div>

            {/* Price display */}
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700,
                fontSize: 32, letterSpacing: -1,
                textShadow: `0 0 30px ${palette.from}60`,
              }}>
                ${fmtPrice(asset.price)}
              </div>
              <div style={{
                marginBottom: 5,
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                color: asset.changePct >= 0 ? 'var(--green)' : 'var(--red)',
                background: asset.changePct >= 0 ? 'rgba(134,239,172,0.1)' : 'rgba(248,113,113,0.1)',
                border: `1px solid ${asset.changePct >= 0 ? 'rgba(134,239,172,0.25)' : 'rgba(248,113,113,0.25)'}`,
                borderRadius: 6, padding: '3px 8px',
              }}>
                {asset.changePct >= 0 ? '▲' : '▼'} {Math.abs(asset.changePct).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ padding: '20px 24px 24px' }}>

            {/* Buy / Sell tabs */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              background: 'rgba(10,6,20,0.6)',
              borderRadius: 14, padding: 4,
              border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: 16,
            }}>
              {(['buy', 'sell'] as const).map(t => {
                const isActive = type === t
                const tabColor = t === 'buy' ? '#c084fc' : '#f87171'
                const tabBg = t === 'buy'
                  ? 'linear-gradient(135deg, rgba(167,139,250,0.28), rgba(103,232,249,0.14))'
                  : 'rgba(248,113,113,0.18)'
                const tabBorder = t === 'buy' ? 'rgba(192,132,252,0.5)' : 'rgba(248,113,113,0.5)'
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    style={{
                      padding: '11px',
                      borderRadius: 11,
                      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, letterSpacing: 1.5,
                      transition: 'all 0.22s',
                      background: isActive ? tabBg : 'transparent',
                      color: isActive ? tabColor : 'var(--muted)',
                      border: isActive ? `1px solid ${tabBorder}` : '1px solid transparent',
                      boxShadow: isActive ? `0 0 16px ${t === 'buy' ? 'rgba(192,132,252,0.2)' : 'rgba(248,113,113,0.15)'}` : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      {t === 'buy'
                        ? <path d="M6 1L11 10H1L6 1Z" fill="currentColor" opacity="0.9" />
                        : <path d="M6 11L1 2H11L6 11Z" fill="currentColor" opacity="0.9" />
                      }
                    </svg>
                    {t === 'buy' ? 'BUY' : 'SELL'}
                  </button>
                )
              })}
            </div>

            {/* Market / Limit toggle */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              background: 'rgba(10,6,20,0.4)',
              borderRadius: 10, padding: 3,
              border: '1px solid rgba(255,255,255,0.05)',
              marginBottom: 18,
            }}>
              {(['market', 'limit'] as const).map(m => {
                const isActive = orderMode === m
                return (
                  <button
                    key={m}
                    onClick={() => setOrderMode(m)}
                    style={{
                      padding: '7px',
                      borderRadius: 8,
                      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 10, letterSpacing: 1,
                      transition: 'all 0.18s',
                      background: isActive ? 'rgba(103,232,249,0.1)' : 'transparent',
                      color: isActive ? 'var(--accent2)' : 'var(--muted)',
                      border: isActive ? '1px solid rgba(103,232,249,0.28)' : '1px solid transparent',
                    }}
                  >
                    {m === 'market' ? '⚡ MARKET' : '⏳ LIMIT'}
                  </button>
                )
              })}
            </div>

            {confirming ? (
              /* ── Executing animation ── */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '28px 0 16px' }}>
                <div style={{ position: 'relative', width: 72, height: 72 }}>
                  {/* Outer ring */}
                  <svg width="72" height="72" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                    <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                    <circle cx="36" cy="36" r="30" fill="none"
                      stroke={`url(#execGrad)`} strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="188" strokeDashoffset="188"
                      style={{ animation: 'fillRing 0.7s ease-out forwards' }}
                    />
                    <defs>
                      <linearGradient id="execGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={palette.from} />
                        <stop offset="100%" stopColor={palette.to} />
                      </linearGradient>
                    </defs>
                  </svg>
                  {/* Center icon */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22,
                  }}>
                  {isLimit ? '⏳' : (
                    <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
                      {isBuy
                        ? <path d="M6 1L11 10H1L6 1Z" fill="white" opacity="0.9" />
                        : <path d="M6 11L1 2H11L6 11Z" fill="white" opacity="0.9" />
                      }
                    </svg>
                  )}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', letterSpacing: 2, textAlign: 'center' }}>
                    {isLimit ? 'QUEUING ORDER' : 'EXECUTING'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--faint)', textAlign: 'center', marginTop: 4 }}>
                    {asset.symbol} · {quantity} units
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Limit price input */}
                {isLimit && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{
                      fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)',
                      fontWeight: 700, letterSpacing: 1.5, marginBottom: 8,
                    }}>
                      {isBuy ? 'TRIGGER WHEN PRICE ≤' : 'TRIGGER WHEN PRICE ≥'}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <span style={{
                        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16,
                        color: 'var(--accent2)', opacity: 0.6,
                        pointerEvents: 'none', zIndex: 1,
                      }}>$</span>
                      <NumberInput
                        value={limitPrice}
                        onChange={setLimitPrice}
                        placeholder={fmtPrice(asset.price)}
                        step={asset.price > 100 ? 1 : asset.price > 1 ? 0.01 : 0.0001}
                        min={0}
                        autoFocus
                        fontSize={17}
                        accentColor="rgba(103,232,249,0.9)"
                        accentBorder="rgba(103,232,249,0.5)"
                        accentGlow="rgba(103,232,249,0.3)"
                        inputStyle={{
                          width: '100%',
                          background: 'rgba(103,232,249,0.05)',
                          border: `1px solid ${parseFloat(limitPrice) > 0 ? 'rgba(103,232,249,0.4)' : 'rgba(103,232,249,0.15)'}`,
                          borderRadius: 11,
                          padding: '12px 36px 12px 28px',
                          transition: 'border-color 0.2s',
                        }}
                        onFocus={() => {
                          const el = document.activeElement as HTMLInputElement
                          if (el) el.style.borderColor = 'rgba(103,232,249,0.5)'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: 1.5 }}>
                      QUANTITY
                    </span>
                    <button
                      onClick={isBuy ? setMaxBuy : setMaxSell}
                      style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: accentColor, letterSpacing: 1,
                        background: `${accentColor}15`, border: `1px solid ${accentColor}35`,
                        borderRadius: 5, padding: '2px 8px', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = `${accentColor}28`)}
                      onMouseLeave={e => (e.currentTarget.style.background = `${accentColor}15`)}
                    >
                      MAX
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <NumberInput
                      value={qty}
                      onChange={setQty}
                      placeholder="0.00"
                      step={asset.price > 1000 ? 0.001 : asset.price > 100 ? 0.01 : asset.price > 1 ? 0.1 : 1}
                      min={0}
                      fontSize={22}
                      accentColor={accentColor}
                      accentBorder={accentBorder}
                      accentGlow={accentGlow}
                      inputStyle={{
                        width: '100%',
                        background: quantity > 0 ? `${accentColor}08` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${quantity > 0 ? accentBorder : 'rgba(255,255,255,0.09)'}`,
                        borderRadius: 11,
                        padding: '14px 36px 14px 16px',
                        transition: 'all 0.2s',
                      }}
                    />
                    {quantity > 0 && (
                      <div style={{
                        position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)',
                        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)',
                        pointerEvents: 'none',
                      }}>
                        units
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: 10, marginBottom: 14,
                }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 11, padding: '11px 14px',
                  }}>
                    <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1.5, marginBottom: 5 }}>
                      {isLimit ? 'EST. TOTAL' : 'TOTAL'}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16,
                      color: total > 0 ? accentColor : 'var(--faint)',
                      textShadow: total > 0 ? `0 0 20px ${accentGlow}` : 'none',
                    }}>
                      ${total > 0 ? total.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00'}
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 11, padding: '11px 14px',
                  }}>
                    <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1.5, marginBottom: 5 }}>
                      {isBuy ? 'AVAILABLE' : 'OWNED'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: 'var(--gold)' }}>
                      {isBuy
                        ? `$${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : (holding ? `${holding.quantity}` : '—')}
                    </div>
                  </div>
                </div>

                {/* Limit info */}
                {isLimit && effectivePrice > 0 && (
                  <div style={{
                    background: 'rgba(103,232,249,0.05)',
                    border: '1px solid rgba(103,232,249,0.15)',
                    borderRadius: 10, padding: '9px 14px',
                    marginBottom: 14,
                    fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.6,
                  }}>
                    {isBuy
                      ? `⏳ Triggers when price drops to $${fmtPrice(effectivePrice)}. Cash reserved until filled or cancelled.`
                      : `⏳ Triggers when price rises to $${fmtPrice(effectivePrice)}.`}
                  </div>
                )}

                {/* Warnings */}
                {quantity > 0 && isBuy && !canAfford && (
                  <div style={{
                    color: 'var(--red)', fontSize: 11, fontFamily: 'var(--font-mono)',
                    marginBottom: 12, textAlign: 'center',
                    background: 'rgba(248,113,113,0.08)', borderRadius: 8, padding: '8px',
                    border: '1px solid rgba(248,113,113,0.2)',
                  }}>
                    ⚠ Insufficient funds
                  </div>
                )}
                {quantity > 0 && !isBuy && !hasEnough && (
                  <div style={{
                    color: 'var(--red)', fontSize: 11, fontFamily: 'var(--font-mono)',
                    marginBottom: 12, textAlign: 'center',
                    background: 'rgba(248,113,113,0.08)', borderRadius: 8, padding: '8px',
                    border: '1px solid rgba(248,113,113,0.2)',
                  }}>
                    ⚠ Not enough holdings
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  style={{
                    width: '100%', padding: '15px',
                    borderRadius: 13,
                    fontFamily: 'var(--font-mono)', fontWeight: 700,
                    fontSize: 14, letterSpacing: 1.5,
                    transition: 'all 0.2s',
                    background: canSubmit ? accentBg : 'rgba(255,255,255,0.04)',
                    color: canSubmit ? accentColor : 'var(--muted)',
                    border: `1px solid ${canSubmit ? accentBorder : 'rgba(255,255,255,0.07)'}`,
                    boxShadow: canSubmit ? `0 0 24px ${accentGlow}, inset 0 1px 0 rgba(255,255,255,0.08)` : 'none',
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                    opacity: canSubmit ? 1 : 0.45,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={e => {
                    if (canSubmit) {
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = `0 0 36px ${accentGlow}, inset 0 1px 0 rgba(255,255,255,0.1)`
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = canSubmit ? `0 0 24px ${accentGlow}, inset 0 1px 0 rgba(255,255,255,0.08)` : 'none'
                  }}
                >
                  {isLimit
                    ? (isBuy ? '⏳ QUEUE LIMIT BUY' : '⏳ QUEUE LIMIT SELL')
                    : (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          {isBuy
                            ? <path d="M6 1L11 10H1L6 1Z" fill="currentColor" opacity="0.9" />
                            : <path d="M6 11L1 2H11L6 11Z" fill="currentColor" opacity="0.9" />
                          }
                        </svg>
                        {isBuy ? 'BUY' : 'SELL'} {asset.symbol}
                      </span>
                    )
                  }
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}