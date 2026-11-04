import { useState } from 'react'
import { Lock, RotateCcw, Square, Unlock } from 'lucide-react'
import { CompareBars } from '../components/charts'
import { ConceptBox } from '../components/ConceptBox'
import { Bar, Callout, ErrorBanner, LiveBadge, Loading, Stat, TableWrap } from '../components/ui'
import { CONCEPTS } from '../content/concepts'
import { useSystem } from '../contexts/SystemContext'
import { usePolling } from '../hooks/usePolling'
import { api } from '../services/api'
import { cx, fmtInt, fmtMs } from '../lib/format'
import type { ConcurrencyState } from '../types/api'

const SIZES = [10000, 100000, 500000, 1000000]

export default function Concurrency() {
  const { runOp, conn } = useSystem()
  const [n, setN] = useState(100000)
  const [fast, setFast] = useState(false)
  const { data, setData, error, loading } = usePolling(api.concurrency.get, fast ? 300 : 1000)

  const op = async (label: string, fn: () => Promise<ConcurrencyState>) => {
    const r = await runOp(label, fn)
    if (r) { setData(r); setFast(r.running) }
  }
  if (fast && data && !data.running) setFast(false)

  const last = data?.history[0]
  const lastNo = data?.history.find((h) => !h.mutex)
  const lastYes = data?.history.find((h) => h.mutex)
  const running = !!data?.running

  return (
    <div className="space-y-4 p-4">
      <ConceptBox id="concurrency" concept={CONCEPTS.concurrency} />

      <div className="panel flex flex-wrap items-end gap-2.5 p-3">
        <label className="flex w-[170px] flex-col gap-1">
          <span className="label">Incrementos por tarefa</span>
          <select className="field" value={n} onChange={(e) => setN(Number(e.target.value))}>
            {SIZES.map((s) => <option key={s} value={s}>{fmtInt(s)}</option>)}
          </select>
        </label>
        <button className="btn btn-warn" disabled={running || conn !== 'connected'} onClick={() => op('Não foi possível executar', () => api.concurrency.start(n, false))}><Unlock size={15} /> Executar SEM mutex</button>
        <button className="btn btn-primary" disabled={running || conn !== 'connected'} onClick={() => op('Não foi possível executar', () => api.concurrency.start(n, true))}><Lock size={15} /> Executar COM mutex</button>
        {running && <button className="btn btn-danger" onClick={() => op('Falha ao parar', api.concurrency.stop)}><Square size={14} /> Parar</button>}
        <button className="btn ml-auto" disabled={running || !data?.history.length} onClick={() => op('Falha ao limpar', api.concurrency.reset)} title="Limpar histórico"><RotateCcw size={14} /> Limpar</button>
      </div>

      <ErrorBanner error={error} />
      {loading && !data ? <Loading /> : data && (
        <>
          {data.current && (
            <div className="panel space-y-2 p-3">
              <div className="flex items-center justify-between text-[12.5px] text-ink-300">
                <span>Executando {data.current.mutex ? 'COM' : 'SEM'} mutex · {fmtInt(data.current.n)} por tarefa</span>
                <span className="num">{fmtMs(data.current.elapsedMs)}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><div className="mb-1 text-[11.5px] text-ink-400">Tarefa no núcleo 0</div><Bar value={data.current.progress0} max={data.current.n} /></div>
                <div><div className="mb-1 text-[11.5px] text-ink-400">Tarefa no núcleo 1</div><Bar value={data.current.progress1} max={data.current.n} tone="volt" /></div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-ink-100">{last ? `Última execução (${last.version})` : 'Nenhuma execução ainda'}</h3>
            <LiveBadge live={conn === 'connected' && !error} />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Esperado (2 × N)" value={last ? fmtInt(last.expected) : '—'} big />
            <Stat label="Obtido" value={last ? fmtInt(last.obtained) : '—'} big tone={last ? (last.lost ? 'bad' : 'ok') : undefined} />
            <Stat label="Incrementos perdidos" value={last ? fmtInt(last.lost) : '—'} big tone={last?.lost ? 'bad' : last ? 'ok' : undefined} hint={last ? `${last.lostPct.toFixed(2).replace('.', ',')}% do esperado` : undefined} />
            <Stat label="Tempo" value={last ? fmtMs(last.elapsedMs) : '—'} big />
          </div>

          <pre className="code overflow-x-auto scroll-thin text-ink-200">
{`// Duas tarefas, uma em cada núcleo, fazem N vezes:
`}<span className="text-phos-300">{`xSemaphoreTake(mutex);   // só na versão COM mutex`}</span>{`
`}<span className="bg-amber-400/10">{`int t = contador;        // 1. lê       ┐
t = t + 1;               // 2. modifica ├ região crítica
contador = t;            // 3. escreve  ┘`}</span>{`
`}<span className="text-phos-300">{`xSemaphoreGive(mutex);   // só na versão COM mutex`}</span>
          </pre>

          {last && (
            last.aborted ? <Callout tone="warn" title="Execução interrompida">O experimento foi parado antes do fim; o resultado é parcial.</Callout>
            : last.lost > 0 ? (
              <Callout tone="bad" title="Condição de corrida!">
                As duas tarefas leram o mesmo valor ao mesmo tempo e uma escrita apagou a outra: <b className="num">{fmtInt(last.lost)}</b> incrementos sumiram ({last.lostPct.toFixed(2).replace('.', ',')}%). As três linhas formam a <b>região crítica</b> e precisam de exclusão mútua.
              </Callout>
            ) : last.mutex ? (
              <Callout tone="ok" title="Exclusão mútua funcionou">Com o mutex, só uma tarefa por vez entra na região crítica: o contador chegou exatamente a {fmtInt(last.expected)}. O custo aparece no tempo.</Callout>
            ) : (
              <Callout tone="info" title="Nenhum incremento perdido desta vez">{last.sameCore ? 'Este chip tem um só núcleo: as tarefas não executam ao mesmo tempo de verdade, por isso a corrida é rara.' : 'A corrida depende do entrelaçamento exato dos núcleos. Repita ou aumente N (100.000 ou mais).'}</Callout>
            )
          )}

          {lastNo && lastYes && (
            <div className="panel grid gap-4 p-3 md:grid-cols-2">
              <div>
                <div className="label mb-2">Incrementos perdidos</div>
                <CompareBars format={fmtInt} rows={[
                  { label: `sem mutex (N=${fmtInt(lastNo.n)})`, value: lastNo.lost, color: '#f2606d' },
                  { label: `com mutex (N=${fmtInt(lastYes.n)})`, value: lastYes.lost, color: '#4ade80' },
                ]} />
              </div>
              <div>
                <div className="label mb-2">Tempo de execução</div>
                <CompareBars format={(v) => fmtMs(v)} rows={[
                  { label: 'sem mutex', value: lastNo.elapsedMs, color: '#f5b748' },
                  { label: 'com mutex', value: lastYes.elapsedMs, color: '#4fd1c5', note: lastNo.elapsedMs > 0 ? `${(lastYes.elapsedMs / lastNo.elapsedMs).toFixed(0)}× mais lento` : undefined },
                ]} />
              </div>
            </div>
          )}

          {data.history.length > 0 && (
            <>
              <h3 className="text-[13px] font-semibold text-ink-100">Histórico</h3>
              <TableWrap maxH={260}>
                <table className="tbl min-w-[560px]">
                  <thead><tr><th>#</th><th>Versão</th><th>N</th><th>Obtido</th><th>Perdidos</th><th>Tempo</th></tr></thead>
                  <tbody>
                    {data.history.map((h) => (
                      <tr key={h.id}>
                        <td className="num text-ink-400">{h.id}</td>
                        <td>{h.version}{h.aborted && <span className="ml-1 text-amber-200">(parado)</span>}</td>
                        <td className="num">{fmtInt(h.n)}</td>
                        <td className="num">{fmtInt(h.obtained)}</td>
                        <td className={cx('num font-semibold', h.lost ? 'text-rose-300' : 'text-emerald-300')}>{fmtInt(h.lost)}</td>
                        <td className="num">{fmtMs(h.elapsedMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </>
          )}
          {!data.dualCore && <Callout tone="warn">Esta placa informa apenas 1 núcleo: as duas tarefas rodam no mesmo núcleo e a corrida tende a não aparecer.</Callout>}
        </>
      )}
    </div>
  )
}
