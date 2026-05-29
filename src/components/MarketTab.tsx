import { useState } from 'react'
import { useStore } from '../store'
import { Asset, AssetClass } from '../types'
import { CLASS_COLORS, CLASS_LABELS } from '../assets'

interface Props {
  onTrade: (asset: Asset, type: 'buy' | 'sell') => void
}

const FILTERS: { id: AssetClass | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'stock', label: 'Stocks' },
  { id: 'etf', label: 'ETFs' },
  { id: 'bond', label: 'Bonds' },
]

export default function MarketTab({ onTrade }: Props) {
  const assets = useStore(s => s.assets)
  const [filter, setFilter] = useState<AssetClass | 'all'>('all')
  const [search, setSearch] = useState('')

  const filtered = assets.filter(a => {
    if (filter !== 'all' && a.class !== filter) return false
    if (search && !a.symbol.toLowerCase().includes(search.toLowerCase()) && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ animation: 'slideIn 0.3s ease' }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, margin: '28px 0 20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: '6px 16px',
                borderRadius: 20,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                background: filter === f.id ? 'var(--accent)' : 'var(--bg3)',
                color: filter === f.id ? '#000' : 'var(--muted)',
                border: filter === f.id ? 'none' : '1px solid var(--border)',
                transition: 'all 0.2s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          style={{
            marginLeft: 'auto',
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 14px',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            outline: 'none',
            width: 180,
          }}
        />
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr',
        padding: '8px 16px',
        color: 'var(--muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: 1,
        fontWeight: 700,
        borderBottom: '1px solid var(--border)',
      }}>
        <span>ASSET</span>
        <span style={{ textAlign: 'right' }}>PRICE</span>
        <span style={{ textAlign: 'right' }}>24H</span>
        <span style={{ textAlign: 'right' }}>CLASS</span>
        <span style={{ textAlign: 'right' }}>ACTION</span>
      </div>

      {/* Asset rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {filtered.map(asset => (
          <AssetRow key={asset.id} asset={asset} onTrade={onTrade} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          No assets found
        </div>
      )}
    </div>
  )
}

function AssetRow({ asset, onTrade }: { asset: Asset; onTrade: (a: Asset, t: 'buy' | 'sell') => void }) {
  const holding = useStore(s => s.holdings.find(h => h.assetId === asset.id))
  const isUp = asset.changePct >= 0
  const loading = asset.price === 0

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr',
      padding: '14px 16px',
      borderBottom: '1px solid var(--border)',
      alignItems: 'center',
      transition: 'background 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Asset name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${CLASS_COLORS[asset.class]}22`,
          border: `1px solid ${CLASS_COLORS[asset.class]}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
          color: CLASS_COLORS[asset.class],
          flexShrink: 0,
        }}>
          {asset.symbol.slice(0, 3)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{asset.symbol}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{asset.name}</div>
        </div>
        {holding && (
          <span style={{
            background: 'rgba(0,255,136,0.1)',
            color: 'var(--green)',
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 700,
          }}>OWNED</span>
        )}
      </div>

      {/* Price */}
      <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15 }}>
        {loading ? (
          <span style={{ color: 'var(--muted)', animation: 'pulse 1.5s infinite' }}>—</span>
        ) : (
          `$${asset.price < 1 ? asset.price.toFixed(4) : asset.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
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
        {loading ? '—' : `${isUp ? '+' : ''}${asset.changePct.toFixed(2)}%`}
      </div>

      {/* Class badge */}
      <div style={{ textAlign: 'right' }}>
        <span style={{
          background: `${CLASS_COLORS[asset.class]}22`,
          color: CLASS_COLORS[asset.class],
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 4,
          letterSpacing: 0.5,
        }}>
          {CLASS_LABELS[asset.class]}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          onClick={() => onTrade(asset, 'buy')}
          disabled={loading}
          style={{
            background: 'rgba(0,255,136,0.15)',
            color: 'var(--green)',
            border: '1px solid rgba(0,255,136,0.3)',
            borderRadius: 6,
            padding: '5px 14px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            transition: 'all 0.2s',
            opacity: loading ? 0.4 : 1,
          }}
          onMouseEnter={e => !loading && (e.currentTarget.style.background = 'rgba(0,255,136,0.3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,255,136,0.15)')}
        >
          BUY
        </button>
        {holding && (
          <button
            onClick={() => onTrade(asset, 'sell')}
            style={{
              background: 'rgba(255,59,92,0.15)',
              color: 'var(--red)',
              border: '1px solid rgba(255,59,92,0.3)',
              borderRadius: 6,
              padding: '5px 14px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,59,92,0.3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,59,92,0.15)')}
          >
            SELL
          </button>
        )}
      </div>
    </div>
  )
}
