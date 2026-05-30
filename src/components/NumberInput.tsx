import { CSSProperties } from 'react'

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  step?: number
  min?: number
  autoFocus?: boolean
  fontSize?: number
  accentColor?: string
  accentBorder?: string
  accentGlow?: string
  inputStyle?: CSSProperties
  onFocus?: () => void
  onBlur?: () => void
}

/**
 * A number input with custom +/− stepper buttons that match the TRADR UI.
 * Hides the native browser spinner (handled globally in index.css).
 */
export default function NumberInput({
  value,
  onChange,
  placeholder = '0.00',
  step = 1,
  min = 0,
  autoFocus = false,
  fontSize = 22,
  accentColor = 'rgba(192,132,252,0.9)',
  accentBorder = 'rgba(192,132,252,0.5)',
  accentGlow = 'rgba(192,132,252,0.3)',
  inputStyle = {},
  onFocus,
  onBlur,
}: Props) {
  const parsed = parseFloat(value)
  const hasValue = !isNaN(parsed) && parsed > 0

  const increment = () => {
    const cur = parseFloat(value) || 0
    onChange(String(Math.max(min, parseFloat((cur + step).toFixed(8)))))
  }
  const decrement = () => {
    const cur = parseFloat(value) || 0
    onChange(String(Math.max(min, parseFloat((cur - step).toFixed(8)))))
  }

  const stepperBtn: CSSProperties = {
    width: 18,
    height: 16,
    borderRadius: 4,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    color: 'var(--muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
    flexShrink: 0,
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 0 }}>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        step={step}
        autoFocus={autoFocus}
        style={{
          flex: 1,
          paddingRight: 72, // room for stepper buttons
          color: 'var(--text)',
          fontFamily: 'var(--font-mono)',
          fontSize,
          fontWeight: 700,
          outline: 'none',
          transition: 'all 0.2s',
          boxShadow: hasValue ? `0 0 16px ${accentGlow}` : 'none',
          ...inputStyle,
        }}
        onFocus={onFocus}
        onBlur={onBlur}
      />

      {/* Custom stepper buttons, absolutely positioned inside the input */}
      <div style={{
        position: 'absolute',
        right: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        <button
          type="button"
          onClick={increment}
          style={stepperBtn}
          onMouseEnter={e => {
            e.currentTarget.style.background = `${accentColor}18`
            e.currentTarget.style.borderColor = accentBorder
            e.currentTarget.style.color = accentColor
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
            e.currentTarget.style.color = 'var(--muted)'
          }}
        >
          <svg width="6" height="4" viewBox="0 0 6 4" fill="currentColor">
            <path d="M3 0L6 4H0L3 0Z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={decrement}
          style={stepperBtn}
          onMouseEnter={e => {
            e.currentTarget.style.background = `${accentColor}18`
            e.currentTarget.style.borderColor = accentBorder
            e.currentTarget.style.color = accentColor
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
            e.currentTarget.style.color = 'var(--muted)'
          }}
        >
          <svg width="6" height="4" viewBox="0 0 6 4" fill="currentColor">
            <path d="M3 4L0 0H6L3 4Z" />
          </svg>
        </button>
      </div>
    </div>
  )
}