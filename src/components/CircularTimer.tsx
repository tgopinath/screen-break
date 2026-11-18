import type { ReactNode } from 'react'

export function CircularTimer({ progress, color, size = 260, stroke = 14, children, glow }: { progress: number; color: string; size?: number; stroke?: number; children: ReactNode; glow?: boolean }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.min(1, Math.max(0, progress))
  // Tick marks every 5% for a calm, watch-like dial
  const ticks = Array.from({ length: 60 }, (_, i) => i)
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {glow && <div className="anim-breathe absolute inset-6 rounded-full" style={{ background: `radial-gradient(circle, color-mix(in oklab, ${color} 22%, transparent), transparent 70%)` }} />}
      <svg width={size} height={size} className="-rotate-90">
        {ticks.map((i) => {
          const a = (i / 60) * Math.PI * 2
          const r1 = r - stroke / 2 - 8
          const r2 = r1 - (i % 5 === 0 ? 6 : 3)
          return (
            <line
              key={i}
              x1={size / 2 + Math.cos(a) * r1}
              y1={size / 2 + Math.sin(a) * r1}
              x2={size / 2 + Math.cos(a) * r2}
              y2={size / 2 + Math.sin(a) * r2}
              stroke="var(--border)"
              strokeWidth={i % 5 === 0 ? 2 : 1}
              strokeLinecap="round"
            />
          )
        })}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          strokeOpacity={p < 0.004 ? 0 : 1}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}
