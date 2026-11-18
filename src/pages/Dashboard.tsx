import { useMemo, useState } from 'react'
import { Activity, Clock3, Coffee, Eye, Info, Moon, Pause, PersonStanding, Play, RotateCcw, Sparkles, Sun, Target, Timer, TriangleAlert, X } from 'lucide-react'
import { getEngine, useSnapshot } from '../hooks/useEngine'
import type { Snapshot } from '../lib/engine'
import { statusText } from '../lib/engine'
import { Badge, Button, Card, IconButton, MenuItem, Modal, NumberField, Popover, ProgressBar, Ring, SectionTitle, cx } from '../components/ui'
import { CircularTimer } from '../components/CircularTimer'
import { KindIcon, kindMeta } from '../components/meta'
import { allSessions, dayRange, summarize, isDone } from '../lib/analytics'
import { DAY_NAMES, HOUR, MIN, formatClock, formatDuration, formatTime12, startOfDay } from '../lib/time'
import type { BreakRecord } from '../lib/types'

export function Dashboard({ navigate }: { navigate: (r: string) => void }) {
  const s = useSnapshot()
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <SessionCard s={s} />
      <div className="flex flex-col gap-5 lg:col-span-5">
        <UpNext s={s} navigate={navigate} />
        <FocusCard s={s} />
      </div>
      <SummaryCards s={s} navigate={navigate} />
      <TodayTimeline s={s} />
    </div>
  )
}

// ───────────────────────── session / timer ─────────────────────────

export function PauseMenu({ s, size = 'md' }: { s: Snapshot; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false)
  const e = getEngine()
  if (s.runtime.pause) {
    return (
      <Button size={size} variant="soft" onClick={() => e.resume()}>
        <Play size={16} /> Resume
      </Button>
    )
  }
  const pick = (ms: number | null) => {
    e.pause(ms)
    setOpen(false)
  }
  const tomorrow = startOfDay(s.now) + 24 * HOUR - s.now
  return (
    <Popover
      open={open}
      setOpen={setOpen}
      align="left"
      trigger={
        <Button size={size} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
          <Pause size={16} /> Pause
        </Button>
      }
    >
      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Pause reminders</div>
      <MenuItem onClick={() => pick(15 * MIN)}>For 15 minutes</MenuItem>
      <MenuItem onClick={() => pick(30 * MIN)}>For 30 minutes</MenuItem>
      <MenuItem onClick={() => pick(HOUR)}>For 1 hour</MenuItem>
      <MenuItem onClick={() => pick(tomorrow)}>Until tomorrow</MenuItem>
      <MenuItem onClick={() => pick(null)}>Until I resume</MenuItem>
    </Popover>
  )
}

function inactiveCopy(s: Snapshot) {
  const a = s.availability
  const resumes = a.resumesAt ? describeWhen(a.resumesAt, s.now) : null
  switch (a.reason) {
    case 'paused':
      return { icon: Pause, title: 'Reminders paused', body: resumes ? `They'll resume ${resumes}.` : 'They stay paused until you resume.' }
    case 'lunch':
      return { icon: Coffee, title: 'Enjoy your lunch', body: resumes ? `Reminders resume ${resumes}.` : '' }
    case 'away':
      return { icon: Moon, title: 'Welcome back soon', body: "You've stepped away — timers restart when you return." }
    case 'sleep':
      return { icon: Moon, title: 'Resting', body: 'Your computer is asleep.' }
    case 'pause-period':
      return { icon: Sun, title: 'Enjoy your time off', body: resumes ? `Reminders resume ${resumes}.` : 'Reminders are paused for this period.' }
    case 'non-working-day':
      return { icon: Sun, title: 'Not a working day', body: resumes ? `Reminders resume ${resumes}.` : '' }
    case 'before-hours':
      return { icon: Sun, title: 'Good morning', body: resumes ? `Your work day starts ${resumes}.` : '' }
    default:
      return { icon: Moon, title: "You're done for the day", body: resumes ? `Reminders resume ${resumes}.` : 'Time to rest your eyes for real.' }
  }
}

