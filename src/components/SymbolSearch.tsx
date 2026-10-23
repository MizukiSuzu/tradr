import { useEffect, useState } from 'react'
import { searchSymbols, SearchResult } from '../data'

export default function SymbolSearch({ onSelect }: { onSelect: (r: SearchResult) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 1) { setResults([]); setError(null); return }
    let alive = true
    const t = setTimeout(() => {
      searchSymbols(term)
        .then(r => { if (alive) { setResults(r); setError(null) } })
        .catch(e => { if (alive) setError(e.message) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [q])

  const pick = (r: SearchResult) => { onSelect(r); setQ(''); setResults([]) }

  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 320, margin: '0 16px' }}>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && results[0]) pick(results[0]) }}
        placeholder="Search any US ticker…"
        aria-label="Search ticker"
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
          color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 13,
        }}
      />
      {(results.length > 0 || error) && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 200,
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
        }}>
          {error && <div style={{ padding: 10, fontSize: 12, color: 'var(--red)' }}>{error}</div>}
          {results.map(r => (
            <button key={`${r.symbol}-${r.exchange}`} onClick={() => pick(r)} style={{
              display: 'flex', justifyContent: 'space-between', width: '100%', padding: '9px 12px',
              background: 'transparent', border: 'none', color: 'var(--text)', textAlign: 'left', cursor: 'pointer',
            }}>
              <span><b style={{ fontFamily: 'var(--font-mono)' }}>{r.symbol}</b> <span style={{ color: 'var(--muted)', fontSize: 12 }}>{r.name}</span></span>
              <span style={{ color: 'var(--faint)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{r.type.toUpperCase()} · {r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
