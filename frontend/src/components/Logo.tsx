import { useId } from 'react'
import { motion } from 'framer-motion'

/** Marca do WebOS: um chip com trilhas. `animated` desenha as trilhas no boot. */
export function Logo({ size = 28, animated = false }: { size?: number; animated?: boolean }) {
  const gid = 'lg' + useId().replace(/:/g, '')
  const pins = [22, 32, 42]
  const draw = animated
    ? { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { duration: 0.9, ease: 'easeInOut' as const } }
    : {}
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="64" y2="64">
          <stop offset="0" stopColor="#93f3d1" />
          <stop offset="1" stopColor="#a5acff" />
        </linearGradient>
      </defs>
      {pins.map((p, i) => (
        <g key={p} stroke={`url(#${gid})`} strokeWidth="3.4" strokeLinecap="round">
          <motion.path d={`M${p} 4 V14`} {...draw} transition={{ ...(draw.transition ?? {}), delay: i * 0.08 }} />
          <motion.path d={`M${p} 50 V60`} {...draw} transition={{ ...(draw.transition ?? {}), delay: 0.1 + i * 0.08 }} />
          <motion.path d={`M4 ${p} H14`} {...draw} transition={{ ...(draw.transition ?? {}), delay: 0.2 + i * 0.08 }} />
          <motion.path d={`M50 ${p} H60`} {...draw} transition={{ ...(draw.transition ?? {}), delay: 0.3 + i * 0.08 }} />
        </g>
      ))}
      <rect x="15" y="15" width="34" height="34" rx="8" fill="#111318" stroke={`url(#${gid})`} strokeWidth="3.4" />
      <motion.circle cx="32" cy="32" r="6" fill={`url(#${gid})`}
        initial={animated ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ delay: animated ? 0.7 : 0, type: 'spring', stiffness: 260, damping: 14 }} />
    </svg>
  )
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={'font-semibold tracking-tight ' + className}>
      Web<span className="bg-gradient-to-r from-phos-300 to-phos-400 bg-clip-text text-transparent">OS</span>
    </span>
  )
}
