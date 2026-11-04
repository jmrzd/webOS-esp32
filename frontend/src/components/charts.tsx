// Gráficos leves em SVG (sem bibliotecas: economiza ~100 KB na flash do ESP32).
import { useId } from 'react'

interface Series { values: number[]; color: string; label: string; fill?: boolean }

export function LineChart({
  series, height = 160, min, max, capacity, yFormat = (v) => String(Math.round(v)), xLabelLeft, xLabelRight,
}: {
  series: Series[]; height?: number; min?: number; max?: number; capacity?: number
  yFormat?: (v: number) => string; xLabelLeft?: string; xLabelRight?: string
}) {
  const gid = useId().replace(/:/g, '')
  const W = 600
  const all = series.flatMap((s) => s.values)
  const lo = min ?? (all.length ? Math.min(...all) : 0)
  const hi0 = max ?? (all.length ? Math.max(...all) : 1)
  const pad = min === undefined && max === undefined ? (hi0 - lo) * 0.15 || 1 : 0
  const yMin = min ?? lo - pad
  const yMax = (max ?? hi0 + pad) === yMin ? yMin + 1 : max ?? hi0 + pad
  const n = capacity ?? Math.max(2, ...series.map((s) => s.values.length))
  const x = (i: number, len: number) => ((n - len + i) / Math.max(1, n - 1)) * W
  const y = (v: number) => height - ((v - yMin) / (yMax - yMin)) * (height - 8) - 4
  const ticks = [yMax, (yMax + yMin) / 2, yMin]

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="num flex w-[64px] shrink-0 flex-col justify-between py-0.5 text-right text-[10.5px] text-ink-400" style={{ height }}>
          {ticks.map((t, i) => <span key={i}>{yFormat(t)}</span>)}
        </div>
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="min-w-0 flex-1 overflow-visible" style={{ height }} role="img" aria-label={series.map((s) => s.label).join(', ')}>
          <defs>
            {series.map((s, k) => (
              <linearGradient key={k} id={`${gid}-g${k}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity=".32" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t, i) => <line key={i} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="rgb(255 255 255 / .06)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />)}
          {series.map((s, k) => {
            if (s.values.length < 2) return null
            const pts = s.values.map((v, i) => `${x(i, s.values.length).toFixed(1)},${y(v).toFixed(1)}`)
            const line = 'M' + pts.join(' L')
            const area = `${line} L${x(s.values.length - 1, s.values.length)},${height} L${x(0, s.values.length)},${height} Z`
            return (
              <g key={k}>
                {s.fill !== false && <path d={area} fill={`url(#${gid}-g${k})`} />}
                <path d={line} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              </g>
            )
          })}
        </svg>
      </div>
      {(xLabelLeft || xLabelRight) && (
        <div className="ml-[72px] mt-1 flex justify-between text-[10.5px] text-ink-400">
          <span>{xLabelLeft}</span><span>{xLabelRight}</span>
        </div>
      )}
      {series.length > 1 && (
        <div className="ml-[72px] mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-[11.5px] text-ink-300">
              <span className="h-2 w-3 rounded-sm" style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Barras horizontais comparativas (ex.: sem mutex × com mutex). */
export function CompareBars({ rows, unit, format = (v) => String(v) }: { rows: { label: string; value: number; color: string; note?: string }[]; unit?: string; format?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="text-ink-200">{r.label}</span>
            <span className="num text-ink-50">{format(r.value)}{unit && <span className="ml-1 text-ink-400">{unit}</span>}{r.note && <span className="ml-2 text-ink-400">{r.note}</span>}</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/[.05]">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(r.value / max) * 100}%`, background: r.color, minWidth: r.value > 0 ? 3 : 0 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