function describeWhen(t: number, now: number) {
  const today = startOfDay(now)
  const day = startOfDay(t)
  const time = formatTime12(t)
  if (day === today) return `at ${time}`
  if (day - today === 24 * HOUR) return `tomorrow at ${time}`
  if (day - today < 7 * 24 * HOUR) return `${DAY_NAMES[new Date(t).getDay()]} at ${time}`
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${time}`
}

function SessionCard({ s }: { s: Snapshot }) {
  const e = getEngine()
  const a = s.availability
  const next = s.next
  const sessionMs = e.currentSessionMs(s.now)
  const status = statusText(s)
  const remaining = next?.remainingMs ?? 0
  const progress = next ? 1 - remaining / next.intervalMs : 0
  const near = a.active && next && remaining <= Math.min(60_000, next.intervalMs * 0.15)
  const color = !a.active ? 'var(--muted)' : near ? 'var(--warning)' : kindMeta(next?.reminder).color === 'var(--primary)' ? 'var(--primary)' : kindMeta(next?.reminder).color
  const inactive = !a.active ? inactiveCopy(s) : null
  const outsideSchedule = !a.active && a.reason && ['before-hours', 'after-hours', 'non-working-day', 'pause-period'].includes(a.reason)
  const nextEye = s.timers.find((t) => t.reminder.id === 'eye')
  const nextMove = s.timers.find((t) => t.reminder.id === 'movement')

  return (
    <Card className="anim-fade-up relative overflow-hidden p-6 sm:p-8 lg:col-span-7">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-mint opacity-60 blur-3xl dark:opacity-30" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-muted">Current screen session</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={cx('h-2 w-2 rounded-full', a.active ? (s.runtime.prompt ? 'anim-pulse-soft bg-warning' : 'bg-success') : 'bg-muted')} />
            <span className="text-sm font-bold">{status}</span>
            {s.runtime.focus && <Badge tone="info">Focus</Badge>}
            {s.settings.testMode && <Badge tone="warning">Test mode</Badge>}
          </div>
        </div>
        <IconButton label="Reset all timers" onClick={() => e.resetTimers()} disabled={!!s.runtime.prompt}>
          <RotateCcw size={17} />
        </IconButton>
      </div>

      <div className="relative mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
        <CircularTimer progress={a.active ? progress : (next ? 1 - remaining / next.intervalMs : 0)} color={color} glow={!!near}>
          {inactive && !s.runtime.pause ? (
            <div className="flex flex-col items-center px-10">
              <inactive.icon size={30} className="text-muted" strokeWidth={1.8} />
              <p className="mt-2 text-[15px] font-bold leading-tight">{inactive.title}</p>
            </div>
          ) : next ? (
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{s.runtime.prompt ? 'Break due' : a.active ? 'Next break in' : 'Paused at'}</span>
              <span className="tabular mt-1 text-[52px] font-bold leading-none tracking-tight">{s.runtime.prompt ? 'Now' : formatClock(remaining)}</span>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">
                <KindIcon reminder={next.reminder} size={13} /> {next.reminder.name}
              </span>
            </div>
          ) : (
            <div className="px-10 text-sm text-muted">No reminders enabled</div>
          )}
        </CircularTimer>

        <div className="flex w-full flex-1 flex-col gap-4">
          {inactive ? (
            <div className="rounded-2xl bg-surface-2 p-4">
              <p className="text-sm font-bold">{inactive.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{inactive.body}</p>
              {outsideSchedule && (
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => e.workOutsideHoursToday()}>
                  <Play size={14} /> Work outside hours today
                </Button>
              )}
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3">
              <Stat label="Work session" value={formatDuration(sessionMs)} />
              <Stat label="Next break" value={next ? next.reminder.name : '—'} />
              <Stat label="Eye rest in" value={nextEye ? (nextEye.dueAt === null && nextEye.remainingMs === 0 ? 'Now' : formatClock(nextEye.remainingMs)) : 'Off'} />
              <Stat label="Movement in" value={nextMove ? (nextMove.suppressed ? 'After focus' : nextMove.dueAt === null && nextMove.remainingMs === 0 ? 'Now' : formatClock(nextMove.remainingMs)) : 'Off'} />
            </dl>
          )}
          {s.runtime.overrideUntil && (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              Working outside your hours today ·
              <button className="font-semibold text-primary-strong hover:underline" onClick={() => e.clearOverride()}>
                Stop
              </button>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <TakeBreakButton s={s} />
            <PauseMenu s={s} />
          </div>
        </div>
      </div>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="tabular mt-0.5 truncate text-[15px] font-bold">{value}</dd>
    </div>
  )
}

function TakeBreakButton({ s }: { s: Snapshot }) {
  const [open, setOpen] = useState(false)
  const e = getEngine()
  const enabled = s.settings.reminders.filter((r) => r.enabled)
  const defaultIds = s.runtime.prompt?.reminderIds ?? (s.next ? [s.next.reminder.id] : enabled[0] ? [enabled[0].id] : [])
  const go = (ids: string[]) => {
    setOpen(false)
    e.takeBreak(ids)
  }
  return (
    <div className="flex">
      <Button variant="primary" size="lg" className="rounded-r-none pr-4" disabled={!defaultIds.length} onClick={() => go(defaultIds)}>
        <Sparkles size={17} /> Take a Break Now
      </Button>
      <Popover
        open={open}
        setOpen={setOpen}
        align="left"
        trigger={
          <Button variant="primary" size="lg" className="rounded-l-none border-l border-white/25 px-3" aria-label="Choose break type" onClick={() => setOpen(!open)} disabled={!enabled.length}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </Button>
        }
      >
        <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Start a break</div>
        {enabled.map((r) => (
          <MenuItem key={r.id} icon={<KindIcon reminder={r} size={16} />} onClick={() => go([r.id])} hint={r.kind === 'movement' ? formatDuration(r.durationSec * 1000) : `${r.durationSec}s`}>
            {r.name}
          </MenuItem>
        ))}
        {enabled.some((r) => r.id === 'eye') && enabled.some((r) => r.id === 'movement') && <MenuItem icon={<Sparkles size={16} />} onClick={() => go(['eye', 'movement'])}>Eye rest + movement</MenuItem>}
      </Popover>
    </div>
  )
}

// ───────────────────────── up next ─────────────────────────

function UpNext({ s, navigate }: { s: Snapshot; navigate: (r: string) => void }) {
  const sorted = [...s.timers].sort((a, b) => a.remainingMs - b.remainingMs)
  return (
    <Card className="anim-fade-up p-5 [animation-delay:60ms]">
      <SectionTitle
        action={
          <button className="text-xs font-semibold text-primary-strong hover:underline" onClick={() => navigate('settings/reminders')}>
            Edit
          </button>
        }
      >
        Reminders
      </SectionTitle>
      {sorted.length === 0 && <p className="text-sm text-muted">All reminders are off. Turn some on in settings.</p>}
      <ul className="flex flex-col gap-1">
        {sorted.map((t) => {
          const held = t.dueAt === null && t.remainingMs === 0 && !!(s.runtime.prompt?.reminderIds.includes(t.reminder.id) || s.activeBreak?.reminderIds.includes(t.reminder.id))
          return (
            <li key={t.reminder.id} className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-surface-2">
              <KindIcon reminder={t.reminder} boxed size={17} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.reminder.name}</p>
                <ProgressBar className="mt-1.5" value={held ? 1 : 1 - t.remainingMs / t.intervalMs} color={kindMeta(t.reminder).color} />
              </div>
              <span className="tabular w-16 text-right text-[13px] font-semibold text-muted">{held ? 'Now' : t.suppressed ? 'Held' : formatClock(t.remainingMs)}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

// ───────────────────────── focus ─────────────────────────

function FocusCard({ s }: { s: Snapshot }) {
  const e = getEngine()
  const [custom, setCustom] = useState(false)
  const [mins, setMins] = useState(30)
  const f = s.runtime.focus
  const unit = s.settings.testMode ? 'sec' : 'min'
  if (f) {
    const total = f.endsAt - f.start
    const left = Math.max(0, f.endsAt - s.now)
    return (
      <Card className="anim-fade-up flex items-center gap-4 p-5">
        <Ring value={1 - left / total} size={64} stroke={6} color="var(--info)">
          <Target size={20} className="text-info" />
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-muted">Focus session</p>
          <p className="tabular text-2xl font-bold">{formatClock(left)}</p>
          <p className="text-xs text-muted">Only eye-rest reminders will interrupt you.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => e.endFocus(false)}>
          End
        </Button>
      </Card>
    )
  }
  return (
    <Card className="anim-fade-up p-5 [animation-delay:120ms]">
      <SectionTitle>Focus mode</SectionTitle>
      <p className="-mt-1 mb-3 text-[13px] text-muted">Hold non-essential reminders while you concentrate. Eye rest still reminds you.</p>
      <div className="grid grid-cols-4 gap-2">
        {[25, 45, 60].map((m) => (
          <Button key={m} variant="soft" size="sm" className="h-10" onClick={() => e.startFocus(m)}>
            {m} {unit}
          </Button>
        ))}
        <Button variant="secondary" size="sm" className="h-10" onClick={() => setCustom(true)}>
          Custom
        </Button>
      </div>
      <Modal open={custom} onClose={() => setCustom(false)} title="Custom focus session">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Duration</span>
          <NumberField label="Focus duration" value={mins} onChange={setMins} min={5} max={240} step={5} suffix={unit} />
        </div>
        <Button
          variant="primary"
          className="mt-6 w-full"
          onClick={() => {
            e.startFocus(mins)
            setCustom(false)
          }}
        >
          <Timer size={16} /> Start focus
        </Button>
      </Modal>
    </Card>
  )
}

// ───────────────────────── summary cards ─────────────────────────

function SummaryCards({ s, navigate }: { s: Snapshot; navigate: (r: string) => void }) {
  const [explain, setExplain] = useState(false)
  const today = dayRange(s.now)
  const sum = summarize(s.history, s.runtime.currentSession, s.runtime.focus, today, s.now)
  const eyeOn = s.settings.reminders.find((r) => r.id === 'eye')?.enabled
  const moveOn = s.settings.reminders.find((r) => r.id === 'movement')?.enabled
  const sessionsToday = allSessions(s.history, s.runtime.currentSession).filter((x) => x.end >= today.from).length
  const score = sum.score
  return (
    <div className="grid grid-cols-2 gap-4 lg:col-span-12 lg:grid-cols-4">
      <Card interactive className="anim-fade-up cursor-pointer p-5 [animation-delay:80ms]" onClick={() => navigate('stats')}>
        <div className="flex items-start justify-between">
          <KindIcon reminder={{ kind: 'eye' }} boxed size={18} boxSize={38} />
          <Ring value={sum.eye / Math.max(1, s.settings.targets.eye)} size={42} stroke={5} />
        </div>
        <p className="mt-4 text-[13px] font-semibold text-muted">Eye breaks</p>
        <p className="tabular text-2xl font-bold">
          {sum.eye}
          <span className="text-base font-semibold text-muted"> / {s.settings.targets.eye}</span>
        </p>
        <p className="mt-1 text-xs text-muted">{eyeOn ? 'Completed today' : 'Reminder off'}</p>
      </Card>
      <Card interactive className="anim-fade-up cursor-pointer p-5 [animation-delay:120ms]" onClick={() => navigate('stats')}>
        <div className="flex items-start justify-between">
          <KindIcon reminder={{ kind: 'movement' }} boxed size={18} boxSize={38} />
          <Ring value={sum.movement / Math.max(1, s.settings.targets.movement)} size={42} stroke={5} color="var(--warning)" />
        </div>
        <p className="mt-4 text-[13px] font-semibold text-muted">Movement breaks</p>
        <p className="tabular text-2xl font-bold">
          {sum.movement}
          <span className="text-base font-semibold text-muted"> / {s.settings.targets.movement}</span>
        </p>
        <p className="mt-1 text-xs text-muted">{moveOn ? 'Completed today' : 'Reminder off'}</p>
      </Card>
      <Card interactive className="anim-fade-up cursor-pointer p-5 [animation-delay:160ms]" onClick={() => navigate('stats')}>
        <div className="flex items-start justify-between">
          <span className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-info-soft">
            <Clock3 size={18} className="text-info" />
          </span>
        </div>
        <p className="mt-4 text-[13px] font-semibold text-muted">Screen time</p>
        <p className="tabular text-2xl font-bold">{formatDuration(sum.screenMs)}</p>
        <p className="mt-1 text-xs text-muted">
          {sessionsToday} {sessionsToday === 1 ? 'session' : 'sessions'} today
        </p>
      </Card>
      <Card interactive className="anim-fade-up cursor-pointer p-5 [animation-delay:200ms]" onClick={() => setExplain(true)}>
        <div className="flex items-start justify-between">
          <span className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-mint">
            <Activity size={18} className="text-primary-strong" />
          </span>
          <Info size={16} className="text-muted" />
        </div>
        <p className="mt-4 text-[13px] font-semibold text-muted">Wellness score</p>
        <p className="tabular text-2xl font-bold">{score ? `${score.percent}%` : '—'}</p>
        <p className="mt-1 text-xs text-muted">{score ? `${score.completed + score.partial} of ${score.total} scheduled breaks` : 'No scheduled breaks yet'}</p>
      </Card>
      <Modal open={explain} onClose={() => setExplain(false)} title="How the wellness score works">
        <p className="text-sm leading-relaxed text-muted">
          Your score is the share of today's <b className="text-text">scheduled</b> reminders you acted on. A completed break counts fully, a partly finished break counts half, and skipped or missed reminders count zero. Snoozes aren't counted until the reminder comes back.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-mint p-3">
            <p className="tabular text-xl font-bold text-primary-strong">{score?.completed ?? 0}</p>
            <p className="text-xs text-muted">Completed</p>
          </div>
          <div className="rounded-2xl bg-warning-soft p-3">
            <p className="tabular text-xl font-bold">{score?.partial ?? 0}</p>
            <p className="text-xs text-muted">Partial</p>
          </div>
          <div className="rounded-2xl bg-surface-2 p-3">
            <p className="tabular text-xl font-bold">{score?.missed ?? 0}</p>
            <p className="text-xs text-muted">Skipped / missed</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">Breaks you start yourself with "Take a Break Now" count toward your daily totals but don't affect the score.</p>
      </Modal>
    </div>
  )
}

// ───────────────────────── timeline ─────────────────────────

type TLItem = { key: string; at: number; end?: number; type: 'session' | 'break' | 'focus'; rec?: BreakRecord; label: string; detail: string; completed?: boolean }

function TodayTimeline({ s }: { s: Snapshot }) {
  const [all, setAll] = useState(false)
  const range = dayRange(s.now)
  const items = useMemo(() => {
    const out: TLItem[] = []
    for (const x of allSessions(s.history, s.runtime.currentSession)) {
      if (x.end < range.from) continue
      const live = x === s.runtime.currentSession
      out.push({ key: x.id, at: Math.max(x.start, range.from), end: x.end, type: 'session', label: live ? 'Working now' : 'Work session', detail: formatDuration(x.end - Math.max(x.start, range.from)) })
    }
    for (const b of s.history.breaks) {
      if (b.endedAt < range.from) continue
      const names = b.reminderIds.map((id) => s.settings.reminders.find((r) => r.id === id)?.name ?? 'Removed reminder').join(' + ')
      const label = b.status === 'completed' ? `${names} completed` : b.status === 'partial' ? `${names} — partly done` : b.status === 'snoozed' ? `${names} snoozed` : b.status === 'missed' ? `${names} missed` : `${names} skipped`
      const ex = b.exercises.filter((e) => e.completed).length
      out.push({ key: b.id, at: b.startedAt ?? b.promptedAt, end: b.endedAt, type: 'break', rec: b, label, detail: b.startedAt ? `${formatDuration(b.endedAt - b.startedAt)}${b.exercises.length ? ` · ${ex}/${b.exercises.length} exercises` : ''}${b.trigger === 'manual' ? ' · on your own' : ''}` : 'Reminder', completed: isDone(b) })
    }
    for (const f of [...s.history.focus, ...(s.runtime.focus ? [s.runtime.focus] : [])]) {
      if ((f.end ?? s.now) < range.from) continue
      out.push({ key: f.id, at: f.start, end: f.end ?? s.now, type: 'focus', label: f.end ? (f.completed ? 'Focus session completed' : 'Focus session ended early') : 'Focusing now', detail: formatDuration((f.end ?? s.now) - f.start) })
    }
    return out.sort((a, b) => b.at - a.at)
  }, [s.history.breaks.length, s.history.sessions.length, s.history.focus.length, s.runtime.currentSession?.end, s.runtime.focus, s.now - (s.now % 15000)])

  const shown = all ? items : items.slice(0, 8)
  // Strip bounds: working hours, widened to include any activity
  const [sh, sm] = s.settings.schedule.start.split(':').map(Number)
  const [eh, em] = s.settings.schedule.end.split(':').map(Number)
  let from = range.from + (sh * 60 + sm) * MIN
  let to = range.from + (eh * 60 + em) * MIN
  for (const i of items) {
    from = Math.min(from, i.at)
    to = Math.max(to, i.end ?? i.at)
  }
  to = Math.max(to, Math.min(s.now, range.to))
  const pct = (t: number) => ((t - from) / Math.max(1, to - from)) * 100
  const hours: number[] = []
  for (let t = Math.ceil(from / HOUR) * HOUR; t <= to; t += HOUR) hours.push(t)
  const step = Math.ceil(hours.length / 8)

  return (
    <Card className="anim-fade-up p-5 sm:p-6 lg:col-span-12 [animation-delay:240ms]">
      <SectionTitle
        action={
          <div className="hidden items-center gap-3 text-[11px] font-semibold text-muted sm:flex">
            <Legend color="var(--mint)" border="var(--primary)" label="Work" />
            <Legend color="var(--primary)" label="Eye break" />
            <Legend color="var(--warning)" label="Movement" />
            <Legend color="var(--info)" label="Focus" />
            <Legend color="var(--surface)" border="var(--danger)" label="Skipped" />
          </div>
        }
      >
        Today's activity
      </SectionTitle>

      <div className="relative mb-6 mt-2 h-10">
        <div className="absolute inset-x-0 top-3 h-4 rounded-full bg-surface-2" />
        {items
          .filter((i) => i.type === 'session')
          .map((i) => (
            <div key={i.key} className="absolute top-3 h-4 rounded-full border border-primary/40 bg-mint" style={{ left: `${pct(i.at)}%`, width: `${Math.max(0.6, pct(i.end!) - pct(i.at))}%` }} />
          ))}
        {items
          .filter((i) => i.type === 'focus')
          .map((i) => (
            <div key={i.key} className="absolute top-[30px] h-1 rounded-full bg-info" style={{ left: `${pct(i.at)}%`, width: `${Math.max(0.6, pct(i.end!) - pct(i.at))}%` }} />
          ))}
        {items
          .filter((i) => i.type === 'break' && i.rec!.status !== 'snoozed')
          .map((i) => {
            const isMove = i.rec!.reminderIds.includes('movement')
            const c = isMove ? 'var(--warning)' : kindMeta(s.settings.reminders.find((r) => r.id === i.rec!.reminderIds[0])).color
            return (
              <div
                key={i.key}
                title={`${formatTime12(i.at)} · ${i.label}`}
                className="absolute top-[7px] h-3 w-3 -translate-x-1/2 rounded-full border-2"
                style={{ left: `${pct(i.at)}%`, background: i.completed ? c : 'var(--surface)', borderColor: i.completed ? 'var(--surface)' : 'var(--danger)', top: 14 }}
              />
            )
          })}
        {s.now < to && <div className="absolute top-1 h-8 w-0.5 rounded-full bg-text/60" style={{ left: `${pct(s.now)}%` }} title="Now" />}
        <div className="absolute inset-x-0 top-9 h-3">
          {hours.map((h, i) =>
            i % step === 0 ? (
              <span key={h} className="tabular absolute -translate-x-1/2 text-[10px] font-medium text-muted" style={{ left: `${pct(h)}%` }}>
                {new Date(h).toLocaleTimeString([], { hour: 'numeric' })}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-surface-2 py-8 text-center">
          <Eye size={22} className="text-muted" />
          <p className="mt-2 text-sm font-semibold">Nothing recorded yet today</p>
          <p className="text-[13px] text-muted">Work sessions and breaks will appear here as they happen.</p>
        </div>
      ) : (
        <ol className="relative ml-1 border-l border-border">
          {shown.map((i) => (
            <TimelineRow key={i.key} i={i} s={s} />
          ))}
        </ol>
      )}
      {items.length > 8 && (
        <button className="mt-3 text-[13px] font-semibold text-primary-strong hover:underline" onClick={() => setAll(!all)}>
          {all ? 'Show less' : `Show all ${items.length}`}
        </button>
      )}
    </Card>
  )
}

function TimelineRow({ i, s }: { i: TLItem; s: Snapshot }) {
  let icon: React.ReactNode
  let tone = 'bg-surface-2'
  if (i.type === 'session') {
    icon = <Clock3 size={14} className="text-primary-strong" />
    tone = 'bg-mint'
  } else if (i.type === 'focus') {
    icon = <Target size={14} className="text-info" />
    tone = 'bg-info-soft'
  } else {
    const r = s.settings.reminders.find((x) => x.id === (i.rec!.reminderIds.includes('movement') ? 'movement' : i.rec!.reminderIds[0]))
    if (i.rec!.status === 'skipped' || i.rec!.status === 'missed') {
      icon = <X size={14} className="text-danger" />
      tone = 'bg-danger-soft'
    } else if (i.rec!.status === 'snoozed') {
      icon = <Clock3 size={14} className="text-muted" />
    } else if (i.rec!.status === 'partial') {
      icon = <TriangleAlert size={14} className="text-warning" />
      tone = 'bg-warning-soft'
    } else {
      icon = r?.kind === 'movement' ? <PersonStanding size={14} className="text-warning" /> : <KindIcon reminder={r ?? { kind: 'custom' }} size={14} />
      tone = r ? '' : 'bg-surface-2'
    }
    if (tone === '') tone = ''
    return (
      <li className="relative py-2 pl-6">
        <span className="absolute -left-[13px] top-2.5 grid h-6 w-6 place-items-center rounded-full ring-4 ring-surface" style={tone ? undefined : { background: kindMeta(r).soft }}>
          <span className={cx('grid h-6 w-6 place-items-center rounded-full', tone)}>{icon}</span>
        </span>
        <Row i={i} />
      </li>
    )
  }
  return (
    <li className="relative py-2 pl-6">
      <span className={cx('absolute -left-[13px] top-2.5 grid h-6 w-6 place-items-center rounded-full ring-4 ring-surface', tone)}>{icon}</span>
      <Row i={i} />
    </li>
  )
}

function Row({ i }: { i: TLItem }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{i.label}</p>
        <p className="text-xs text-muted">{i.detail}</p>
      </div>
      <span className="tabular shrink-0 text-xs font-medium text-muted">
        {formatTime12(i.at)}
        {i.end && i.type !== 'break' ? ` – ${formatTime12(i.end)}` : ''}
      </span>
    </div>
  )
}

function Legend({ color, label, border }: { color: string; label: string; border?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color, border: border ? `1.5px solid ${border}` : undefined }} />
      {label}
    </span>
  )
}
