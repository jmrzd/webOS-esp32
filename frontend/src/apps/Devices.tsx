import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Power, RotateCcw, Settings2 } from 'lucide-react'
import { ConceptBox } from '../components/ConceptBox'
import { Callout, ErrorBanner, LiveBadge, Loading, Stat } from '../components/ui'
import { CONCEPTS } from '../content/concepts'
import { useSystem } from '../contexts/SystemContext'
import { usePolling } from '../hooks/usePolling'
import { api } from '../services/api'
import { ago, cx, fmtInt } from '../lib/format'
import type { DevicesState } from '../types/api'

export default function Devices() {
  const { runOp, conn } = useSystem()
  const { data, setData, error, loading } = usePolling(api.devices.get, 500)
  const [cfgOpen, setCfgOpen] = useState(false)
  const [pin, setPin] = useState<number | null>(null)
  const [low, setLow] = useState(false)
  const [pulse, setPulse] = useState(0)
  const lastIrq = useRef<number | null>(null)
  const can = conn === 'connected'

  useEffect(() => {
    if (!data) return
    if (lastIrq.current != null && data.button.interrupts > lastIrq.current) setPulse((p) => p + 1)
    lastIrq.current = data.button.interrupts
  }, [data])

  const merge = (patch: Partial<DevicesState>) => setData((d) => (d ? { ...d, ...patch } : d))
  const led = async () => { const r = await runOp('Falha no LED', () => api.devices.led('toggle')); if (r) merge(r) }
  const saveCfg = async () => {
    if (pin == null) return
    const r = await runOp('Configuração recusada', () => api.devices.config(pin, low), 'GPIO do LED atualizado e salvo na NVS')
    if (r) { merge(r); setCfgOpen(false) }
  }
  const resetBtn = async () => { const r = await runOp('Falha', api.devices.resetButton); if (r) merge(r) }

  if (loading && !data) return <div className="space-y-4 p-4"><ConceptBox id="devices" concept={CONCEPTS.devices} /><Loading /></div>
  const b = data?.button
  const l = data?.led

  return (
    <div className="space-y-4 p-4">
      <ConceptBox id="devices" concept={CONCEPTS.devices} />
      <ErrorBanner error={error} />
      <div className="flex justify-end"><LiveBadge live={can && !error} /></div>
      {l && b && (
        <>
          {/* LED */}
          <div className="panel flex flex-wrap items-center gap-4 p-4">
            <motion.div
              className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full"
              animate={{ boxShadow: l.on ? '0 0 34px 8px rgb(96 165 250 / .65), inset 0 0 12px rgb(255 255 255 / .6)' : '0 0 0 0 rgb(0 0 0 / 0), inset 0 2px 8px rgb(0 0 0 / .6)', background: l.on ? 'radial-gradient(circle at 40% 35%, #dbeafe, #3b82f6 55%, #1d4ed8)' : 'radial-gradient(circle at 40% 35%, #3a4560, #1a2238 70%)' }}
              transition={{ duration: 0.25 }}
              aria-label={l.on ? 'LED ligado' : 'LED desligado'}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink-50">LED — dispositivo de saída (GPIO {l.pin})</div>
              <div className="text-[12px] text-ink-400">Estado confirmado pela placa: <b className={l.on ? 'text-sky-300' : 'text-ink-200'}>{l.on ? 'ligado' : 'desligado'}</b> · nível no pino: <span className="num">{l.level ? 'HIGH' : 'LOW'}</span> ({l.activeLow ? 'ativo em LOW' : 'ativo em HIGH'}) · {fmtInt(l.toggles)} trocas</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={cx('btn', l.on ? 'btn-volt' : 'btn-primary')} disabled={!can} onClick={led}><Power size={15} /> {l.on ? 'Desligar' : 'Ligar'}</button>
                <button className="btn" onClick={() => { setCfgOpen((o) => !o); setPin(l.pin); setLow(l.activeLow) }}><Settings2 size={15} /> Pino do LED</button>
              </div>
            </div>
          </div>
          {cfgOpen && (
            <div className="panel flex flex-wrap items-end gap-2.5 p-3">
              <label className="flex flex-col gap-1">
                <span className="label">GPIO</span>
                <select className="field w-[120px]" value={pin ?? l.pin} onChange={(e) => setPin(Number(e.target.value))}>
                  {l.allowedPins.map((p) => <option key={p} value={p}>GPIO {p}</option>)}
                </select>
              </label>
              <label className="flex h-9 items-center gap-2 text-[12.5px] text-ink-200"><input type="checkbox" className="h-4 w-4 accent-[#4fd1c5]" checked={low} onChange={(e) => setLow(e.target.checked)} /> LED acende com nível LOW</label>
              <button className="btn btn-primary" disabled={!can} onClick={saveCfg}>Aplicar e salvar</button>
              <p className="basis-full text-[11.5px] text-ink-400">Placas diferentes ligam o LED em pinos diferentes (DevKit V1: GPIO 2). Pinos 6–11 (flash), 34–39 (só entrada), 0 (BOOT) e 1/3 (serial) não são oferecidos.</p>
            </div>
          )}

          {/* Botão */}
          <div className="panel p-4">
            <div className="flex flex-wrap items-center gap-4">
              <motion.div
                className={cx('grid h-14 w-16 shrink-0 place-items-center rounded-xl text-[12px] font-bold tracking-wider', b.pressedNow ? 'bg-amber-300 text-amber-950' : 'bg-ink-700 text-ink-100')}
                animate={{ y: b.pressedNow ? 3 : 0, boxShadow: b.pressedNow ? '0 1px 0 #6b4a07' : '0 4px 0 #0d1425' }}
              >BOOT</motion.div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-ink-50">Botão BOOT — entrada por interrupção (GPIO {b.pin})</div>
                <div className="text-[12px] text-ink-400">Aperte o botão na placa e veja os números mudarem. Borda {b.trigger === 'FALLING' ? 'de descida' : b.trigger} · pull-up · debounce {b.debounceMs} ms</div>
              </div>
              <button className="btn btn-sm" onClick={resetBtn} disabled={!can}><RotateCcw size={13} /> Zerar</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="Interrupções recebidas" value={fmtInt(b.interrupts)} big />
              <Stat label="Apertos válidos" value={fmtInt(b.valid)} big tone="ok" />
              <Stat label="Repiques filtrados" value={fmtInt(b.filtered)} big tone={b.filtered ? 'warn' : undefined} />
              <Stat label="Eventos na fila" value={fmtInt(b.queued)} big hint={b.dropped ? `${b.dropped} perdidos (fila cheia)` : 'ISR → driver'} />
            </div>

            <Pipeline pulse={pulse} driverState={b.driverState} />
          </div>

          {b.interrupts > b.valid && b.valid > 0 ? (
            <Callout tone="info" title="Repique mecânico">
              {fmtInt(b.interrupts)} interrupções geraram {fmtInt(b.valid)} aperto(s) válido(s). O contato metálico “quica” e dispara várias interrupções; a ISR só põe o evento na fila e a tarefa <b>driver-botao</b> descarta os repiques (debounce). Com <b>polling</b>, o programa teria de ler o pino o tempo todo, gastando CPU.
            </Callout>
          ) : b.valid > 0 ? (
            <Callout tone="ok">Cada aperto gerou uma interrupção limpa. Aperte várias vezes rapidamente para ver o debounce em ação.</Callout>
          ) : (
            <Callout tone="idea" title="Experimente">Aperte o botão BOOT (ao lado do conector USB). O driver está <b>{b.driverState ?? '—'}</b>: dormindo sem gastar CPU até a interrupção chegar.</Callout>
          )}

          <div className="panel p-3">
            <div className="label mb-2">Últimos apertos válidos</div>
            {b.history.length === 0 ? <p className="py-3 text-center text-[12.5px] text-ink-400">Nenhum aperto ainda.</p> : (
              <ul className="divide-y divide-white/[.05]">
                {b.history.map((h, i) => (
                  <li key={h.atMs + '-' + i} className="flex items-center justify-between py-1.5 text-[12.5px]">
                    <span className="text-ink-100">{ago(b.nowMs - h.atMs)}</span>
                    <span className="num text-ink-400">{h.sinceLastMs ? `${fmtInt(h.sinceLastMs)} ms após o anterior` : 'primeiro'} · {h.bounces} repique(s) antes</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Pipeline({ pulse, driverState }: { pulse: number; driverState: string | null }) {
  const steps = ['Botão', 'ISR (interrupção)', 'Fila', `tarefa driver-botao${driverState ? ` (${driverState})` : ''}`, 'esta página']
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11.5px]">
      {steps.map((s, i) => (
        <span key={s} className="flex items-center gap-1.5">
          <motion.span
            key={pulse + '-' + i}
            initial={pulse ? { backgroundColor: 'rgba(79,209,197,.45)' } : false}
            animate={{ backgroundColor: 'rgba(255,255,255,.05)' }}
            transition={{ delay: i * 0.12, duration: 0.6 }}
            className="rounded-md px-2 py-1 text-ink-200 ring-1 ring-white/[.08]"
          >{s}</motion.span>
          {i < steps.length - 1 && <ArrowRight size={12} className="text-ink-500" />}
        </span>
      ))}
    </div>
  )
}
