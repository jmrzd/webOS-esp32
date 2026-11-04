import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Pause, Play, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { ConceptBox } from '../components/ConceptBox'
import { Callout, ErrorBanner, LiveBadge, Loading, Segmented, StateBadge, TableWrap } from '../components/ui'
import { CONCEPTS } from '../content/concepts'
import { ProcessStateDiagram } from '../content/diagrams'
import { useSystem } from '../contexts/SystemContext'
import { usePolling } from '../hooks/usePolling'
import { api } from '../services/api'
import { cx, fmtInt, fmtPct } from '../lib/format'
import type { TaskInfo } from '../types/api'

type Filter = 'todas' | 'usuario' | 'sistema'
type SortKey = 'pid' | 'name' | 'state' | 'priority' | 'core' | 'stackFree' | 'cpu'

export default function TaskManager() {
  const { runOp, conn } = useSystem()
  const { data, error, loading, refresh } = usePolling(api.tasks.list, 1000)
  const [type, setType] = useState<'cpu' | 'contador'>('contador')
  const [prio, setPrio] = useState(1)
  const [name, setName] = useState('')
  const [filter, setFilter] = useState<Filter>('todas')
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: 'pid', asc: true })

  const tasks = useMemo(() => {
    let t = data?.tasks ?? []
    if (filter === 'usuario') t = t.filter((x) => x.user)
    if (filter === 'sistema') t = t.filter((x) => !x.user)
    const dir = sort.asc ? 1 : -1
    return [...t].sort((a, b) => {
      const va = a[sort.k] ?? -1, vb = b[sort.k] ?? -1
      return (typeof va === 'string' ? va.localeCompare(String(vb)) : (va as number) - (vb as number)) * dir
    })
  }, [data, filter, sort])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const t of data?.tasks ?? []) c[t.state] = (c[t.state] ?? 0) + 1
    return c
  }, [data])

  const userTasks = data?.tasks.filter((t) => t.user) ?? []
  const act = async (label: string, fn: () => Promise<unknown>) => { await runOp(label, fn); refresh() }

  const create = () => act('Não foi possível criar a tarefa', async () => {
    const r = await api.tasks.create(type, prio, name.trim() || undefined)
    setName('')
    return r
  })

  const insight = buildInsight(data?.tasks ?? [])

  return (
    <div className="space-y-4 p-4">
      <ConceptBox id="tasks" concept={{ ...CONCEPTS.tasks, diagram: <ProcessStateDiagram counts={counts} /> }} />

      <div className="panel flex flex-wrap items-end gap-2.5 p-3">
        <label className="flex min-w-[150px] flex-col gap-1">
          <span className="label">Programa</span>
          <select className="field" value={type} onChange={(e) => setType(e.target.value as 'cpu' | 'contador')}>
            <option value="contador">contador (dorme 100 ms)</option>
            <option value="cpu">cpu (só calcula, núcleo 0)</option>
          </select>
        </label>
        <label className="flex w-[110px] flex-col gap-1">
          <span className="label">Prioridade</span>
          <select className="field" value={prio} onChange={(e) => setPrio(Number(e.target.value))}>
            {Array.from({ length: (data?.prioMax ?? 8) - (data?.prioMin ?? 1) + 1 }, (_, i) => (data?.prioMin ?? 1) + i).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="flex min-w-[140px] flex-1 flex-col gap-1">
          <span className="label">Nome (opcional)</span>
          <input className="field" value={name} maxLength={15} placeholder="ex.: calculo-1" onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))} />
        </label>
        <button className="btn btn-primary" onClick={create} disabled={conn !== 'connected' || userTasks.length >= (data?.maxUserTasks ?? 12)}>
          <Plus size={16} /> Criar processo
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-ink-300">
          Tarefas no FreeRTOS: <b className="num text-ink-50">{data ? fmtInt(data.total) : '—'}</b> (inclui as internas: Wi-Fi, ociosas, timers).
          {' '}Suas tarefas: <b className="num text-ink-50">{userTasks.length}</b>/{data?.maxUserTasks ?? 12}.
        </p>
        <div className="flex items-center gap-2">
          <LiveBadge live={conn === 'connected' && !error} />
          <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'todas', label: 'Todas' }, { value: 'usuario', label: 'Usuário' }, { value: 'sistema', label: 'Sistema' }]} />
        </div>
      </div>

      <ErrorBanner error={error} />
      {data && !data.traceFacility && (
        <Callout tone="warn" title="Listagem parcial">O FreeRTOS deste core do Arduino foi compilado sem <i>trace facility</i>; só as tarefas criadas pelo WebOS podem ser listadas. Nenhum dado de tarefa do sistema é inventado.</Callout>
      )}

      {loading && !data ? <Loading /> : (
        <TableWrap maxH={420}>
          <table className="tbl min-w-[860px]">
            <thead>
              <tr>
                {([['pid', 'PID'], ['name', 'Nome']] as const).map(([k, l]) => <Th key={k} k={k} sort={sort} setSort={setSort}>{l}</Th>)}
                <th>Tipo</th>
                <Th k="state" sort={sort} setSort={setSort}>Estado</Th>
                <Th k="priority" sort={sort} setSort={setSort}>Prio</Th>
                <Th k="core" sort={sort} setSort={setSort}>Núcleo</Th>
                <Th k="stackFree" sort={sort} setSort={setSort}>Pilha livre</Th>
                <Th k="cpu" sort={sort} setSort={setSort}>CPU</Th>
                <th>Contador</th>
                <th>Ritmo/s</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.pid} className={cx(t.user && 'bg-phos-400/[.035]')}>
                  <td className="num text-ink-300">{t.pid}</td>
                  <td className="font-medium text-ink-50">{t.name}</td>
                  <td className="text-ink-300">{t.type}</td>
                  <td><StateBadge state={t.state} /></td>
                  <td className="num">
                    {t.priority}
                    {t.priority !== t.basePriority && <span className="ml-1 text-[11px] text-amber-200" title="prioridade herdada temporariamente (herança de prioridade do mutex)">(base {t.basePriority})</span>}
                  </td>
                  <td className="num">{t.core < 0 ? <span className="text-ink-400" title="sem afinidade: pode rodar em qualquer núcleo">qualquer</span> : t.core}</td>
                  <td className={cx('num', t.stackFree < 512 ? 'text-rose-300' : t.stackFree < 1024 ? 'text-amber-200' : '')}>{fmtInt(t.stackFree)} B</td>
                  <td className="num">{t.cpu == null ? <span className="text-ink-500">—</span> : fmtPct(t.cpu, 1)}</td>
                  <td className="num text-ink-300">{t.counter == null ? '—' : fmtInt(t.counter)}</td>
                  <td className="num text-ink-300">{t.rate == null ? '—' : fmtInt(t.rate)}</td>
                  <td className="text-right">
                    {t.protected ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-ink-500" title={t.protectedReason}><ShieldCheck size={13} /> protegido</span>
                    ) : (
                      <div className="inline-flex gap-1">
                        {t.state === 'suspensa'
                          ? <button className="btn btn-sm" title="Retomar (vTaskResume)" aria-label="Retomar" onClick={() => act('Falha ao retomar', () => api.tasks.resume(t.pid))}><Play size={13} /></button>
                          : <button className="btn btn-sm" title="Suspender (vTaskSuspend)" aria-label="Suspender" onClick={() => act('Falha ao suspender', () => api.tasks.suspend(t.pid))}><Pause size={13} /></button>}
                        <button className="btn btn-sm" title="Diminuir prioridade" aria-label="Diminuir prioridade" disabled={t.basePriority <= (data?.prioMin ?? 1)} onClick={() => act('Falha ao mudar prioridade', () => api.tasks.priority(t.pid, t.basePriority - 1))}><ArrowDown size={13} /></button>
                        <button className="btn btn-sm" title="Aumentar prioridade" aria-label="Aumentar prioridade" disabled={t.basePriority >= (data?.prioMax ?? 8)} onClick={() => act('Falha ao mudar prioridade', () => api.tasks.priority(t.pid, t.basePriority + 1))}><ArrowUp size={13} /></button>
                        <button className="btn btn-sm btn-danger" title="Finalizar (vTaskDelete)" aria-label="Finalizar" onClick={() => act('Falha ao finalizar', () => api.tasks.remove(t.pid))}><Trash2 size={13} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!tasks.length && <tr><td colSpan={11} className="py-8 text-center text-ink-400">Nenhuma tarefa neste filtro. Crie uma acima.</td></tr>}
            </tbody>
          </table>
        </TableWrap>
      )}

      {insight && <Callout tone={insight.tone} title={insight.title}>{insight.body}</Callout>}
      <p className="text-[11.5px] text-ink-500">
        CPU = % do tempo de um núcleo usado no último segundo. Pilha livre = menor espaço livre que a pilha já teve (marca d'água). Tarefas do sistema e do Escalonador ao vivo são protegidas aqui.
      </p>
    </div>
  )
}

