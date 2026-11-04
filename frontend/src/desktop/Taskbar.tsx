import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Loader2, MemoryStick, Timer, Wifi, WifiOff } from 'lucide-react'
import { APP_BY_ID, type AppId } from '../apps/meta'
import { AppIcon } from '../components/AppIcon'
import { Logo } from '../components/Logo'
import { useNotify } from '../contexts/Notifications'
import { useSystem, type ConnState } from '../contexts/SystemContext'
import { TASKBAR_H, useWM } from '../contexts/WindowManager'
import { useIsMobile } from '../hooks/useMediaQuery'
import { BOARD_ADDRESS } from '../services/api'
import { cx, fmtBytes, fmtUptime } from '../lib/format'

const connLabel: Record<ConnState, string> = {
  connecting: 'conectando',
  connected: 'conectado',
  reconnecting: 'reconectando',
  disconnected: 'desconectado',
  error: 'erro de comunicação',
}
const connDot: Record<ConnState, string> = {
  connecting: 'bg-sky-300 animate-pulse-soft',
  connected: 'bg-phos-400',
  reconnecting: 'bg-amber-300 animate-pulse-soft',
  disconnected: 'bg-rose-400',
  error: 'bg-rose-400 animate-pulse-soft',
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="text-center leading-tight" title={now.toLocaleString('pt-BR')}>
      <div className="text-[13px] font-semibold tabular-nums text-ink-50">{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
      <div className="hidden text-[10.5px] tabular-nums text-ink-300 lg:block">{now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</div>
    </div>
  )
}

export function Taskbar({ startOpen, onStart, onContextMenu }: { startOpen: boolean; onStart: () => void; onContextMenu: (e: React.MouseEvent, id: AppId) => void }) {
  const { wins, focusedId, taskbarClick } = useWM()
  const { metrics, conn, busy, latencyMs } = useSystem()
  const mobile = useIsMobile()
  const live = conn === 'connected' && metrics
  const sorted = [...wins].sort((a, b) => APP_BY_ID[a.id].title.localeCompare(APP_BY_ID[b.id].title))

  return (
    <nav
      className="glass absolute inset-x-1.5 z-[5000] flex items-center gap-1 rounded-xl px-1"
      style={{ height: TASKBAR_H - 12, bottom: 'max(6px, env(safe-area-inset-bottom))' }}
      aria-label="Painel"
    >
      <button
        onClick={onStart}
        aria-expanded={startOpen}
        aria-haspopup="menu"
        aria-label="Iniciar"
        title="Aplicativos"
        className={cx('grid h-[38px] w-[42px] shrink-0 place-items-center rounded-lg transition-colors', startOpen ? 'bg-phos-400/25' : 'hover:bg-white/10')}
      >
        <Logo size={26} />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
        <AnimatePresence initial={false}>
          {sorted.map((w) => {
            const active = focusedId === w.id && !w.minimized
            return (
              <motion.button
                key={w.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                onClick={() => taskbarClick(w.id)}
                onContextMenu={(e) => onContextMenu(e, w.id)}
                title={APP_BY_ID[w.id].title}
                aria-label={APP_BY_ID[w.id].title}
                className={cx(
                  'relative grid h-[38px] w-[44px] shrink-0 place-items-center rounded-lg transition-colors',
                  active ? 'bg-white/[.12]' : 'hover:bg-white/[.08]',
                )}
              >
                <AppIcon id={w.id} size={26} />
                <span className={cx('absolute bottom-0 left-1/2 h-[3px] -translate-x-1/2 rounded-full transition-all duration-200', active ? 'w-6 bg-phos-400' : 'w-2.5 bg-ink-300/70', w.minimized && 'opacity-50')} />
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 text-[12px] text-ink-200">
        {busy > 0 && <Loader2 size={15} className="mx-1 animate-spin text-phos-300" aria-label="Operação em andamento" />}
        <span className="hidden h-[38px] items-center gap-1.5 rounded-lg px-2 hover:bg-white/[.08] md:flex" title={`Estado da conexão: ${connLabel[conn]}${latencyMs ? ` · latência ${Math.round(latencyMs)} ms` : ''} · ${BOARD_ADDRESS}`}>
          {conn === 'disconnected' || conn === 'error' ? <WifiOff size={16} className="text-rose-300" /> : <Wifi size={16} />}
          <span className="num text-[11.5px] text-ink-300">{BOARD_ADDRESS}</span>
        </span>
        <span className="num flex h-[38px] items-center gap-1.5 rounded-lg px-2 text-[11.5px] hover:bg-white/[.08]" title="Heap livre (RAM interna)">
          <span className={cx('h-2 w-2 rounded-full', connDot[conn])} />
          <MemoryStick size={15} className="hidden sm:block" />
          {live ? fmtBytes(metrics.heap.free) : '—'}
        </span>
        <span className="num hidden h-[38px] items-center gap-1.5 rounded-lg px-2 text-[11.5px] hover:bg-white/[.08] lg:flex" title="Tempo ligado da placa">
          <Timer size={15} />{live ? fmtUptime(metrics.uptimeMs) : '—'}
        </span>
        {!mobile && <NotificationBell />}
        <div className="flex h-[38px] items-center rounded-lg px-2.5 hover:bg-white/[.08]"><Clock /></div>
      </div>
    </nav>
  )
}

function NotificationBell() {
  const { history, clearHistory } = useNotify()
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const unread = history.length > 0 && history[0].id !== seen
  useEffect(() => {
    if (!open) return
    const h = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', h)
    return () => window.removeEventListener('pointerdown', h)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button className="icon-btn relative h-[38px] w-9 rounded-lg" aria-label="Notificações" onClick={() => { setOpen((o) => !o); if (history[0]) setSeen(history[0].id) }}>
        <Bell size={15} />
        {unread && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-phos-300" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.15 }}
            className="glass absolute bottom-[50px] right-0 w-[330px] rounded-xl p-2">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[12.5px] font-semibold text-ink-100">Notificações</span>
              {history.length > 0 && <button className="text-[11.5px] text-ink-400 hover:text-ink-100" onClick={clearHistory}>limpar</button>}
            </div>
            <div className="max-h-[320px] overflow-auto scroll-thin">
              {history.length === 0 && <p className="px-2 py-6 text-center text-[12px] text-ink-400">Nenhuma notificação.</p>}
              {history.map((n) => (
                <div key={n.id} className="rounded-lg px-2 py-1.5 hover:bg-white/[.04]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cx('text-[12.5px] font-medium', n.kind === 'error' ? 'text-rose-300' : n.kind === 'success' ? 'text-emerald-300' : n.kind === 'warning' ? 'text-amber-200' : 'text-ink-100')}>{n.title}</span>
                    <span className="num shrink-0 text-[10.5px] text-ink-500">{new Date(n.at).toLocaleTimeString('pt-BR')}</span>
                  </div>
                  {n.body && <p className="text-[11.5px] text-ink-400">{n.body}</p>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
