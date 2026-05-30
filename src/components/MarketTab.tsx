import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { Asset, AssetClass } from '../types'
import { CLASS_LABELS } from '../assets'
import NumberInput from './NumberInput'

interface Props {
  onTrade: (asset: Asset, type: 'buy' | 'sell') => void
}

const FILTERS: { id: AssetClass | 'all' | 'watchlist'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'stock', label: 'Stocks' },
  { id: 'etf', label: 'ETFs' },
  { id: 'bond', label: 'Bonds' },
  { id: 'watchlist', label: '★ Watchlist' },
]

const CLASS_PILL: Record<string, { bg: string; color: string; glow: string }> = {
  crypto: { bg: 'rgba(167,139,250,0.18)', color: '#c084fc', glow: 'rgba(192,132,252,0.35)' },
  stock:  { bg: 'rgba(103,232,249,0.14)', color: '#67e8f9', glow: 'rgba(103,232,249,0.3)' },
  etf:    { bg: 'rgba(252,211,77,0.13)',  color: '#fcd34d', glow: 'rgba(252,211,77,0.3)' },
  bond:   { bg: 'rgba(134,239,172,0.12)', color: '#86efac', glow: 'rgba(134,239,172,0.3)' },
}

export default function MarketTab({ onTrade }: Props) {
  const assets = useStore(s => s.assets)
  const alerts = useStore(s => s.alerts)
  const favourites = useStore(s => s.favourites)
  const [filter, setFilter] = useState<AssetClass | 'all' | 'watchlist'>('all')
  const [search, setSearch] = useState('')
  // Track which asset's alert form is open — only one at a time
  const [openAlertId, setOpenAlertId] = useState<string | null>(null)

  const filtered = assets.filter(a => {
    if (filter === 'watchlist') return favourites.includes(a.id)
    if (filter !== 'all' && a.class !== filter) return false
    if (search && !a.symbol.toLowerCase().includes(search.toLowerCase()) && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const alertCount = alerts.length

  return (
    <div style={{ animation: 'slideIn 0.3s ease' }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, margin: '28px 0 20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, background: 'rgba(15,10,30,0.7)', borderRadius: 12, padding: '4px', border: '1px solid var(--border)' }}>
          {FILTERS.map(f => {
            const isActive = filter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: '6px 18px',
                  borderRadius: 8,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(192,132,252,0.3), rgba(103,232,249,0.15))'
                    : 'transparent',
                  color: isActive ? '#c084fc' : 'var(--muted)',
                  border: isActive
                    ? '1px solid rgba(192,132,252,0.5)'
                    : '1px solid transparent',
                  boxShadow: isActive ? '0 0 12px rgba(192,132,252,0.25)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {alertCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(252,211,77,0.1)',
            border: '1px solid rgba(252,211,77,0.3)',
            borderRadius: 20,
            padding: '4px 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--gold)',
            fontWeight: 700,
          }}>
            🔔 {alertCount} alert{alertCount !== 1 ? 's' : ''} active
          </div>
        )}

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          style={{
            marginLeft: 'auto',
            background: 'rgba(15,10,30,0.7)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '8px 16px',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            outline: 'none',
            width: 200,
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = 'rgba(192,132,252,0.5)'
            e.currentTarget.style.boxShadow = '0 0 10px rgba(192,132,252,0.15)'
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.2fr',
        padding: '8px 20px',
        color: 'var(--muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: 1.5,
        fontWeight: 700,
        borderBottom: '1px solid var(--border)',
        marginBottom: 6,
      }}>
        <span>ASSET</span>
        <span style={{ textAlign: 'right' }}>PRICE</span>
        <span style={{ textAlign: 'right' }}>24H</span>
        <span style={{ textAlign: 'right' }}>CLASS</span>
        <span style={{ textAlign: 'right' }}>ACTION</span>
      </div>

      {/* Asset rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map(asset => (
          <AssetRow
            key={asset.id}
            asset={asset}
            onTrade={onTrade}
            alertFormOpen={openAlertId === asset.id}
            onOpenAlertForm={() => setOpenAlertId(asset.id)}
            onCloseAlertForm={() => setOpenAlertId(null)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          {filter === 'watchlist' ? 'No favourites yet — star an asset to add it here' : 'No assets found'}
        </div>
      )}
    </div>
  )
}

function AlertForm({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const addAlert = useStore(s => s.addAlert)
  const [direction, setDirection] = useState<'above' | 'below'>('above')
  const [price, setPrice] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const submit = () => {
    const targetPrice = parseFloat(price)
    if (!targetPrice || targetPrice <= 0) return
    addAlert({ assetId: asset.id, direction, targetPrice })
    onClose()
  }

  return (
    <>
      {/* Full-screen backdrop to catch clicks outside */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 198 }}
        onClick={onClose}
      />
      <div
        ref={ref}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          right: 0,
          zIndex: 300,
          // Fully opaque, rich dark background — no transparency issues
          background: 'linear-gradient(160deg, #1c1238 0%, #120e28 100%)',
          border: '1px solid rgba(252,211,77,0.4)',
          borderRadius: 16,
          padding: '18px 20px',
          width: 280,
          boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(252,211,77,0.06), 0 0 30px rgba(252,211,77,0.1)',
          animation: 'modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: 1.5, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>🔔</span>
          SET ALERT — {asset.symbol}
        </div>

        {/* Direction toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(['above', 'below'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              style={{
                flex: 1, padding: '8px',
                borderRadius: 10,
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                background: direction === d ? 'rgba(252,211,77,0.2)' : 'rgba(255,255,255,0.04)',
                color: direction === d ? 'var(--gold)' : 'var(--muted)',
                border: direction === d ? '1px solid rgba(252,211,77,0.5)' : '1px solid rgba(255,255,255,0.08)',
                transition: 'all 0.15s',
                boxShadow: direction === d ? '0 0 12px rgba(252,211,77,0.15)' : 'none',
              }}
            >
              {d === 'above' ? '↑ ABOVE' : '↓ BELOW'}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 8, letterSpacing: 1 }}>
            TARGET PRICE (current: ${asset.price < 1 ? asset.price.toFixed(4) : asset.price.toLocaleString(undefined, { maximumFractionDigits: 2 })})
          </div>
          <NumberInput
            value={price}
            onChange={setPrice}
            placeholder="0.00"
            step={asset.price > 100 ? 1 : asset.price > 1 ? 0.01 : 0.0001}
            min={0}
            autoFocus
            fontSize={16}
            accentColor="rgba(252,211,77,0.9)"
            accentBorder="rgba(252,211,77,0.5)"
            accentGlow="rgba(252,211,77,0.25)"
            inputStyle={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(252,211,77,0.3)',
              borderRadius: 10,
              padding: '10px 36px 10px 14px',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={submit}
            disabled={!parseFloat(price)}
            style={{
              flex: 1, padding: '9px',
              borderRadius: 10,
              background: parseFloat(price) ? 'linear-gradient(135deg, rgba(252,211,77,0.25), rgba(252,211,77,0.1))' : 'rgba(255,255,255,0.04)',
              color: parseFloat(price) ? 'var(--gold)' : 'var(--muted)',
              border: parseFloat(price) ? '1px solid rgba(252,211,77,0.5)' : '1px solid rgba(255,255,255,0.08)',
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12,
              transition: 'all 0.15s',
              boxShadow: parseFloat(price) ? '0 0 14px rgba(252,211,77,0.2)' : 'none',
              letterSpacing: 0.5,
            }}
          >
            SET ALERT
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '9px 14px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--muted)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; e.currentTarget.style.color = 'var(--red)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--muted)' }}
          >
            ✕
          </button>
        </div>
      </div>
    </>
  )
}

interface AssetRowProps {
  asset: Asset
  onTrade: (a: Asset, t: 'buy' | 'sell') => void
  alertFormOpen: boolean
  onOpenAlertForm: () => void
  onCloseAlertForm: () => void
}

function AssetRow({ asset, onTrade, alertFormOpen, onOpenAlertForm, onCloseAlertForm }: AssetRowProps) {
  const holding = useStore(s => s.holdings.find(h => h.assetId === asset.id))
  const alerts = useStore(s => s.alerts)
  const removeAlert = useStore(s => s.removeAlert)
  const favourites = useStore(s => s.favourites)
  const toggleFavourite = useStore(s => s.toggleFavourite)
  const isUp = asset.changePct >= 0
  const loading = asset.price === 0
  const pill = CLASS_PILL[asset.class] ?? { bg: 'rgba(148,100,255,0.1)', color: '#a78bfa', glow: 'rgba(192,132,252,0.3)' }
  const isFav = favourites.includes(asset.id)

  const activeAlert = alerts.find(a => a.assetId === asset.id)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.2fr',
      padding: '14px 20px',
      background: 'linear-gradient(135deg, rgba(26,18,50,0.9) 0%, rgba(18,14,40,0.85) 100%)',
      border: '1px solid rgba(148,100,255,0.18)',
      borderRadius: 14,
      alignItems: 'center',
      transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s, background 0.2s',
      cursor: 'default',
      position: 'relative',
      zIndex: alertFormOpen ? 10 : 'auto',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${pill.glow}`
        e.currentTarget.style.boxShadow = `0 4px 24px rgba(0,0,0,0.4), 0 0 20px ${pill.glow}33`
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(30,22,58,0.95) 0%, rgba(22,16,48,0.9) 100%)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(148,100,255,0.18)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(26,18,50,0.9) 0%, rgba(18,14,40,0.85) 100%)'
      }}
    >
      {/* Asset name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `linear-gradient(135deg, ${pill.bg}, rgba(0,0,0,0.2))`,
          border: `1px solid ${pill.color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
          color: pill.color,
          flexShrink: 0,
          boxShadow: `0 0 12px ${pill.glow}33`,
        }}>
          {asset.symbol.slice(0, 3)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.3 }}>{asset.symbol}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{asset.name}</div>
        </div>
        {holding && (
          <span style={{
            background: 'rgba(134,239,172,0.12)',
            color: 'var(--green)',
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            padding: '2px 7px',
            borderRadius: 4,
            fontWeight: 700,
            letterSpacing: 0.5,
            border: '1px solid rgba(134,239,172,0.2)',
          }}>OWNED</span>
        )}
      </div>

      {/* Price */}
      <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15 }}>
        {loading ? (
          <span style={{ color: 'var(--muted)', animation: 'pulse 1.5s infinite' }}>—</span>
        ) : (
          <span>
            <span style={{ color: 'var(--faint)', fontSize: 11 }}>$</span>
            {asset.price < 1
              ? asset.price.toFixed(4)
              : asset.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {/* 24h change */}
      <div style={{
        textAlign: 'right',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        fontWeight: 700,
        color: loading ? 'var(--muted)' : isUp ? 'var(--green)' : 'var(--red)',
      }}>
        {loading ? '—' : (
          <span style={{
            background: isUp ? 'rgba(134,239,172,0.08)' : 'rgba(248,113,113,0.08)',
            border: `1px solid ${isUp ? 'rgba(134,239,172,0.2)' : 'rgba(248,113,113,0.2)'}`,
            borderRadius: 6,
            padding: '3px 7px',
            fontSize: 12,
          }}>
            {isUp ? '▲' : '▼'} {Math.abs(asset.changePct).toFixed(2)}%
          </span>
        )}
      </div>

      {/* Class badge */}
      <div style={{ textAlign: 'right' }}>
        <span style={{
          background: pill.bg,
          color: pill.color,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          fontWeight: 700,
          padding: '3px 9px',
          borderRadius: 5,
          letterSpacing: 0.5,
          border: `1px solid ${pill.color}30`,
        }}>
          {CLASS_LABELS[asset.class]}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', alignItems: 'center', position: 'relative' }}>
        {/* Star / favourite button */}
        <button
          onClick={e => { e.stopPropagation(); toggleFavourite(asset.id) }}
          title={isFav ? 'Remove from watchlist' : 'Add to watchlist'}
          style={{
            background: isFav ? 'rgba(252,211,77,0.15)' : 'rgba(255,255,255,0.03)',
            color: isFav ? 'var(--gold)' : 'var(--muted)',
            border: isFav ? '1px solid rgba(252,211,77,0.4)' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '6px 8px',
            fontSize: 13,
            transition: 'all 0.2s',
            lineHeight: 1,
          }}
          onMouseEnter={e => {
            if (!isFav) {
              e.currentTarget.style.color = 'var(--gold)'
              e.currentTarget.style.borderColor = 'rgba(252,211,77,0.35)'
              e.currentTarget.style.background = 'rgba(252,211,77,0.08)'
            }
          }}
          onMouseLeave={e => {
            if (!isFav) {
              e.currentTarget.style.color = 'var(--muted)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
            }
          }}
        >
          {isFav ? '★' : '☆'}
        </button>

        {/* Bell alert button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (activeAlert) {
              removeAlert(activeAlert.id)
            } else if (alertFormOpen) {
              onCloseAlertForm()
            } else {
              onOpenAlertForm()
            }
          }}
          title={activeAlert ? `Alert: ${activeAlert.direction} $${activeAlert.targetPrice} — click to remove` : 'Set price alert'}
          style={{
            background: activeAlert ? 'rgba(252,211,77,0.15)' : alertFormOpen ? 'rgba(252,211,77,0.1)' : 'rgba(255,255,255,0.03)',
            color: activeAlert || alertFormOpen ? 'var(--gold)' : 'var(--muted)',
            border: activeAlert ? '1px solid rgba(252,211,77,0.4)' : alertFormOpen ? '1px solid rgba(252,211,77,0.25)' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '6px 8px',
            fontSize: 13,
            transition: 'all 0.2s',
            lineHeight: 1,
          }}
          onMouseEnter={e => {
            if (!activeAlert) {
              e.currentTarget.style.color = 'var(--gold)'
              e.currentTarget.style.borderColor = 'rgba(252,211,77,0.35)'
              e.currentTarget.style.background = 'rgba(252,211,77,0.1)'
            }
          }}
          onMouseLeave={e => {
            if (!activeAlert && !alertFormOpen) {
              e.currentTarget.style.color = 'var(--muted)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
            }
          }}
        >
          {activeAlert ? '🔔' : '🔕'}
        </button>

        <button
          onClick={() => onTrade(asset, 'buy')}
          disabled={loading}
          style={{
            background: 'linear-gradient(135deg, rgba(134,239,172,0.15), rgba(134,239,172,0.06))',
            color: 'var(--green)',
            border: '1px solid rgba(134,239,172,0.3)',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            transition: 'all 0.2s',
            opacity: loading ? 0.4 : 1,
            letterSpacing: 0.5,
          }}
          onMouseEnter={e => !loading && (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(134,239,172,0.28), rgba(134,239,172,0.12))')}
          onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(134,239,172,0.15), rgba(134,239,172,0.06))')}
        >
          BUY
        </button>
        {holding && (
          <button
            onClick={() => onTrade(asset, 'sell')}
            style={{
              background: 'linear-gradient(135deg, rgba(248,113,113,0.15), rgba(248,113,113,0.06))',
              color: 'var(--red)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              transition: 'all 0.2s',
              letterSpacing: 0.5,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(248,113,113,0.28), rgba(248,113,113,0.12))')}
            onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(248,113,113,0.15), rgba(248,113,113,0.06))')}
          >
            SELL
          </button>
        )}

        {/* Alert form dropdown — only renders when this row's form is open */}
        {alertFormOpen && !activeAlert && (
          <AlertForm asset={asset} onClose={onCloseAlertForm} />
        )}
      </div>
    </div>
  )
}