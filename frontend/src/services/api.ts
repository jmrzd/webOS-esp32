// =============================================================================
//  Cliente HTTP centralizado. Nenhum componente chama fetch() diretamente.
//  - timeout por requisição (AbortController)
//  - fila com no máximo 2 requisições simultâneas: o servidor do ESP32 atende
//    um cliente por vez; rajadas causariam timeouts em cascata
//  - GETs idênticos em andamento são compartilhados (deduplicação)
//  - cada sucesso/falha alimenta o monitor de conexão
// =============================================================================
import type {
  ApiEnvelope, AuthStatus, ConcurrencyState, DeadlockState, DevicesState, ButtonState, LedState, FileContent, FileList,
  MemoryState, PartitionTable, SchedulerState, SystemHealth, SystemInfo, SystemMetrics, TaskList, TerminalResult,
} from '../types/api'

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
  get isNetwork() { return this.status === 0 }
}

type Listener = (ok: boolean, latencyMs: number) => void
const listeners = new Set<Listener>()
export function onNetworkResult(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn) } }
const emit = (ok: boolean, ms: number) => listeners.forEach((l) => l(ok, ms))

// Servido pelo próprio ESP32 → mesma origem. Aberto como arquivo local → endereço padrão do AP.
const BASE = typeof location !== 'undefined' && location.protocol === 'file:' ? 'http://192.168.4.1' : ''
export const BOARD_ADDRESS = BASE || (typeof location !== 'undefined' ? location.host : '192.168.4.1')

const MAX_IN_FLIGHT = 2
let inFlight = 0
const waiting: Array<() => void> = []
function acquire(): Promise<void> {
  if (inFlight < MAX_IN_FLIGHT) { inFlight++; return Promise.resolve() }
  return new Promise((res) => waiting.push(() => { inFlight++; res() }))
}
function release() {
  inFlight--
  const next = waiting.shift()
  if (next) next()
}

const pendingGets = new Map<string, Promise<unknown>>()

type Params = Record<string, string | number | boolean | undefined>
function encode(params?: Params) {
  const sp = new URLSearchParams()
  if (params) for (const [k, v] of Object.entries(params)) if (v !== undefined) sp.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v))
  return sp
}

async function request<T>(method: 'GET' | 'POST', path: string, params?: Params, timeoutMs = 4500): Promise<T> {
  await acquire()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const t0 = performance.now()
  try {
    let url = BASE + path
    const init: RequestInit = { method, signal: ctrl.signal, cache: 'no-store' }
    if (method === 'GET') {
      const qs = encode(params).toString()
      if (qs) url += '?' + qs
    } else {
      init.body = encode(params)   // application/x-www-form-urlencoded
    }
    let res: Response
    try {
      res = await fetch(url, init)
    } catch (e) {
      emit(false, 0)
      const aborted = (e as Error).name === 'AbortError'
      throw new ApiError(aborted ? 'timeout' : 'network', aborted ? `sem resposta da placa em ${timeoutMs / 1000}s` : 'não foi possível falar com a placa', 0)
    }
    let body: ApiEnvelope<T>
    try {
      body = (await res.json()) as ApiEnvelope<T>
    } catch {
      emit(true, performance.now() - t0)
      throw new ApiError('bad_response', `resposta inválida (HTTP ${res.status})`, res.status)
    }
    emit(true, performance.now() - t0)
    if (!body.ok) throw new ApiError(body.error.code, body.error.message, res.status)
    return body.data
  } finally {
    clearTimeout(timer)
    release()
  }
}

function get<T>(path: string, params?: Params, timeoutMs?: number): Promise<T> {
  const key = path + '?' + encode(params).toString()
  const existing = pendingGets.get(key)
  if (existing) return existing as Promise<T>
  const p = request<T>('GET', path, params, timeoutMs).finally(() => pendingGets.delete(key))
  pendingGets.set(key, p)
  return p
}
const post = <T>(path: string, params?: Params, timeoutMs?: number) => request<T>('POST', path, params, timeoutMs)

