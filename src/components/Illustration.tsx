import type { CSSProperties } from 'react'
import { cx } from './ui'

// Line illustrations animated with CSS keyframes (see index.css). Pure SVG —
// light on CPU, crisp at any size, and theme-aware via CSS variables.

const ink = 'var(--text)'
const accent = 'var(--primary)'
const soft = 'var(--mint)'

function pivot(x: number, y: number, animation?: string): CSSProperties {
  return { transformOrigin: `${x}px ${y}px`, transformBox: 'view-box', animation }
}

const line = { stroke: ink, strokeWidth: 3.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }

function Eye({ variant }: { variant: string }) {
  const almond = 'M20 50 C 50 14, 110 14, 140 50 C 110 86, 50 86, 20 50 Z'
  if (variant === 'eye-close') {
    return (
      <svg viewBox="0 0 160 100" className="ill h-full w-full">
        <path d="M24 50 C 54 76, 106 76, 136 50" {...line} />
        {[38, 60, 80, 100, 122].map((x, i) => (
          <line key={x} x1={x} y1={60 + (i === 0 || i === 4 ? -2 : 4)} x2={x + (x - 80) * 0.08} y2={70 + (i === 0 || i === 4 ? 0 : 6)} {...line} strokeWidth={2.4} />
        ))}
        {[0, 1, 2].map((i) => (
          <text key={i} x={118 + i * 6} y={34 - i * 4} fill={accent} fontSize={12 - i * 2} fontWeight={700} style={{ animation: `float-z 3s ${i * 0.9}s ease-out infinite` }}>
            z
          </text>
        ))}
      </svg>
    )
  }
  const pupilAnim =
    variant === 'eye-left-right' ? 'look-lr 4s ease-in-out infinite' : variant === 'eye-up-down' ? 'look-ud 4s ease-in-out infinite' : variant === 'eye-distance' ? 'look-drift 6s ease-in-out infinite' : undefined
  return (
    <svg viewBox="0 0 160 100" className="ill h-full w-full">
      <defs>
        <clipPath id={`eye-clip-${variant}`}>
          <path d={almond} />
        </clipPath>
      </defs>
      <path d={almond} fill="var(--surface)" />
      <g clipPath={`url(#eye-clip-${variant})`}>
        <g style={{ animation: pupilAnim }}>
          <g style={variant === 'eye-near-far' ? pivot(80, 50, 'focus-shift 3.5s ease-in-out infinite') : undefined}>
            <circle cx={80} cy={50} r={19} fill={accent} />
            <circle cx={80} cy={50} r={8.5} fill={ink} />
            <circle cx={86} cy={44} r={3.2} fill="white" />
          </g>
        </g>
        {variant === 'eye-blink' && <rect x={0} y={0} width={160} height={100} fill={soft} style={pivot(80, 14, 'blink 2.4s ease-in-out infinite')} />}
      </g>
      <path d={almond} {...line} />
      {variant === 'eye-near-far' && (
        <g style={{ animation: 'pulse-soft 3.5s ease-in-out infinite' }}>
          <circle cx={80} cy={93} r={3} fill={accent} />
        </g>
      )}
    </svg>
  )
}

