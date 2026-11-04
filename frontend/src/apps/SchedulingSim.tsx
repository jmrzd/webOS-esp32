import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { CompareBars } from '../components/charts'
import { ConceptBox } from '../components/ConceptBox'
import { Callout, Segmented, SimulationBadge, TableWrap } from '../components/ui'
import { CONCEPTS } from '../content/concepts'
import { simulate, type Algo, type Proc, type SimResult } from '../lib/scheduling'
import { cx } from '../lib/format'

const PALETTE = ['#4fd1c5', '#9a8cf8', '#f5b748', '#f472b6', '#60a5fa', '#a3e635', '#fb923c', '#e879f9']
const PRESETS: Record<string, Proc[]> = {
  'Exemplo da Aula 7': [{ id: 'P1', arrival: 0, burst: 6 }, { id: 'P2', arrival: 1, burst: 3 }, { id: 'P3', arrival: 2, burst: 2 }],
  'Clássico': [{ id: 'P1', arrival: 0, burst: 8 }, { id: 'P2', arrival: 1, burst: 4 }, { id: 'P3', arrival: 2, burst: 9 }, { id: 'P4', arrival: 3, burst: 5 }],
  'Comboio': [{ id: 'P1', arrival: 0, burst: 20 }, { id: 'P2', arrival: 1, burst: 2 }, { id: 'P3', arrival: 1, burst: 2 }, { id: 'P4', arrival: 2, burst: 3 }],
  'Com ociosidade': [{ id: 'P1', arrival: 0, burst: 3 }, { id: 'P2', arrival: 6, burst: 4 }, { id: 'P3', arrival: 7, burst: 2 }],
}
const fmt = (v: number) => v.toFixed(2).replace('.', ',')

