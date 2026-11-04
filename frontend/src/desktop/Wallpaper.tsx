export type WallpaperId = 'aurora' | 'silicio' | 'grafite'
export const WALLPAPERS: { id: WallpaperId; label: string }[] = [
  { id: 'aurora', label: 'Ondas' },
  { id: 'silicio', label: 'Crepúsculo' },
  { id: 'grafite', label: 'Grafite' },
]

// [fundo topo, fundo base, cor das ondas A, cor das ondas B]
const THEME: Record<WallpaperId, [string, string, string, string]> = {
  aurora: ['#0d1517', '#13201f', '#2fd6ad', '#1b8f86'],
  silicio: ['#12121c', '#1a1a2b', '#8b7cf6', '#2fd6ad'],
  grafite: ['#1b1d21', '#141518', '#7d8590', '#4a5058'],
}

/** Papel de parede em SVG (nada para baixar): ondas sobrepostas com brilho suave. */
export function Wallpaper({ id }: { id: WallpaperId }) {
  const [top, base, a, b] = THEME[id]
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden style={{ background: `linear-gradient(170deg, ${top} 0%, ${base} 100%)` }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="wa" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={a} stopOpacity=".0" />
            <stop offset=".45" stopColor={a} stopOpacity=".55" />
            <stop offset="1" stopColor={b} stopOpacity=".25" />
          </linearGradient>
          <linearGradient id="wb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={b} stopOpacity=".5" />
            <stop offset="1" stopColor={a} stopOpacity=".08" />
          </linearGradient>
          <linearGradient id="wc" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={a} stopOpacity=".35" />
            <stop offset="1" stopColor={b} stopOpacity="0" />
          </linearGradient>
          <radialGradient id="glow" cx=".72" cy=".62" r=".55">
            <stop offset="0" stopColor={a} stopOpacity=".22" />
            <stop offset="1" stopColor={a} stopOpacity="0" />
          </radialGradient>
          <filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2" /></filter>
        </defs>
        <rect width="1600" height="900" fill="url(#glow)" />
        {/* camadas de ondas, da mais distante à mais próxima */}
        <path d="M0 620 C 260 520, 520 700, 820 600 S 1340 470, 1600 560 L1600 900 L0 900 Z" fill="url(#wb)" opacity=".55" />
        <path d="M0 700 C 300 610, 560 780, 900 680 S 1380 560, 1600 640 L1600 900 L0 900 Z" fill="url(#wa)" opacity=".45" />
        <path d="M0 790 C 340 720, 640 860, 980 770 S 1420 690, 1600 740 L1600 900 L0 900 Z" fill={b} opacity=".35" />
        {/* fios de luz acompanhando as ondas */}
        <g fill="none" filter="url(#soft)">
          <path d="M-20 575 C 260 470, 540 660, 840 560 S 1360 430, 1620 520" stroke={a} strokeOpacity=".55" strokeWidth="2" />
          <path d="M-20 655 C 300 565, 580 735, 920 635 S 1400 515, 1620 600" stroke={a} strokeOpacity=".3" strokeWidth="1.5" />
          <path d="M-20 520 C 320 430, 600 580, 900 500 S 1300 400, 1620 460" stroke="url(#wc)" strokeWidth="1.2" />
        </g>
        <g fill="none" stroke={a} strokeOpacity=".16" strokeWidth="1">
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M-20 ${600 + i * 14} C 280 ${505 + i * 12}, 560 ${690 + i * 10}, 860 ${590 + i * 12} S 1380 ${465 + i * 14}, 1620 ${550 + i * 12}`} />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_55%,rgb(0_0_0/.35))]" />
    </div>
  )
}