function Figure({ variant }: { variant: string }) {
  const S = { x: 60, y: 46 } // shoulders
  const H = { x: 60, y: 82 } // hips
  const hangL = <line x1={S.x} y1={S.y} x2={42} y2={74} {...line} />
  const hangR = <line x1={S.x} y1={S.y} x2={78} y2={74} {...line} />
  const head = <circle cx={60} cy={29} r={10.5} fill="var(--surface)" {...{ stroke: ink, strokeWidth: 3.2 }} />
  const torso = <line x1={60} y1={40} x2={H.x} y2={H.y} {...line} />
  const legs = (
    <>
      <line x1={H.x} y1={H.y} x2={49} y2={120} {...line} />
      <line x1={H.x} y1={H.y} x2={71} y2={120} {...line} />
    </>
  )
  const ground = <line x1={22} y1={124} x2={98} y2={124} stroke="var(--border)" strokeWidth={3} strokeLinecap="round" />

  let body: React.ReactNode
  switch (variant) {
    case 'neck':
      body = (
        <>
          <g style={pivot(60, 40, 'head-roll 4s ease-in-out infinite')}>
            {head}
            <path d="M45 18 a 18 18 0 0 1 30 0" stroke={accent} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeDasharray="3 5" />
          </g>
          {torso}
          {hangL}
          {hangR}
          {legs}
        </>
      )
      break
    case 'shoulders':
      body = (
        <>
          {head}
          <g style={{ animation: 'shrug 1.8s ease-in-out infinite' }}>
            <line x1={46} y1={46} x2={74} y2={46} {...line} />
            <line x1={46} y1={46} x2={40} y2={74} {...line} />
            <line x1={74} y1={46} x2={80} y2={74} {...line} />
            <circle cx={46} cy={46} r={6} fill="none" stroke={accent} strokeWidth={2} strokeDasharray="3 4" />
            <circle cx={74} cy={46} r={6} fill="none" stroke={accent} strokeWidth={2} strokeDasharray="3 4" />
          </g>
          {torso}
          {legs}
        </>
      )
      break
    case 'reach':
      body = (
        <>
          {head}
          {torso}
          <g style={pivot(S.x, S.y, 'arm-raise-l 4s ease-in-out infinite')}>{hangL}</g>
          <g style={pivot(S.x, S.y, 'arm-raise-r 4s ease-in-out infinite')}>{hangR}</g>
          {legs}
        </>
      )
      break
    case 'full-body':
      body = (
        <>
          {head}
          {torso}
          <g style={pivot(S.x, S.y, 'arm-out-l 3.4s ease-in-out infinite')}>{hangL}</g>
          <g style={pivot(S.x, S.y, 'arm-out-r 3.4s ease-in-out infinite')}>{hangR}</g>
          <line x1={H.x} y1={H.y} x2={49} y2={120} {...line} />
          <g style={pivot(H.x, H.y, 'leg-swing-a 3.4s ease-in-out infinite')}>
            <line x1={H.x} y1={H.y} x2={71} y2={120} {...line} />
          </g>
        </>
      )
      break
    case 'wrist':
      body = (
        <>
          {head}
          {torso}
          {hangL}
          <line x1={S.x} y1={S.y} x2={88} y2={50} {...line} />
          <g style={pivot(88, 50, 'wrist-bend 2.4s ease-in-out infinite')}>
            <line x1={88} y1={50} x2={100} y2={51} {...line} />
          </g>
          <circle cx={88} cy={50} r={7} fill="none" stroke={accent} strokeWidth={2} strokeDasharray="3 4" />
          {legs}
        </>
      )
      break
    case 'back':
      body = (
        <>
          <g style={pivot(H.x, H.y, 'lean-back 4s ease-in-out infinite')}>
            {head}
            {torso}
            <path d={`M${S.x} ${S.y} L46 62 L54 78`} {...line} />
            <path d={`M${S.x} ${S.y} L74 62 L66 78`} {...line} />
          </g>
          {legs}
        </>
      )
      break
    case 'walk':
      body = (
        <g style={{ animation: 'walk-x 4s ease-in-out infinite' }}>
          <g style={{ animation: 'bob 0.6s ease-in-out infinite' }}>
            {head}
            {torso}
            <g style={pivot(S.x, S.y, 'leg-swing-b 1.2s ease-in-out infinite')}>
              <line x1={S.x} y1={S.y} x2={60} y2={76} {...line} />
            </g>
            <g style={pivot(S.x, S.y, 'leg-swing-a 1.2s ease-in-out infinite')}>
              <line x1={S.x} y1={S.y} x2={60} y2={76} {...line} />
            </g>
          </g>
          <g style={pivot(H.x, H.y, 'leg-swing-a 1.2s ease-in-out infinite')}>
            <line x1={H.x} y1={H.y} x2={60} y2={121} {...line} />
          </g>
          <g style={pivot(H.x, H.y, 'leg-swing-b 1.2s ease-in-out infinite')}>
            <line x1={H.x} y1={H.y} x2={60} y2={121} {...line} />
          </g>
        </g>
      )
      break
    case 'calf':
      body = (
        <g style={{ animation: 'rise 1.8s ease-in-out infinite' }}>
          {head}
          {torso}
          {hangL}
          {hangR}
          {legs}
        </g>
      )
      break
    case 'breathe':
      body = (
        <>
          <circle cx={60} cy={62} r={30} fill={soft} className="anim-breathe" style={{ animationDuration: '10s' }} />
          {head}
          {torso}
          {hangL}
          {hangR}
          {legs}
        </>
      )
      break
    case 'posture':
      return (
        <svg viewBox="0 0 120 140" className="ill h-full w-full">
          <path d="M36 86 h40 M40 86 v36 M72 86 v36 M36 50 v36" stroke="var(--border)" strokeWidth={4} strokeLinecap="round" fill="none" />
          <g style={pivot(56, 84, 'sit-tall 4s ease-in-out infinite alternate')}>
            <circle cx={56} cy={31} r={10.5} fill="var(--surface)" stroke={ink} strokeWidth={3.2} />
            <line x1={56} y1={42} x2={56} y2={84} {...line} />
            <path d="M56 50 L70 66 L84 66" {...line} />
          </g>
          <path d="M56 84 L86 84 L86 120" {...line} />
          <line x1={92} y1={60} x2={110} y2={60} stroke={accent} strokeWidth={3} strokeLinecap="round" />
          <rect x={90} y={40} width={22} height={16} rx={3} fill="none" stroke={accent} strokeWidth={2.5} />
        </svg>
      )
    default: // stand
      body = (
        <g style={{ animation: 'bob 2.4s ease-in-out infinite' }}>
          {head}
          {torso}
          {hangL}
          {hangR}
          {legs}
        </g>
      )
  }
  return (
    <svg viewBox="0 0 120 140" className="ill h-full w-full">
      {ground}
      {body}
    </svg>
  )
}

