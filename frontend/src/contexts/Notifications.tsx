import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, TriangleAlert, XCircle, X } from 'lucide-react'
import { cx } from '../lib/format'

export type NoticeKind = 'info' | 'success' | 'warning' | 'error'
export interface Notice { id: number; kind: NoticeKind; title: string; body?: string; at: number }

interface Ctx {
  notify: (kind: NoticeKind, title: string, body?: string) => void
  history: Notice[]
  clearHistory: () => void
}
const NotificationsCtx = createContext<Ctx | null>(null)

const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, error: XCircle }
const tones = {
  info: 'text-sky-300',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  error: 'text-rose-300',
}

let seq = 0

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Notice[]>([])
  const [history, setHistory] = useState<Notice[]>([])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((n) => n.id !== id)), [])
  const notify = useCallback((kind: NoticeKind, title: string, body?: string) => {
    const n: Notice = { id: ++seq, kind, title, body, at: Date.now() }
    setToasts((t) => [...t.slice(-3), n])
    setHistory((h) => [n, ...h].slice(0, 30))
    setTimeout(() => dismiss(n.id), kind === 'error' ? 6500 : 4200)
  }, [dismiss])
  const clearHistory = useCallback(() => setHistory([]), [])
  const value = useMemo(() => ({ notify, history, clearHistory }), [notify, history, clearHistory])

  return (
    <NotificationsCtx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed z-[9000] flex flex-col gap-2 right-3 top-3 left-3 sm:left-auto sm:top-auto sm:bottom-[64px] sm:w-[360px]">
        <AnimatePresence initial={false}>
          {toasts.map((n) => {
            const Icon = icons[n.kind]
            return (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="glass pointer-events-auto flex items-start gap-3 rounded-xl px-3.5 py-3 shadow-2xl"
                role="status"
              >
                <Icon className={cx('mt-0.5 h-4.5 w-4.5 shrink-0', tones[n.kind])} size={18} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink-50">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-300 break-words">{n.body}</p>}
                </div>
                <button onClick={() => dismiss(n.id)} className="icon-btn -mr-1 -mt-1 h-7 w-7" aria-label="Fechar notificação">
                  <X size={14} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </NotificationsCtx.Provider>
  )
}

export function useNotify() {
  const c = useContext(NotificationsCtx)
  if (!c) throw new Error('NotificationsProvider ausente')
  return c
}
