// =============================================================================
//  SERVIDOR DE TESTES (MOCK) — SOMENTE PARA DESENVOLVIMENTO NO PC
//  Imita o contrato da API do firmware para testar a interface sem a placa.
//  Os números aqui são FALSOS e o modelo do chip aparece como "MOCK" para que
//  nunca sejam confundidos com dados reais. Não faz parte do que é gravado no ESP32.
//  Uso: npm run mock   →  http://localhost:8787  (serve também firmware/WebOS_ESP32/data/www, como a placa)
// =============================================================================
import http from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT || 8787)
const WWW = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'firmware', 'WebOS_ESP32', 'data', 'www')
const t0 = Date.now()
const up = () => Date.now() - t0
const rnd = (a, b) => a + Math.random() * (b - a)

// ------------------------------------------------------------------ estado
const HEAP_TOTAL = 300 * 1024
let heapFree = 128 * 1024, heapMin = 118 * 1024
const hist = []
const sysTasks = [
  ['loopTask', 1, 1, 5200], ['webos-monitor', 4, 1, 2100], ['driver-botao', 3, 1, 1700], ['IDLE0', 0, 0, 900], ['IDLE1', 0, 1, 900],
  ['tiT', 18, -1, 1900], ['wifi', 23, 0, 3600], ['sys_evt', 20, 0, 2400], ['esp_timer', 22, 0, 3300], ['ipc0', 24, 0, 600], ['ipc1', 24, 1, 600],
].map(([name, p, core, st], i) => ({ pid: i + 1, name, priority: p, basePriority: p, core, stackFree: st, state: name.startsWith('IDLE') ? 'pronta' : 'bloqueada', user: false, type: 'sistema', counter: null, rate: null, protected: true, protectedReason: 'tarefa do sistema' }))
let pidSeq = 20
const userTasks = []
const sched = { running: false, scenario: 0, aging: false, agingBoosts: 0, startedAt: 0, lastEvent: '', tasks: [0, 1, 2].map((id) => ({ id, name: ['baixa', 'media', 'alta'][id], priority: 1, basePriority: 1, suspended: false, aged: false, loops: 0 })) }
const lab = { running: false, current: null, history: [], id: 0 }
const mem = { blocks: [], next: 1, alloc: 0, freed: 0, aOps: 0, fOps: 0, refused: 0, last: '' }
const files = new Map([
  ['/leia-me.txt', 'Bem-vindo ao WebOS ESP32 (MOCK).\n'],
  ['/grupo.json', JSON.stringify({ grupo: 'Grupo de teste', turma: '', disciplina: 'Introdução a Sistemas Operacionais', professor: 'Prof. Joelmir Ramos (Joel)', integrantes: [] }, null, 2)],
  ['/notas/', null],
])
const dev = { led: false, pin: 2, low: false, toggles: 0, irq: 0, valid: 0, filtered: 0, hist: [] }
const dl = { running: false, mode: 'deadlock', auto: true, start: 0, detected: false, recoveries: 0, detections: 0, log: [], rounds: [0, 0], victim: false }
const auth = { required: false, user: 'admin', pass: 'webos', token: '' }

setInterval(() => {
  heapFree = Math.max(60 * 1024, Math.min(HEAP_TOTAL, heapFree + rnd(-900, 900)))
  heapMin = Math.min(heapMin, heapFree)
  hist.push(Math.round(heapFree)); if (hist.length > 60) hist.shift()
  for (const t of userTasks) { const inc = t.suspended ? 0 : t.type === 'contador' ? 10 : Math.round(rnd(80, 90)); t.rate = inc; t.counter += inc }
  if (sched.running) for (const t of sched.tasks) t.loops += 1
  // botão: um aperto falso a cada ~7 s com repiques
  if (Math.random() < 0.15) { const b = Math.floor(rnd(1, 5)); dev.irq += b; dev.valid++; dev.filtered += b - 1; dev.hist.unshift({ atMs: up(), sinceLastMs: 0, bounces: b - 1 }); dev.hist = dev.hist.slice(0, 16) }
}, 1000)

const heap = () => ({ total: HEAP_TOTAL, free: Math.round(heapFree), minFree: Math.round(heapMin), largestBlock: Math.round(mem.blocks.length > 3 ? heapFree * 0.35 : heapFree * 0.85), allocatedBlocks: 400 + mem.blocks.length, freeBlocks: mem.blocks.length > 3 ? 9 : 3, psramTotal: 0, psramFree: 0 })

