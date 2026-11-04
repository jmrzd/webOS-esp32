import { motion, AnimatePresence } from 'framer-motion'
import { Blocks, Eraser, Scissors, Trash2 } from 'lucide-react'
import { LineChart } from '../components/charts'
import { ConceptBox } from '../components/ConceptBox'
import { Bar, Callout, ErrorBanner, LiveBadge, Loading, Stat } from '../components/ui'
import { CONCEPTS } from '../content/concepts'
import { useSystem } from '../contexts/SystemContext'
import { usePolling } from '../hooks/usePolling'
import { api } from '../services/api'
import { fmtBytes, fmtHex, fmtInt, fmtPct } from '../lib/format'
import type { MemoryState } from '../types/api'

export default function MemoryMonitor() {
  const { runOp, conn } = useSystem()
  const { data, setData, error, loading } = usePolling(api.memory.get, 1000)
  const op = async (label: string, fn: () => Promise<MemoryState>) => { const r = await runOp(label, fn); if (r) setData(r) }
  const can = conn === 'connected'

  if (loading && !data) return <div className="p-4"><ConceptBox id="memory" concept={CONCEPTS.memory} /><Loading /></div>
  const h = data?.heap
  const frag = h?.fragmentationPct ?? 0

  return (
    <div className="space-y-4 p-4">
      <ConceptBox id="memory" concept={CONCEPTS.memory} />
      <ErrorBanner error={error} />
      {data && h && (
        <>
          <div className="flex items-center justify-between"><h3 className="text-[13px] font-semibold">Heap da RAM interna</h3><LiveBadge live={can && !error} /></div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Heap total" value={fmtBytes(h.total)} />
            <Stat label="Livre" value={fmtBytes(h.free)} tone="accent" />
            <Stat label="Menor livre (pior momento)" value={fmtBytes(h.minFree)} />
            <Stat label="Maior bloco contíguo" value={fmtBytes(h.largestBlock)} tone={frag > 40 ? 'warn' : undefined} />
            <Stat label="Fragmentação" value={fmtPct(frag, 1)} tone={frag > 50 ? 'bad' : frag > 25 ? 'warn' : 'ok'} hint="1 − maior bloco ÷ livre" />
            <Stat label="Pedaços livres" value={fmtInt(h.freeBlocks)} hint="regiões livres separadas" />
            <Stat label="Alocado pelo app" value={fmtBytes(data.app.bytesHeld)} hint={`${data.app.blocks} bloco(s)`} />
            <Stat label="Total alocado / liberado" value={<span className="text-[15px]">{fmtBytes(data.app.bytesAllocatedTotal)} / {fmtBytes(data.app.bytesFreedTotal)}</span>} hint={`${data.app.allocOps} malloc · ${data.app.freeOps} free`} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[11.5px] text-ink-400"><span>usado</span><span className="num">{fmtPct((h.used / h.total) * 100)} de {fmtBytes(h.total)}</span></div>
            <Bar value={h.used} max={h.total} tone={h.free < data.app.reserveBytes * 1.5 ? 'bad' : 'phos'} label="Uso do heap" />
          </div>

          <div className="panel flex flex-wrap items-center gap-2 p-3">
            <span className="label mr-1">Alocar (malloc)</span>
            {[4, 8, 16, 32].map((kb) => <button key={kb} className="btn btn-sm" disabled={!can} onClick={() => op(`malloc(${kb} KB) recusado`, () => api.memory.allocate(kb))}>{kb} KB</button>)}
            <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
            <button className="btn btn-sm btn-warn" disabled={!can} onClick={() => op('Falha', api.memory.fragment)}><Scissors size={13} /> Provocar fragmentação</button>
            <button className="btn btn-sm" disabled={!can || data.blocks.length < 2} onClick={() => op('Falha', () => api.memory.free('alternate'))}><Eraser size={13} /> Liberar alternados</button>
            <button className="btn btn-sm btn-danger" disabled={!can || !data.blocks.length} onClick={() => op('Falha', () => api.memory.free('all'))}><Trash2 size={13} /> Liberar todos</button>
          </div>
          {data.lastEvent && <p className="num text-[12px] text-ink-300">› {data.lastEvent}</p>}

          <AddressMap data={data} onFree={(id) => op('Falha ao liberar', () => api.memory.free('one', id))} />

          <Interpretation d={data} />

          <div className="panel p-3">
            <div className="label mb-2">Heap livre nos últimos 60 s</div>
            <LineChart height={120} series={[{ label: 'heap livre', color: '#f472b6', values: data.history }]} capacity={60} yFormat={(v) => fmtBytes(v, 0)} xLabelLeft="−60 s" xLabelRight="agora" />
          </div>
          <p className="text-[11.5px] text-ink-500">Proteção: o WebOS recusa pedidos que deixariam menos de {fmtBytes(data.app.reserveBytes, 0)} livres, para o Wi-Fi e o servidor continuarem funcionando.</p>
        </>
      )}
    </div>
  )
}

