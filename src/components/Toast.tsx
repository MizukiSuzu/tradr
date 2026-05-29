interface Props {
  msg: string
  ok: boolean
}

export default function Toast({ msg, ok }: Props) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      background: ok
        ? 'linear-gradient(135deg, rgba(134,239,172,0.15), rgba(103,232,249,0.1))'
        : 'rgba(248,113,113,0.12)',
      border: `1px solid ${ok ? 'rgba(134,239,172,0.4)' : 'rgba(248,113,113,0.4)'}`,
      borderRadius: 12,
      padding: '12px 20px',
      display: 'flex', alignItems: 'center', gap: 10,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      boxShadow: ok ? '0 0 20px rgba(134,239,172,0.15)' : '0 0 20px rgba(248,113,113,0.15)',
      animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      zIndex: 9000,
    }}>
      <span style={{ fontSize: 16 }}>{ok ? '✦' : '✕'}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 13,
        color: ok ? '#86efac' : '#f87171',
        fontWeight: 700,
      }}>{msg}</span>
    </div>
  )
}
