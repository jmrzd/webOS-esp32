import { useEffect, useId, useState } from 'react'
import { motion } from 'framer-motion'
import { useSystem } from '../contexts/SystemContext'
import { useWM } from '../contexts/WindowManager'
import { cx, fmtBytes, fmtUptime } from '../lib/format'

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Widget de relógio + identificação da placa. */
export function DesktopClock({ compact = false }: { compact?: boolean }) {
  const now = useNow()
  const { info, conn } = useSystem()
  const hh = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const date = cap(now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
  const online = conn === 'connected'

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cx('glass select-none rounded-xl', compact ? 'px-4 py-3' : 'px-5 py-4')}
      aria-label="Relógio"
    >
      <time className={cx('block font-light leading-none tracking-[-.03em] text-ink-50 tabular-nums', compact ? 'text-[40px]' : 'text-[56px]')} dateTime={now.toISOString()}>
        {hh}
      </time>
      <p className={cx('mt-2 font-medium text-ink-200', compact ? 'text-[13px]' : 'text-[14px]')}>{date}</p>
      <p className="mt-2.5 flex items-center gap-2 border-t border-white/[.07] pt-2.5 text-[11.5px] text-ink-400">
        <span className="relative flex h-2 w-2 shrink-0">
          {online && <span className="absolute inset-0 rounded-full bg-phos-400 animate-ping-slow" />}
          <span className={cx('relative h-2 w-2 rounded-full', online ? 'bg-phos-400' : conn === 'reconnecting' || conn === 'connecting' ? 'bg-amber-300' : 'bg-rose-400')} />
        </span>
        <span className="truncate">{info ? `${info.chip.model} · ${info.chip.cores} × ${info.chip.cpuMHz} MHz` : 'procurando a placa…'}</span>
      </p>
    </motion.section>
  )
}

