export default function Loader() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      gap: 32,
    }}>
      {/* 3D Crystal using CSS perspective */}
      <div style={{ perspective: 400, width: 80, height: 80 }}>
        <div style={{
          width: 80, height: 80,
          position: 'relative',
          transformStyle: 'preserve-3d',
          animation: 'crystalSpin 2.4s cubic-bezier(0.4,0,0.2,1) infinite',
        }}>
          {[
            { transform: 'rotateY(0deg) translateZ(40px)',   bg: 'rgba(192,132,252,0.4)' },
            { transform: 'rotateY(90deg) translateZ(40px)',  bg: 'rgba(167,139,250,0.3)' },
            { transform: 'rotateY(180deg) translateZ(40px)', bg: 'rgba(103,232,249,0.35)' },
            { transform: 'rotateY(-90deg) translateZ(40px)', bg: 'rgba(139,92,246,0.4)' },
            { transform: 'rotateX(90deg) translateZ(40px)',  bg: 'rgba(192,132,252,0.25)' },
            { transform: 'rotateX(-90deg) translateZ(40px)', bg: 'rgba(103,232,249,0.25)' },
          ].map((face, i) => (
            <div key={i} style={{
              position: 'absolute', inset: 0,
              transform: face.transform,
              background: face.bg,
              border: '1px solid rgba(192,132,252,0.5)',
              borderRadius: 6,
              backdropFilter: 'blur(4px)',
            }} />
          ))}
        </div>
      </div>

      <div style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18,
        letterSpacing: 6,
        background: 'linear-gradient(90deg, #c084fc, #67e8f9)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        TRADR
      </div>

      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--muted)', letterSpacing: 2,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}>
        LOADING MARKETS...
      </div>
    </div>
  )
}
