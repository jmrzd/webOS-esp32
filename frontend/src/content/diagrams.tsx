// Diagrama de estados de uma tarefa (FreeRTOS), com contagem ao vivo opcional.
export function ProcessStateDiagram({ counts }: { counts?: Partial<Record<string, number>> }) {
  const node = (x: number, y: number, w: number, label: string, fill: string, key?: string) => {
    const n = key && counts ? counts[key] ?? 0 : undefined
    return (
      <g>
        <rect x={x} y={y} width={w} height={34} rx={8} fill={fill} opacity={n === 0 ? 0.55 : 1} />
        <text x={x + w / 2} y={y + 21.5} textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#f6f8ff">{label}</text>
        {n !== undefined && (
          <g>
            <circle cx={x + w - 2} cy={y + 2} r={10} fill="#070b14" stroke={fill} strokeWidth="2" />
            <text x={x + w - 2} y={y + 6} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#f6f8ff">{n}</text>
          </g>
        )}
      </g>
    )
  }
  const arrow = 'url(#psd-arrow)'
  const lbl = (x: number, y: number, t: string) => <text x={x} y={y} textAnchor="middle" fontSize="10.5" fill="#93a1c2">{t}</text>
  return (
    <svg viewBox="0 0 560 190" className="mx-auto block w-full max-w-[560px] min-w-[460px]" role="img" aria-label="Diagrama de estados: criada, pronta, executando, bloqueada, suspensa, finalizada">
      <defs>
        <marker id="psd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#93a1c2" />
        </marker>
      </defs>
      <g stroke="#93a1c2" strokeWidth="1.4" fill="none">
        <line x1={92} y1={95} x2={148} y2={95} markerEnd={arrow} />
        <path d="M232,88 C262,78 292,78 322,88" markerEnd={arrow} />
        <path d="M322,104 C292,114 262,114 232,104" markerEnd={arrow} />
        <line x1={420} y1={95} x2={468} y2={95} markerEnd={arrow} />
        <line x1={190} y1={78} x2={190} y2={44} markerEnd={arrow} markerStart={arrow} />
        <path d="M360,112 L330,150" markerEnd={arrow} />
        <path d="M268,152 L212,114" markerEnd={arrow} />
      </g>
      {lbl(120, 86, 'criar')}
      {lbl(277, 72, 'escalonar')}
      {lbl(277, 128, 'preempção')}
      {lbl(444, 86, 'finalizar')}
      {lbl(232, 60, 'suspender / retomar')}
      {lbl(392, 140, 'esperar (delay, fila)')}
      {lbl(204, 146, 'evento chegou')}
      {node(8, 78, 84, 'Criada', '#36415e')}
      {node(150, 78, 82, 'Pronta', '#2563c9', 'pronta')}
      {node(324, 78, 96, 'Executando', '#1f8a5b', 'executando')}
      {node(470, 78, 84, 'Finalizada', '#4d5a7c')}
      {node(146, 10, 90, 'Suspensa', '#7247c9', 'suspensa')}
      {node(250, 148, 98, 'Bloqueada', '#b4750f', 'bloqueada')}
    </svg>
  )
}
