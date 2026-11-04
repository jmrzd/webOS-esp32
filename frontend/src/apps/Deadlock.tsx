import { Check, LifeBuoy, ListOrdered, Square, X, Zap } from 'lucide-react'
import { useState } from 'react'
import { ConceptBox } from '../components/ConceptBox'
import { Callout, ErrorBanner, LiveBadge, Loading, Stat } from '../components/ui'
import { CONCEPTS } from '../content/concepts'
import { useSystem } from '../contexts/SystemContext'
import { usePolling } from '../hooks/usePolling'
import { api } from '../services/api'
import { cx, fmtInt, fmtMs } from '../lib/format'
import type { DeadlockState } from '../types/api'

export default function Deadlock() {
  const { runOp, conn } = useSystem()
  const [auto, setAuto] = useState(true)
  const { data, setData, error, loading } = usePolling(api.deadlock.get, 500)
  const op = async (label: string, fn: () => Promise<DeadlockState>) => { const r = await runOp(label, fn); if (r) setData(r) }
  const can = conn === 'connected'
  const running = !!data?.running

  return (
    <div className="space-y-4 p-4">
      <ConceptBox id="deadlock" concept={CONCEPTS.deadlock} />
      <div className="panel flex flex-wrap items-center gap-2 p-3">
        <button className="btn btn-danger" disabled={!can || running} onClick={() => op('Não foi possível iniciar', () => api.deadlock.start('deadlock', auto))}><Zap size={15} /> Provocar deadlock</button>
        <button className="btn btn-primary" disabled={!can || running} onClick={() => op('Não foi possível iniciar', () => api.deadlock.start('ordered', auto))}><ListOrdered size={15} /> Prevenção (mesma ordem)</button>
        <button className="btn btn-warn" disabled={!can || !data?.deadlock} onClick={() => op('Falha na recuperação', api.deadlock.recover)}><LifeBuoy size={15} /> Recuperar agora</button>
        <button className="btn" disabled={!can || !running} onClick={() => op('Falha ao parar', api.deadlock.stop)}><Square size={14} /> Parar</button>
        <label className="ml-auto flex items-center gap-2 text-[12.5px] text-ink-200">
          <input type="checkbox" className="h-4 w-4 accent-[#4fd1c5]" checked={auto} disabled={running} onChange={(e) => setAuto(e.target.checked)} />
          watchdog recupera sozinho ({data ? data.autoRecoverAfterMs / 1000 : 8} s)
        </label>
      </div>
      <ErrorBanner error={error} />

      {loading && !data ? <Loading /> : data && (
        <>
          <div className="flex items-center justify-between">
            <span className={cx('chip', data.deadlock ? 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/40' : running ? 'bg-emerald-400/12 text-emerald-300' : 'bg-white/[.06] text-ink-300')}>
              {data.deadlock ? `DEADLOCK há ${fmtMs(data.cycleForMs)}` : running ? (data.mode === 'ordered' ? 'executando (prevenção)' : 'executando') : 'parado'}
            </span>
            <LiveBadge live={can && !error} />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <div className="panel p-2"><WaitGraph d={data} /></div>
            <div className="space-y-2">
              {data.tasks.map((t) => (
                <div key={t.name} className="panel px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-50">Tarefa {t.name}</span>
                    <span className="num text-[11.5px] text-ink-400">ordem {t.order}</span>
                  </div>
                  <div className="mt-1 text-[12.5px] text-ink-300">{t.waitingFor ? <>bloqueada esperando <b className="text-amber-200">{t.waitingFor}</b></> : t.phase}</div>
                  <div className="num mt-0.5 text-[11.5px] text-ink-500">{fmtInt(t.rounds)} rodadas · estado FreeRTOS: {t.state}</div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Detecções" value={fmtInt(data.detections)} />
                <Stat label="Recuperações" value={fmtInt(data.recoveries)} />
              </div>
            </div>
          </div>

          <Coffman d={data} />

          {data.deadlock ? (
            <Callout tone="bad" title="Espera circular detectada">
              A segura M1 e espera M2; B segura M2 e espera M1. Nenhuma das duas pode continuar: as quatro condições de Coffman estão presentes. {data.autoRecover ? `O watchdog do experimento escolhe B como vítima em ${Math.max(0, Math.ceil((data.autoRecoverAfterMs - Math.max(0, data.cycleForMs - data.detectAfterMs)) / 1000))} s.` : 'Clique em “Recuperar agora”.'} O resto do WebOS continua respondendo.
            </Callout>
          ) : data.mode === 'ordered' && data.tasks.some((t) => t.rounds > 0) ? (
            <Callout tone="ok" title="Prevenção funcionando">As duas tarefas pegam M1 antes de M2. Quem consegue M1 sempre consegue terminar, então a espera circular nunca se forma — {fmtInt(data.tasks[0].rounds + data.tasks[1].rounds)} rodadas sem impasse.</Callout>
          ) : data.recoveries > 0 && !running ? (
            <Callout tone="info" title="Recuperado">A vítima liberou o mutex que segurava; a outra tarefa obteve os dois recursos e concluiu sua rodada. Recuperar por preempção de recurso custa o trabalho da vítima.</Callout>
          ) : (
            <Callout tone="idea">Inicie “Provocar deadlock” e observe o grafo: em menos de um segundo forma-se o ciclo A → M2 → B → M1 → A.</Callout>
          )}

          <div className="panel p-3">
            <div className="label mb-1.5">Registro do experimento (na placa)</div>
            {data.log.length === 0 ? <p className="text-[12px] text-ink-500">vazio</p> : (
              <ul className="num space-y-0.5 text-[12px] text-ink-300">{data.log.map((l, i) => <li key={i} className={cx(l.includes('DEADLOCK') && 'text-rose-300')}>{l}</li>)}</ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function WaitGraph({ d }: { d: DeadlockState }) {
  const P = { A: { x: 90, y: 110 }, B: { x: 390, y: 110 }, M1: { x: 240, y: 32 }, M2: { x: 240, y: 188 } }
  const holder = (m: 'M1' | 'M2') => d.mutexes.find((x) => x.name === m)?.holder ?? null
  const red = d.deadlock
  const edge = (from: { x: number; y: number }, to: { x: number; y: number }, kind: 'hold' | 'wait', key: string) => {
    const col = red ? '#f87171' : kind === 'hold' ? '#4fd1c5' : '#f5b748'
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy)
    const s = 34 / len, e = 30 / len
    return (
      <line key={key} x1={from.x + dx * s} y1={from.y + dy * s} x2={to.x - dx * e} y2={to.y - dy * e}
        stroke={col} strokeWidth={2.4} strokeDasharray={kind === 'wait' ? '7 6' : undefined} markerEnd={`url(#dl-${red ? 'r' : kind})`} />
    )
  }
  const edges = []
  for (const m of ['M1', 'M2'] as const) { const h = holder(m); if (h) edges.push(edge(P[m], P[h], 'hold', 'h' + m)) }
  for (const t of d.tasks) if (t.waitingFor) edges.push(edge(P[t.name], P[t.waitingFor], 'wait', 'w' + t.name))
  return (
    <svg viewBox="0 0 480 220" className="mx-auto block w-full max-w-[520px]" role="img" aria-label="Grafo de alocação de recursos">
      <defs>
        {[['hold', '#4fd1c5'], ['wait', '#f5b748'], ['r', '#f87171']].map(([k, c]) => (
          <marker key={k} id={`dl-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill={c} /></marker>
        ))}
      </defs>
      {edges}
      {(['A', 'B'] as const).map((t) => (
        <g key={t}>
          <circle cx={P[t].x} cy={P[t].y} r={30} fill={red ? 'rgb(248 113 113 / .15)' : 'rgb(56 189 248 / .14)'} stroke={red ? '#f87171' : '#38bdf8'} strokeWidth={2} />
          <text x={P[t].x} y={P[t].y + 5} textAnchor="middle" fontSize="16" fontWeight="700" fill="#eef2fb">{t}</text>
        </g>
      ))}
      {(['M1', 'M2'] as const).map((m) => (
        <g key={m}>
          <rect x={P[m].x - 28} y={P[m].y - 18} width={56} height={36} rx={7} fill="rgb(255 255 255 / .06)" stroke={holder(m) ? '#93a1c2' : '#36415e'} strokeWidth={1.6} />
          <text x={P[m].x} y={P[m].y + 5} textAnchor="middle" fontSize="13.5" fontWeight="700" fill="#eef2fb">{m}</text>
        </g>
      ))}
      <g fontSize="10.5" fill="#93a1c2">
        <line x1="12" y1="206" x2="34" y2="206" stroke="#4fd1c5" strokeWidth="2.4" /><text x="40" y="210">segura</text>
        <line x1="96" y1="206" x2="118" y2="206" stroke="#f5b748" strokeWidth="2.4" strokeDasharray="6 5" /><text x="124" y="210">espera</text>
      </g>
    </svg>
  )
}

function Coffman({ d }: { d: DeadlockState }) {
  const anyHold = d.mutexes.some((m) => m.holder)
  const holdWait = d.tasks.some((t) => t.waitingFor && d.mutexes.some((m) => m.holder === t.name))
  const conds = [
    { k: 'Exclusão mútua', ok: true, why: 'um mutex tem um só dono' },
    { k: 'Posse e espera', ok: holdWait, why: holdWait ? 'tarefa segura um e espera outro' : 'ninguém segura um recurso esperando outro agora' },
    { k: 'Ausência de preempção', ok: true, why: 'o FreeRTOS não toma o mutex de volta' },
    { k: 'Espera circular', ok: d.deadlock, why: d.mode === 'ordered' ? 'impossível: ordem global M1 → M2' : d.deadlock ? 'ciclo A → B → A' : 'sem ciclo neste instante' },
  ]
  return (
    <div className="panel p-3">
      <div className="label mb-2">Condições de Coffman (todas necessárias para o deadlock)</div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {conds.map((c) => (
          <div key={c.k} className="flex items-start gap-2 text-[12.5px]">
            <span className={cx('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full', c.ok ? 'bg-rose-400/25 text-rose-200' : 'bg-emerald-400/20 text-emerald-300')}>{c.ok ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}</span>
            <span><b className="text-ink-100">{c.k}</b> <span className="text-ink-400">— {c.why}</span></span>
          </div>
        ))}
      </div>
      {!anyHold && !d.running && <p className="mt-2 text-[11.5px] text-ink-500">Sem experimento em andamento.</p>}
    </div>
  )
}
