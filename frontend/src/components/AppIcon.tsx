import { APP_BY_ID, type AppId } from '../apps/meta'
import { cx } from '../lib/format'

/** Ícone de app no estilo chapado dos temas de ícones do Linux: quadrado colorido e símbolo branco. */
export function AppIcon({ id, size = 40, className }: { id: AppId; size?: number; className?: string }) {
  const app = APP_BY_ID[id]
  const Icon = app.icon
  return (
    <span
      className={cx('relative inline-grid shrink-0 place-items-center text-white', className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        background: `linear-gradient(180deg, color-mix(in oklab, ${app.hue} 88%, white) 0%, ${app.hue} 55%, color-mix(in oklab, ${app.hue} 86%, black) 100%)`,
        boxShadow: `inset 0 1px 0 rgb(255 255 255 / .22), inset 0 -1px 0 rgb(0 0 0 / .15), 0 ${Math.max(1, size * 0.05)}px ${Math.max(3, size * 0.16)}px rgb(0 0 0 / .32)`,
      }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.52)} strokeWidth={size >= 36 ? 1.9 : 2.1} className="drop-shadow-[0_1px_1px_rgb(0_0_0/.25)]" />
    </span>
  )
}
