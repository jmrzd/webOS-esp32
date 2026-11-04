import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Pause, Play, Square } from 'lucide-react'
import { LineChart } from '../components/charts'
import { ConceptBox } from '../components/ConceptBox'
import { Bar, Callout, ErrorBanner, LiveBadge, Loading, StateBadge } from '../components/ui'
import { CONCEPTS } from '../content/concepts'
import { useSystem } from '../contexts/SystemContext'
import { usePolling } from '../hooks/usePolling'
import { api } from '../services/api'
import { cx, fmtInt, fmtPct, fmtUptime } from '../lib/format'
import type { SchedulerState } from '../types/api'

const COLORS = ['#7eeadb', '#9a8cf8', '#f5b748']
const SCENARIOS = [
  { id: 1, title: 'Cenário 1', sub: 'prioridades iguais (1, 1, 1)' },
  { id: 2, title: 'Cenário 2', sub: 'prioridades 1, 2 e 3' },
  { id: 3, title: 'Cenário 3', sub: 'prioridades 2, 2 e 1' },
]

export default function Scheduler() {
  const { runOp, conn } = useSystem()
  const { data, setData, error, loading } = usePolling(api.scheduler.get, 1000)
  const hist = useRef<number[][]>([[], [], []])
  const [, force] = useState(0)

  // histórico local das amostras reais (1 por segundo) para o gráfico
  useEffect(() => {
    if (!data?.running) return
    data.tasks.forEach((t, i) => {
      const h = hist.current[i]
      h.push(t.cpu ?? 0)
      if (h.length > 40) h.shift()
    })
    force((x) => x + 1)
  }, [data])

  const op = async (label: string, fn: () => Promise<SchedulerState>) => {
    const r = await runOp(label, fn)
    if (r) setData(r)
  }
  const start = (sc: number) => { hist.current = [[], [], []]; op('Não foi possível iniciar', () => api.scheduler.start(sc)) }

  const running = !!data?.running
  const insight = data ? interpret(data) : null

  return (
    <div className="space-y-4 p-4">
      <ConceptBox id="scheduler" concept={CONCEPTS.scheduler} />

      <div className="grid gap-2 sm:grid-cols-3">
        {SCENARIOS.map((s) => (
          <button key={s.id} onClick={() => start(s.id)} disabled={conn !== 'connected'}
            className={cx('panel px-3 py-2.5 text-left transition-colors hover:bg-white/[.06]', running && data?.scenario === s.id && 'ring-1 ring-phos-400/60 bg-phos-400/[.07]')}>
            <div className="text-[13px] font-semibold text-ink-50">{s.title}</div>
            <div className="text-[12px] text-ink-400">{s.sub}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-danger" disabled={!running} onClick={() => op('Falha ao encerrar', api.scheduler.stop)}><Square size={14} /> Encerrar testes</button>
        <label className="flex items-center gap-2 rounded-[9px] px-2 py-1 text-[12.5px] text-ink-200 ring-1 ring-white/10">
          <input type="checkbox" className="h-4 w-4 accent-[#4fd1c5]" checked={!!data?.aging} disabled={!data} onChange={(e) => op('Falha ao mudar aging', () => api.scheduler.aging(e.target.checked))} />
          Envelhecimento (aging)
        </label>
        <span className="ml-auto"><LiveBadge live={conn === 'connected' && !error} /></span>
      </div>

      <ErrorBanner error={error} />
      {loading && !data ? <Loading /> : data && (
        <>
          <p className="text-[12px] text-ink-400">
            Cada barra é a fatia de CPU que a tarefa recebeu no <b className="text-ink-200">último segundo</b> (todas no núcleo {data.core}).
            {' '}Medição: {data.cpuMethod === 'runtime' ? 'contador de tempo de execução do FreeRTOS' : 'proporção de voltas (o core não tem estatística de tempo de execução)'}.
            {running && <> · rodando há <span className="num">{fmtUptime(data.elapsedMs)}</span> (para sozinho em {data.maxSeconds} s)</>}
          </p>
          <div className="space-y-2">
            {data.tasks.map((t, i) => (
              <div key={t.id} className="panel grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[160px_1fr_auto]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i] }} />
                    <span className="font-semibold text-ink-50">{t.name}</span>
                    {t.aged && <span className="chip h-[18px] bg-volt-400/15 text-[10.5px] text-volt-300">aging</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-400">prioridade <b className="num text-ink-100">{t.priority}</b> <StateBadge state={t.state} /></div>
                </div>
                <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
                  <Bar value={t.cpu ?? 0} tone={i === 0 ? 'phos' : i === 1 ? 'volt' : 'warn'} label={`CPU de ${t.name}`} />
                  <div className="num mt-1 flex justify-between text-[11.5px] text-ink-400">
                    <span><b className="text-[13px] text-ink-50">{fmtPct(t.cpu, 1)}</b> da CPU</span>
                    <span>{fmtInt(t.loopsPerSec)} voltas/s</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {t.suspended
                    ? <button className="btn btn-sm" aria-label={`Retomar ${t.name}`} title="Retomar" disabled={!running} onClick={() => op('Falha', () => api.scheduler.task(t.id, 'resume'))}><Play size={13} /></button>
                    : <button className="btn btn-sm" aria-label={`Suspender ${t.name}`} title="Suspender" disabled={!running} onClick={() => op('Falha', () => api.scheduler.task(t.id, 'suspend'))}><Pause size={13} /></button>}
                  <button className="btn btn-sm" aria-label="Diminuir prioridade" title="Prioridade −1" disabled={!running || t.priority <= 1} onClick={() => op('Falha', () => api.scheduler.task(t.id, 'prio', t.priority - 1))}><ArrowDown size={13} /></button>
                  <button className="btn btn-sm" aria-label="Aumentar prioridade" title="Prioridade +1" disabled={!running || t.priority >= 8} onClick={() => op('Falha', () => api.scheduler.task(t.id, 'prio', t.priority + 1))}><ArrowUp size={13} /></button>
                </div>
              </div>
            ))}
          </div>

          {running && hist.current[0].length > 1 && (
            <div className="panel p-3">
              <div className="label mb-2">% de CPU por segundo (últimos 40 s)</div>
              <LineChart height={130} min={0} max={100} capacity={40} yFormat={(v) => `${Math.round(v)}%`}
                series={data.tasks.map((t, i) => ({ label: t.name, color: COLORS[i], values: hist.current[i], fill: false }))}
                xLabelLeft="−40 s" xLabelRight="agora" />
            </div>
          )}

          {insight && <Callout tone={insight.tone} title={insight.title}>{insight.body}</Callout>}
          {data.otherCpuTasks > 0 && <Callout tone="warn">Há {data.otherCpuTasks} tarefa(s) “cpu” do Gerenciador de Tarefas também no núcleo 0 — elas competem com estas.</Callout>}
          {data.lastEvent && <p className="text-[11.5px] text-ink-500">Último evento na placa: {data.lastEvent}</p>}
        </>
      )}
    </div>
  )
}

function interpret(d: SchedulerState): { tone: 'info' | 'ok' | 'warn' | 'bad' | 'idea'; title: string; body: string } | null {
  if (!d.running) return { tone: 'idea', title: 'Comece por um cenário', body: 'Escolha o cenário 2 e veja que só a tarefa de maior prioridade usa a CPU. Depois suspenda “alta” ou ligue o aging.' }
  const active = d.tasks.filter((t) => !t.suspended)
  if (!active.length) return { tone: 'info', title: 'Todas suspensas', body: 'Nenhuma tarefa pronta no núcleo 0: a CPU fica com a tarefa ociosa (IDLE0) e as do sistema.' }
  if (d.tasks.every((t) => t.cpu == null)) return { tone: 'info', title: 'Medindo…', body: 'A primeira medição aparece depois de 1 segundo.' }
  const top = Math.max(...active.map((t) => t.priority))
  const starving = active.filter((t) => t.priority < top && (t.cpu ?? 0) < 1)
  const tops = active.filter((t) => t.priority === top)
  if (starving.length) {
    return {
      tone: 'bad', title: 'Inanição (starvation)',
      body: `${tops.map((t) => `“${t.name}”`).join(' e ')} ${tops.length > 1 ? 'têm' : 'tem'} a maior prioridade (${top}) e ${tops.length > 1 ? 'nunca bloqueiam' : 'nunca bloqueia'}; ${starving.map((t) => `“${t.name}”`).join(' e ')} ${starving.length > 1 ? 'estão prontas' : 'está pronta'} mas não recebe${starving.length > 1 ? 'm' : ''} CPU. Suspenda as de prioridade ${top}, iguale as prioridades ou ligue o aging.`,
    }
  }
  if (tops.length > 1) return { tone: 'ok', title: 'Round-Robin', body: `${tops.length} tarefas de prioridade ${top} dividem o núcleo, cerca de ${Math.round(100 / tops.length)}% cada: o FreeRTOS troca entre elas a cada tick de 1 ms.` }
  if (d.aging && d.agingBoosts > 0) return { tone: 'idea', title: 'Aging em ação', body: 'Quem ficou 2 s sem CPU subiu de prioridade e executou; ao receber CPU volta à prioridade base. Assim ninguém espera para sempre.' }
  return { tone: 'info', title: 'Preempção por prioridade', body: `“${tops[0].name}” é a única pronta com a maior prioridade e fica com o núcleo.` }
}
