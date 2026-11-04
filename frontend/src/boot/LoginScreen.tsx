import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, KeyRound, Loader2, ShieldAlert, User } from 'lucide-react'
import { Logo } from '../components/Logo'
import { Wallpaper } from '../desktop/Wallpaper'
import { api, errorMessage } from '../services/api'
import type { AuthStatus } from '../types/api'

export const TOKEN_KEY = 'webos.token'

export function LoginScreen({ status, onSuccess }: { status: AuthStatus; onSuccess: () => void }) {
  const [user, setUser] = useState(status.user)
  const [pass, setPass] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const r = await api.auth.login(user, pass)
      try { sessionStorage.setItem(TOKEN_KEY, r.token) } catch { /* */ }
      onSuccess()
    } catch (ex) {
      setErr(errorMessage(ex))
      setPass('')
    } finally {
      setBusy(false)
    }
  }

  const now = new Date()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="fixed inset-0 overflow-auto">
      <Wallpaper id="aurora" />
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[14px]" />
      <div className="relative flex min-h-full flex-col items-center justify-center gap-8 p-5">
        <div className="text-center text-white [text-shadow:0_2px_12px_rgb(0_0_0/.5)]">
          <div className="text-[64px] font-light leading-none tracking-[-.03em] tabular-nums">{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="mt-2 text-[16px] font-medium text-white/85">{now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <motion.form onSubmit={submit} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }} className="flex w-full max-w-[320px] flex-col items-center">
          <span className="grid h-24 w-24 place-items-center rounded-full bg-[#0f1a1a]/80 ring-4 ring-white/25 shadow-[0_8px_30px_rgb(0_0_0/.4)]"><Logo size={52} /></span>
          <label className="mt-4 flex items-center gap-1.5 text-[17px] font-semibold text-white [text-shadow:0_1px_8px_rgb(0_0_0/.5)]">
            <User size={16} className="opacity-70" />
            <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" aria-label="Usuário" className="w-[160px] bg-transparent text-center outline-none" />
          </label>
          <div className="mt-4 flex w-full items-center gap-2">
            <span className="flex h-10 flex-1 items-center gap-2 rounded-lg bg-black/35 px-3 ring-1 ring-white/20 backdrop-blur focus-within:ring-2 focus-within:ring-phos-400">
              <KeyRound size={15} className="text-white/60" />
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Senha" aria-label="Senha" autoComplete="current-password" autoFocus className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/50" />
            </span>
            <button type="submit" disabled={busy || !pass} aria-label="Entrar" className="grid h-10 w-10 place-items-center rounded-lg bg-phos-400 text-[#03140e] transition-colors hover:bg-phos-300 disabled:opacity-40">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={18} strokeWidth={2.4} />}
            </button>
          </div>
          {err && <p className="mt-3 w-full rounded-lg bg-rose-500/20 px-3 py-2 text-center text-[12.5px] text-rose-100 ring-1 ring-rose-400/30">{err}</p>}
          <p className="mt-6 flex gap-2 text-[11.5px] leading-snug text-white/70">
            <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-300" />
            Recurso educacional: a placa confere a senha comparando hashes SHA-256 com sal. O tráfego é HTTP sem criptografia.
          </p>
        </motion.form>
      </div>
    </motion.div>
  )
}
