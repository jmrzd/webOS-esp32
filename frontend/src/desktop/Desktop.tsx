import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, WifiOff } from 'lucide-react'
import { APPS, type AppId } from '../apps/meta'
import { APP_COMPONENTS } from '../apps/registry'
import { AppIcon } from '../components/AppIcon'
import { useSystem } from '../contexts/SystemContext'
import { TASKBAR_H, useWM } from '../contexts/WindowManager'
import { useIsMobile } from '../hooks/useMediaQuery'
import { cx } from '../lib/format'
import { Window } from '../windows/Window'
import { BoardWidget, DesktopClock } from './Widgets'
import { StartMenu } from './StartMenu'
import { Taskbar } from './Taskbar'
import { WALLPAPERS, Wallpaper, type WallpaperId } from './Wallpaper'

interface Menu { x: number; y: number; items: { label: string; action: () => void; danger?: boolean }[] }

function loadWallpaper(): WallpaperId {
  try { const v = localStorage.getItem('webos.wallpaper'); if (v === 'aurora' || v === 'silicio' || v === 'grafite') return v } catch { /* */ }
  return 'aurora'
}

export function Desktop({ onLock, canLock }: { onLock: () => void; canLock: boolean }) {
  const wm = useWM()
  const { conn } = useSystem()
  const mobile = useIsMobile()
  const [startOpen, setStartOpen] = useState(false)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [selected, setSelected] = useState<AppId | null>(null)
  const [wallpaper, setWallpaper] = useState<WallpaperId>(loadWallpaper)
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

  useEffect(() => { try { localStorage.setItem('webos.wallpaper', wallpaper) } catch { /* */ } }, [wallpaper])
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', close) }
  }, [menu])

  const openMenu = (e: React.MouseEvent, items: Menu['items']) => {
    e.preventDefault()
    const x = Math.min(e.clientX, window.innerWidth - 220)
    const y = Math.min(e.clientY, window.innerHeight - TASKBAR_H - items.length * 36 - 16)
    setMenu({ x, y, items })
  }

  const desktopMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    const next = WALLPAPERS[(WALLPAPERS.findIndex((w) => w.id === wallpaper) + 1) % WALLPAPERS.length]
    openMenu(e, [
      { label: 'Abrir menu Iniciar', action: () => setStartOpen(true) },
      { label: 'Mostrar a área de trabalho', action: wm.minimizeAll },
      { label: `Papel de parede: ${next.label}`, action: () => setWallpaper(next.id) },
      { label: 'Monitor do Sistema', action: () => wm.open('monitor') },
      { label: 'Sobre o WebOS', action: () => wm.open('about') },
    ])
  }

  const taskMenu = useCallback((e: React.MouseEvent, id: AppId) => {
    const w = wm.wins.find((x) => x.id === id)
    openMenu(e, [
      { label: w?.minimized ? 'Restaurar' : 'Minimizar', action: () => (w?.minimized ? wm.focus(id) : wm.minimize(id)) },
      ...(mobile ? [] : [{ label: w?.maximized ? 'Restaurar tamanho' : 'Maximizar', action: () => wm.toggleMax(id) }]),
      { label: 'Fechar', action: () => wm.close(id), danger: true },
    ])
  }, [wm, mobile])

  return (
    <div className="fixed inset-0 overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
      <Wallpaper id={wallpaper} />

      {/* área de trabalho: ícones à esquerda (como uma pasta da área de trabalho) e widgets à direita */}
      <div
        className="absolute inset-x-0 top-0 overflow-y-auto overscroll-contain [scrollbar-width:none]"
        style={{ bottom: TASKBAR_H }}
        onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('button')) setSelected(null) }}
        onContextMenu={desktopMenu}
      >
        <div className={cx('flex min-h-full w-full', mobile ? 'flex-col gap-4 px-3 pb-4 pt-4' : 'gap-6 p-3 pr-6')}>
          {mobile && (
            <div className="space-y-3 px-1">
              <DesktopClock compact />
              <BoardWidget compact />
            </div>
          )}

          <div
            className={cx(
              mobile
                ? 'grid grid-cols-4 gap-1'
                : 'grid min-h-0 flex-1 grid-flow-col auto-cols-[100px] grid-rows-[repeat(auto-fill,108px)] content-start justify-start gap-1',
            )}
            style={mobile ? undefined : { height: `calc(100vh - ${TASKBAR_H + 24}px)` }}
          >
            {APPS.map((a, i) => (
              <motion.button
                key={a.id}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 + 0.025 * i, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => (coarse || mobile ? wm.open(a.id) : setSelected(a.id))}
                onDoubleClick={() => wm.open(a.id)}
                onKeyDown={(e) => e.key === 'Enter' && wm.open(a.id)}
                onContextMenu={(e) => { e.stopPropagation(); openMenu(e, [{ label: 'Abrir', action: () => wm.open(a.id) }]) }}
                className={cx(
                  'group relative flex h-[104px] flex-col items-center gap-1.5 rounded-lg border px-1 pt-2.5 text-center outline-none transition-colors duration-100',
                  selected === a.id ? 'border-phos-400/60 bg-phos-400/20' : 'border-transparent hover:border-white/10 hover:bg-white/[.08]',
                )}
                title={a.summary}
                aria-label={`${a.title}${a.bonus ? ' (bônus)' : ''}${a.simulation ? ' (simulação)' : ''}`}
              >
                <span className="relative">
                  <AppIcon id={a.id} size={48} />
                  {a.bonus && <span className="absolute -right-[3px] -top-[3px] h-[10px] w-[10px] rounded-full bg-amber-300 ring-2 ring-[#1d2a2a]" title="Bônus" />}
                </span>
                <span className="line-clamp-2 text-[12px] font-medium leading-[1.25] text-white [text-shadow:0_1px_2px_rgb(0_0_0/.9),0_0_8px_rgb(0_0_0/.6)]">{a.short}</span>
              </motion.button>
            ))}
          </div>

          {!mobile && (
            <aside className="hidden w-[300px] shrink-0 space-y-3 pt-3 lg:block">
              <DesktopClock />
              <BoardWidget />
            </aside>
          )}
        </div>
      </div>

      {/* janelas */}
      <AnimatePresence>
        {wm.wins.map((w) => {
          const C = APP_COMPONENTS[w.id]
          return (
            <Window key={w.id} win={w} focused={wm.focusedId === w.id} mobile={mobile}>
              <C />
            </Window>
          )
        })}
      </AnimatePresence>

      <AnimatePresence>
        {startOpen && <StartMenu onOpen={wm.open} onClose={() => setStartOpen(false)} onLock={onLock} canLock={canLock} />}
      </AnimatePresence>

      <Taskbar startOpen={startOpen} onStart={() => setStartOpen((o) => !o)} onContextMenu={taskMenu} />

      {/* menu de contexto */}
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="glass fixed z-[8000] min-w-[210px] origin-top-left rounded-xl p-1"
            style={{ left: menu.x, top: menu.y }}
            onPointerDown={(e) => e.stopPropagation()}
            role="menu"
          >
            {menu.items.map((it) => (
              <button key={it.label} role="menuitem" onClick={() => { it.action(); setMenu(null) }}
                className={cx('flex h-8 w-full items-center rounded-lg px-3 text-left text-[12.5px] font-medium transition-colors hover:bg-white/[.07]', it.danger ? 'text-rose-300' : 'text-ink-100')}>
                {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* reconexão: aparece por cima, sem fechar as janelas */}
      <AnimatePresence>
        {(conn === 'disconnected' || conn === 'error') && <ConnectionOverlay error={conn === 'error'} />}
      </AnimatePresence>
    </div>
  )
}

function ConnectionOverlay({ error }: { error: boolean }) {
  const { info } = useSystem()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[7000] grid place-items-center bg-ink-950/70 p-4 backdrop-blur-md" style={{ bottom: TASKBAR_H }}>
      <motion.div initial={{ y: 16, scale: 0.97 }} animate={{ y: 0, scale: 1 }} transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.4 }} className="glass w-full max-w-[440px] rounded-2xl p-6">
        <div className="relative mb-4 grid h-12 w-12 place-items-center">
          <span className="absolute inset-0 rounded-full bg-rose-400/30 animate-ping-slow" />
          <span className="relative grid h-12 w-12 place-items-center rounded-full bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30"><WifiOff size={20} /></span>
        </div>
        <h2 className="text-[18px] font-bold text-ink-50">{error ? 'Erro de comunicação com o ESP32' : 'ESP32 fora de alcance'}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-300">
          {error ? 'A placa respondeu de forma inesperada.' : 'A página não recebe resposta da placa.'} Os números exibidos estão congelados até a conexão voltar.
        </p>
        <ol className="mt-4 space-y-2 text-[12.5px] text-ink-200">
          {[
            <>Confirme que o aparelho está no Wi-Fi <b className="text-ink-50">{info?.network.ssid ?? 'WebOS-ESP32-xxxx'}</b>.</>,
            <>No celular, desligue os dados móveis e aceite “rede sem internet”.</>,
            <>Se a placa reiniciou, aguarde alguns segundos.</>,
          ].map((t, i) => (
            <li key={i} className="flex gap-2.5"><span className="num grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/[.06] text-[10.5px] text-ink-300">{i + 1}</span><span>{t}</span></li>
          ))}
        </ol>
        <div className="mt-5 flex items-center gap-2 border-t border-white/[.07] pt-4 text-[12.5px] text-amber-200">
          <RefreshCw size={14} className="animate-spin" /> Tentando reconectar automaticamente…
        </div>
      </motion.div>
    </motion.div>
  )
}
