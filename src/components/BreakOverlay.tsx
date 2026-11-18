import { useEffect, useState } from 'react'
import { Check, ChevronRight, Leaf, Pause, Play, SkipForward, X } from 'lucide-react'
import { getEngine, useSnapshot } from '../hooks/useEngine'
import type { ActiveBreak, BreakRecord } from '../lib/types'
import { Illustration } from './Illustration'
import { Button, Toggle, cx } from './ui'
import { formatDuration } from '../lib/time'

function headline(ids: string[], names: (id: string) => string) {
  const has = (k: string) => ids.includes(k)
  if (has('eye') && has('movement')) return { title: 'Rest & Move', sub: 'Rest your eyes first, then give your body a little movement.' }
  if (has('movement')) return { title: 'Time to Move!', sub: 'Your body deserves a little movement.' }
  if (has('eye')) return { title: 'Give Your Eyes a Rest', sub: 'Look away from your screen and focus on something in the distance.' }
  if (has('hydration')) return { title: 'Time for a Water Break', sub: 'Take a moment to drink some water.' }
  if (has('posture')) return { title: 'Check Your Posture', sub: 'Relax your shoulders and sit comfortably.' }
  return { title: names(ids[0]), sub: 'A short pause for you.' }
}

export function BreakOverlay() {
  const s = useSnapshot()
  if (s.activeBreak) return <ActiveBreakView b={s.activeBreak} />
  if (s.lastFinished) return <Completed rec={s.lastFinished.record} />
  return null
}