export const api = {
  system: {
    info: () => get<SystemInfo>('/api/system/info'),
    health: (timeoutMs?: number) => get<SystemHealth>('/api/system/health', undefined, timeoutMs),
    metrics: () => get<SystemMetrics>('/api/system/metrics'),
    partitions: () => get<PartitionTable>('/api/system/partitions'),
    restart: () => post<{ message: string }>('/api/system/restart'),
  },
  tasks: {
    list: () => get<TaskList>('/api/tasks'),
    create: (type: 'cpu' | 'contador', priority: number, name?: string) => post<{ pid: number; name: string }>('/api/tasks', { type, priority, name: name || undefined }),
    suspend: (pid: number) => post<{ message: string }>('/api/tasks/suspend', { pid }),
    resume: (pid: number) => post<{ message: string }>('/api/tasks/resume', { pid }),
    remove: (pid: number) => post<{ message: string }>('/api/tasks/delete', { pid }),
    priority: (pid: number, priority: number) => post<{ message: string }>('/api/tasks/priority', { pid, priority }),
  },
  scheduler: {
    get: () => get<SchedulerState>('/api/scheduler'),
    start: (scenario: number) => post<SchedulerState>('/api/scheduler/start', { scenario }),
    stop: () => post<SchedulerState>('/api/scheduler/stop'),
    task: (id: number, action: 'suspend' | 'resume' | 'prio', priority?: number) => post<SchedulerState>('/api/scheduler/task', { id, action, priority }),
    aging: (enabled: boolean) => post<SchedulerState>('/api/scheduler/aging', { enabled }),
  },
  concurrency: {
    get: () => get<ConcurrencyState>('/api/concurrency'),
    start: (n: number, mutex: boolean) => post<ConcurrencyState>('/api/concurrency/start', { n, mutex }),
    stop: () => post<ConcurrencyState>('/api/concurrency/stop'),
    reset: () => post<ConcurrencyState>('/api/concurrency/reset'),
  },
  memory: {
    get: () => get<MemoryState>('/api/memory'),
    allocate: (kb: number) => post<MemoryState>('/api/memory/allocate', { kb }),
    free: (mode: 'one' | 'all' | 'alternate', id?: number) => post<MemoryState>('/api/memory/free', { mode, id }),
    fragment: () => post<MemoryState>('/api/memory/fragment', undefined, 8000),
  },
  files: {
    list: (dir = '/') => get<FileList>('/api/files', { dir }),
    read: (path: string) => get<FileContent>('/api/files/read', { path }, 8000),
    create: (path: string, type: 'file' | 'dir', content = '') => post<{ path: string }>('/api/files/create', { path, type, content }, 8000),
    write: (path: string, content: string) => post<{ path: string; size: number }>('/api/files/write', { path, content }, 10000),
    remove: (path: string) => post<{ path: string }>('/api/files/delete', { path }, 8000),
  },
  devices: {
    get: () => get<DevicesState>('/api/devices'),
    button: () => get<{ button: ButtonState }>('/api/devices/button'),
    resetButton: () => post<{ button: ButtonState }>('/api/devices/button/reset'),
    led: (state: 'on' | 'off' | 'toggle') => post<{ led: LedState }>('/api/devices/led', { state }),
    config: (ledPin: number, activeLow: boolean) => post<{ led: LedState }>('/api/devices/config', { ledPin, activeLow }),
  },
  deadlock: {
    get: () => get<DeadlockState>('/api/deadlock'),
    start: (mode: 'deadlock' | 'ordered', autoRecover: boolean) => post<DeadlockState>('/api/deadlock/start', { mode, autoRecover }),
    recover: () => post<DeadlockState>('/api/deadlock/recover'),
    stop: () => post<DeadlockState>('/api/deadlock/stop'),
  },
  terminal: {
    exec: (cmd: string) => post<TerminalResult>('/api/terminal/execute', { cmd }, 6000),
  },
  auth: {
    status: () => get<AuthStatus>('/api/auth/status'),
    login: (user: string, pass: string) => post<{ token: string; user: string }>('/api/auth/login', { user, pass }),
    verify: (token: string) => post<{ valid: boolean }>('/api/auth/verify', { token }),
    logout: () => post<{ loggedOut: boolean }>('/api/auth/logout'),
    config: (p: { currentPass: string; newUser?: string; newPass?: string; required?: boolean }) => post<AuthStatus>('/api/auth/config', p),
  },
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return String(e)
}
