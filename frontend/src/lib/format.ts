const nf = new Intl.NumberFormat('pt-BR')
export const fmtInt = (n: number | null | undefined) => (n == null ? '—' : nf.format(Math.round(n)))

export function fmtBytes(b: number | null | undefined, decimals = 1): string {
  if (b == null) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(decimals).replace('.', ',')} KB`
  return `${(b / 1024 / 1024).toFixed(decimals + 1).replace('.', ',')} MB`
}

export function fmtUptime(ms: number | null | undefined): string {
  if (ms == null) return '—'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}h ${p(m)}m ${p(ss)}s` : `${p(m)}m ${p(ss)}s`
}

export const fmtPct = (v: number | null | undefined, d = 0) => (v == null ? '—' : `${v.toFixed(d).replace('.', ',')}%`)
export const fmtHex = (n: number) => '0x' + n.toString(16).toUpperCase().padStart(8, '0')
export const fmtMs = (ms: number) => (ms < 1000 ? `${ms.toFixed(ms < 10 ? 2 : 0).replace('.', ',')} ms` : `${(ms / 1000).toFixed(2).replace('.', ',')} s`)

export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `há ${s} s`
  const m = Math.floor(s / 60)
  return m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)} h`
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')