// ------------------------------------------------------------------ rotas
const ok = (data) => ({ code: 200, body: { ok: true, data } })
const err = (code, c, message) => ({ code, body: { ok: false, error: { code: c, message } } })

function schedState() {
  const active = sched.tasks.filter((t) => !t.suspended)
  const top = Math.max(0, ...active.map((t) => t.priority))
  const winners = active.filter((t) => t.priority === top)
  return {
    running: sched.running, scenario: sched.scenario, aging: sched.aging, agingBoosts: sched.agingBoosts, cpuMethod: 'runtime', core: 0,
    elapsedMs: sched.running ? up() - sched.startedAt : 0, maxSeconds: 180, otherCpuTasks: userTasks.filter((t) => t.type === 'cpu').length, lastEvent: sched.lastEvent,
    tasks: sched.tasks.map((t) => {
      const share = sched.running && !t.suspended && t.priority === top ? 98 / winners.length : 0
      return { id: t.id, name: t.name, state: !sched.running ? 'parada' : t.suspended ? 'suspensa' : share > 0 ? (winners.length > 1 ? (Math.random() < 1 / winners.length ? 'executando' : 'pronta') : 'executando') : 'pronta',
        priority: t.priority, basePriority: t.basePriority, pid: sched.running ? 30 + t.id : null, loopsPerSec: Math.round(share * 812), loops: t.loops, suspended: t.suspended, aged: t.aged, starvedSecs: share ? 0 : 3,
        cpu: sched.running ? +(share + (share ? rnd(-1.2, 1.2) : 0)).toFixed(1) : null }
    }),
  }
}

function memState() {
  const held = mem.blocks.reduce((s, b) => s + b.size, 0)
  const h = heap()
  return { heap: { total: h.total, free: h.free, used: h.total - h.free, minFree: h.minFree, largestBlock: h.largestBlock, freeBlocks: h.freeBlocks, allocatedBlocks: h.allocatedBlocks, fragmentationPct: +(100 * (1 - h.largestBlock / h.free)).toFixed(1) },
    app: { blocks: mem.blocks.length, bytesHeld: held, bytesAllocatedTotal: mem.alloc, bytesFreedTotal: mem.freed, allocOps: mem.aOps, freeOps: mem.fOps, refused: mem.refused, reserveBytes: 40960, maxBlocks: 48 },
    lastEvent: mem.last, blocks: mem.blocks.map((b) => ({ ...b, ageMs: up() - b.at })), history: hist }
}
const freeBlock = (i) => { const b = mem.blocks.splice(i, 1)[0]; heapFree += b.size + 16; mem.freed += b.size; mem.fOps++ }

function dlState() {
  const t = up() - dl.start
  const deadlock = dl.running && dl.mode === 'deadlock' && !dl.victim && t > 300
  const cycleFor = deadlock ? t - 300 : 0
  if (deadlock && !dl.detected && cycleFor > 1000) { dl.detected = true; dl.detections++; dl.log.unshift(`[${(t / 1000).toFixed(1)}s] DEADLOCK: A espera M2 (de B) e B espera M1 (de A)`) }
  if (deadlock && dl.auto && cycleFor > 9000) recoverDl('watchdog')
  if (dl.running && dl.mode === 'ordered') { dl.rounds = [Math.min(25, Math.floor(t / 70)), Math.min(25, Math.floor(t / 75))]; if (dl.rounds[0] >= 25 && dl.rounds[1] >= 25) { dl.running = false; dl.log.unshift('fim: 25 + 25 rodadas, nenhum deadlock') } }
  return { running: dl.running, mode: dl.mode, autoRecover: dl.auto, deadlock, detected: dl.detected, detections: dl.detections, recoveries: dl.recoveries, elapsedMs: dl.running ? t : 0, cycleForMs: cycleFor, detectAfterMs: 1000, autoRecoverAfterMs: 8000,
    mutexes: [{ name: 'M1', holder: deadlock ? 'A' : null }, { name: 'M2', holder: deadlock ? 'B' : null }],
    tasks: [{ name: 'A', phase: deadlock ? 'esperando o 2º mutex' : dl.running ? 'com os dois mutex' : 'terminou', rounds: dl.rounds[0], waitingFor: deadlock ? 'M2' : null, order: 'M1 → M2', state: dl.running ? 'bloqueada' : 'finalizada' },
      { name: 'B', phase: dl.victim ? 'vítima (liberou e saiu)' : deadlock ? 'esperando o 2º mutex' : dl.running ? 'pegando o 1º mutex' : 'terminou', rounds: dl.rounds[1], waitingFor: deadlock ? 'M1' : null, order: dl.mode === 'ordered' ? 'M1 → M2' : 'M2 → M1', state: dl.running && !dl.victim ? 'bloqueada' : 'finalizada' }],
    log: dl.log.slice(0, 12) }
}
function recoverDl(why) { dl.victim = true; dl.recoveries++; dl.running = false; dl.log.unshift(`recuperação (${why}): B escolhida como vítima`, 'A concluiu a rodada após a recuperação') }

