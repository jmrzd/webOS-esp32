import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, FlaskConical, Info, Lightbulb, Loader2, WifiOff } from 'lucide-react'
import { cx } from '../lib/format'
import type { TaskStateName } from '../types/api'

export function Stat({ label, value, unit, hint, tone, big }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; tone?: 'ok' | 'warn' | 'bad' | 'accent'; big?: boolean }) {
  const toneCls = tone === 'bad' ? 'text-rose-300' : tone === 'warn' ? 'text-amber-200' : tone === 'ok' ? 'text-phos-300' : tone === 'accent' ? 'text-phos-300' : 'text-ink-50'
  return (
    <div className="panel min-w-0 px-3.5 py-3">
      <div className="label truncate !text-[10px]">{label}</div>
      <div className={cx('num mt-1 font-semibold leading-none', big ? 'text-[26px] tracking-[-.04em]' : 'text-[19px] tracking-[-.03em]', toneCls)}>
        {value}
        {unit && <span className="ml-1 text-[12px] font-medium text-ink-400">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 truncate text-[11.5px] text-ink-400">{hint}</div>}
    </div>
  )
}

const stateTone: Record<string, string> = {
  executando: 'bg-phos-400/12 text-phos-300 ring-1 ring-phos-400/30',
  pronta: 'bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30',
  bloqueada: 'bg-amber-400/12 text-amber-200 ring-1 ring-amber-400/30',
  suspensa: 'bg-violet-400/15 text-violet-200 ring-1 ring-violet-400/30',
  finalizada: 'bg-ink-500/30 text-ink-300',
  parada: 'bg-ink-500/30 text-ink-300',
  invalida: 'bg-ink-500/30 text-ink-300',
}
export function StateBadge({ state }: { state: TaskStateName | string }) {
  return <span className={cx('chip', stateTone[state] ?? 'bg-white/10 text-ink-200')}>{state}</span>
}

export function Bar({ value, max = 100, tone = 'phos', className, label }: { value: number; max?: number; tone?: 'phos' | 'volt' | 'warn' | 'bad' | 'ok'; className?: string; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const bg = { phos: 'from-phos-300 to-phos-500', volt: 'from-volt-300 to-volt-500', warn: 'from-amber-200 to-amber-500', bad: 'from-rose-300 to-rose-500', ok: 'from-emerald-300 to-emerald-500' }[tone]
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-white/[.06]', className)} role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <motion.div className={cx('h-full rounded-full bg-gradient-to-r', bg)} initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 160, damping: 26 }} />
    </div>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-[10px] bg-black/25 p-0.5 ring-1 ring-white/[.08] scroll-thin" role="tablist">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'relative rounded-[8px] px-3 font-semibold whitespace-nowrap transition-colors',
            size === 'sm' ? 'h-7 text-[12px]' : 'h-8 text-[12.5px] pointer-coarse:h-10',
            o.value === value ? 'text-ink-950' : 'text-ink-300 hover:text-ink-100',
          )}
        >
          {o.value === value && <motion.span layoutId={undefined} className="absolute inset-0 rounded-[8px] bg-phos-400" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/** Caixa de interpretação: o que o resultado significa. */
export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'ok' | 'warn' | 'bad' | 'idea'; title?: ReactNode; children: ReactNode }) {
  const map = {
    info: ['ring-sky-300/20 bg-sky-300/[.05]', Info, 'text-sky-300'],
    ok: ['ring-phos-400/25 bg-phos-400/[.05]', CheckCircle2, 'text-phos-300'],
    warn: ['ring-amber-300/25 bg-amber-300/[.06]', AlertTriangle, 'text-amber-300'],
    bad: ['ring-rose-400/25 bg-rose-400/[.06]', AlertTriangle, 'text-rose-300'],
    idea: ['ring-volt-400/25 bg-volt-400/[.06]', Lightbulb, 'text-volt-300'],
  } as const
  const [cls, Icon, ic] = map[tone]
  return (
    <div className={cx('flex gap-3 rounded-xl px-4 py-3 text-[13px] leading-relaxed text-ink-100 ring-1 ring-inset', cls)}>
      <Icon size={17} className={cx('mt-0.5 shrink-0', ic)} />
      <div className="min-w-0">
        {title && <div className={cx('mb-0.5 font-semibold', ic)}>{title}</div>}
        {children}
      </div>
    </div>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-1 flex items-center justify-between gap-3">
      <h3 className="text-[13px] font-semibold text-ink-100">{children}</h3>
      {right}
    </div>
  )
}

export function Loading({ text = 'Consultando a placa…' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-10 text-ink-300 justify-center">
      <Loader2 className="animate-spin" size={18} /> <span className="text-[13px]">{text}</span>
    </div>
  )
}

export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200 ring-1 ring-rose-400/25">
      <WifiOff size={15} className="shrink-0" /> <span>Sem dados novos da placa: {error}. Os valores mostrados podem estar desatualizados.</span>
    </div>
  )
}

export function SimulationBadge() {
  return (
    <span className="chip bg-volt-400/15 text-volt-300 ring-1 ring-volt-400/35" title="Executa no navegador; não usa a placa">
      <FlaskConical size={12} /> SIMULAÇÃO no navegador
    </span>
  )
}

export function LiveBadge({ live }: { live: boolean }) {
  return live ? (
    <span className="chip bg-phos-400/10 text-phos-300 ring-1 ring-phos-400/25">
      <span className="h-1.5 w-1.5 rounded-full bg-phos-400 animate-pulse-soft" /> dados reais do ESP32
    </span>
  ) : (
    <span className="chip bg-rose-400/12 text-rose-300 ring-1 ring-rose-400/30">sem conexão</span>
  )
}

export function TableWrap({ children, maxH }: { children: ReactNode; maxH?: number }) {
  return (
    <div className="panel overflow-auto scroll-thin" style={maxH ? { maxHeight: maxH } : undefined}>
      {children}
    </div>
  )
}
