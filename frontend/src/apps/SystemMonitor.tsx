import { LineChart } from '../components/charts'
import { ConceptBox } from '../components/ConceptBox'
import { Bar, Callout, LiveBadge, Loading, Stat } from '../components/ui'
import { CONCEPTS } from '../content/concepts'
import { useSystem } from '../contexts/SystemContext'
import { fmtBytes, fmtInt, fmtPct, fmtUptime } from '../lib/format'

export default function SystemMonitor() {
  const { metrics: m, info, conn, latencyMs } = useSystem()
  const live = conn === 'connected'
  if (!m) return <div className="space-y-4 p-4"><ConceptBox id="monitor" concept={CONCEPTS.monitor} /><Loading /></div>
  const used = m.heap.total - m.heap.free
  const hist = m.heapHistory
  const trend = hist.length > 10 ? hist[hist.length - 1] - hist[0] : 0

  return (
    <div className="space-y-4 p-4">
      <ConceptBox id="monitor" concept={CONCEPTS.monitor} />
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Recursos da placa</h3>
        <LiveBadge live={live} />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Heap livre" value={fmtBytes(m.heap.free)} big tone="accent" />
        <Stat label="Menor heap desde o boot" value={fmtBytes(m.heap.minFree)} big />
        <Stat label="Tarefas no FreeRTOS" value={fmtInt(m.tasks)} big />
        <Stat label="Aparelhos conectados" value={fmtInt(m.stations)} big hint={info ? `máx. ${info.network.maxStations}` : undefined} />
        <Stat label="CPU" value={info ? `${info.chip.cores} × ${info.chip.cpuMHz} MHz` : '—'} hint={info?.chip.model} />
        <Stat label="Ligado há" value={fmtUptime(m.uptimeMs)} />
        <Stat label="Carga núcleo 0" value={m.cpu.core0 == null ? '—' : fmtPct(m.cpu.core0, 1)} tone={(m.cpu.core0 ?? 0) > 90 ? 'warn' : undefined} hint="tarefas cpu e experimentos" />
        <Stat label="Carga núcleo 1" value={m.cpu.core1 == null ? '—' : fmtPct(m.cpu.core1, 1)} hint="servidor web" />
      </div>

      <div className="panel p-3">
        <div className="mb-2 flex justify-between"><span className="label">Heap livre nos últimos 60 segundos</span><span className="num text-[11px] text-ink-400">{hist.length ? `mín ${fmtBytes(Math.min(...hist))} · máx ${fmtBytes(Math.max(...hist))}` : ''}</span></div>
        <LineChart height={150} capacity={60} series={[{ label: 'heap livre', color: '#4fd1c5', values: hist }]} yFormat={(v) => fmtBytes(v, 0)} xLabelLeft="−60 s" xLabelRight="agora →" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="panel space-y-1.5 p-3">
          <div className="flex justify-between text-[12px]"><span className="label">Uso da memória (RAM interna)</span><span className="num text-ink-300">{fmtPct((used / m.heap.total) * 100)} de {fmtBytes(m.heap.total)}</span></div>
          <Bar value={used} max={m.heap.total} label="Uso da memória" />
          <div className="flex justify-between pt-2 text-[12px]"><span className="label">Armazenamento (LittleFS)</span><span className="num text-ink-300">{fmtBytes(m.fs.used)} de {fmtBytes(m.fs.total)}</span></div>
          <Bar value={m.fs.used} max={m.fs.total || 1} tone="warn" label="Uso do LittleFS" />
        </div>
        <div className="panel space-y-1 p-3 text-[12.5px]">
          <div className="label mb-1">Estado da placa</div>
          <Row k="Conexão" v={live ? 'conectado' : conn} />
          <Row k="Latência média da API" v={latencyMs ? `${Math.round(latencyMs)} ms` : '—'} />
          <Row k="Rede" v={info ? `${info.network.ssid} (canal ${info.network.channel})` : '—'} />
          <Row k="FreeRTOS · ESP-IDF" v={info ? `${info.freertos.kernel} · ${info.sdk}` : '—'} />
          <Row k="Tarefas que nunca bloqueiam no núcleo 0" v={fmtInt(m.demoCoreBusy)} />
          <Row k="Requisições recusadas (limite)" v={fmtInt(m.rateLimited)} />
        </div>
      </div>

      {trend < -8192 ? (
        <Callout tone="warn" title="Heap caindo">O heap livre diminuiu {fmtBytes(-trend)} no último minuto. Se não voltar ao liberar recursos, seria um vazamento de memória.</Callout>
      ) : (
        <Callout tone="info">O SO divide CPU, memória, armazenamento e rede entre os programas. Abra outros apps (crie tarefas, aloque memória) e veja o efeito aqui.</Callout>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><span className="text-ink-400">{k}</span><span className="num truncate text-right text-ink-100">{v}</span></div>
}
