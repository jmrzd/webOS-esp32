// Algoritmos de substituição de páginas (SIMULAÇÃO educacional no navegador).
export type PageAlgo = 'FIFO' | 'LRU' | 'OPT'
export interface PageStep { ref: number; frames: (number | null)[]; hit: boolean; evicted: number | null; slot: number }
export interface PageResult { steps: PageStep[]; faults: number; hits: number }

export function runPaging(refs: number[], nFrames: number, algo: PageAlgo): PageResult {
  const frames: (number | null)[] = Array(nFrames).fill(null)
  const loadedAt: number[] = Array(nFrames).fill(-1)
  const lastUse: number[] = Array(nFrames).fill(-1)
  const steps: PageStep[] = []
  let faults = 0
  refs.forEach((page, t) => {
    let slot = frames.indexOf(page)
    let evicted: number | null = null
    const hit = slot >= 0
    if (!hit) {
      faults++
      slot = frames.indexOf(null)
      if (slot < 0) {
        if (algo === 'FIFO') slot = loadedAt.indexOf(Math.min(...loadedAt))
        else if (algo === 'LRU') slot = lastUse.indexOf(Math.min(...lastUse))
        else {
          // Ótimo: sai a página cujo próximo uso está mais longe (ou nunca mais)
          let best = 0, bestDist = -1
          frames.forEach((f, i) => {
            const nx = refs.indexOf(f as number, t + 1)
            const dist = nx < 0 ? Infinity : nx
            if (dist > bestDist) { bestDist = dist; best = i }
          })
          slot = best
        }
        evicted = frames[slot]
      }
      frames[slot] = page
      loadedAt[slot] = t
    }
    lastUse[slot] = t
    steps.push({ ref: page, frames: [...frames], hit, evicted, slot })
  })
  return { steps, faults, hits: refs.length - faults }
}

export function parseRefs(s: string): number[] {
  return s.split(/[\s,;]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 99).slice(0, 40)
}
