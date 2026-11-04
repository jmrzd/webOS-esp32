// Gerenciador de janelas: abrir, focar (z-index), mover, redimensionar,
// minimizar, maximizar/restaurar e fechar. Uma instância por app.
import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react'
import { APP_BY_ID, type AppId } from '../apps/meta'

export interface Rect { x: number; y: number; w: number; h: number }
export interface WinState extends Rect {
  id: AppId
  z: number
  minimized: boolean
  maximized: boolean
}

type Action =
  | { t: 'open'; id: AppId; vw: number; vh: number }
  | { t: 'close'; id: AppId }
  | { t: 'focus'; id: AppId }
  | { t: 'minimize'; id: AppId }
  | { t: 'toggleMax'; id: AppId }
  | { t: 'rect'; id: AppId; rect: Rect }
  | { t: 'minimizeAll' }

interface State { wins: WinState[]; zTop: number; opened: number }

export const TASKBAR_H = 58
const MIN_W = 340
const MIN_H = 240

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case 'open': {
      const ex = s.wins.find((w) => w.id === a.id)
      const z = s.zTop + 1
      if (ex) return { ...s, zTop: z, wins: s.wins.map((w) => (w.id === a.id ? { ...w, minimized: false, z } : w)) }
      const [dw, dh] = APP_BY_ID[a.id].size
      const w = Math.max(MIN_W, Math.min(dw, a.vw - 24))
      const h = Math.max(MIN_H, Math.min(dh, a.vh - TASKBAR_H - 24))
      const step = (s.opened % 7) * 30
      const x = Math.max(8, Math.min(a.vw - w - 8, Math.round((a.vw - w) / 2) - 90 + step))
      const y = Math.max(8, Math.min(a.vh - TASKBAR_H - h - 8, 28 + step))
      return { zTop: z, opened: s.opened + 1, wins: [...s.wins, { id: a.id, x, y, w, h, z, minimized: false, maximized: false }] }
    }
    case 'close':
      return { ...s, wins: s.wins.filter((w) => w.id !== a.id) }
    case 'focus': {
      const top = s.wins.reduce((m, w) => Math.max(m, w.z), 0)
      const cur = s.wins.find((w) => w.id === a.id)
      if (cur && cur.z === top && !cur.minimized) return s
      const z = s.zTop + 1
      return { ...s, zTop: z, wins: s.wins.map((w) => (w.id === a.id ? { ...w, z, minimized: false } : w)) }
    }
    case 'minimize':
      return { ...s, wins: s.wins.map((w) => (w.id === a.id ? { ...w, minimized: true } : w)) }
    case 'minimizeAll':
      return { ...s, wins: s.wins.map((w) => ({ ...w, minimized: true })) }
    case 'toggleMax': {
      const z = s.zTop + 1
      return { ...s, zTop: z, wins: s.wins.map((w) => (w.id === a.id ? { ...w, maximized: !w.maximized, minimized: false, z } : w)) }
    }
    case 'rect':
      return {
        ...s,
        wins: s.wins.map((w) => (w.id === a.id ? { ...w, ...a.rect, w: Math.max(MIN_W, a.rect.w), h: Math.max(MIN_H, a.rect.h) } : w)),
      }
  }
}

interface Ctx {
  wins: WinState[]
  focusedId: AppId | null
  open: (id: AppId) => void
  close: (id: AppId) => void
  focus: (id: AppId) => void
  minimize: (id: AppId) => void
  toggleMax: (id: AppId) => void
  setRect: (id: AppId, r: Rect) => void
  minimizeAll: () => void
  /** clique no botão da barra de tarefas: foca, ou minimiza se já estiver em foco */
  taskbarClick: (id: AppId) => void
}

const WMCtx = createContext<Ctx | null>(null)

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { wins: [], zTop: 10, opened: 0 })
  const focusedId = useMemo(() => {
    const vis = state.wins.filter((w) => !w.minimized)
    if (!vis.length) return null
    return vis.reduce((a, b) => (a.z > b.z ? a : b)).id
  }, [state.wins])

  const open = useCallback((id: AppId) => dispatch({ t: 'open', id, vw: window.innerWidth, vh: window.innerHeight }), [])
  const close = useCallback((id: AppId) => dispatch({ t: 'close', id }), [])
  const focus = useCallback((id: AppId) => dispatch({ t: 'focus', id }), [])
  const minimize = useCallback((id: AppId) => dispatch({ t: 'minimize', id }), [])
  const toggleMax = useCallback((id: AppId) => dispatch({ t: 'toggleMax', id }), [])
  const setRect = useCallback((id: AppId, rect: Rect) => dispatch({ t: 'rect', id, rect }), [])
  const minimizeAll = useCallback(() => dispatch({ t: 'minimizeAll' }), [])
  const taskbarClick = useCallback((id: AppId) => {
    const w = state.wins.find((x) => x.id === id)
    if (!w) return
    if (!w.minimized && focusedId === id) dispatch({ t: 'minimize', id })
    else dispatch({ t: 'focus', id })
  }, [state.wins, focusedId])

  const value = useMemo(
    () => ({ wins: state.wins, focusedId, open, close, focus, minimize, toggleMax, setRect, minimizeAll, taskbarClick }),
    [state.wins, focusedId, open, close, focus, minimize, toggleMax, setRect, minimizeAll, taskbarClick],
  )
  return <WMCtx.Provider value={value}>{children}</WMCtx.Provider>
}

export function useWM() {
  const c = useContext(WMCtx)
  if (!c) throw new Error('WindowManagerProvider ausente')
  return c
}

// Cada janela informa se está visível; apps pausam o polling quando minimizados.
const ActiveCtx = createContext(true)
export const WindowActiveProvider = ActiveCtx.Provider
export const useWindowActive = () => useContext(ActiveCtx)
