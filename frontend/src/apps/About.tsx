import { useEffect, useState } from 'react'
import { KeyRound, Pencil, Save, Users } from 'lucide-react'
import { APPS } from './meta'
import { AppIcon } from '../components/AppIcon'
import { ConceptBox } from '../components/ConceptBox'
import { Logo, Wordmark } from '../components/Logo'
import { Callout, Stat, TableWrap } from '../components/ui'
import { CONCEPTS } from '../content/concepts'
import { useNotify } from '../contexts/Notifications'
import { useSystem } from '../contexts/SystemContext'
import { api } from '../services/api'
import { fmtBytes, fmtUptime } from '../lib/format'
import type { AuthStatus } from '../types/api'

interface Group { grupo: string; turma: string; disciplina: string; professor: string; integrantes: string[] }
const GROUP_FILE = '/grupo.json'
const EMPTY: Group = { grupo: '', turma: '', disciplina: 'Introdução a Sistemas Operacionais', professor: 'Prof. Joelmir Ramos (Joel)', integrantes: [] }

const LAYERS = [
  { t: 'Apps do WebOS (esta página, no navegador)', d: 'React + TypeScript · cada janela é um app', c: 'from-sky-500/25 to-sky-500/10 ring-sky-400/30' },
  { t: 'API HTTP · servidor web', d: 'rotas /api/… respondem em JSON — como as chamadas de sistema de um SO', c: 'from-indigo-500/25 to-indigo-500/10 ring-indigo-400/30' },
  { t: 'Serviços', d: 'Wi-Fi (AP), LittleFS, driver do botão, monitor, login', c: 'from-teal-500/25 to-teal-500/10 ring-teal-400/30' },
  { t: 'Núcleo: FreeRTOS', d: 'escalonador, tarefas, filas, semáforos, mutex, heap', c: 'from-amber-500/25 to-amber-500/10 ring-amber-400/30' },
  { t: 'Hardware: ESP32', d: '2 núcleos Xtensa · RAM interna · flash SPI · GPIO · interrupções', c: 'from-rose-500/25 to-rose-500/10 ring-rose-400/30' },
]