function Th({ k, sort, setSort, children }: { k: SortKey; sort: { k: SortKey; asc: boolean }; setSort: (s: { k: SortKey; asc: boolean }) => void; children: React.ReactNode }) {
  const on = sort.k === k
  return (
    <th>
      <button className={cx('inline-flex items-center gap-0.5 uppercase', on && 'text-ink-100')} onClick={() => setSort({ k, asc: on ? !sort.asc : true })}>
        {children}{on ? (sort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
      </button>
    </th>
  )
}

function buildInsight(tasks: TaskInfo[]) {
  const user = tasks.filter((t) => t.user)
  if (!user.length) return { tone: 'idea' as const, title: 'Experimente', body: 'Crie uma tarefa “contador” e uma “cpu” para comparar uma tarefa I/O-bound (quase sempre bloqueada) com uma CPU-bound (sempre pronta ou executando).' }
  const cpu = user.filter((t) => t.type === 'cpu' && t.state !== 'suspensa')
  if (cpu.length >= 2) {
    const top = Math.max(...cpu.map((t) => t.priority))
    const starving = cpu.filter((t) => t.priority < top && (t.rate ?? 0) === 0)
    if (starving.length) return { tone: 'warn' as const, title: 'Inanição observada', body: `${starving.map((t) => t.name).join(', ')} está pronta mas com ritmo 0: uma tarefa “cpu” de prioridade ${top} nunca bloqueia e o escalonador sempre a prefere.` }
    const same = cpu.every((t) => t.priority === top)
    if (same) return { tone: 'ok' as const, title: 'Round-Robin', body: 'As tarefas “cpu” têm a mesma prioridade e dividem o núcleo 0: o escalonador alterna entre elas a cada tick (1 ms).' }
  }
  const blocked = user.filter((t) => t.type === 'contador' && t.state === 'bloqueada').length
  if (blocked) return { tone: 'info' as const, title: 'Tarefas I/O-bound', body: `${blocked} tarefa(s) “contador” aparece(m) bloqueada(s): passam quase todo o tempo em vTaskDelay(100 ms) e não consomem CPU.` }
  return null
}
