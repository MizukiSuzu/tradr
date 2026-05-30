interface Props {
  msg: string
  ok: boolean
}

export default function Toast({ msg, ok }: Props) {
  return (
    <div style={{
      background: ok
        ? 'linear-gradient(135deg, rgba(20,32,26,0.98), rgba(14,24,20,0.98))'
        : 'linear-gradient(135deg, rgba(32,16,16,0.98), rgba(24,12,12,0.98))',
      border: `1px solid ${ok ? 'rgba(134,239,172,0.35)' : 'rgba(248,113,113,0.35)'}`,
      borderLeft: `3px solid ${ok ? 'var(--green)' : 'var(--red)'}`,
      borderRadius: 12,
      padding: '12px 18px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: ok
        ? '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(134,239,172,0.12)'
        : '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(248,113,113,0.12)',
      animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      minWidth: 230,
      maxWidth: 340,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: ok ? 'rgba(134,239,172,0.15)' : 'rgba(248,113,113,0.15)',
        border: `1px solid ${ok ? 'rgba(134,239,172,0.3)' : 'rgba(248,113,113,0.3)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13,
      }}>
        {ok ? '✓' : '✕'}
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 12,
        color: ok ? '#86efac' : '#f87171',
        fontWeight: 700,
        letterSpacing: 0.2,
      }}>{msg}</span>
    </div>
  )
}