export default function SchedulingSim() {
  const [procs, setProcs] = useState<Proc[]>(PRESETS['Exemplo da Aula 7'])
  const [quantum, setQuantum] = useState(2)
  const [view, setView] = useState<Algo>('FCFS')

  const colorOf = useMemo(() => {
    const m = new Map<string, string>()
    procs.forEach((p, i) => m.set(p.id, PALETTE[i % PALETTE.length]))
    return m
  }, [procs])
  const results = useMemo(() => ({ FCFS: simulate(procs, 'FCFS'), SJF: simulate(procs, 'SJF'), RR: simulate(procs, 'RR', quantum) }), [procs, quantum])
  const best = (Object.keys(results) as Algo[]).reduce((a, b) => (results[a].avgWaiting <= results[b].avgWaiting ? a : b))

  const update = (i: number, k: 'arrival' | 'burst', v: number) => setProcs((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: Math.max(k === 'burst' ? 1 : 0, Math.min(50, v || 0)) } : p)))
  const add = () => setProcs((ps) => {
    const used = new Set(ps.map((p) => p.id))
    let n = ps.length + 1
    while (used.has('P' + n)) n++
    return [...ps, { id: 'P' + n, arrival: ps.length ? Math.max(...ps.map((p) => p.arrival)) + 1 : 0, burst: 3 }]
  })

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2"><SimulationBadge /><span className="text-[12px] text-ink-400">Estes cálculos rodam no navegador; não há tarefas do FreeRTOS envolvidas.</span></div>
      <ConceptBox id="schedsim" concept={CONCEPTS.schedsim} />

      <div className="panel p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="label mr-1">Processos</span>
          {Object.keys(PRESETS).map((k) => <button key={k} className="btn btn-sm" onClick={() => setProcs(PRESETS[k])}>{k}</button>)}
          <label className="ml-auto flex items-center gap-2 text-[12.5px] text-ink-300">quantum RR
            <input type="number" min={1} max={10} value={quantum} onChange={(e) => setQuantum(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className="field num h-8 w-16" />
          </label>
        </div>
        <TableWrap>
          <table className="tbl min-w-[360px]">
            <thead><tr><th>Processo</th><th>Chegada</th><th>Duração (burst)</th><th></th></tr></thead>
            <tbody>
              {procs.map((p, i) => (
                <tr key={p.id}>
                  <td><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: colorOf.get(p.id) }} /><b>{p.id}</b></td>
                  <td><input type="number" min={0} max={50} value={p.arrival} onChange={(e) => update(i, 'arrival', Number(e.target.value))} className="field num h-8 w-20" aria-label={`Chegada de ${p.id}`} /></td>
                  <td><input type="number" min={1} max={50} value={p.burst} onChange={(e) => update(i, 'burst', Number(e.target.value))} className="field num h-8 w-20" aria-label={`Duração de ${p.id}`} /></td>
                  <td className="text-right"><button className="icon-btn h-8 w-8" aria-label={`Remover ${p.id}`} disabled={procs.length <= 1} onClick={() => setProcs((ps) => ps.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <button className="btn btn-sm mt-2" disabled={procs.length >= 8} onClick={add}><Plus size={13} /> Adicionar processo</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={view} onChange={setView} options={[{ value: 'FCFS', label: 'FCFS' }, { value: 'SJF', label: 'SJF' }, { value: 'RR', label: `Round-Robin (q=${quantum})` }]} />
      </div>
      <Gantt r={results[view]} colorOf={colorOf} />
      <ResultTable r={results[view]} />

      <div className="panel grid gap-4 p-3 md:grid-cols-2">
        <div>
          <div className="label mb-2">Tempo médio de espera</div>
          <CompareBars format={fmt} unit="u.t." rows={(['FCFS', 'SJF', 'RR'] as Algo[]).map((a) => ({ label: a === 'RR' ? `RR (q=${quantum})` : a, value: results[a].avgWaiting, color: a === best ? '#4ade80' : '#6c7a9d' }))} />
        </div>
        <div>
          <div className="label mb-2">Tempo médio de retorno</div>
          <CompareBars format={fmt} unit="u.t." rows={(['FCFS', 'SJF', 'RR'] as Algo[]).map((a) => ({ label: a === 'RR' ? `RR (q=${quantum})` : a, value: results[a].avgTurnaround, color: '#60a5fa', note: a === 'RR' ? `${results.RR.switches} trocas` : undefined }))} />
        </div>
      </div>
      <Callout tone="info" title={`Menor espera média: ${best === 'RR' ? `Round-Robin (q=${quantum})` : best}`}>
        {best === 'SJF' ? 'Executar primeiro os processos curtos reduz a espera de todos os que estão na fila — por isso o SJF é ótimo para espera média (quando as durações são conhecidas).'
          : best === 'FCFS' ? 'Neste conjunto a ordem de chegada já coincide com uma boa ordem de execução.'
          : 'O Round-Robin favoreceu os processos curtos neste conjunto, ao custo de mais trocas de contexto.'}
        {' '}Tempo de resposta médio (até a 1ª execução): FCFS {fmt(results.FCFS.avgResponse)}, SJF {fmt(results.SJF.avgResponse)}, RR {fmt(results.RR.avgResponse)} — o RR responde mais cedo a todos.
      </Callout>
    </div>
  )
}

function Gantt({ r, colorOf }: { r: SimResult; colorOf: Map<string, string> }) {
  const total = Math.max(1, r.makespan)
  const ticks = Array.from({ length: total + 1 }, (_, i) => i).filter((i) => total <= 30 || i % Math.ceil(total / 20) === 0 || i === total)
  return (
    <div className="panel overflow-x-auto p-3 scroll-thin">
      <div className="label mb-2">Diagrama de Gantt</div>
      <div className="min-w-[520px]">
        <div className="flex h-10 overflow-hidden rounded-md ring-1 ring-white/[.08]">
          {r.segments.map((s, i) => (
            <div key={i} title={`${s.id ?? 'ociosa'}: ${s.start} → ${s.end}`}
              className={cx('grid shrink-0 place-items-center border-r border-ink-950/70 text-[12px] font-bold', s.id ? 'text-ink-950' : 'text-ink-400')}
              style={{ width: `${((s.end - s.start) / total) * 100}%`, background: s.id ? colorOf.get(s.id) : 'repeating-linear-gradient(45deg, rgb(255 255 255 / .04) 0 6px, transparent 6px 12px)' }}>
              {(s.end - s.start) / total > 0.03 ? s.id ?? '—' : ''}
            </div>
          ))}
        </div>
        <div className="relative mt-1 h-4">
          {ticks.map((t) => <span key={t} className="num absolute -translate-x-1/2 text-[10.5px] text-ink-400" style={{ left: `${(t / total) * 100}%` }}>{t}</span>)}
        </div>
      </div>
    </div>
  )
}

function ResultTable({ r }: { r: SimResult }) {
  return (
    <TableWrap>
      <table className="tbl min-w-[560px]">
        <thead><tr><th>Processo</th><th>Chegada</th><th>Duração</th><th>Início</th><th>Término</th><th>Retorno</th><th>Espera</th></tr></thead>
        <tbody>
          {r.procs.map((p) => (
            <tr key={p.id}><td className="font-semibold">{p.id}</td><td className="num">{p.arrival}</td><td className="num">{p.burst}</td><td className="num">{p.start}</td><td className="num">{p.finish}</td><td className="num">{p.turnaround}</td><td className="num">{p.waiting}</td></tr>
          ))}
          <tr className="font-semibold"><td colSpan={5} className="text-right text-ink-300">Médias</td><td className="num text-phos-300">{fmt(r.avgTurnaround)}</td><td className="num text-phos-300">{fmt(r.avgWaiting)}</td></tr>
        </tbody>
      </table>
    </TableWrap>
  )
}
