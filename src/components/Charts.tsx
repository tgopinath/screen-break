import { useEffect, useRef, useState } from 'react'

/** Measure the container so the SVG renders 1:1 and text stays readable. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export interface Series {
  key: string
  label: string
  color: string
}

export interface Datum {
  label: string
  title: string // tooltip header
  values: Record<string, number>
}

function niceMax(v: number) {
  if (v <= 0) return 4
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return Math.max(4, m * p)
}

const H = 190
const PAD = { l: 34, r: 8, t: 10, b: 26 }

export function BarChart({ data, series, format = (v) => String(Math.round(v)), stacked = true }: { data: Datum[]; series: Series[]; format?: (v: number) => string; stacked?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const [ref, W] = useWidth()
  const totals = data.map((d) => (stacked ? series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0) : Math.max(...series.map((x) => d.values[x.key] ?? 0))))
  const max = niceMax(Math.max(0, ...totals))
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const bw = iw / Math.max(1, data.length)
  const barW = Math.max(2, Math.min(28, bw * 0.62))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(iw / 44)))
  const empty = totals.every((t) => t === 0)
  return (
    <div className="relative min-w-0" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="Bar chart" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => {
          const y = PAD.t + ih - (t / max) * ih
          return (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={PAD.l - 6} y={y + 3.5} textAnchor="end" fontSize={10} fill="var(--muted)" className="tabular">
                {format(t)}
              </text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const cx = PAD.l + bw * i + bw / 2
          let y = PAD.t + ih
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={PAD.l + bw * i} y={PAD.t} width={bw} height={ih} fill={hover === i ? 'var(--surface-2)' : 'transparent'} rx={6} />
              {series.map((sr, si) => {
                const v = d.values[sr.key] ?? 0
                if (v <= 0) return null
                const h = (v / max) * ih
                const x = stacked ? cx - barW / 2 : cx - barW / 2 + (si - (series.length - 1) / 2) * (barW / series.length)
                const w = stacked ? barW : barW / series.length
                const ry = stacked ? (y -= h) : PAD.t + ih - h
                return <rect key={sr.key} x={x} y={ry} width={w} height={Math.max(1.5, h - (stacked ? 1.5 : 0))} rx={Math.min(4, w / 2)} fill={sr.color} style={{ transition: 'all .5s ease' }} />
              })}
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--muted)">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {empty && <div className="pointer-events-none absolute inset-0 grid place-items-center pb-6 text-[13px] font-medium text-muted">No data recorded in this range</div>}
      {hover !== null && !empty && <ChartTip d={data[hover]} series={series} format={format} left={((PAD.l + bw * hover + bw / 2) / W) * 100} />}
    </div>
  )
}

export function LineChart({ data, series, format = (v) => String(Math.round(v)) }: { data: Datum[]; series: Series[]; format?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  const [ref, W] = useWidth()
  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0))))
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const x = (i: number) => PAD.l + (data.length === 1 ? iw / 2 : (iw * i) / (data.length - 1))
  const y = (v: number) => PAD.t + ih - (v / max) * ih
  const ticks = [0, 0.5, 1].map((f) => f * max)
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(iw / 44)))
  const empty = data.every((d) => series.every((s) => !d.values[s.key]))
  return (
    <div className="relative min-w-0" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="Line chart" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={PAD.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--muted)">
              {format(t)}
            </text>
          </g>
        ))}
        {series.map((s) => {
          const pts = data.map((d, i) => `${x(i)},${y(d.values[s.key] ?? 0)}`).join(' ')
          return (
            <g key={s.key}>
              <polygon points={`${x(0)},${y(0)} ${pts} ${x(data.length - 1)},${y(0)}`} fill={s.color} opacity={0.12} />
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {data.map((d, i) => (
                <circle key={i} cx={x(i)} cy={y(d.values[s.key] ?? 0)} r={hover === i ? 4.5 : data.length > 20 ? 0 : 3} fill="var(--surface)" stroke={s.color} strokeWidth={2} />
              ))}
            </g>
          )
        })}
        {data.map((d, i) => (
          <g key={i}>
            <rect x={x(i) - iw / data.length / 2} y={PAD.t} width={iw / Math.max(1, data.length)} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
            {i % labelEvery === 0 && (
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--muted)">
                {d.label}
              </text>
            )}
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--border)" />}
      </svg>
      {empty && <div className="pointer-events-none absolute inset-0 grid place-items-center pb-6 text-[13px] font-medium text-muted">No data recorded in this range</div>}
      {hover !== null && !empty && <ChartTip d={data[hover]} series={series} format={format} left={(x(hover) / W) * 100} />}
    </div>
  )
}

function ChartTip({ d, series, format, left }: { d: Datum; series: Series[]; format: (v: number) => string; left: number }) {
  return (
    <div className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-pop" style={{ left: `clamp(70px, ${left}%, calc(100% - 70px))` }}>
      <p className="mb-1 font-semibold">{d.title}</p>
      {series.map((s) => (
        <p key={s.key} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
          <span className="tabular font-semibold">{format(d.values[s.key] ?? 0)}</span>
        </p>
      ))}
    </div>
  )
}

export function ChartLegend({ series }: { series: Series[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-muted">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}
