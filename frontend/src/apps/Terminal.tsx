import { useEffect, useRef, useState } from 'react'
import { ConceptBox } from '../components/ConceptBox'
import { CONCEPTS } from '../content/concepts'
import { useSystem } from '../contexts/SystemContext'
import { api, errorMessage } from '../services/api'
import { cx } from '../lib/format'

interface Line { kind: 'in' | 'out' | 'err' | 'sys'; text: string }
const COMMANDS = ['help', 'ps', 'kill', 'mem', 'free', 'ls', 'cat', 'df', 'uptime', 'uname', 'led', 'clear']

export default function Terminal() {
  const { info, conn } = useSystem()
  const [lines, setLines] = useState<Line[]>([
    { kind: 'sys', text: `WebOS shell — os comandos são interpretados e executados no ${info?.chip.model ?? 'ESP32'}.` },
    { kind: 'sys', text: 'Digite help para ver os comandos.' },
  ])
  const [input, setInput] = useState('')
  const [hist, setHist] = useState<string[]>([])
  const [hIdx, setHIdx] = useState(-1)
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const inp = useRef<HTMLInputElement>(null)

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [lines])

  const run = async (raw: string) => {
    const cmd = raw.trim()
    setLines((l) => [...l, { kind: 'in', text: cmd }])
    if (!cmd) return
    setHist((h) => [cmd, ...h.filter((x) => x !== cmd)].slice(0, 50))
    setHIdx(-1)
    if (cmd === 'clear') { setLines([]); return }
    if (cmd.length > 120) { setLines((l) => [...l, { kind: 'err', text: 'comando muito longo (máx. 120 caracteres)' }]); return }
    setBusy(true)
    try {
      const r = await api.terminal.exec(cmd)
      setLines((l) => [...l, { kind: r.exitCode === 0 ? 'out' : 'err', text: r.output.replace(/\n$/, '') }])
    } catch (e) {
      setLines((l) => [...l, { kind: 'err', text: `erro de comunicação: ${errorMessage(e)}` }])
    } finally {
      setBusy(false)
      setTimeout(() => inp.current?.focus(), 0)
    }
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); if (!busy) { run(input); setInput('') } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const i = Math.min(hist.length - 1, hIdx + 1); if (i >= 0) { setHIdx(i); setInput(hist[i]) } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const i = hIdx - 1; setHIdx(i); setInput(i >= 0 ? hist[i] : '') }
    else if (e.key === 'Tab') {
      e.preventDefault()
      const m = COMMANDS.filter((c) => c.startsWith(input.trim()))
      if (m.length === 1) setInput(m[0] + ' ')
      else if (m.length > 1) setLines((l) => [...l, { kind: 'sys', text: m.join('  ') }])
    } else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); setLines([]) }
  }

  const prompt = <span className="text-phos-300">admin@webos<span className="text-ink-400">:</span><span className="text-volt-300">~</span><span className="text-ink-400">$</span></span>

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <ConceptBox id="terminal" concept={CONCEPTS.terminal} />
      <div className="flex min-h-[260px] flex-1 flex-col overflow-hidden rounded-xl bg-[#05080f] ring-1 ring-white/[.07]" onClick={() => inp.current?.focus()}>
        <div className="num min-h-0 flex-1 overflow-auto p-3 text-[12.8px] leading-[1.55] scroll-thin">
          {lines.map((l, i) => (
            <div key={i} className={cx('whitespace-pre-wrap break-words', l.kind === 'err' ? 'text-rose-300' : l.kind === 'sys' ? 'text-ink-400' : 'text-ink-100')}>
              {l.kind === 'in' ? <>{prompt} {l.text}</> : l.text}
            </div>
          ))}
          <div className="flex items-center gap-2">
            {prompt}
            <input
              ref={inp}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              disabled={busy}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={120}
              aria-label="Comando"
              className="min-w-0 flex-1 bg-transparent text-ink-50 caret-phos-300 outline-none"
            />
            {busy && <span className="text-ink-500">executando…</span>}
          </div>
          <div ref={end} />
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-white/[.06] p-2">
          {['help', 'ps', 'mem', 'ls', 'cat /leia-me.txt', 'df', 'uptime', 'led toggle'].map((c) => (
            <button key={c} className="btn btn-sm num" disabled={busy || conn !== 'connected'} onClick={(e) => { e.stopPropagation(); run(c) }}>{c}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
