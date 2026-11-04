import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../services/api'
import { useWindowActive } from '../contexts/WindowManager'

// Busca periódica encadeada: a próxima só é agendada quando a anterior termina
// (nunca empilha requisições). Pausa com a aba oculta ou a janela minimizada.
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs = 1000, enabled = true) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const active = useWindowActive()
  const fetchRef = useRef(fetcher)
  useEffect(() => { fetchRef.current = fetcher })

  const refresh = useCallback(async () => {
    try {
      const d = await fetchRef.current()
      setData(d)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !active) return
    let stop = false
    let timer: ReturnType<typeof setTimeout>
    const loop = async () => {
      if (stop) return
      if (!document.hidden) await refresh()
      if (!stop) timer = setTimeout(loop, intervalMs)
    }
    loop()
    return () => { stop = true; clearTimeout(timer) }
  }, [enabled, active, intervalMs, refresh])

  return { data, setData, error, loading, refresh }
}
