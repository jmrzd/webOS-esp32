import { Suspense, useRef, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Copy, X } from 'lucide-react'
import { APP_BY_ID } from '../apps/meta'
import { AppIcon } from '../components/AppIcon'
import { Loading, SimulationBadge } from '../components/ui'
import { TASKBAR_H, WindowActiveProvider, useWM, type Rect, type WinState } from '../contexts/WindowManager'
import { cx } from '../lib/format'

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const EDGES: { e: Edge; cls: string }[] = [
  { e: 'e', cls: 'right-[-4px] top-3 bottom-3 w-2 cursor-ew-resize' },
  { e: 'w', cls: 'left-[-4px] top-3 bottom-3 w-2 cursor-ew-resize' },
  { e: 's', cls: 'bottom-[-4px] left-3 right-3 h-2 cursor-ns-resize' },
  { e: 'n', cls: 'top-[-4px] left-3 right-3 h-2 cursor-ns-resize' },
  { e: 'se', cls: 'right-[-4px] bottom-[-4px] h-4 w-4 cursor-nwse-resize' },
  { e: 'sw', cls: 'left-[-4px] bottom-[-4px] h-4 w-4 cursor-nesw-resize' },
  { e: 'ne', cls: 'right-[-4px] top-[-4px] h-4 w-4 cursor-nesw-resize' },
  { e: 'nw', cls: 'left-[-4px] top-[-4px] h-4 w-4 cursor-nwse-resize' },
]

export function Window({ win, focused, mobile, children }: { win: WinState; focused: boolean; mobile: boolean; children: ReactNode }) {
  const { focus, close, minimize, toggleMax, setRect } = useWM()
  const app = APP_BY_ID[win.id]
  const frame = useRef<HTMLDivElement>(null)
  const full = mobile || win.maximized

  // Arrasto e redimensionamento: altera o estilo diretamente durante o gesto
  // (sem re-render do app) e grava a posição no estado ao soltar.
  const startGesture = (e: RPointerEvent, edge: Edge | 'move') => {
    if (full || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    focus(win.id)
    const el = frame.current
    if (!el) return
    const sx = e.clientX, sy = e.clientY
    const r0: Rect = { x: win.x, y: win.y, w: win.w, h: win.h }
    let r = r0
    const vw = window.innerWidth, vh = window.innerHeight - TASKBAR_H
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy
      if (edge === 'move') {
        r = { ...r0, x: Math.min(vw - 80, Math.max(-r0.w + 120, r0.x + dx)), y: Math.min(vh - 40, Math.max(0, r0.y + dy)) }
      } else {
        let { x, y, w, h } = r0
        if (edge.includes('e')) w = Math.max(340, Math.min(vw - x, r0.w + dx))
        if (edge.includes('s')) h = Math.max(240, Math.min(vh - y, r0.h + dy))
        if (edge.includes('w')) { const nw = Math.max(340, r0.w - dx); x = r0.x + (r0.w - nw); w = nw }
        if (edge.includes('n')) { const nh = Math.max(240, r0.h - dy); const ny = Math.max(0, r0.y + (r0.h - nh)); h = r0.h + (r0.y - ny); y = ny }
        r = { x, y, w, h }
      }
      el.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`
      el.style.width = `${r.w}px`
      el.style.height = `${r.h}px`
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''
      setRect(win.id, r)
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const style: React.CSSProperties = full
    ? { transform: 'translate3d(0,0,0)', width: '100%', height: `calc(100% - ${TASKBAR_H}px)`, zIndex: win.z }
    : { transform: `translate3d(${win.x}px, ${win.y}px, 0)`, width: win.w, height: win.h, zIndex: win.z }
  if (win.minimized) style.pointerEvents = 'none'

  return (
    <div ref={frame} className="absolute left-0 top-0" style={style} onPointerDownCapture={() => !focused && focus(win.id)}>
      <motion.section
        role="dialog"
        aria-label={app.title}
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={win.minimized ? { opacity: 0, scale: 0.86, y: 70, transition: { duration: 0.2, ease: 'easeIn' } } : { opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
        transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
        className={cx(
          'window-surface relative flex h-full w-full flex-col overflow-hidden',
          full ? 'rounded-none border-0' : 'rounded-[10px]',
          focused ? '' : 'brightness-[.88]',
        )}
        style={{ transition: 'filter .2s' }}
      >
        <header
          className={cx('relative flex h-[38px] shrink-0 select-none items-center gap-2 border-b border-black/30 pl-2.5 pr-1.5', focused ? 'bg-[#2a2e32]' : 'bg-[#25282c]', !full && 'cursor-default')}
          onPointerDown={(e) => startGesture(e, 'move')}
          onDoubleClick={() => !mobile && toggleMax(win.id)}
        >
          <AppIcon id={win.id} size={20} />
          {app.simulation && <span className="hidden md:inline-flex"><SimulationBadge /></span>}
          <h2 className={cx('pointer-events-none absolute inset-x-28 truncate text-center text-[13px] font-medium', focused ? 'text-ink-50' : 'text-ink-400', app.simulation && 'md:inset-x-48')}>{app.title}</h2>
          <div className="ml-auto flex items-center gap-1.5 pr-1" onPointerDown={(e) => e.stopPropagation()}>
            <button className="grid h-[22px] w-[22px] place-items-center rounded-full text-ink-200 transition-colors hover:bg-ink-100 hover:text-ink-900" onClick={() => minimize(win.id)} aria-label="Minimizar" title="Minimizar"><ChevronDown size={15} strokeWidth={2.4} /></button>
            {!mobile && (
              <button className="grid h-[22px] w-[22px] place-items-center rounded-full text-ink-200 transition-colors hover:bg-ink-100 hover:text-ink-900" onClick={() => toggleMax(win.id)} aria-label={win.maximized ? 'Restaurar' : 'Maximizar'} title={win.maximized ? 'Restaurar' : 'Maximizar'}>
                {win.maximized ? <Copy size={11} strokeWidth={2.4} className="-scale-x-100" /> : <ChevronUp size={15} strokeWidth={2.4} />}
              </button>
            )}
            <button className={cx('grid h-[22px] w-[22px] place-items-center rounded-full transition-colors hover:bg-[#e5556a] hover:text-white', focused ? 'bg-ink-200/90 text-ink-900' : 'text-ink-300')} onClick={() => close(win.id)} aria-label="Fechar" title="Fechar"><X size={13} strokeWidth={2.6} /></button>
          </div>
        </header>
        <div className="relative min-h-0 flex-1 overflow-auto overscroll-contain scroll-thin">
          <WindowActiveProvider value={!win.minimized}>
            <Suspense fallback={<Loading text="Carregando aplicativo…" />}>{children}</Suspense>
          </WindowActiveProvider>
        </div>
      </motion.section>
      {!full && !win.minimized && EDGES.map(({ e, cls }) => (
        <div key={e} className={cx('absolute z-10 touch-none', cls)} onPointerDown={(ev) => startGesture(ev, e)} aria-hidden />
      ))}
    </div>
  )
}
