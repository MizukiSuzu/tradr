import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Bar, Cone } from '../forecast/types'

const usd = (x: number) => `$${x.toFixed(2)}`

export default function ConeChart({ past, cone, actual, hideDates }: { past: Bar[]; cone: Cone; actual?: Bar[]; hideDates?: boolean }) {
  const pastPts = past.map((b, i) => ({ x: hideDates ? `-${past.length - 1 - i}d` : b.date.slice(5), close: b.close }))
  const future = cone.bands.slice(1).map((b, i) => ({
    x: `+${b.step}d`, p50: b.p50, band95: [b.p025, b.p975], band68: [b.p16, b.p84], actual: actual?.[i]?.close,
  }))
  const join = {
    ...pastPts[pastPts.length - 1],
    p50: cone.start, band95: [cone.start, cone.start], band68: [cone.start, cone.start],
    actual: actual ? cone.start : undefined,
  }
  const data = [...pastPts.slice(0, -1), join, ...future]

  return (
    <div style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid stroke="rgba(148,100,255,0.08)" vertical={false} />
          <XAxis dataKey="x" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval="preserveStartEnd" minTickGap={40} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--muted)' }} width={60} tickFormatter={v => `$${Number(v).toFixed(0)}`} />
          <Tooltip
            contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            formatter={(v: any) => (Array.isArray(v) ? `${usd(v[0])} – ${usd(v[1])}` : usd(Number(v)))}
          />
          <Area dataKey="band95" name="95% range" stroke="none" fill="rgba(192,132,252,0.15)" isAnimationActive={false} />
          <Area dataKey="band68" name="68% range" stroke="none" fill="rgba(192,132,252,0.3)" isAnimationActive={false} />
          <Line dataKey="close" name="Close" stroke="var(--accent2)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <Line dataKey="p50" name="Median" stroke="var(--accent)" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          {actual && <Line dataKey="actual" name="Actual" stroke="var(--gold)" dot={false} strokeWidth={2} animationDuration={900} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
