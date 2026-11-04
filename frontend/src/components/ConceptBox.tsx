import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, ChevronRight } from 'lucide-react'
import { cx } from '../lib/format'

export interface Concept {
  lesson: string              // "Aula 7 · Processos"
  tanenbaum: string           // "cap. 2.1 — Processos"
  tanenbaumConfirmed: boolean // true = conferida no sumário da 4ª ed. (2016), a edição citada nas aulas
  what: ReactNode
  how: ReactNode
  why: ReactNode
  tryIt: ReactNode[]
  observe: ReactNode[]
  interpret: ReactNode
  diagram?: ReactNode
  apis?: string
}

function readOpen(key: string) {
  try {
    const v = localStorage.getItem(key)
    if (v != null) return v === '1'
  } catch { /* armazenamento indisponível */ }
  return window.innerWidth >= 768
}

export function ConceptBox({ id, concept, extra }: { id: string; concept: Concept; extra?: ReactNode }) {
  const key = `webos.concept.${id}`
  const [open, setOpen] = useState(() => readOpen(key))
  const toggle = () => {
    setOpen((o) => {
      try { localStorage.setItem(key, o ? '0' : '1') } catch { /* ignora */ }
      return !o
    })
  }
  return (
    <section className="overflow-hidden rounded-xl border border-sky-300/15 bg-gradient-to-b from-sky-400/[.07] to-sky-400/[.02]">
      <button onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left hover:bg-white/[.03]">
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.18 }} className="text-sky-300"><ChevronRight size={16} /></motion.span>
        <BookOpen size={16} className="text-sky-300" />
        <span className="text-[13.5px] font-semibold text-sky-100">Entenda o conceito</span>
        <span className="ml-auto chip bg-white/[.06] text-ink-300 ring-1 ring-white/[.08]">{concept.lesson}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="space-y-3 px-3.5 pb-3.5 text-[13px] leading-relaxed text-ink-200">
              <div className="text-ink-100">{concept.what}</div>
              {concept.diagram && <div className="overflow-x-auto scroll-thin">{concept.diagram}</div>}
              <div className="grid gap-2.5 md:grid-cols-2">
                <Card title="Como funciona">{concept.how}</Card>
                <Card title="Por que importa no SO">{concept.why}</Card>
                <Card title="Como experimentar aqui">
                  <ol className="list-decimal space-y-1 pl-4 marker:text-ink-400">{concept.tryIt.map((t, i) => <li key={i}>{t}</li>)}</ol>
                </Card>
                <Card title="O que observar">
                  <ul className="list-disc space-y-1 pl-4 marker:text-ink-500">{concept.observe.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </Card>
              </div>
              <Card title="Como interpretar os resultados">{concept.interpret}</Card>
              {extra}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[.06] pt-2 text-[11.5px] text-ink-400">
                <span>{concept.lesson} da disciplina</span>
                <span className="hidden sm:inline">·</span>
                <span>
                  Tanenbaum &amp; Bos, <i>Sistemas Operacionais Modernos</i>, 4ª ed., {concept.tanenbaum}
                  {!concept.tanenbaumConfirmed && (
                    <span className="ml-1.5 chip h-[18px] bg-amber-400/10 text-[10.5px] text-amber-200 ring-1 ring-amber-400/25" title="Seção indicada pelo grupo, não citada no documento do professor: confira na edição usada pela turma">conferir edição</span>
                  )}
                </span>
                {concept.apis && <span className={cx('num basis-full text-[11px] text-ink-500')}>{concept.apis}</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-black/20 px-3 py-2.5 ring-1 ring-white/[.05]">
      <div className="label mb-1 !text-sky-200/80">{title}</div>
      <div className="text-[12.8px]">{children}</div>
    </div>
  )
}