function listDir(dir) {
  const pre = dir === '/' ? '/' : dir + '/'
  const out = new Map()
  for (const [p, c] of files) {
    if (!p.startsWith(pre) || p === pre) continue
    const rest = p.slice(pre.length).replace(/\/$/, '')
    const name = rest.split('/')[0]
    const isDir = rest.includes('/') || c === null
    out.set(name, { name, path: pre + name, isDir, size: isDir ? 0 : Buffer.byteLength(c), protected: false, modified: 0 })
  }
  if (dir === '/') out.set('www', { name: 'www', path: '/www', isDir: true, size: 0, protected: true, modified: 0 })
  return [...out.values()]
}

function route(method, path, q) {
  const n = (k) => Number(q.get(k))
  switch (`${method} ${path}`) {
    case 'GET /api/system/health': return ok({ status: 'ok', uptimeMs: up(), freeHeap: Math.round(heapFree), samples: Math.floor(up() / 1000) })
    case 'GET /api/system/info': return ok({ name: 'WebOS ESP32', version: '1.0.0', build: 'MOCK', chip: { model: 'MOCK (servidor de testes)', revision: 0, cores: 2, cpuMHz: 240, flashBytes: 4194304, flashMHz: 80, psramBytes: 0, mac: '00:00:00:00:00:00' }, sdk: 'mock', arduinoCore: 'mock', freertos: { kernel: 'mock', tickHz: 1000, maxPriorities: 25, tasks: sysTasks.length + userTasks.length }, capabilities: { traceFacility: true, runtimeStats: true, dualCore: true, littlefs: true }, network: { mode: 'access-point', ssid: 'WebOS-ESP32-MOCK', ip: '192.168.4.1', channel: 6, hostname: 'webos.local', stations: 1, maxStations: 4 }, hardware: { ledPin: dev.pin, buttonPin: 0 }, uptimeMs: up(), heap: heap() })
    case 'GET /api/system/metrics': return ok({ uptimeMs: up(), heap: heap(), tasks: sysTasks.length + userTasks.length + (sched.running ? 3 : 0), stations: 1, cpu: { core0: sched.running ? 99.1 : +rnd(2, 6).toFixed(1), core1: +rnd(4, 12).toFixed(1), measured: true }, fs: { mounted: true, used: 245760, total: 1441792 }, heapHistory: hist, led: dev.led, demoCoreBusy: (sched.running ? 3 : 0) + userTasks.filter((t) => t.type === 'cpu').length, rateLimited: 0 })
    case 'GET /api/system/partitions': return ok({ flashBytes: 4194304, partitions: [['nvs', 'data', 'nvs', 0x9000, 0x5000], ['otadata', 'data', 'otadata', 0xe000, 0x2000], ['app0', 'app', 'ota', 0x10000, 0x140000], ['app1', 'app', 'ota', 0x150000, 0x140000], ['spiffs', 'data', 'spiffs', 0x290000, 0x160000], ['coredump', 'data', 'coredump', 0x3f0000, 0x10000]].map(([label, type, subtype, offset, size]) => ({ label, type, subtype, offset, size, running: label === 'app0', filesystem: label === 'spiffs' })) })
    case 'POST /api/system/restart': return ok({ message: 'mock: reinício ignorado' })
    case 'GET /api/tasks': {
      const sys = sysTasks.map((t) => ({ ...t, cpu: t.name === 'IDLE1' ? +rnd(85, 95).toFixed(1) : t.name === 'IDLE0' ? (sched.running ? 0 : 95) : +rnd(0, 2).toFixed(1), state: t.name === 'loopTask' ? 'executando' : t.state }))
      const user = userTasks.map((t) => ({ pid: t.pid, name: t.name, state: t.suspended ? 'suspensa' : t.type === 'contador' ? 'bloqueada' : 'pronta', priority: t.priority, basePriority: t.priority, core: t.type === 'cpu' ? 0 : 1, stackFree: 1800, cpu: t.type === 'cpu' && !t.suspended ? 50 : 0.1, user: true, type: t.type, counter: t.counter, rate: t.rate, protected: false }))
      return ok({ total: sys.length + user.length, maxUserTasks: 12, prioMin: 1, prioMax: 8, traceFacility: true, runtimeStats: true, tasks: [...sys, ...user] })
    }
    case 'POST /api/tasks': {
      if (userTasks.length >= 12) return err(409, 'limit', 'limite de tarefas do usuário atingido')
      const type = q.get('type'); if (!['cpu', 'contador'].includes(type)) return err(400, 'invalid_param', "type deve ser 'cpu' ou 'contador'")
      const t = { pid: ++pidSeq, name: q.get('name') || `${type}-${pidSeq}`, type, priority: n('priority') || 1, counter: 0, rate: 0, suspended: false }
      userTasks.push(t); heapFree -= 2900; return ok({ pid: t.pid, name: t.name })
    }
    case 'POST /api/tasks/suspend': case 'POST /api/tasks/resume': case 'POST /api/tasks/delete': case 'POST /api/tasks/priority': {
      const i = userTasks.findIndex((t) => t.pid === n('pid'))
      if (i < 0) return err(403, 'protected', 'somente tarefas criadas pelo usuário podem ser alteradas')
      if (path.endsWith('suspend')) userTasks[i].suspended = true
      if (path.endsWith('resume')) userTasks[i].suspended = false
      if (path.endsWith('priority')) userTasks[i].priority = n('priority')
      if (path.endsWith('delete')) { userTasks.splice(i, 1); heapFree += 2900 }
      return ok({ pid: n('pid'), message: 'ok' })
    }
    case 'GET /api/scheduler': return ok(schedState())
    case 'POST /api/scheduler/start': { const sc = n('scenario'); const pr = [[1, 1, 1], [1, 2, 3], [2, 2, 1]][sc - 1]; if (!pr) return err(400, 'invalid_param', 'cenário'); sched.running = true; sched.scenario = sc; sched.startedAt = up(); sched.tasks.forEach((t, i) => Object.assign(t, { priority: pr[i], basePriority: pr[i], suspended: false, aged: false, loops: 0 })); sched.lastEvent = `cenário ${sc} iniciado`; return ok(schedState()) }
    case 'POST /api/scheduler/stop': sched.running = false; sched.lastEvent = 'encerrado pelo usuário'; return ok(schedState())
    case 'POST /api/scheduler/task': { const t = sched.tasks[n('id')]; const a = q.get('action'); if (a === 'suspend') t.suspended = true; if (a === 'resume') t.suspended = false; if (a === 'prio') { t.priority = n('priority'); t.basePriority = t.priority } return ok(schedState()) }
    case 'POST /api/scheduler/aging': sched.aging = q.get('enabled') === '1'; return ok(schedState())
    case 'GET /api/concurrency': return ok({ running: lab.running, dualCore: true, current: lab.current, history: lab.history })
    case 'POST /api/concurrency/start': {
      const N = n('n'), mutex = q.get('mutex') === '1'
      lab.running = true; lab.current = { mutex, n: N, progress0: 0, progress1: 0, counter: 0, elapsedMs: 0 }
      const dur = mutex ? N * 0.0048 : N * 0.00009
      setTimeout(() => {
        const lost = mutex ? 0 : Math.round(N * rnd(0.55, 0.8))
        lab.history.unshift({ id: ++lab.id, version: mutex ? 'com mutex' : 'sem mutex', mutex, n: N, expected: 2 * N, obtained: 2 * N - lost, lost, lostPct: +((lost / (2 * N)) * 100).toFixed(2), elapsedMs: +dur.toFixed(2), aborted: false, sameCore: false })
        lab.history = lab.history.slice(0, 12); lab.running = false; lab.current = null
      }, Math.max(150, dur))
      return ok({ running: true, dualCore: true, current: lab.current, history: lab.history })
    }
    case 'POST /api/concurrency/stop': return ok({ running: lab.running, dualCore: true, current: lab.current, history: lab.history })
    case 'POST /api/concurrency/reset': lab.history = []; return ok({ running: false, dualCore: true, current: null, history: [] })
    case 'GET /api/memory': return ok(memState())
    case 'POST /api/memory/allocate': { const size = n('kb') * 1024; if (heapFree - size < 40960) { mem.refused++; mem.last = 'recusado: deixaria menos de 40 KB livres para o sistema'; return err(409, 'refused', mem.last) } heapFree -= size + 16; mem.blocks.push({ id: mem.next++, size, address: 0x3ffb0000 + mem.next * 0x2400, at: up() }); mem.alloc += size; mem.aOps++; mem.last = `malloc(${n('kb')} KB) → bloco #${mem.next - 1}`; return ok(memState()) }
    case 'POST /api/memory/free': { const m = q.get('mode'); if (m === 'all') while (mem.blocks.length) freeBlock(0); else if (m === 'alternate') { for (let i = mem.blocks.length - 1; i >= 0; i -= 2) freeBlock(i) } else { const i = mem.blocks.findIndex((b) => b.id === n('id')); if (i < 0) return err(404, 'not_found', 'bloco não existe'); freeBlock(i) } mem.last = `free (${m})`; return ok(memState()) }
    case 'POST /api/memory/fragment': { while (heapFree - 8192 > 40960 && mem.blocks.length < 48) { heapFree -= 8208; mem.blocks.push({ id: mem.next++, size: 8192, address: 0x3ffb0000 + mem.next * 0x2010, at: up() }); mem.alloc += 8192; mem.aOps++ } for (let i = mem.blocks.length - 1; i >= 0; i -= 2) freeBlock(i); mem.last = 'fragmentação provocada'; return ok(memState()) }
    case 'GET /api/files': { const dir = q.get('dir') || '/'; return ok({ dir, used: 245760, total: 1441792, maxFileBytes: 16384, partition: 'spiffs', entries: listDir(dir) }) }
    case 'GET /api/files/read': { const p = q.get('path'); if (!files.has(p) || files.get(p) === null) return err(404, 'not_found', 'arquivo não existe'); const c = files.get(p); return ok({ path: p, size: Buffer.byteLength(c), binary: false, protected: false, content: c, truncated: false }) }
    case 'POST /api/files/create': { const p = q.get('path'); if (files.has(p) || files.has(p + '/')) return err(409, 'exists', 'já existe'); if (q.get('type') === 'dir') files.set(p + '/', null); else files.set(p, q.get('content') || ''); return ok({ path: p, type: q.get('type'), size: 0 }) }
    case 'POST /api/files/write': { const p = q.get('path'); if (p.startsWith('/www')) return err(403, 'protected', 'protegido'); files.set(p, q.get('content') ?? ''); return ok({ path: p, size: Buffer.byteLength(q.get('content') ?? ''), used: 245760 }) }
    case 'POST /api/files/delete': { const p = q.get('path'); files.delete(p); files.delete(p + '/'); return ok({ path: p, deleted: true, used: 245760 }) }
    case 'GET /api/devices': case 'GET /api/devices/button': case 'POST /api/devices/led': case 'POST /api/devices/config': case 'POST /api/devices/button/reset': {
      if (path.endsWith('/led')) { const s = q.get('state'); const nv = s === 'toggle' ? !dev.led : s === 'on'; if (nv !== dev.led) dev.toggles++; dev.led = nv }
      if (path.endsWith('/config')) { dev.pin = n('ledPin'); dev.low = q.get('activeLow') === '1' }
      if (path.endsWith('/reset')) Object.assign(dev, { irq: 0, valid: 0, filtered: 0, hist: [] })
      const led = { pin: dev.pin, activeLow: dev.low, on: dev.led, toggles: dev.toggles, level: dev.led !== dev.low ? 1 : 0, allowedPins: [2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33] }
      const button = { pin: 0, trigger: 'FALLING', pullup: true, pressedNow: false, interrupts: dev.irq, valid: dev.valid, filtered: dev.filtered, dropped: 0, queued: 0, debounceMs: 200, lastValidMs: dev.hist[0]?.atMs ?? 0, nowMs: up(), driverState: 'bloqueada', history: dev.hist }
      return ok(path.endsWith('/led') || path.endsWith('/config') ? { led } : path.includes('button') ? { button } : { led, button })
    }
    case 'GET /api/deadlock': return ok(dlState())
    case 'POST /api/deadlock/start': Object.assign(dl, { running: true, mode: q.get('mode'), auto: q.get('autoRecover') !== '0', start: up(), detected: false, victim: false, rounds: [0, 0], log: [q.get('mode') === 'ordered' ? 'início: ambas pegam M1 → M2' : 'início: A pega M1→M2, B pega M2→M1'] }); return ok(dlState())
    case 'POST /api/deadlock/recover': recoverDl('manual'); return ok(dlState())
    case 'POST /api/deadlock/stop': dl.running = false; dl.log.unshift('parada solicitada'); return ok(dlState())
    case 'POST /api/terminal/execute': {
      const cmd = (q.get('cmd') || '').trim(); const [c, ...a] = cmd.split(/\s+/)
      const out = { help: 'Comandos: help ps kill mem ls cat df uptime uname led (MOCK)\n', ps: '  PID NOME   ...\n(saída simulada pelo MOCK)\n', mem: `heap livre ${Math.round(heapFree)} bytes (MOCK)\n`, ls: listDir(a[0] || '/').map((e) => (e.isDir ? 'd ' : '- ') + e.name).join('\n') + '\n', uptime: `ligado há ${Math.floor(up() / 1000)} s\n` }[c]
      return ok({ cmd, output: out ?? (c === 'cat' ? (files.get(a[0]) ?? 'cat: não existe\n') : `${c}: comando não encontrado\n`), exitCode: out || c === 'cat' ? 0 : 127 })
    }
    case 'GET /api/auth/status': return ok({ required: auth.required, user: auth.user, locked: false, lockRemainingMs: 0, defaultPassword: auth.pass === 'webos', algorithm: 'SHA-256 com sal (NVS)' })
    case 'POST /api/auth/login': if (q.get('user') !== auth.user || q.get('pass') !== auth.pass) return err(401, 'bad_credentials', 'usuário ou senha incorretos'); auth.token = 'mock-' + Date.now(); return ok({ token: auth.token, user: auth.user })
    case 'POST /api/auth/verify': return ok({ valid: q.get('token') === auth.token && !!auth.token })
    case 'POST /api/auth/logout': auth.token = ''; return ok({ loggedOut: true })
    case 'POST /api/auth/config': if (q.get('currentPass') !== auth.pass) return err(401, 'bad_credentials', 'senha atual incorreta'); if (q.get('newPass')) auth.pass = q.get('newPass'); if (q.has('required')) auth.required = q.get('required') === '1'; return ok({ required: auth.required, user: auth.user, locked: false, lockRemainingMs: 0, defaultPassword: auth.pass === 'webos', algorithm: 'SHA-256 com sal (NVS)' })
  }
  return err(404, 'not_found', 'rota da API não existe')
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname.startsWith('/api/')) {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      const q = new URLSearchParams(url.search)
      if (req.method === 'POST') for (const [k, v] of new URLSearchParams(body)) q.set(k, v)
      const r = route(req.method, url.pathname, q)
      setTimeout(() => { res.writeHead(r.code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(r.body)) }, rnd(15, 45))
    })
    return
  }
  // como no firmware: serve /www/<arquivo>.gz com Content-Encoding: gzip; SPA cai no index
  let p = url.pathname === '/' ? '/index.html' : url.pathname
  let f = join(WWW, p + '.gz')
  if (!existsSync(f) || !statSync(f).isFile()) { p = '/index.html'; f = join(WWW, p + '.gz') }
  if (!existsSync(f)) { res.writeHead(404); res.end('interface não construída: rode npm run build'); return }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream', 'Content-Encoding': 'gzip' })
  res.end(readFileSync(f))
}).listen(PORT, () => console.log(`[MOCK] WebOS de testes em http://localhost:${PORT} — dados FALSOS, apenas para desenvolvimento`))
