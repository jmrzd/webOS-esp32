import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ChevronRight, FilePlus2, FileText, Folder, FolderPlus, HardDrive, Lock, RefreshCw, Save, Trash2 } from 'lucide-react'
import { ConceptBox } from '../components/ConceptBox'
import { Bar, Callout, ErrorBanner, Loading, TableWrap } from '../components/ui'
import { CONCEPTS } from '../content/concepts'
import { useNotify } from '../contexts/Notifications'
import { useSystem } from '../contexts/SystemContext'
import { useIsMobile } from '../hooks/useMediaQuery'
import { usePolling } from '../hooks/usePolling'
import { api } from '../services/api'
import { cx, fmtBytes, fmtHex, fmtPct } from '../lib/format'
import type { FileContent, PartitionTable } from '../types/api'

const NAME_RE = /^[A-Za-z0-9._ -]{1,31}$/
const PART_COLORS: Record<string, string> = { nvs: '#60a5fa', otadata: '#a78bfa', ota: '#4fd1c5', factory: '#4fd1c5', spiffs: '#f5b748', coredump: '#f472b6', phy: '#93a1c2' }

export default function FileExplorer() {
  const { runOp, conn } = useSystem()
  const { notify } = useNotify()
  const mobile = useIsMobile()
  const [dir, setDir] = useState('/')
  const fetchDir = useCallback(() => api.files.list(dir), [dir])
  const { data, error, loading, refresh } = usePolling(fetchDir, 5000)
  const [file, setFile] = useState<FileContent | null>(null)
  const [text, setText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [creating, setCreating] = useState<null | 'file' | 'dir'>(null)
  const [newName, setNewName] = useState('')
  const [parts, setParts] = useState<PartitionTable | null>(null)
  const can = conn === 'connected'

  useEffect(() => { refresh() }, [dir, refresh])
  useEffect(() => { api.system.partitions().then(setParts).catch(() => setParts(null)) }, [])

  const open = async (path: string) => {
    if (dirty && !confirm('Descartar as alterações não salvas?')) return
    const r = await runOp('Não foi possível abrir', () => api.files.read(path))
    if (r) { setFile(r); setText(r.content ?? ''); setDirty(false) }
  }

  const save = useCallback(async () => {
    if (!file || file.protected || file.binary) return
    const r = await runOp('Não foi possível salvar', () => api.files.write(file.path, text))
    if (r) { setDirty(false); setFile({ ...file, size: r.size }); notify('success', 'Arquivo salvo na flash', `${file.path} · ${fmtBytes(r.size)}`); refresh() }
  }, [file, text, runOp, notify, refresh])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 's' && file) { e.preventDefault(); save() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [save, file])

  const create = async () => {
    const nm = newName.trim()
    if (!NAME_RE.test(nm)) { notify('warning', 'Nome inválido', 'Use letras, números, ponto, hífen, sublinhado ou espaço (até 31 caracteres).'); return }
    const path = (dir === '/' ? '' : dir) + '/' + nm
    const r = await runOp('Não foi possível criar', () => api.files.create(path, creating!, ''))
    if (r) {
      setCreating(null); setNewName(''); refresh()
      if (creating === 'file') open(path)
    }
  }

  const remove = async (path: string, isDir: boolean) => {
    if (!confirm(`Apagar ${isDir ? 'a pasta' : 'o arquivo'} ${path}? Esta ação não pode ser desfeita.`)) return
    const r = await runOp('Não foi possível apagar', () => api.files.remove(path))
    if (r) { if (file?.path === path) { setFile(null); setDirty(false) } refresh() }
  }

  const crumbs = dir === '/' ? [] : dir.slice(1).split('/')
  const showList = !mobile || !file
  const showEditor = !mobile || !!file
  const maxBytes = data?.maxFileBytes ?? 16384
  const bytes = new TextEncoder().encode(text).length

  return (
    <div className="space-y-4 p-4">
      <ConceptBox id="files" concept={CONCEPTS.files} />
      <ErrorBanner error={error} />

      {data && (
        <div className="panel flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
          <HardDrive size={18} className="text-amber-300" />
          <div className="min-w-[180px] flex-1">
            <div className="mb-1 flex justify-between text-[12px]"><span className="text-ink-200">LittleFS · partição “{data.partition}”</span><span className="num text-ink-300">{fmtBytes(data.used)} de {fmtBytes(data.total)} ({fmtPct((data.used / data.total) * 100)})</span></div>
            <Bar value={data.used} max={data.total} tone={data.used / data.total > 0.9 ? 'bad' : 'warn'} label="Espaço usado" />
          </div>
          <span className="text-[12px] text-ink-400">livre: <b className="num text-ink-100">{fmtBytes(data.total - data.used)}</b></span>
        </div>
      )}

      <div className={cx('grid gap-3', !mobile && 'grid-cols-[minmax(240px,320px)_1fr]')}>
        {showList && (
          <div className="panel flex min-h-[300px] flex-col overflow-hidden">
            <div className="flex items-center gap-1 border-b border-white/[.06] px-2 py-1.5">
              <nav className="flex min-w-0 flex-1 items-center overflow-x-auto text-[12.5px] scroll-thin" aria-label="Caminho">
                <button className="rounded px-1.5 py-1 text-ink-200 hover:bg-white/[.06]" onClick={() => setDir('/')}>/</button>
                {crumbs.map((c, i) => (
                  <span key={i} className="flex items-center">
                    <ChevronRight size={12} className="text-ink-500" />
                    <button className="rounded px-1.5 py-1 text-ink-200 hover:bg-white/[.06]" onClick={() => setDir('/' + crumbs.slice(0, i + 1).join('/'))}>{c}</button>
                  </span>
                ))}
              </nav>
              <button className="icon-btn h-8 w-8" title="Novo arquivo" aria-label="Novo arquivo" disabled={!can || dir.startsWith('/www')} onClick={() => setCreating('file')}><FilePlus2 size={15} /></button>
              <button className="icon-btn h-8 w-8" title="Nova pasta" aria-label="Nova pasta" disabled={!can || dir.startsWith('/www')} onClick={() => setCreating('dir')}><FolderPlus size={15} /></button>
              <button className="icon-btn h-8 w-8" title="Atualizar" aria-label="Atualizar" onClick={refresh}><RefreshCw size={14} /></button>
            </div>
            {creating && (
              <form className="flex gap-1.5 border-b border-white/[.06] p-2" onSubmit={(e) => { e.preventDefault(); create() }}>
                <input autoFocus className="field h-8 flex-1 text-[12.5px]" placeholder={creating === 'file' ? 'nome.txt' : 'nome-da-pasta'} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={31} />
                <button className="btn btn-sm btn-primary" type="submit">Criar</button>
                <button className="btn btn-sm" type="button" onClick={() => { setCreating(null); setNewName('') }}>×</button>
              </form>
            )}
            <div className="min-h-0 flex-1 overflow-auto scroll-thin">
              {loading && !data ? <Loading /> : (
                <ul className="py-1">
                  {dir !== '/' && (
                    <li><button className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-ink-300 hover:bg-white/[.05]" onClick={() => setDir(dir.slice(0, dir.lastIndexOf('/')) || '/')}><ArrowLeft size={14} /> ..</button></li>
                  )}
                  {[...(data?.entries ?? [])].sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name)).map((e) => (
                    <li key={e.path} className={cx('group flex items-center', file?.path === e.path && 'bg-phos-400/10')}>
                      <button className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left hover:bg-white/[.05]" onClick={() => (e.isDir ? setDir(e.path) : open(e.path))}>
                        {e.isDir ? <Folder size={16} className="shrink-0 text-amber-300" /> : <FileText size={16} className="shrink-0 text-sky-300" />}
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-100">{e.name}</span>
                        {e.protected && <Lock size={12} className="shrink-0 text-ink-500" aria-label="protegido" />}
                        {!e.isDir && <span className="num shrink-0 text-[11.5px] text-ink-400">{fmtBytes(e.size)}</span>}
                      </button>
                      {!e.protected && (
                        <button className="icon-btn mr-1 h-8 w-8 opacity-60 hover:!text-rose-300 group-hover:opacity-100" title="Apagar" aria-label={`Apagar ${e.name}`} onClick={() => remove(e.path, e.isDir)}><Trash2 size={14} /></button>
                      )}
                    </li>
                  ))}
                  {data && !data.entries.length && <li className="px-3 py-8 text-center text-[12.5px] text-ink-400">Pasta vazia.</li>}
                </ul>
              )}
            </div>
          </div>
        )}

        {showEditor && (
          <div className="panel flex min-h-[300px] flex-col overflow-hidden">
            {!file ? (
              <div className="grid flex-1 place-items-center p-6 text-center text-[12.5px] text-ink-400">Abra um arquivo para ler ou editar.<br />As alterações são gravadas na flash do ESP32.</div>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-white/[.06] px-2 py-1.5">
                  {mobile && <button className="icon-btn h-8 w-8" aria-label="Voltar" onClick={() => { if (!dirty || confirm('Descartar alterações?')) { setFile(null); setDirty(false) } }}><ArrowLeft size={15} /></button>}
                  <span className="num min-w-0 flex-1 truncate text-[12.5px] text-ink-100">{file.path}{dirty && <span className="ml-1 text-amber-300">●</span>}</span>
                  {!file.protected && !file.binary && <button className="btn btn-sm btn-primary" disabled={!dirty || bytes > maxBytes} onClick={save}><Save size={13} /> Salvar</button>}
                  {!file.protected && <button className="btn btn-sm btn-danger" aria-label="Apagar arquivo" onClick={() => remove(file.path, false)}><Trash2 size={13} /></button>}
                </div>
                {file.binary ? (
                  <div className="grid flex-1 place-items-center p-6 text-center text-[12.5px] text-ink-400">Arquivo binário ({fmtBytes(file.size)}).<br />{file.path.endsWith('.gz') ? 'É parte da interface do WebOS, comprimida com gzip.' : 'Não pode ser editado como texto.'}</div>
                ) : (
                  <>
                    <textarea
                      value={text}
                      readOnly={file.protected}
                      onChange={(e) => { setText(e.target.value); setDirty(true) }}
                      spellCheck={false}
                      className="num min-h-[260px] flex-1 resize-none bg-transparent p-3 text-[12.8px] leading-relaxed text-ink-100 outline-none"
                      aria-label={`Conteúdo de ${file.path}`}
                    />
                    <div className="flex justify-between border-t border-white/[.06] px-3 py-1.5 text-[11px] text-ink-400">
                      <span>{file.protected ? 'somente leitura (/www é a interface)' : 'Ctrl+S salva'}{file.truncated && ' · arquivo truncado na leitura'}</span>
                      <span className={cx('num', bytes > maxBytes && 'text-rose-300')}>{fmtBytes(bytes)} / {fmtBytes(maxBytes, 0)}</span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {parts && <PartitionView t={parts} />}
      <Callout tone="idea" title="Teste de persistência">Salve um arquivo, reinicie a placa (botão EN ou menu Iniciar › reiniciar) e abra-o de novo: ele continua lá porque está na flash, não na RAM.</Callout>
      {conn !== 'connected' && <p className="text-[12px] text-rose-300">Sem conexão: a lista pode estar desatualizada.</p>}
    </div>
  )
}

function PartitionView({ t }: { t: PartitionTable }) {
  const total = t.flashBytes || 4 * 1024 * 1024
  return (
    <div className="panel p-3">
      <div className="mb-2 flex items-baseline justify-between"><h3 className="text-[13px] font-semibold">Tabela de partições da flash <span className="text-ink-400">· Aula 4</span></h3><span className="num text-[11.5px] text-ink-400">{fmtBytes(total)}</span></div>
      <div className="relative mb-3 h-8 overflow-hidden rounded-md bg-white/[.04] ring-1 ring-white/[.06]">
        {t.partitions.map((p) => (
          <div key={p.label + p.offset} title={`${p.label} · ${fmtBytes(p.size)} @ ${fmtHex(p.offset)}`} className="absolute inset-y-0 border-r border-ink-950/60"
            style={{ left: `${(p.offset / total) * 100}%`, width: `${(p.size / total) * 100}%`, background: PART_COLORS[p.subtype] ?? '#6c7a9d', opacity: p.running || p.filesystem ? 1 : 0.55 }} />
        ))}
      </div>
      <TableWrap>
        <table className="tbl min-w-[520px]">
          <thead><tr><th>Nome</th><th>Tipo</th><th>Subtipo</th><th>Início</th><th>Tamanho</th><th></th></tr></thead>
          <tbody>
            {t.partitions.map((p) => (
              <tr key={p.label + p.offset}>
                <td className="font-medium"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: PART_COLORS[p.subtype] ?? '#6c7a9d' }} />{p.label}</td>
                <td>{p.type}</td><td>{p.subtype}</td>
                <td className="num">{fmtHex(p.offset)}</td><td className="num">{fmtBytes(p.size)}</td>
                <td className="text-[12px] text-ink-400">{p.running ? 'firmware em execução' : p.filesystem ? 'LittleFS (arquivos + interface)' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </div>
  )
}
