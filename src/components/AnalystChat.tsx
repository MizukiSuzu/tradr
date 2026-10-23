import { useEffect, useRef, useState } from 'react'

interface Msg { role: 'user' | 'assistant'; content: string }

const BASE_PROMPT = `You are TRADR Analyst, the explainer inside TRADR, a stock prediction game with statistical forecasts, where players call Up or Down and earn more points for calls the forecast thought unlikely.
Explain what the numbers below mean in plain language: the probability cone, the signals, and the track record.
How TRADR works:
- Forecasts use daily closing prices only. No volume, news or fundamentals.
- The probability cone is a block-bootstrap Monte Carlo: 5,000 simulated paths built from random 5-day blocks of the stock's last 252 daily returns. It shows the median plus 68% and 95% ranges over 1 week, 1 month or 3 months of trading days.
- Four signals: trend (price vs 50- and 200-day averages, golden/death crosses), 20-day momentum, RSI(14) (above 70 overbought, below 30 oversold), and volatility regime (20-day volatility vs the past year).
- The track record rebuilds a 1-month cone at each of the last 12 monthly dates, using only data available then, and counts how often the actual price landed inside the 68% and 95% ranges.
Rules:
- Use only the data provided. If something isn't in it, say you don't know.
- Never tell the user to buy or sell or which way to call (Up or Down), never give personal financial advice, and never claim certainty about future prices.
- Keep answers under 120 words. No headers. Short paragraphs or a short list are fine.`

export default function AnalystChat({ summary, symbol }: { summary: string | null; symbol: string | null }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const symbolRef = useRef(symbol)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  // A new ticker starts a fresh conversation; replies still in flight for the old one are dropped in send()
  useEffect(() => { symbolRef.current = symbol; setMsgs([]) }, [symbol])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    const sentFor = symbol
    const next: Msg[] = [...msgs, { role: 'user', content: text }]
    setMsgs(next)
    setInput('')
    setBusy(true)
    const system = summary
      ? `${BASE_PROMPT}\n\nCurrent ticker data:\n${summary}`
      : `${BASE_PROMPT}\n\nNo ticker is open. Explain how TRADR's forecasts work in general, and suggest opening a ticker for specifics.`
    let reply = '[connection error — try again]'
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: system }, ...next.slice(-10)] }),
      })
      const data = await r.json()
      const err = typeof data.error === 'string' ? data.error : (data.error?.message ?? 'request failed')
      reply = data.choices?.[0]?.message?.content?.trim() || (data.error ? `[${err}]` : '[no response — try again]')
    } catch { /* keep default reply */ }
    if (symbolRef.current === sentFor) setMsgs(m => [...m, { role: 'assistant', content: reply }])
    setBusy(false)
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 7000 }}>
      {open && (
        <div style={{
          width: 360, height: 460, marginBottom: 12, display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(180deg, #1a1035 0%, #110d24 100%)', border: '1px solid rgba(148,100,255,0.25)',
          borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 800 }}>TRADR Analyst</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
              {symbol ? `Explaining ${symbol}` : 'Open a ticker for specifics'} · not financial advice
            </div>
          </div>
          <div role="log" aria-live="polite" style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {msgs.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                Try: "What does the cone mean?" · "Why is volatility high?" · "How accurate has this been?"
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%',
                padding: '8px 11px', borderRadius: 10, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                background: m.role === 'user' ? 'rgba(192,132,252,0.18)' : 'rgba(255,255,255,0.05)',
              }}>{m.content}</div>
            ))}
            {busy && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Thinking…</div>}
            <div ref={bottomRef} />
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--border)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
              placeholder="Ask about this forecast…"
              aria-label="Message the analyst"
              maxLength={2000}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13 }}
            />
            <button onClick={send} disabled={busy} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0c0818', fontWeight: 700, cursor: 'pointer' }}>Send</button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close analyst chat' : 'Open analyst chat'}
        style={{
          padding: '12px 18px', borderRadius: 999, border: '1px solid rgba(192,132,252,0.4)',
          background: 'linear-gradient(135deg, #a78bfa 0%, #67e8f9 100%)', color: '#0c0818', fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(167,139,250,0.35)',
        }}
      >{open ? 'Close' : 'Ask the Analyst'}</button>
    </div>
  )
}