function AddressMap({ data, onFree }: { data: MemoryState; onFree: (id: number) => void }) {
  const blocks = [...data.blocks].sort((a, b) => a.address - b.address)
  const lo = blocks.length ? blocks[0].address : 0
  const hi = blocks.length ? blocks[blocks.length - 1].address + blocks[blocks.length - 1].size : 1
  const span = Math.max(1, hi - lo)
  return (
    <div className="panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="label flex items-center gap-1.5"><Blocks size={13} /> Blocos alocados — clique para liberar</span>
        {blocks.length > 0 && <span className="num text-[11px] text-ink-500">{fmtHex(lo)} … {fmtHex(hi)}</span>}
      </div>
      {blocks.length === 0 ? (
        <p className="py-4 text-center text-[12.5px] text-ink-400">Nenhum bloco alocado. Use os botões acima.</p>
      ) : (
        <>
          {/* faixa de endereços reais: buracos entre blocos = memória livre ou de outros donos */}
          <div className="relative mb-3 h-7 overflow-hidden rounded-md bg-white/[.04] ring-1 ring-white/[.06]" aria-label="Mapa de endereços dos blocos">
            {blocks.map((b) => (
              <div key={b.id} title={`#${b.id} · ${fmtBytes(b.size)} @ ${fmtHex(b.address)}`}
                className="absolute inset-y-0.5 rounded-sm bg-gradient-to-b from-pink-300 to-fuchsia-500"
                style={{ left: `${((b.address - lo) / span) * 100}%`, width: `max(3px, ${(b.size / span) * 100}%)` }} />
            ))}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-1.5">
            <AnimatePresence initial={false}>
              {blocks.map((b) => (
                <motion.button key={b.id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
                  onClick={() => onFree(b.id)} title="Liberar (free)"
                  className="rounded-lg bg-fuchsia-400/10 px-2 py-1.5 text-left ring-1 ring-fuchsia-300/30 hover:bg-rose-500/20 hover:ring-rose-300/50">
                  <div className="flex justify-between text-[11px] text-ink-400"><span>#{b.id}</span><span className="num text-ink-100">{fmtBytes(b.size, 0)}</span></div>
                  <div className="num text-[11px] text-fuchsia-200">{fmtHex(b.address)}</div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  )
}

function Interpretation({ d }: { d: MemoryState }) {
  const h = d.heap
  if (h.fragmentationPct > 35 && h.free > 32 * 1024) {
    return (
      <Callout tone="warn" title="Fragmentação externa">
        Há <b>{fmtBytes(h.free)}</b> livres, mas o maior pedaço contíguo tem só <b>{fmtBytes(h.largestBlock)}</b>, espalhados em {h.freeBlocks} regiões. Um pedido maior que {fmtBytes(h.largestBlock)} falharia mesmo com memória “sobrando”. Libere os blocos vizinhos para o alocador juntar os buracos.
      </Callout>
    )
  }
  if (d.app.refused > 0 && /recusado|NULL/.test(d.lastEvent)) {
    return <Callout tone="bad" title="Pedido recusado">{d.lastEvent}. O gerenciador de memória protege o restante do sistema.</Callout>
  }
  if (d.blocks.length) {
    return <Callout tone="info">Cada malloc reservou um bloco contíguo real na RAM (veja os endereços). Eles somam {fmtBytes(d.app.bytesHeld)}; o heap livre cai aproximadamente isso — o alocador também guarda um pequeno cabeçalho por bloco, e o sistema (Wi-Fi, servidor) aloca e libera memória ao mesmo tempo.</Callout>
  }
  return <Callout tone="idea" title="Experimente">Aloque alguns blocos de 8 KB, depois clique em “Provocar fragmentação” e compare o heap livre com o maior bloco contíguo.</Callout>
}
