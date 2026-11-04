// Metadados dos apps (sem importar os componentes → evita ciclos e mantém o code splitting).
import {
  Activity, CalendarRange, Cpu, FolderOpen, Gauge, Info, Layers, Lightbulb, Lock, MemoryStick, Shuffle, SquareTerminal,
  type LucideIcon,
} from 'lucide-react'

export type AppId =
  | 'tasks' | 'scheduler' | 'concurrency' | 'memory' | 'files' | 'devices'
  | 'monitor' | 'deadlock' | 'schedsim' | 'pagingsim' | 'terminal' | 'about'

export interface AppMeta {
  id: AppId
  title: string
  short: string            // rótulo do ícone
  icon: LucideIcon
  hue: string              // cor do símbolo no ícone
  group: string            // agrupamento do menu Iniciar (por aula)
  lesson: string
  bonus: boolean
  simulation?: boolean     // roda no navegador (não usa a placa)
  size: [number, number]   // tamanho inicial (px)
  summary: string
}

export const GROUPS = [
  'Processos e escalonamento · Aula 7',
  'Concorrência · Aula 8',
  'Memória · Aula 9',
  'Arquivos e E/S · Aulas 4 e 10',
  'Sistema · Aulas 2 e 3',
] as const

export const APPS: AppMeta[] = [
  { id: 'tasks', title: 'Gerenciador de Tarefas', short: 'Gerenciador de Tarefas', icon: Cpu, hue: '#3b8fe3', group: GROUPS[0], lesson: 'Aula 7 · Processos', bonus: false, size: [920, 640], summary: 'Tarefas reais do FreeRTOS: estados, prioridades, pilha' },
  { id: 'scheduler', title: 'Escalonador ao vivo', short: 'Escalonador ao vivo', icon: Activity, hue: '#1aae8a', group: GROUPS[0], lesson: 'Aula 7 · Escalonamento', bonus: false, size: [820, 640], summary: 'Prioridade, preempção, Round-Robin e inanição' },
  { id: 'schedsim', title: 'Simulador de Escalonamento', short: 'Simulador de Escalonamento', icon: CalendarRange, hue: '#7c6fe6', group: GROUPS[0], lesson: 'Aula 7 · Algoritmos', bonus: true, simulation: true, size: [900, 660], summary: 'FCFS, SJF e Round-Robin com diagrama de Gantt' },
  { id: 'concurrency', title: 'Laboratório de Concorrência', short: 'Laboratório de Concorrência', icon: Shuffle, hue: '#ee8a3a', group: GROUPS[1], lesson: 'Aula 8 · Concorrência', bonus: false, size: [820, 680], summary: 'Condição de corrida real entre os dois núcleos' },
  { id: 'deadlock', title: 'Deadlock', short: 'Deadlock', icon: Lock, hue: '#e2566a', group: GROUPS[1], lesson: 'Aula 8 · Deadlocks', bonus: true, size: [860, 660], summary: 'Espera circular, detecção, prevenção e recuperação' },
  { id: 'memory', title: 'Monitor de Memória', short: 'Monitor de Memória', icon: MemoryStick, hue: '#bd5fd6', group: GROUPS[2], lesson: 'Aula 9 · Memória', bonus: false, size: [860, 680], summary: 'Heap real: alocação, liberação e fragmentação' },
  { id: 'pagingsim', title: 'Simulador de Paginação', short: 'Simulador de Paginação', icon: Layers, hue: '#7c6fe6', group: GROUPS[2], lesson: 'Aula 9 · Memória virtual', bonus: true, simulation: true, size: [900, 660], summary: 'FIFO, LRU e Ótimo contando faltas de página' },
  { id: 'files', title: 'Explorador de Arquivos', short: 'Explorador de Arquivos', icon: FolderOpen, hue: '#e3a535', group: GROUPS[3], lesson: 'Aulas 4 e 10 · Arquivos', bonus: false, size: [900, 640], summary: 'LittleFS na flash: arquivos persistentes e partições' },
  { id: 'devices', title: 'Gerenciador de Dispositivos', short: 'Gerenciador de Dispositivos', icon: Lightbulb, hue: '#d4a91f', group: GROUPS[3], lesson: 'Aula 10 · Entrada e saída', bonus: false, size: [820, 680], summary: 'LED (saída) e botão BOOT por interrupção' },
  { id: 'monitor', title: 'Monitor do Sistema', short: 'Monitor do Sistema', icon: Gauge, hue: '#5fae3e', group: GROUPS[4], lesson: 'Aula 2 · SO como gerenciador de recursos', bonus: true, size: [820, 640], summary: 'Heap ao longo do tempo, tarefas, CPU e aparelhos' },
  { id: 'terminal', title: 'Terminal', short: 'Terminal', icon: SquareTerminal, hue: '#4b535d', group: GROUPS[4], lesson: 'Aula 3 · Shell', bonus: true, size: [780, 520], summary: 'ps, kill, mem, ls, cat executados na placa' },
  { id: 'about', title: 'Sobre o WebOS', short: 'Sobre o WebOS', icon: Info, hue: '#2aa5c7', group: GROUPS[4], lesson: 'Aula 3 · Estrutura do SO', bonus: true, size: [860, 660], summary: 'Arquitetura em camadas, hardware, grupo e login' },
]

export const APP_BY_ID = Object.fromEntries(APPS.map((a) => [a.id, a])) as Record<AppId, AppMeta>
