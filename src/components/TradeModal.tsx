import { useState } from 'react'
import { useStore } from '../store'
import { Asset } from '../types'
import { CLASS_COLORS } from '../assets'

interface Props {
  asset: Asset
  type: 'buy' | 'sell'
  onClose: () => void
  onToast: (msg: string, ok: boolean) => void
}

export default function TradeModal({ asset, type: initialType, onClose, onToast }: Props) {
  const [type, setType] = useState(initialType)
  const [qty, setQty] = useState('')
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
    const result = type === 'buy' ? buy(asset.id, quantity) : sell(asset.id, quantity)
    onToast(result.msg, result.ok)
    if (result.ok) onClose()
  }

  const setMaxBuy = () => {
    const maxQty = Math.floor((cash / asset.price) * 10000) / 10000
    setQty(maxQty.toString())
  }

  const setMaxSell = () => {
    if (holding) setQty(holding.quantity.toString())
  }

  const isBuy = type === 'buy'
  const accentColor = isBuy ? 'var(--green)' : 'var(--red)'
  const canSubmit = quantity > 0 && (isBuy ? canAfford : hasEnough)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg2)',
          border: `1px solid ${CLASS_COLORS[asset.class]}44`,
          borderRadius: 16,
          padding: 28,
          width: 380,
          animation: 'slideIn 0.2s ease',
          boxShadow: `0 0 40px ${CLASS_COLORS[asset.class]}22`,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{asset.symbol}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{asset.name}</div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted)', fontSize: 20, padding: 4 }}>✕</button>
        </div>

        {/* Price */}
        <div style={{
          background: 'var(--bg3)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>CURRENT PRICE</span>
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
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['buy', 'sell'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                flex: 1,
                padding: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 1,
                background: type === t ? (t === 'buy' ? 'rgba(0,255,136,0.2)' : 'rgba(255,59,92,0.2)') : 'transparent',
                color: type === t ? (t === 'buy' ? 'var(--green)' : 'var(--red)') : 'var(--muted)',
                transition: 'all 0.2s',
              }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Quantity input */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              QUANTITY
            </label>
            <button
              onClick={isBuy ? setMaxBuy : setMaxSell}
              style={{ fontSize: 10, color: accentColor, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
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
              border: `1px solid ${quantity > 0 ? accentColor + '66' : 'var(--border)'}`,
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
          background: 'var(--bg3)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>TOTAL</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: accentColor }}>
            ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Info */}
        <div style={{ marginBottom: 20, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Cash: ${cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          {holding && <span>Owned: {holding.quantity}</span>}
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
            borderRadius: 10,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 1,
            background: canSubmit ? (isBuy ? 'var(--green)' : 'var(--red)') : 'var(--bg3)',
            color: canSubmit ? '#000' : 'var(--muted)',
            border: 'none',
            transition: 'all 0.2s',
            opacity: canSubmit ? 1 : 0.5,
          }}
        >
          {isBuy ? '▲ BUY' : '▼ SELL'} {asset.symbol}
        </button>
      </div>
    </div>
  )
}
