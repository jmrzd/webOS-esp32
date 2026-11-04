import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Cpu, FolderOpen, Gauge, LayoutGrid, Lock, MemoryStick, Power, Search, Shuffle } from 'lucide-react'
import { APPS, GROUPS, type AppId } from '../apps/meta'
import { AppIcon } from '../components/AppIcon'
import { Logo } from '../components/Logo'
import { useSystem } from '../contexts/SystemContext'
import { TASKBAR_H } from '../contexts/WindowManager'
import { useIsMobile } from '../hooks/useMediaQuery'
import { api } from '../services/api'
import { cx, fmtBytes, fmtUptime } from '../lib/format'

const ALL = 'Todos os aplicativos'
const GROUP_ICON = [Cpu, Shuffle, MemoryStick, FolderOpen, Gauge]

/** Lançador de aplicativos: categorias (por aula) à esquerda, apps à direita. */
export function StartMenu({ onOpen, onClose, onLock, canLock }: { onOpen: (id: AppId) => void; onClose: () => void; onLock: () => void; canLock: boolean }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>(ALL)
  const { info, metrics, runOp } = useSystem()
  const mobile = useIsMobile()
  const ref = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) input.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (!ref.current?.contains(t) && !t.closest('[aria-haspopup="menu"]')) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown) }
  }, [onClose])

  const term = q.trim().toLowerCase()
  const list = useMemo(() => {
    if (term) return APPS.filter((a) => (a.title + ' ' + a.summary + ' ' + a.lesson).toLowerCase().includes(term))
    return cat === ALL ? APPS : APPS.filter((a) => a.group === cat)
  }, [term, cat])

  const restart = async () => {
    if (!confirm('Reiniciar o ESP32? A conexão cairá por alguns segundos; arquivos salvos no LittleFS são mantidos.')) return
    await runOp('Falha ao reiniciar', () => api.system.restart(), 'Placa reiniciando…')
    onClose()
  }

  const open = (id: AppId) => { onOpen(id); onClose() }

  return (
    <motion.div
      ref={ref}
      role="menu"
      aria-label="Aplicativos"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10, transition: { duration: 0.12 } }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="glass absolute left-1.5 z-[5500] flex w-[calc(100%-12px)] max-w-[680px] flex-col overflow-hidden rounded-xl"
      style={{ bottom: TASKBAR_H - 2, height: `min(560px, calc(100% - ${TASKBAR_H + 12}px))` }}
    >
      {/* cabeçalho */}
      <div className="flex items-center gap-3 border-b border-white/[.07] px-3 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0f1a1a] ring-2 ring-phos-400/50"><Logo size={24} /></span>
        <div className="hidden min-w-0 sm:block">
          <div className="text-[13.5px] font-semibold text-ink-50">WebOS ESP32</div>
          <div className="num truncate text-[11px] text-ink-400">{info ? info.network.ssid : 'placa não identificada'}</div>
        </div>
        <label className="ml-auto flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg bg-black/25 px-3 ring-1 ring-white/10 transition-shadow focus-within:ring-2 focus-within:ring-phos-400/70 sm:max-w-[300px]">
          <Search size={15} className="shrink-0 text-ink-400" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-500" aria-label="Pesquisar aplicativos" />
        </label>
      </div>

      {/* corpo */}
      <div className="flex min-h-0 flex-1">
        {!mobile && (
          <nav className="w-[230px] shrink-0 space-y-0.5 overflow-y-auto border-r border-white/[.07] p-2 scroll-thin" aria-label="Categorias">
            {[ALL, ...GROUPS].map((g, i) => {
              const Icon = i === 0 ? LayoutGrid : GROUP_ICON[i - 1]
              const [name, lesson] = g.split(' · ')
              const on = !term && cat === g
              return (
                <button
                  key={g}
                  onClick={() => { setCat(g); setQ('') }}
                  onMouseEnter={() => !term && setCat(g)}
                  className={cx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors', on ? 'bg-phos-400/20 text-ink-50' : 'text-ink-200 hover:bg-white/[.07]')}
                >
                  <Icon size={16} className={on ? 'text-phos-300' : 'text-ink-400'} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-medium">{name}</span>
                    {lesson && <span className="block text-[10.5px] text-ink-400">{lesson}</span>}
                  </span>
                </button>
              )
            })}
          </nav>
        )}

        <div className="min-w-0 flex-1 overflow-y-auto p-2 scroll-thin">
          {term && <div className="px-2 pb-1.5 pt-1 text-[11.5px] text-ink-400">{list.length} resultado(s) para “{q}”</div>}
          {list.map((a) => (
            <button key={a.id} role="menuitem" onClick={() => open(a.id)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[.08] focus-visible:bg-white/[.08]">
              <AppIcon id={a.id} size={34} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-50">
                  {a.title}
                  {a.bonus && <span title="Bônus" aria-label="bônus" className="h-[6px] w-[6px] shrink-0 rounded-full bg-amber-300" />}
                  {a.simulation && <span className="chip h-4 bg-volt-400/15 px-1.5 text-[9.5px] text-volt-300">simulação</span>}
                </span>
                <span className="block truncate text-[11.5px] text-ink-400">{a.summary}</span>
              </span>
            </button>
          ))}
          {!list.length && <p className="px-3 py-10 text-center text-[12.5px] text-ink-400">Nenhum aplicativo encontrado.</p>}
        </div>
      </div>

      {/* rodapé */}
      <div className="flex items-center gap-2 border-t border-white/[.07] px-3 py-2">
        <div className="num min-w-0 flex-1 truncate text-[11px] text-ink-400">
          {metrics ? `heap ${fmtBytes(metrics.heap.free)} · ligada há ${fmtUptime(metrics.uptimeMs)}` : '—'}
        </div>
        {canLock && (
          <button className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-ink-200 hover:bg-white/[.08]" onClick={onLock}>
            <Lock size={14} /> Bloquear
          </button>
        )}
        <button className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-ink-200 hover:bg-white/[.08]" onClick={restart}>
          <Power size={14} /> Reiniciar placa
        </button>
      </div>
    </motion.div>
  )
}
