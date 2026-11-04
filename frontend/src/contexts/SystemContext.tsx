// Estado global da placa: identificação, métricas (1 s) e estado da conexão.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, errorMessage, onNetworkResult } from '../services/api'
import type { SystemInfo, SystemMetrics } from '../types/api'
import { useNotify } from './Notifications'

export type ConnState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

interface Ctx {
  info: SystemInfo | null
  setInfo: (i: SystemInfo) => void
  metrics: SystemMetrics | null
  metricsAt: number
  conn: ConnState
  latencyMs: number | null
  busy: number
  /** Executa uma ação na placa com indicador de "operação em andamento" e aviso de erro. */
  runOp: <T>(label: string, fn: () => Promise<T>, successMsg?: string) => Promise<T | undefined>
  startPolling: () => void
}

const SystemCtx = createContext<Ctx | null>(null)

export function SystemProvider({ children }: { children: ReactNode }) {
  const { notify } = useNotify()
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [metricsAt, setMetricsAt] = useState(0)
  const [conn, setConn] = useState<ConnState>('connecting')
  const [latencyMs, setLatency] = useState<number | null>(null)
  const [busy, setBusy] = useState(0)
  const [polling, setPolling] = useState(false)
  const failures = useRef(0)
  const lastConn = useRef<ConnState>('connecting')

  // Qualquer requisição (de qualquer app) informa a saúde da conexão.
  useEffect(() => onNetworkResult((ok, ms) => {
    if (ok) {
      failures.current = 0
      setLatency((prev) => (prev == null ? ms : prev * 0.7 + ms * 0.3))
      setConn('connected')
    } else {
      failures.current++
      setConn(failures.current >= 4 ? 'disconnected' : 'reconnecting')
    }
  }), [])

  useEffect(() => {
    const prev = lastConn.current
    lastConn.current = conn
    if (prev === conn || prev === 'connecting') return
    if (conn === 'disconnected') notify('error', 'Conexão com o ESP32 perdida', 'Verifique se o aparelho continua no Wi-Fi da placa. Tentando reconectar…')
    if (conn === 'connected' && (prev === 'disconnected' || prev === 'reconnecting')) notify('success', 'Conexão restabelecida')
  }, [conn, notify])

  useEffect(() => {
    if (!polling) return
    let stop = false
    let timer: ReturnType<typeof setTimeout>
    const loop = async () => {
      if (stop) return
      if (!document.hidden) {
        try {
          const m = await api.system.metrics()
          setMetrics(m)
          setMetricsAt(Date.now())
        } catch (e) {
          if (!(e as { isNetwork?: boolean }).isNetwork) setConn('error')
        }
      }
      // desconectado: tenta com menos frequência para não congestionar o AP
      if (!stop) timer = setTimeout(loop, failures.current >= 4 ? 2500 : 1000)
    }
    loop()
    return () => { stop = true; clearTimeout(timer) }
  }, [polling])

  const runOp = useCallback(async <T,>(label: string, fn: () => Promise<T>, successMsg?: string) => {
    setBusy((b) => b + 1)
    try {
      const r = await fn()
      if (successMsg) notify('success', successMsg)
      return r
    } catch (e) {
      notify('error', label, errorMessage(e))
      return undefined
    } finally {
      setBusy((b) => b - 1)
    }
  }, [notify])

  const startPolling = useCallback(() => setPolling(true), [])

  const value = useMemo(
    () => ({ info, setInfo, metrics, metricsAt, conn, latencyMs, busy, runOp, startPolling }),
    [info, metrics, metricsAt, conn, latencyMs, busy, runOp, startPolling],
  )
  return <SystemCtx.Provider value={value}>{children}</SystemCtx.Provider>
}

export function useSystem() {
  const c = useContext(SystemCtx)
  if (!c) throw new Error('SystemProvider ausente')
  return c
}
