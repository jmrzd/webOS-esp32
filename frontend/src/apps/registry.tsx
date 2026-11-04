// Componentes dos apps carregados sob demanda (code splitting): cada app vira
// um arquivo .js separado na flash e só é baixado quando a janela abre.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { AppId } from './meta'

export const APP_COMPONENTS: Record<AppId, LazyExoticComponent<ComponentType>> = {
  tasks: lazy(() => import('./TaskManager')),
  scheduler: lazy(() => import('./Scheduler')),
  concurrency: lazy(() => import('./Concurrency')),
  memory: lazy(() => import('./MemoryMonitor')),
  files: lazy(() => import('./FileExplorer')),
  devices: lazy(() => import('./Devices')),
  monitor: lazy(() => import('./SystemMonitor')),
  deadlock: lazy(() => import('./Deadlock')),
  schedsim: lazy(() => import('./SchedulingSim')),
  pagingsim: lazy(() => import('./PagingSim')),
  terminal: lazy(() => import('./Terminal')),
  about: lazy(() => import('./About')),
}