function ActiveBreakView({ b }: { b: ActiveBreak }) {
  const s = useSnapshot()
  const e = getEngine()
  const [gentle, setGentle] = useState(s.settings.gentleMovement)
  const step = b.steps[b.stepIndex]
  const elapsed = e.stepElapsed(b, s.now)
  const left = Math.max(0, step.durationSec * 1000 - elapsed)
  const secs = Math.ceil(left / 1000)
  const progress = Math.min(1, elapsed / (step.durationSec * 1000))
  const names = (id: string) => s.settings.reminders.find((r) => r.id === id)?.name ?? 'Break'
  const h = headline(b.reminderIds, names)
  const totalSec = b.steps.reduce((a, x) => a + x.durationSec, 0)
  const doneSec = b.steps.slice(0, b.stepIndex).reduce((a, x) => a + x.durationSec, 0) + elapsed / 1000
  const isEye = step.animation.startsWith('eye-')

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === ' ' && (ev.target as HTMLElement)?.tagName !== 'BUTTON') {
        ev.preventDefault()
        b.paused ? e.resumeBreak() : e.pauseBreak()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [b.paused, e])

  const size = 300
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r

  return (
    <div className="anim-fade-in fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label={h.title}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[38%] h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint opacity-50 blur-3xl dark:opacity-25" />
      </div>
      <div className="drag h-8 shrink-0" />
      {/* overall progress */}
      <div className="relative mx-auto w-full max-w-3xl px-6">
        <div className="flex items-center gap-1.5">
          {b.steps.map((x, i) => {
            const res = b.results[i]
            return (
              <div key={x.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" title={x.title}>
                <div
                  className={cx('h-full rounded-full transition-[width] duration-1000 ease-linear', res && !res.completed ? 'bg-muted/40' : 'bg-primary')}
                  style={{ width: i < b.stepIndex ? '100%' : i === b.stepIndex ? `${progress * 100}%` : '0%' }}
                />
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs font-medium text-muted">
          <span>
            Step {b.stepIndex + 1} of {b.steps.length}
          </span>
          <span className="tabular">{formatDuration(Math.max(0, (totalSec - doneSec) * 1000))} left</span>
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{h.title}</h1>
        <p className="mt-2 max-w-md text-[15px] text-muted">{h.sub}</p>

        <div className="relative mt-8 grid place-items-center" style={{ width: size, height: size, maxWidth: '78vw', maxHeight: '78vw' }}>
          <div className="anim-breathe absolute inset-8 rounded-full bg-mint" style={{ animationPlayState: b.paused ? 'paused' : 'running' }} />
          <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - progress)}
              strokeOpacity={progress < 0.004 ? 0 : 1}
              style={{ transition: progress === 0 ? 'none' : 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div key={step.key} className="anim-scale-in relative flex flex-col items-center">
            <Illustration name={step.animation} paused={b.paused} className={isEye ? 'h-24 w-40' : 'h-36 w-32'} />
            <span className="tabular mt-1 text-5xl font-bold leading-none">{secs}</span>
            <span className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{b.paused ? 'Paused' : 'seconds'}</span>
          </div>
        </div>

        <div key={step.key + '-text'} className="anim-fade-up mt-8 w-full max-w-md">
          <h2 className="text-xl font-bold">{step.title}</h2>
          <ol className="mt-3 flex flex-col gap-1.5 text-left">
            {(gentle && step.gentle ? [step.gentle] : step.steps).map((t, i) => (
              <li key={i} className="flex gap-3 rounded-2xl bg-surface/70 px-4 py-2.5 text-sm backdrop-blur-sm">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint text-[11px] font-bold text-primary-strong">{gentle && step.gentle ? <Leaf size={11} /> : i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          {step.gentle && (
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-muted">
              <Toggle checked={gentle} onChange={setGentle} label="Show gentle alternative" />
              Gentle alternative
            </label>
          )}
          {b.stepIndex + 1 < b.steps.length && (
            <p className="mt-3 flex items-center justify-center gap-1 text-xs text-muted">
              Up next <ChevronRight size={12} /> <span className="font-semibold text-text">{b.steps[b.stepIndex + 1].title}</span>
            </p>
          )}
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-2 px-6 pb-10">
        <Button variant="ghost" onClick={() => e.finishBreak('skip')}>
          <X size={16} /> Skip break
        </Button>
        <Button onClick={() => (b.paused ? e.resumeBreak() : e.pauseBreak())} aria-keyshortcuts="Space">
          {b.paused ? <Play size={16} /> : <Pause size={16} />} {b.paused ? 'Resume' : 'Pause'}
        </Button>
        {b.stepIndex + 1 < b.steps.length && (
          <Button onClick={() => e.skipStep()}>
            <SkipForward size={16} /> Next exercise
          </Button>
        )}
        <Button variant="primary" onClick={() => e.finishBreak('complete')}>
          <Check size={16} /> {b.steps.length > 1 ? 'Complete routine' : 'Complete'}
        </Button>
      </div>
    </div>
  )
}

function Completed({ rec }: { rec: BreakRecord }) {
  const e = getEngine()
  useEffect(() => {
    const id = setTimeout(() => e.dismissFinished(), 9000)
    const onKey = (ev: KeyboardEvent) => (ev.key === 'Escape' || ev.key === 'Enter') && e.dismissFinished()
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [e, rec.id])
  const done = rec.exercises.filter((x) => x.completed).length
  const mins = rec.startedAt ? formatDuration(rec.endedAt - rec.startedAt) : ''
  return (
    <div className="anim-fade-in fixed inset-0 z-[60] grid place-items-center bg-bg/95 p-6 backdrop-blur" role="dialog" aria-modal="true" aria-label="Break complete">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="anim-pop grid h-24 w-24 place-items-center rounded-full bg-mint">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--primary-strong)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" className="anim-draw" />
          </svg>
        </div>
        <h2 className="anim-fade-up mt-6 text-2xl font-bold [animation-delay:150ms]">Nice work!</h2>
        <p className="anim-fade-up mt-1 text-[15px] text-muted [animation-delay:220ms]">
          {rec.exercises.length > 1 ? `${done} of ${rec.exercises.length} exercises done` : 'Break complete'}
          {mins ? ` · ${mins}` : ''}. Your next reminder has been rescheduled.
        </p>
        <Button variant="primary" size="lg" className="anim-fade-up mt-8 [animation-delay:300ms]" onClick={() => e.dismissFinished()} autoFocus>
          Back to work
        </Button>
      </div>
    </div>
  )
}