/** Linha do heap livre ao longo do tempo, com o ponto atual "pulsando". */
function HeapSpark({ data, height = 64 }: { data: number[]; height?: number }) {
  const gid = 'hs' + useId().replace(/:/g, '')
  const W = 280
  if (data.length < 2) {
    return <div className="grid place-items-center text-[11px] text-ink-500" style={{ height }}>coletando amostras…</div>
  }
  const min = Math.min(...data), max = Math.max(...data)
  const span = Math.max(1, max - min)
  const pad = 6
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, pad + (1 - (v - min) / span) * (height - pad * 2)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block w-full overflow-visible" style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#52e3b3" stopOpacity=".28" />
          <stop offset="1" stopColor="#52e3b3" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={height * f} y2={height * f} stroke="rgb(255 255 255 / .05)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />)}
      <path d={`${line} L${W} ${height} L0 ${height} Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="#52e3b3" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="7" fill="#52e3b3" opacity=".18" className="animate-pulse-soft" />
      <circle cx={lx} cy={ly} r="2.8" fill="#c9fbe9" />
    </svg>
  )
}

function CoreBar({ label, value }: { label: string; value: number | null }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-ink-400">{label}</span>
        <span className="num text-ink-100">{value == null ? '—' : `${pct.toFixed(0)}%`}</span>
      </div>
      <div className="mt-1.5 flex h-[5px] gap-[2px]" role="meter" aria-label={`Carga do ${label}`} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} className={cx('flex-1 rounded-[1px] transition-colors duration-500', i < Math.round(pct / 5) ? (pct > 85 ? 'bg-amber-300' : 'bg-phos-400') : 'bg-white/[.07]')} />
        ))}
      </div>
    </div>
  )
}

/** Cartão ao vivo da placa: tudo aqui vem de /api/system/metrics. */
export function BoardWidget({ compact = false }: { compact?: boolean }) {
  const { metrics: m, info, conn, latencyMs } = useSystem()
  const { open } = useWM()
  const live = conn === 'connected' && !!m
  const used = m ? m.heap.total - m.heap.free : 0
  const usedPct = m && m.heap.total ? (used / m.heap.total) * 100 : 0

  if (compact) {
    return (
      <button onClick={() => open('monitor')} className="glass block w-full rounded-xl p-3.5 text-left transition-colors hover:border-white/15" aria-label="Abrir o Monitor do Sistema">
        <div className="flex items-center justify-between">
          <span className="label">Heap livre</span>
          <LivePill live={live} />
        </div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <span className="num text-[26px] font-semibold leading-none text-ink-50">{m ? fmtBytes(m.heap.free) : '—'}</span>
          <span className="num text-[11.5px] text-ink-400">{m ? `${m.tasks} tarefas · ${fmtUptime(m.uptimeMs)}` : ''}</span>
        </div>
        <div className="mt-2"><HeapSpark data={m?.heapHistory ?? []} height={40} /></div>
      </button>
    )
  }

  return (
    <motion.section
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="glass overflow-hidden rounded-xl"
      aria-label="Estado da placa"
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="min-w-0">
          <div className="label">Placa</div>
          <div className="mt-0.5 truncate text-[13.5px] font-semibold text-ink-50">{info?.chip.model ?? '—'}</div>
        </div>
        <LivePill live={live} />
      </div>

      <div className="px-5 pt-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11.5px] text-ink-400">Heap livre</div>
            <div className="num mt-1 text-[34px] font-semibold leading-none tracking-[-.04em] text-ink-50">{m ? fmtBytes(m.heap.free) : '—'}</div>
          </div>
          <div className="num pb-0.5 text-right text-[11px] leading-tight text-ink-400">
            <div>{m ? `${usedPct.toFixed(0)}% em uso` : ''}</div>
            <div>{m ? `de ${fmtBytes(m.heap.total)}` : ''}</div>
          </div>
        </div>
        <div className="-mx-5 mt-3"><HeapSpark data={m?.heapHistory ?? []} height={72} /></div>
      </div>

      <dl className="grid grid-cols-2 border-t border-white/[.06]">
        {[
          ['Tarefas', m ? String(m.tasks) : '—'],
          ['Ligada há', m ? fmtUptime(m.uptimeMs) : '—'],
          ['Aparelhos no Wi-Fi', m ? `${m.stations}${info ? ` / ${info.network.maxStations}` : ''}` : '—'],
          ['Latência', live && latencyMs ? `${Math.round(latencyMs)} ms` : '—'],
        ].map(([k, v], i) => (
          <div key={k} className={cx('px-5 py-3', i % 2 === 0 && 'border-r border-white/[.06]', i < 2 && 'border-b border-white/[.06]')}>
            <dt className="text-[11px] text-ink-400">{k}</dt>
            <dd className="num mt-0.5 text-[15px] font-medium text-ink-50">{v}</dd>
          </div>
        ))}
      </dl>

      {m && (m.cpu.core0 != null || m.cpu.core1 != null) && (
        <div className="grid grid-cols-2 gap-4 border-t border-white/[.06] px-5 py-3.5">
          <CoreBar label="Núcleo 0" value={m.cpu.core0} />
          <CoreBar label="Núcleo 1" value={m.cpu.core1} />
        </div>
      )}

      <button onClick={() => open('monitor')} className="group flex w-full items-center justify-between border-t border-white/[.06] bg-white/[.02] px-5 py-3 text-left text-[12px] text-ink-300 transition-colors hover:bg-white/[.05] hover:text-ink-50">
        <span className="num truncate">{info?.network.ssid ?? 'Monitor do Sistema'}</span>
        <span className="shrink-0 transition-transform group-hover:translate-x-0.5">Abrir monitor →</span>
      </button>
    </motion.section>
  )
}

function LivePill({ live }: { live: boolean }) {
  return live ? (
    <span className="chip bg-phos-400/10 text-phos-300 ring-1 ring-phos-400/25">
      <span className="h-1.5 w-1.5 rounded-full bg-phos-400 animate-pulse-soft" /> ao vivo
    </span>
  ) : (
    <span className="chip bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/25">sem conexão</span>
  )
}
