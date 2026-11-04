// Inicialização em 3 etapas: boot da interface → detecção do hardware → ambiente.
// Nada de hardware é exibido antes de uma resposta válida da placa.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CircleAlert, Cpu, HardDrive, Loader2, MemoryStick, Network, RefreshCw, Timer, Wifi, X } from 'lucide-react'
import { Logo, Wordmark } from '../components/Logo'
import { Wallpaper } from '../desktop/Wallpaper'
import { ApiError, BOARD_ADDRESS, api, errorMessage } from '../services/api'
import type { AuthStatus, SystemInfo } from '../types/api'
import { cx, fmtBytes, fmtUptime } from '../lib/format'

type Phase = 'boot' | 'detect' | 'init'
type StepState = 'wait' | 'run' | 'ok' | 'warn' | 'fail'
interface Step { label: string; state: StepState; detail?: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const VERSION = '1.0.0'

function validInfo(i: unknown): i is SystemInfo {
  const x = i as SystemInfo
  return !!x && typeof x.chip?.model === 'string' && typeof x.chip?.cores === 'number' && typeof x.heap?.free === 'number' && typeof x.freertos?.kernel === 'string'
}

export function BootSequence({ onDone }: { onDone: (info: SystemInfo, auth: AuthStatus | null) => void }) {
  const [phase, setPhase] = useState<Phase>('boot')
  const [steps, setSteps] = useState<Step[]>([])
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const started = useRef(false)

  const push = (label: string) => setSteps((s) => [...s, { label, state: 'run' }])
  const finish = (state: StepState, detail?: string) => setSteps((s) => s.map((st, i) => (i === s.length - 1 ? { ...st, state, detail } : st)))

  // Etapa 1 — interface
  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      push('Carregando a interface do WebOS')
      await sleep(350)
      finish('ok', `v${VERSION}`)
      push('Verificando integridade da interface')
      const missing = (['fetch', 'AbortController', 'URLSearchParams', 'Promise'] as const).filter((k) => !(k in window))
      const css = document.styleSheets.length > 0
      await sleep(300)
      if (missing.length || !css) finish('fail', `navegador sem suporte: ${missing.join(', ') || 'estilos'}`)
      else finish('ok', 'recursos do navegador e estilos carregados')
      push('Preparando serviços de comunicação')
      await sleep(300)
      finish('ok', 'cliente HTTP com timeout, fila e reconexão')
      await sleep(250)
      setPhase('detect')
    })()
  }, [])

  // Etapa 2 — detecção do hardware (e nova tentativa automática)
  useEffect(() => {
    if (phase !== 'detect') return
    let cancel = false
    ;(async () => {
      setFailure(null)
      setInfo(null)
      setSteps([{ label: `Procurando o ESP32 em ${BOARD_ADDRESS || '192.168.4.1'}`, state: 'run' }])
      try {
        const h = await api.system.health(3000)
        if (cancel) return
        if (h.status !== 'ok') throw new ApiError('bad_health', 'a placa respondeu, mas não está saudável', 200)
        finish('ok', `API respondeu · ligada há ${fmtUptime(h.uptimeMs)}`)
        push('Lendo a identificação da placa')
        const i = await api.system.info()
        if (cancel) return
        if (!validInfo(i)) throw new ApiError('bad_info', 'resposta de identificação inválida', 200)
        finish('ok', `${i.chip.model} · firmware ${i.name} ${i.version}`)
        setInfo(i)
        push('Conexão confirmada')
        await sleep(200)
        finish('ok', `${i.network.ssid} · ${i.network.ip}`)
        await sleep(900)
        if (!cancel) setPhase('init')
      } catch (e) {
        if (cancel) return
        finish('fail', errorMessage(e))
        setFailure(errorMessage(e))
        setCountdown(5)
      }
    })()
    return () => { cancel = true }
  }, [phase, attempt])

  useEffect(() => {
    if (!failure || countdown <= 0) return
    const t = setTimeout(() => {
      if (countdown === 1) setAttempt((a) => a + 1)
      setCountdown((c) => c - 1)
    }, 1000)
    return () => clearTimeout(t)
  }, [failure, countdown])

  // Etapa 3 — ambiente
  useEffect(() => {
    if (phase !== 'init' || !info) return
    let cancel = false
    ;(async () => {
      setSteps([])
      const checks: [string, () => Promise<unknown>][] = [
        ['Métricas do sistema', api.system.metrics],
        ['Tabela de tarefas do FreeRTOS', api.tasks.list],
        ['Sistema de arquivos LittleFS', () => api.files.list('/')],
        ['Dispositivos (LED e botão)', api.devices.get],
      ]
      for (const [label, fn] of checks) {
        if (cancel) return
        push(label)
        try { await fn(); finish('ok') } catch (e) {
          if (e instanceof ApiError && e.isNetwork) { finish('fail', e.message); setPhase('detect'); return }
          finish('warn', errorMessage(e))
        }
      }
      push('Preparando a área de trabalho')
      let auth: AuthStatus | null
      try { auth = await api.auth.status() } catch { auth = null }
      await sleep(250)
      finish('ok')
      await sleep(450)
      if (!cancel) onDone(info, auth)
    })()
    return () => { cancel = true }
  }, [phase, info, onDone])

  const titles: Record<Phase, string> = { boot: 'Iniciando', detect: 'Detectando o hardware', init: 'Inicializando o ambiente' }
  const phaseIdx = ['boot', 'detect', 'init'].indexOf(phase)

  return (
    <motion.div exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.35 } }} className="fixed inset-0 overflow-auto bg-ink-950">
      <Wallpaper id="aurora" />
      <div className="pointer-events-none absolute inset-0 bg-black/45" />
      <div className="relative mx-auto flex min-h-full w-full max-w-[560px] flex-col items-center justify-center px-5 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
          <Logo size={72} animated />
          <div className="mt-5 text-[34px] font-bold leading-none tracking-[-.03em]"><Wordmark className="text-ink-50" /> <span className="num align-middle text-[13px] font-medium tracking-normal text-ink-400">ESP32</span></div>
          <p className="mt-2.5 text-[13px] text-ink-400">Sistema operacional web · FreeRTOS no hardware</p>
        </motion.div>

        <div className="mt-8 flex w-full items-center gap-2">
          {['Interface', 'Hardware', 'Ambiente'].map((t, i) => (
            <div key={t} className="flex-1">
              <div className="h-[3px] overflow-hidden rounded-full bg-white/[.07]">
                <motion.div className="h-full bg-phos-400 shadow-[0_0_10px_rgb(82_227_179/.8)]" initial={{ width: 0 }} animate={{ width: i < phaseIdx ? '100%' : i === phaseIdx ? '55%' : '0%' }} transition={{ duration: 0.6 }} />
              </div>
              <div className={cx('label mt-2 text-center !text-[10px]', i <= phaseIdx ? '!text-ink-200' : '!text-ink-500')}>{t}</div>
            </div>
          ))}
        </div>

        <div className="glass mt-6 w-full rounded-[20px] p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink-100">{titles[phase]}</span>
            {phase === 'detect' && !failure && <Loader2 size={15} className="animate-spin text-phos-300" />}
          </div>
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {steps.map((s, i) => (
                <motion.li key={phase + i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2.5 text-[12.8px]">
                  <StepIcon state={s.state} />
                  <span className="min-w-0">
                    <span className={s.state === 'fail' ? 'text-rose-200' : 'text-ink-100'}>{s.label}</span>
                    {s.detail && <span className={cx('block text-[11.5px]', s.state === 'fail' ? 'text-rose-300/80' : s.state === 'warn' ? 'text-amber-200/80' : 'text-ink-400')}>{s.detail}</span>}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <AnimatePresence>
            {info && phase !== 'boot' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[.07] pt-3 sm:grid-cols-3">
                  <HwItem icon={<Cpu size={14} />} label="Processador" value={`${info.chip.model} rev ${info.chip.revision}`} />
                  <HwItem icon={<Cpu size={14} />} label="Núcleos · clock" value={`${info.chip.cores} × ${info.chip.cpuMHz} MHz`} />
                  <HwItem icon={<HardDrive size={14} />} label="Flash" value={fmtBytes(info.chip.flashBytes)} />
                  <HwItem icon={<MemoryStick size={14} />} label="Heap livre" value={fmtBytes(info.heap.free)} />
                  <HwItem icon={<Timer size={14} />} label="Ligada há" value={fmtUptime(info.uptimeMs)} />
                  <HwItem icon={<Network size={14} />} label="FreeRTOS" value={info.freertos.kernel} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {failure && phase === 'detect' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 w-full rounded-2xl border border-rose-400/25 bg-rose-500/[.07] p-4">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-rose-200"><Wifi size={16} /> O ESP32 não respondeu</div>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[12.8px] leading-relaxed text-ink-200">
                <li>Conecte este aparelho à rede Wi-Fi <b className="text-ink-50">WebOS-ESP32-xxxx</b> (senha padrão <span className="num">webos1234</span>) pelas configurações do sistema — o navegador não pode trocar de rede sozinho.</li>
                <li>Abra <span className="num text-phos-200">http://192.168.4.1</span> (com <b>http</b>, não https).</li>
                <li>No celular, desligue os dados móveis e aceite “rede sem internet”.</li>
                <li>Se a placa acabou de ser gravada, aguarde alguns segundos e confira se está alimentada.</li>
              </ol>
              <div className="mt-3 flex items-center gap-3">
                <button className="btn btn-primary" onClick={() => { setCountdown(0); setAttempt((a) => a + 1) }}><RefreshCw size={15} /> Tentar agora</button>
                {countdown > 0 && <span className="text-[12px] text-ink-400">nova tentativa em {countdown} s</span>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function StepIcon({ state }: { state: StepState }) {
  const base = 'mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px]'
  if (state === 'run') return <span className={base}><Loader2 size={14} className="animate-spin text-phos-300" /></span>
  if (state === 'ok') return <span className={cx(base, 'bg-phos-400/15 text-phos-300 ring-1 ring-phos-400/25')}><Check size={12} strokeWidth={3} /></span>
  if (state === 'warn') return <span className={cx(base, 'bg-amber-400/20 text-amber-200')}><CircleAlert size={12} strokeWidth={3} /></span>
  if (state === 'fail') return <span className={cx(base, 'bg-rose-400/20 text-rose-300')}><X size={12} strokeWidth={3} /></span>
  return <span className={cx(base, 'bg-white/10')} />
}

function HwItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[10px] bg-black/25 px-3 py-2 ring-1 ring-white/[.05]">
      <div className="label flex items-center gap-1.5 !text-[9.5px]">{icon}{label}</div>
      <div className="num mt-0.5 truncate text-[12.5px] text-ink-50" title={value}>{value}</div>
    </div>
  )
}
