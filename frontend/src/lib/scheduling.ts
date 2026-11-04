// Algoritmos de escalonamento (SIMULAÇÃO educacional, executa no navegador).
export interface Proc { id: string; arrival: number; burst: number }
export interface Segment { id: string | null; start: number; end: number }   // id null = CPU ociosa
export interface ProcResult { id: string; arrival: number; burst: number; start: number; finish: number; turnaround: number; waiting: number; response: number }
export interface SimResult { segments: Segment[]; procs: ProcResult[]; avgWaiting: number; avgTurnaround: number; avgResponse: number; switches: number; makespan: number }
export type Algo = 'FCFS' | 'SJF' | 'RR'

const byArrival = (a: Proc, b: Proc) => a.arrival - b.arrival || a.id.localeCompare(b.id)

function pushSeg(segs: Segment[], id: string | null, start: number, end: number) {
  if (end <= start) return
  const last = segs[segs.length - 1]
  if (last && last.id === id && last.end === start) last.end = end
  else segs.push({ id, start, end })
}

export function simulate(procsIn: Proc[], algo: Algo, quantum = 2): SimResult {
  const procs = procsIn.filter((p) => p.burst > 0).map((p) => ({ ...p })).sort(byArrival)
  const segs: Segment[] = []
  const first = new Map<string, number>()
  const finish = new Map<string, number>()
  let t = 0

  if (algo === 'FCFS') {
    for (const p of procs) {
      if (t < p.arrival) { pushSeg(segs, null, t, p.arrival); t = p.arrival }
      first.set(p.id, t)
      pushSeg(segs, p.id, t, t + p.burst)
      t += p.burst
      finish.set(p.id, t)
    }
  } else if (algo === 'SJF') {
    const left = [...procs]
    while (left.length) {
      const ready = left.filter((p) => p.arrival <= t)
      if (!ready.length) { const nx = Math.min(...left.map((p) => p.arrival)); pushSeg(segs, null, t, nx); t = nx; continue }
      ready.sort((a, b) => a.burst - b.burst || byArrival(a, b))
      const p = ready[0]
      first.set(p.id, t)
      pushSeg(segs, p.id, t, t + p.burst)
      t += p.burst
      finish.set(p.id, t)
      left.splice(left.indexOf(p), 1)
    }
  } else {
    const q = Math.max(1, quantum)
    const rem = new Map(procs.map((p) => [p.id, p.burst]))
    const queue: Proc[] = []
    let next = 0
    const admit = (until: number) => { while (next < procs.length && procs[next].arrival <= until) queue.push(procs[next++]) }
    admit(0)
    while (finish.size < procs.length) {
      if (!queue.length) { const nx = procs[next].arrival; pushSeg(segs, null, t, nx); t = nx; admit(t); continue }
      const p = queue.shift()!
      if (!first.has(p.id)) first.set(p.id, t)
      const run = Math.min(q, rem.get(p.id)!)
      segs.push({ id: p.id, start: t, end: t + run })   // fatias separadas: cada quantum aparece no Gantt
      t += run
      rem.set(p.id, rem.get(p.id)! - run)
      admit(t)                                          // quem chegou durante o quantum entra antes
      if (rem.get(p.id)! > 0) queue.push(p)
      else finish.set(p.id, t)
    }
  }

  const res: ProcResult[] = procs.map((p) => {
    const f = finish.get(p.id)!
    return { id: p.id, arrival: p.arrival, burst: p.burst, start: first.get(p.id)!, finish: f, turnaround: f - p.arrival, waiting: f - p.arrival - p.burst, response: first.get(p.id)! - p.arrival }
  }).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  const avg = (k: 'waiting' | 'turnaround' | 'response') => (res.length ? res.reduce((s, r) => s + r[k], 0) / res.length : 0)
  const running = segs.filter((s) => s.id)
  let switches = 0
  for (let i = 1; i < running.length; i++) if (running[i].id !== running[i - 1].id || running[i].start !== running[i - 1].end) switches++
  return { segments: segs, procs: res, avgWaiting: avg('waiting'), avgTurnaround: avg('turnaround'), avgResponse: avg('response'), switches, makespan: t }
}
