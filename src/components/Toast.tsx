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
      background: ok ? 'rgba(0,255,136,0.15)' : 'rgba(255,59,92,0.15)',
      border: `1px solid ${ok ? 'rgba(0,255,136,0.4)' : 'rgba(255,59,92,0.4)'}`,
      color: ok ? 'var(--green)' : 'var(--red)',
      borderRadius: 10,
      padding: '12px 20px',
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      fontSize: 13,
      zIndex: 9999,
      animation: 'slideIn 0.3s ease',
      backdropFilter: 'blur(4px)',
    }}>
      {ok ? '✓' : '✗'} {msg}
    </div>
  )
}