function Water() {
  return (
    <svg viewBox="0 0 120 140" className="ill h-full w-full">
      <defs>
        <clipPath id="glass">
          <path d="M34 30 L86 30 L80 120 L40 120 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#glass)">
        <g style={{ animation: 'water-level 6s ease-in-out infinite alternate' }}>
          <path d="M20 58 q 12 -6 25 0 t 25 0 t 25 0 t 25 0 V 140 H 20 Z" fill={accent} opacity={0.85} />
        </g>
      </g>
      <path d="M34 30 L86 30 L80 120 L40 120 Z" {...line} />
      <circle cx={50} cy={86} r={3} fill="white" opacity={0.8} className="anim-pulse-soft" />
      <circle cx={64} cy={100} r={2} fill="white" opacity={0.8} className="anim-pulse-soft" />
    </svg>
  )
}

function Custom() {
  return (
    <svg viewBox="0 0 120 140" className="ill h-full w-full">
      <circle cx={60} cy={70} r={36} fill={soft} className="anim-breathe" />
      <path d="M60 44 C 78 56, 78 84, 60 98 C 42 84, 42 56, 60 44 Z" fill="none" stroke={accent} strokeWidth={3.2} strokeLinejoin="round" />
      <path d="M60 52 V 96" stroke={accent} strokeWidth={2.6} strokeLinecap="round" />
      <g style={pivot(92, 40, 'sparkle 2.6s ease-in-out infinite')}>
        <path d="M92 32 v16 M84 40 h16" stroke={ink} strokeWidth={2.6} strokeLinecap="round" />
      </g>
    </svg>
  )
}

export function Illustration({ name, className, paused }: { name: string; className?: string; paused?: boolean }) {
  let el: React.ReactNode
  if (name.startsWith('eye-')) el = <Eye variant={name} />
  else if (name === 'water') el = <Water />
  else if (name === 'custom') el = <Custom />
  else el = <Figure variant={name} />
  return <div className={cx('relative', paused && 'paused-anim', className)}>{el}</div>
}
