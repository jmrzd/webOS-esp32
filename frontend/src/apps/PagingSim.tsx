import { useMemo, useState } from 'react'
import { CompareBars } from '../components/charts'
import { ConceptBox } from '../components/ConceptBox'
import { Callout, Segmented, SimulationBadge, Stat } from '../components/ui'
import { CONCEPTS } from '../content/concepts'
import { parseRefs, runPaging, type PageAlgo } from '../lib/paging'
import { cx } from '../lib/format'

const PRESETS: Record<string, { refs: string; frames: number }> = {
  'Exemplo da Aula 9': { refs: '7 0 1 2 0 3 0 4 2 3 0 3', frames: 3 },
  'Padrão': { refs: '7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1', frames: 3 },
  'Belady (FIFO)': { refs: '1 2 3 4 1 2 5 1 2 3 4 5', frames: 3 },
  'Localidade': { refs: '1 2 1 2 1 3 1 3 4 3 4 3 1 4 1', frames: 2 },
}
const NAMES: Record<PageAlgo, string> = { FIFO: 'FIFO', LRU: 'LRU', OPT: 'Ótimo' }

export default function PagingSim() {
  const [text, setText] = useState(PRESETS['Exemplo da Aula 9'].refs)
  const [frames, setFrames] = useState(3)
  const [algo, setAlgo] = useState<PageAlgo>('FIFO')
  const refs = useMemo(() => parseRefs(text), [text])
  const all = useMemo(() => ({ FIFO: runPaging(refs, frames, 'FIFO'), LRU: runPaging(refs, frames, 'LRU'), OPT: runPaging(refs, frames, 'OPT') }), [refs, frames])
  const belady = useMemo(() => {
    if (frames >= 7) return null
    const a = runPaging(refs, frames, 'FIFO').faults, b = runPaging(refs, frames + 1, 'FIFO').faults
    return b > a ? { a, b } : null
  }, [refs, frames])
  const r = all[algo]

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2"><SimulationBadge /><span className="text-[12px] text-ink-400">O ESP32 não usa memória virtual paginada para os programas; aqui o algoritmo é simulado no navegador.</span></div>
      <ConceptBox id="pagingsim" concept={CONCEPTS.pagingsim} />

      <div className="panel space-y-2.5 p-3">
        <div className="flex flex-wrap gap-2">
          {Object.entries(PRESETS).map(([k, p]) => <button key={k} className="btn btn-sm" onClick={() => { setText(p.refs); setFrames(p.frames) }}>{k}</button>)}
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1">
            <span className="label">Sequência de referências (páginas 0–99, até 40)</span>
            <input className="field num" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <label className="flex w-[130px] flex-col gap-1">
            <span className="label">Quadros na RAM</span>
            <input type="number" min={1} max={7} value={frames} onChange={(e) => setFrames(Math.max(1, Math.min(7, Number(e.target.value) || 1)))} className="field num" />
          </label>
        </div>
      </div>

      <Segmented value={algo} onChange={setAlgo} options={(['FIFO', 'LRU', 'OPT'] as PageAlgo[]).map((a) => ({ value: a, label: NAMES[a] }))} />

      {refs.length === 0 ? <Callout tone="warn">Digite uma sequência de números separados por espaço ou vírgula.</Callout> : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Faltas de página" value={r.faults} tone="bad" big />
            <Stat label="Acertos" value={r.hits} tone="ok" big />
            <Stat label="Taxa de faltas" value={`${Math.round((r.faults / refs.length) * 100)}%`} big />
          </div>
          <div className="panel overflow-x-auto p-3 scroll-thin">
            <table className="num border-separate border-spacing-[3px] text-[12.5px]">
              <thead>
                <tr>
                  <th className="pr-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">ref.</th>
                  {r.steps.map((s, i) => <th key={i} className="h-7 w-8 rounded bg-white/[.06] text-ink-50">{s.ref}</th>)}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: frames }, (_, f) => (
                  <tr key={f}>
                    <td className="pr-2 text-[10.5px] uppercase tracking-wide text-ink-400">quadro {f}</td>
                    {r.steps.map((s, i) => {
                      const v = s.frames[f]
                      const changed = !s.hit && s.slot === f
                      return <td key={i} className={cx('h-8 w-8 rounded text-center', changed ? 'bg-rose-500/35 font-bold text-rose-50' : s.hit && s.slot === f ? 'bg-emerald-500/30 font-bold text-emerald-50' : v == null ? 'bg-white/[.02] text-ink-600' : 'bg-white/[.05] text-ink-300')}>{v ?? '·'}</td>
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="pr-2 text-[10.5px] uppercase tracking-wide text-ink-400">resultado</td>
                  {r.steps.map((s, i) => <td key={i} className={cx('text-center text-[11px] font-bold', s.hit ? 'text-emerald-300' : 'text-rose-300')} title={s.evicted != null ? `saiu a página ${s.evicted}` : undefined}>{s.hit ? '✓' : 'F'}</td>)}
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[11.5px] text-ink-400"><span className="text-rose-300">vermelho</span> = falta (página carregada nesse quadro) · <span className="text-emerald-300">verde</span> = acerto · passe o mouse em “F” para ver quem saiu.</p>
          </div>

          <div className="panel p-3">
            <div className="label mb-2">Comparação — faltas de página com {frames} quadro(s)</div>
            <CompareBars rows={(['FIFO', 'LRU', 'OPT'] as PageAlgo[]).map((a) => ({ label: NAMES[a], value: all[a].faults, color: a === 'OPT' ? '#4ade80' : a === 'LRU' ? '#60a5fa' : '#f5b748', note: `${Math.round((all[a].faults / refs.length) * 100)}%` }))} />
          </div>
          {belady ? (
            <Callout tone="warn" title="Anomalia de Belady">Com FIFO, {frames} quadros geram {belady.a} faltas, mas {frames + 1} quadros geram {belady.b}: mais memória, mais faltas. LRU e Ótimo não sofrem dessa anomalia (são algoritmos de pilha).</Callout>
          ) : (
            <Callout tone="info">O Ótimo ({all.OPT.faults} faltas) é o limite inferior: precisa conhecer o futuro. O LRU ({all.LRU.faults}) aproxima o Ótimo usando o passado recente; o FIFO ({all.FIFO.faults}) ignora o uso das páginas.</Callout>
          )}
        </>
      )}
    </div>
  )
}
