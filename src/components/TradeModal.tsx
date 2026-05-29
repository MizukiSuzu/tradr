import { useState } from 'react'
import { useStore } from '../store'
import { Asset } from '../types'

interface Props {
  asset: Asset
  type: 'buy' | 'sell'
  onClose: () => void
  onToast: (msg: string, ok: boolean) => void
}

export default function TradeModal({ asset, type: initialType, onClose, onToast }: Props) {
  const [type, setType] = useState(initialType)
  const [qty, setQty] = useState('')
  const [confirming, setConfirming] = useState(false)
  const cash = useStore(s => s.cash)
  const buy = useStore(s => s.buy)
  const sell = useStore(s => s.sell)
  const holding = useStore(s => s.holdings.find(h => h.assetId === asset.id))

  const quantity = parseFloat(qty) || 0
  const total = quantity * asset.price
  const canAfford = total <= cash
  const hasEnough = holding ? holding.quantity >= quantity : false

  const handleSubmit = () => {
    if (quantity <= 0) return
    setConfirming(true)
    setTimeout(() => {
      const result = type === 'buy' ? buy(asset.id, quantity) : sell(asset.id, quantity)
      onToast(result.msg, result.ok)
      if (result.ok) onClose()
      else setConfirming(false)
    }, 650)
  }

  const setMaxBuy = () => {
    const maxQty = Math.floor((cash / asset.price) * 10000) / 10000
    setQty(maxQty.toString())
  }

  const setMaxSell = () => {
    if (holding) setQty(holding.quantity.toString())
  }

  const isBuy = type === 'buy'
  const canSubmit = quantity > 0 && (isBuy ? canAfford : hasEnough)

  const buyActiveStyle = {
    background: 'linear-gradient(135deg, rgba(167,139,250,0.3), rgba(192,132,252,0.2))',
    border: '1px solid rgba(192,132,252,0.6)',
    color: '#c084fc',
    boxShadow: '0 0 14px rgba(192,132,252,0.25)',
  }
  const sellActiveStyle = {
    background: 'rgba(248,113,113,0.15)',
    border: '1px solid rgba(248,113,113,0.5)',
    color: '#f87171',
    boxShadow: '0 0 14px rgba(248,113,113,0.2)',
  }
  const inactiveToggle = {
    background: 'transparent',
    border: '1px solid transparent',
    color: 'var(--muted)',
    boxShadow: 'none',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(10, 6, 25, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #1a1035 0%, #120e28 100%)',
          border: '1px solid rgba(192,132,252,0.3)',
          borderRadius: 20,
          padding: '28px 32px',
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 0 60px rgba(139,92,246,0.2), 0 20px 40px rgba(0,0,0,0.5)',
          animation: 'modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{asset.symbol}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{asset.name}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              color: 'var(--muted)', fontSize: 18, padding: 6,
              background: 'var(--bg3)', borderRadius: 8,
              border: '1px solid var(--border)',
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >✕</button>
        </div>

        {/* Price */}
        <div style={{
          background: 'rgba(30,23,53,0.8)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>CURRENT PRICE</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20 }}>
              ${asset.price < 1 ? asset.price.toFixed(4) : asset.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: asset.changePct >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)' }}>
              {asset.changePct >= 0 ? '+' : ''}{asset.changePct.toFixed(2)}% today
            </div>
          </div>
        </div>

        {/* Buy/Sell toggle */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 20,
          padding: '4px',
          background: 'rgba(15,10,30,0.6)',
          borderRadius: 12,
          border: '1px solid var(--border)',
        }}>
          {(['buy', 'sell'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 9,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 1,
                transition: 'all 0.2s',
                ...(type === t
                  ? (t === 'buy' ? buyActiveStyle : sellActiveStyle)
                  : inactiveToggle),
              }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Trade confirm animation or form */}
        {confirming ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
            <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="var(--faint)" strokeWidth="3" />
              <circle cx="32" cy="32" r="26" fill="none"
                stroke="url(#tradeGrad)" strokeWidth="3"
                strokeDasharray="163" strokeDashoffset="163"
                style={{ animation: 'fillRing 0.6s ease-out forwards' }}
              />
              <defs>
                <linearGradient id="tradeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#c084fc" />
                  <stop offset="100%" stopColor="#67e8f9" />
                </linearGradient>
              </defs>
            </svg>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', letterSpacing: 1 }}>
              EXECUTING...
            </span>
          </div>
        ) : (
          <>
            {/* Quantity input */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: 1 }}>
                  QUANTITY
                </label>
                <button
                  onClick={isBuy ? setMaxBuy : setMaxSell}
                  style={{
                    fontSize: 10,
                    color: isBuy ? 'var(--accent)' : 'var(--red)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    letterSpacing: 0.5,
                  }}
                >
                  MAX
                </button>
              </div>
              <input
                type="number"
                value={qty}
                onChange={e => setQty(e.target.value)}
                placeholder="0.00"
                min="0"
                step="any"
                style={{
                  width: '100%',
                  background: 'var(--bg3)',
                  border: `1px solid ${quantity > 0 ? (isBuy ? 'rgba(192,132,252,0.4)' : 'rgba(248,113,113,0.4)') : 'var(--border)'}`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 18,
                  fontWeight: 700,
                  outline: 'none',
                  transition: 'border 0.2s',
                }}
              />
            </div>

            {/* Total */}
            <div style={{
              background: 'rgba(30,23,53,0.8)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>TOTAL</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16,
                color: isBuy ? 'var(--accent)' : 'var(--red)',
              }}>
                ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Info */}
            <div style={{ marginBottom: 16, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Cash: <span style={{ color: 'var(--gold)' }}>${cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
              {holding && <span>Owned: <span style={{ color: 'var(--text)' }}>{holding.quantity}</span></span>}
            </div>

            {/* Warnings */}
            {quantity > 0 && isBuy && !canAfford && (
              <div style={{ color: 'var(--red)', fontSize: 11, fontFamily: 'var(--font-mono)', marginBottom: 12, textAlign: 'center' }}>
                ⚠ Insufficient funds
              </div>
            )}
            {quantity > 0 && !isBuy && !hasEnough && (
              <div style={{ color: 'var(--red)', fontSize: 11, fontFamily: 'var(--font-mono)', marginBottom: 12, textAlign: 'center' }}>
                ⚠ Not enough holdings
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 12,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: 1,
                background: canSubmit
                  ? (isBuy
                    ? 'linear-gradient(135deg, rgba(167,139,250,0.4), rgba(103,232,249,0.25))'
                    : 'rgba(248,113,113,0.25)')
                  : 'var(--bg3)',
                color: canSubmit ? (isBuy ? '#c084fc' : '#f87171') : 'var(--muted)',
                border: canSubmit
                  ? (isBuy ? '1px solid rgba(192,132,252,0.5)' : '1px solid rgba(248,113,113,0.4)')
                  : '1px solid var(--border)',
                transition: 'all 0.2s',
                opacity: canSubmit ? 1 : 0.5,
                boxShadow: canSubmit ? (isBuy ? 'var(--glow-accent)' : '0 0 14px rgba(248,113,113,0.2)') : 'none',
              }}
            >
              {isBuy ? '▲ BUY' : '▼ SELL'} {asset.symbol}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