export default function About() {
  const { info, metrics, runOp } = useSystem()
  const { notify } = useNotify()
  const [group, setGroup] = useState<Group | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Group>(EMPTY)
  const [auth, setAuth] = useState<AuthStatus | null>(null)

  useEffect(() => {
    api.files.read(GROUP_FILE).then((f) => { try { setGroup({ ...EMPTY, ...JSON.parse(f.content ?? '{}') }) } catch { setGroup(EMPTY) } }).catch(() => setGroup(EMPTY))
    api.auth.status().then(setAuth).catch(() => setAuth(null))
  }, [])

  const saveGroup = async () => {
    const clean = { ...draft, integrantes: draft.integrantes.map((s) => s.trim()).filter(Boolean) }
    const r = await runOp('Não foi possível salvar', () => api.files.write(GROUP_FILE, JSON.stringify(clean, null, 2)))
    if (r) { setGroup(clean); setEditing(false); notify('success', 'Dados do grupo salvos', `${GROUP_FILE} no LittleFS`) }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-4">
        <Logo size={56} />
        <div>
          <div className="text-[24px] leading-none"><Wordmark className="text-ink-50" /> <span className="text-[15px] text-ink-400">ESP32</span></div>
          <div className="mt-1 text-[12.5px] text-ink-400">versão {info?.version ?? '—'} · firmware compilado em {info?.build ?? '—'}</div>
        </div>
      </div>
      <ConceptBox id="about" concept={CONCEPTS.about} />

      {info && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Processador" value={<span className="text-[15px]">{info.chip.model} rev {info.chip.revision}</span>} />
            <Stat label="Núcleos · clock" value={`${info.chip.cores} × ${info.chip.cpuMHz} MHz`} />
            <Stat label="Flash" value={fmtBytes(info.chip.flashBytes)} hint={`${info.chip.flashMHz} MHz`} />
            <Stat label="Ligado há" value={fmtUptime(metrics?.uptimeMs ?? info.uptimeMs)} />
          </div>
          <p className="text-[12.5px] text-ink-300">
            Sistema base: FreeRTOS {info.freertos.kernel} (ESP-IDF {info.sdk}{info.arduinoCore ? ` · Arduino core ${info.arduinoCore}` : ''}) · tick de {1000 / info.freertos.tickHz} ms · {info.freertos.maxPriorities} níveis de prioridade ·
            {' '}RAM interna {fmtBytes(info.heap.total)}{info.chip.psramBytes ? ` + PSRAM ${fmtBytes(info.chip.psramBytes)}` : ''} · rede própria <b className="text-ink-100">{info.network.ssid}</b> em {info.network.ip} · MAC <span className="num">{info.chip.mac}</span>
          </p>
        </>
      )}

      <div>
        <h3 className="mb-2 text-[13px] font-semibold">Arquitetura do WebOS em camadas</h3>
        <div className="space-y-1.5">
          {LAYERS.map((l, i) => (
            <div key={l.t} className={`rounded-xl bg-gradient-to-r px-3.5 py-2.5 ring-1 ${l.c}`} style={{ marginLeft: `${i * 2}%`, marginRight: `${i * 2}%` }}>
              <div className="text-[13px] font-semibold text-ink-50">{l.t}</div>
              <div className="text-[12px] text-ink-300">{l.d}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-ink-500">Cada camada só conversa com a vizinha: o navegador nunca mexe no hardware diretamente — pede à API, que pede ao núcleo.</p>
      </div>

      <div>
        <h3 className="mb-2 text-[13px] font-semibold">Apps e conceitos da disciplina</h3>
        <TableWrap>
          <table className="tbl min-w-[560px]">
            <thead><tr><th>App</th><th>Conceito</th><th>Aula</th><th>Tipo</th></tr></thead>
            <tbody>
              {APPS.map((a) => (
                <tr key={a.id}>
                  <td><span className="flex items-center gap-2"><AppIcon id={a.id} size={20} />{a.title}</span></td>
                  <td className="text-ink-300">{a.summary}</td>
                  <td className="text-ink-300">{a.lesson.split(' · ')[0]}</td>
                  <td>{a.bonus ? <span className="text-amber-200">bônus</span> : 'obrigatório'}{a.simulation && <span className="ml-1 text-volt-300">(simulação)</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>

      <div className="panel p-3">
        <div className="label mb-1.5">Tecnologias</div>
        <p className="text-[12.5px] leading-relaxed text-ink-300">
          <b className="text-ink-100">Placa:</b> C++ (Arduino IDE 2.x / arduino-cli, core esp32 3.x), FreeRTOS, WebServer, LittleFS, Preferences (NVS), mbedTLS (SHA-256).{' '}
          <b className="text-ink-100">Interface:</b> React, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide. Gráficos em SVG próprio (sem bibliotecas pesadas). Tudo servido pela própria placa, comprimido em gzip — sem internet e sem CDN.
        </p>
      </div>

      <div className="panel p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="label flex items-center gap-1.5"><Users size={13} /> Grupo</span>
          {!editing && group && <button className="btn btn-sm" onClick={() => { setDraft(group); setEditing(true) }}><Pencil size={13} /> Editar</button>}
        </div>
        {!group ? <p className="text-[12.5px] text-ink-400">Carregando…</p> : !editing ? (
          <div className="text-[13px] text-ink-200">
            <div className="text-[15px] font-semibold text-ink-50">{group.grupo || 'Nome do grupo não definido'}</div>
            <div className="text-ink-400">{[group.disciplina, group.turma, group.professor].filter(Boolean).join(' · ')}</div>
            {group.integrantes.length ? <ul className="mt-2 columns-1 gap-6 sm:columns-2">{group.integrantes.map((p) => <li key={p}>• {p}</li>)}</ul> : <p className="mt-2 text-ink-400">Clique em Editar para cadastrar os integrantes (fica salvo em {GROUP_FILE}).</p>}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {(['grupo', 'turma', 'disciplina', 'professor'] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1"><span className="label">{k}</span><input className="field" value={draft[k]} maxLength={80} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} /></label>
            ))}
            <label className="flex flex-col gap-1 sm:col-span-2"><span className="label">integrantes (um por linha)</span>
              <textarea className="field min-h-[120px] py-2" value={draft.integrantes.join('\n')} onChange={(e) => setDraft({ ...draft, integrantes: e.target.value.split('\n').slice(0, 12) })} />
            </label>
            <div className="flex gap-2 sm:col-span-2"><button className="btn btn-primary" onClick={saveGroup}><Save size={14} /> Salvar na placa</button><button className="btn" onClick={() => setEditing(false)}>Cancelar</button></div>
          </div>
        )}
      </div>

      <LoginSettings auth={auth} onChange={setAuth} />
    </div>
  )
}

function LoginSettings({ auth, onChange }: { auth: AuthStatus | null; onChange: (a: AuthStatus) => void }) {
  const { runOp } = useSystem()
  const { notify } = useNotify()
  const [cur, setCur] = useState('')
  const [newPass, setNewPass] = useState('')
  const [required, setRequired] = useState<boolean | null>(null)
  if (!auth) return null
  const req = required ?? auth.required
  const apply = async () => {
    const r = await runOp('Configuração recusada', () => api.auth.config({ currentPass: cur, newPass: newPass || undefined, required: req }))
    if (r) { onChange(r); setCur(''); setNewPass(''); setRequired(null); notify('success', 'Login atualizado', r.required ? 'O login será pedido ao abrir o WebOS.' : 'O WebOS abre direto na área de trabalho.') }
  }
  return (
    <div className="panel p-3">
      <div className="label mb-2 flex items-center gap-1.5"><KeyRound size={13} /> Tela de login (recurso educacional)</div>
      <p className="mb-2 text-[12.5px] text-ink-300">
        Usuário <b className="text-ink-100">{auth.user}</b> · senha guardada como {auth.algorithm} · login {auth.required ? <b className="text-emerald-300">exigido</b> : <b className="text-ink-100">desativado</b>}.
        {auth.defaultPassword && <> A senha ainda é a padrão (<span className="num">webos</span>).</>}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex h-9 items-center gap-2 text-[12.5px] text-ink-200"><input type="checkbox" className="h-4 w-4 accent-[#4fd1c5]" checked={req} onChange={(e) => setRequired(e.target.checked)} /> exigir login ao abrir</label>
        <label className="flex flex-col gap-1"><span className="label">senha atual</span><input type="password" className="field w-[150px]" value={cur} onChange={(e) => setCur(e.target.value)} /></label>
        <label className="flex flex-col gap-1"><span className="label">nova senha (opcional)</span><input type="password" className="field w-[170px]" value={newPass} onChange={(e) => setNewPass(e.target.value)} /></label>
        <button className="btn btn-primary" disabled={!cur} onClick={apply}>Aplicar</button>
      </div>
      <Callout tone="warn">Limitação assumida: HTTP sem TLS e a API não exige o token. Num sistema real a senha viajaria por HTTPS e cada chamada verificaria a sessão.</Callout>
    </div>
  )
}
