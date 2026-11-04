// Contratos JSON da API do ESP32 (espelham o firmware em firmware/WebOS_ESP32).
// Toda resposta: { ok: true, data } | { ok: false, error: { code, message } }

export interface ApiEnvelopeOk<T> { ok: true; data: T }
export interface ApiEnvelopeErr { ok: false; error: { code: string; message: string } }
export type ApiEnvelope<T> = ApiEnvelopeOk<T> | ApiEnvelopeErr

export interface HeapInfo {
  total: number
  free: number
  minFree: number
  largestBlock: number
  allocatedBlocks: number
  freeBlocks: number
  psramTotal: number
  psramFree: number
}

export interface SystemInfo {
  name: string
  version: string
  build: string
  chip: { model: string; revision: number; cores: number; cpuMHz: number; flashBytes: number; flashMHz: number; psramBytes: number; mac: string }
  sdk: string
  arduinoCore: string | null
  freertos: { kernel: string; tickHz: number; maxPriorities: number; tasks: number }
  capabilities: { traceFacility: boolean; runtimeStats: boolean; dualCore: boolean; littlefs: boolean }
  network: { mode: string; ssid: string; ip: string; channel: number; hostname: string; stations: number; maxStations: number }
  hardware: { ledPin: number; buttonPin: number }
  uptimeMs: number
  heap: HeapInfo
}

export interface SystemHealth { status: string; uptimeMs: number; freeHeap: number; samples: number }

export interface SystemMetrics {
  uptimeMs: number
  heap: HeapInfo
  tasks: number
  stations: number
  cpu: { core0: number | null; core1: number | null; measured: boolean }
  fs: { mounted: boolean; used: number; total: number }
  heapHistory: number[]
  led: boolean
  demoCoreBusy: number
  rateLimited: number
}

export interface Partition { label: string; type: string; subtype: string; offset: number; size: number; running: boolean; filesystem: boolean }
export interface PartitionTable { flashBytes: number; partitions: Partition[] }

export type TaskStateName = 'executando' | 'pronta' | 'bloqueada' | 'suspensa' | 'finalizada' | 'invalida'

export interface TaskInfo {
  pid: number
  name: string
  state: TaskStateName
  priority: number
  basePriority: number
  core: number            // -1 = sem afinidade (qualquer núcleo)
  stackFree: number       // bytes
  cpu: number | null      // % no último segundo
  user: boolean
  type: 'cpu' | 'contador' | 'sistema' | 'escalonador'
  counter: number | null
  rate: number | null
  protected: boolean
  protectedReason?: string
}

export interface TaskList {
  total: number
  maxUserTasks: number
  prioMin: number
  prioMax: number
  traceFacility: boolean
  runtimeStats: boolean
  tasks: TaskInfo[]
}

export interface SchedTask {
  id: number
  name: string
  state: TaskStateName | 'parada'
  priority: number
  basePriority: number
  pid: number | null
  loopsPerSec: number
  loops: number
  suspended: boolean
  aged: boolean
  starvedSecs: number
  cpu: number | null
}

export interface SchedulerState {
  running: boolean
  scenario: number
  aging: boolean
  agingBoosts: number
  cpuMethod: 'runtime' | 'voltas'
  core: number
  elapsedMs: number
  maxSeconds: number
  otherCpuTasks: number
  lastEvent: string
  tasks: SchedTask[]
}

export interface LabResult {
  id: number
  version: 'sem mutex' | 'com mutex'
  mutex: boolean
  n: number
  expected: number
  obtained: number
  lost: number
  lostPct: number
  elapsedMs: number
  aborted: boolean
  sameCore: boolean
}

export interface ConcurrencyState {
  running: boolean
  dualCore: boolean
  current: { mutex: boolean; n: number; progress0: number; progress1: number; counter: number; elapsedMs: number } | null
  history: LabResult[]
}

export interface MemBlock { id: number; size: number; address: number; ageMs: number }
export interface MemoryState {
  heap: { total: number; free: number; used: number; minFree: number; largestBlock: number; freeBlocks: number; allocatedBlocks: number; fragmentationPct: number }
  app: { blocks: number; bytesHeld: number; bytesAllocatedTotal: number; bytesFreedTotal: number; allocOps: number; freeOps: number; refused: number; reserveBytes: number; maxBlocks: number }
  lastEvent: string
  blocks: MemBlock[]
  history: number[]
}

export interface FileEntry { name: string; path: string; isDir: boolean; size: number; protected: boolean; modified: number }
export interface FileList { dir: string; used: number; total: number; maxFileBytes: number; partition: string; entries: FileEntry[] }
export interface FileContent { path: string; size: number; binary: boolean; protected: boolean; content: string | null; truncated: boolean }

export interface LedState { pin: number; activeLow: boolean; on: boolean; toggles: number; level: number; allowedPins: number[] }
export interface ButtonPress { atMs: number; sinceLastMs: number; bounces: number }
export interface ButtonState {
  pin: number
  trigger: string
  pullup: boolean
  pressedNow: boolean
  interrupts: number
  valid: number
  filtered: number
  dropped: number
  queued: number
  debounceMs: number
  lastValidMs: number
  nowMs: number
  driverState: string | null
  history: ButtonPress[]
}
export interface DevicesState { led: LedState; button: ButtonState }

export interface DeadlockState {
  running: boolean
  mode: 'deadlock' | 'ordered'
  autoRecover: boolean
  deadlock: boolean
  detected: boolean
  detections: number
  recoveries: number
  elapsedMs: number
  cycleForMs: number
  detectAfterMs: number
  autoRecoverAfterMs: number
  mutexes: { name: 'M1' | 'M2'; holder: 'A' | 'B' | null }[]
  tasks: { name: 'A' | 'B'; phase: string; rounds: number; waitingFor: 'M1' | 'M2' | null; order: string; state: string }[]
  log: string[]
}

export interface TerminalResult { cmd: string; output: string; exitCode: number }

export interface AuthStatus { required: boolean; user: string; locked: boolean; lockRemainingMs: number; defaultPassword: boolean; algorithm: string }
