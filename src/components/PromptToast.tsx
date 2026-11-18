import { AlarmClock, Play, X } from 'lucide-react'
import { getEngine, useSnapshot } from '../hooks/useEngine'
import { promptTimeoutMs } from '../lib/scheduler'
import { Button, ProgressBar } from './ui'
import { KindIcon } from './meta'

// In-app reminder prompt. Always shown alongside the system notification so
// reminders still work when notification permission is unavailable.
export function PromptToast() {
  const s = useSnapshot()
  const p = s.runtime.prompt
  if (!p || s.activeBreak) return null
  const e = getEngine()
  const rs = p.reminderIds.map((id) => s.settings.reminders.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r)
  if (!rs.length) return null
  const timeout = promptTimeoutMs({ testMode: s.settings.testMode })
  const left = Math.max(0, 1 - (s.now - p.createdAt) / timeout)
  const title = rs.length === 1 ? rs[0].title : 'Time for a combined break'
  const snooze = s.settings.testMode ? '10s' : `${s.settings.notifications.snoozeMin} min`
  return (
    <div className="anim-slide-in fixed inset-x-3 bottom-20 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px]" role="alertdialog" aria-live="assertive" aria-label={title}>
      <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-pop">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex -space-x-2">
              {rs.map((r) => (
                <span key={r.id} className="rounded-xl ring-2 ring-surface">
                  <KindIcon reminder={r} boxed size={18} boxSize={40} />
                </span>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold leading-snug">{title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{rs.length === 1 ? rs[0].message : rs.map((r) => r.name).join(' · ')}</p>
            </div>
            <button aria-label="Dismiss reminder" className="-mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text" onClick={() => e.dismissPrompt()}>
              <X size={16} />
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" className="flex-1" onClick={() => e.startPromptBreak()} autoFocus>
              <Play size={15} /> Start break
            </Button>
            <Button onClick={() => e.snoozePrompt()}>
              <AlarmClock size={15} /> Snooze {snooze}
            </Button>
          </div>
        </div>
        <ProgressBar value={left} className="h-1 rounded-none" color="var(--primary)" />
      </div>
    </div>
  )
}
