import { useCallback, useState } from 'react'
import { AnimatePresence, MotionConfig } from 'framer-motion'
import { BootSequence } from './boot/BootSequence'
import { LoginScreen, TOKEN_KEY } from './boot/LoginScreen'
import { Desktop } from './desktop/Desktop'
import { NotificationsProvider } from './contexts/Notifications'
import { SystemProvider, useSystem } from './contexts/SystemContext'
import { WindowManagerProvider } from './contexts/WindowManager'
import { api } from './services/api'
import type { AuthStatus, SystemInfo } from './types/api'

type Stage = 'boot' | 'login' | 'desktop'

function Shell() {
  const { setInfo, startPolling } = useSystem()
  const [stage, setStage] = useState<Stage>('boot')
  const [auth, setAuth] = useState<AuthStatus | null>(null)

  const onBooted = useCallback(async (info: SystemInfo, a: AuthStatus | null) => {
    setInfo(info)
    setAuth(a)
    startPolling()
    if (a?.required) {
      let token: string | null = null
      try { token = sessionStorage.getItem(TOKEN_KEY) } catch { /* */ }
      if (token) {
        try { if ((await api.auth.verify(token)).valid) { setStage('desktop'); return } } catch { /* cai no login */ }
      }
      setStage('login')
    } else {
      setStage('desktop')
    }
  }, [setInfo, startPolling])

  const lock = useCallback(async () => {
    try { sessionStorage.removeItem(TOKEN_KEY) } catch { /* */ }
    try { await api.auth.logout() } catch { /* */ }
    try { setAuth(await api.auth.status()) } catch { /* mantém o anterior */ }
    setStage('login')
  }, [])

  return (
    <AnimatePresence mode="wait">
      {stage === 'boot' && <BootSequence key="boot" onDone={onBooted} />}
      {stage === 'login' && auth && <LoginScreen key="login" status={auth} onSuccess={() => setStage('desktop')} />}
      {stage === 'desktop' && <Desktop key="desktop" onLock={lock} canLock={!!auth?.required} />}
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <NotificationsProvider>
        <SystemProvider>
          <WindowManagerProvider>
            <Shell />
          </WindowManagerProvider>
        </SystemProvider>
      </NotificationsProvider>
    </MotionConfig>
  )
}
