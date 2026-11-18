import { useState, type ReactNode } from 'react'
import { Bell, CalendarClock, Check, Database, Download, Eye, FlaskConical, Pencil, PersonStanding, Play, Plus, RotateCcw, Settings2, Trash2, Upload } from 'lucide-react'
import { getEngine, useSnapshot } from '../hooks/useEngine'
import type { Snapshot } from '../lib/engine'
import type { DayOfWeek, PausePeriod, ReminderConfig, UserSettings } from '../lib/types'
import { Badge, Button, Card, Confirm, IconButton, Modal, NumberField, Segmented, Select, TextField, TimeField, Toggle, cx } from '../components/ui'
import { KindIcon } from '../components/meta'
import { Illustration } from '../components/Illustration'
import { EYE_EXERCISES, MOVEMENT_EXERCISES } from '../lib/exercises'
import { DAY_NAMES, dateKey, formatDuration, uid } from '../lib/time'
import { isDesktop } from '../lib/platform'
import { toCSV } from '../lib/analytics'
import { mergeDefaults } from '../lib/storage'
import { defaultSettings } from '../lib/defaults'

const SECTIONS = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'eye', label: 'Eye rest', icon: Eye },
  { id: 'movement', label: 'Movement', icon: PersonStanding },
  { id: 'reminders', label: 'Additional reminders', icon: Bell },
  { id: 'schedule', label: 'Schedule', icon: CalendarClock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'data', label: 'Data', icon: Database },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

const update = (fn: (s: UserSettings) => void) => getEngine().updateSettings(fn)
const updReminder = (id: string, fn: (r: ReminderConfig) => void) =>
  update((s) => {
    const r = s.reminders.find((x) => x.id === id)
    if (r) fn(r)
  })

export function Settings({ section, navigate, onReplayOnboarding }: { section?: string; navigate: (r: string) => void; onReplayOnboarding: () => void }) {
  const s = useSnapshot()
  const active: SectionId = (SECTIONS.find((x) => x.id === section)?.id ?? 'general') as SectionId
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="anim-fade-up -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:sticky md:top-24 md:mx-0 md:flex-col md:self-start md:overflow-visible md:px-0" aria-label="Settings sections">
        <h1 className="mb-2 hidden px-3 text-2xl font-bold tracking-tight md:block">Settings</h1>
        {SECTIONS.map((x) => (
          <button
            key={x.id}
            onClick={() => navigate(`settings/${x.id}`)}
            aria-current={active === x.id ? 'page' : undefined}
            className={cx(
              'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition',
              active === x.id ? 'bg-surface text-text shadow-card' : 'text-muted hover:bg-surface hover:text-text',
            )}
          >
            <x.icon size={16} className={active === x.id ? 'text-primary-strong' : ''} />
            {x.label}
          </button>
        ))}
      </nav>
      <div key={active} className="anim-fade-up flex min-w-0 flex-col gap-5">
        {active === 'general' && <General s={s} />}
        {active === 'eye' && <EyeSettings s={s} />}
        {active === 'movement' && <MovementSettings s={s} />}
        {active === 'reminders' && <AdditionalReminders s={s} />}
        {active === 'schedule' && <Schedule s={s} />}
        {active === 'notifications' && <Notifications s={s} />}
        {active === 'data' && <Data s={s} onReplayOnboarding={onReplayOnboarding} />}
      </div>
    </div>
  )
}

function Group({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </Card>
  )
}

function Row({ label, description, children, disabled }: { label: ReactNode; description?: ReactNode; children: ReactNode; disabled?: boolean }) {
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3.5', disabled && 'opacity-50')}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

const desktopOnly = isDesktop ? undefined : 'Available in the desktop app.'

// ───────────────────────── general ─────────────────────────

function General({ s }: { s: Snapshot }) {
  const st = s.settings
  return (
    <>
      <Group title="Profile & appearance">
        <Row label="Your name" description="Used to greet you on the dashboard.">
          <TextField className="w-48" label="Your name" value={st.userName} placeholder="Optional" onChange={(v) => update((x) => void (x.userName = v.slice(0, 40)))} />
        </Row>
        <Row label="Theme">
          <Segmented
            value={st.theme}
            onChange={(v) => update((x) => void (x.theme = v))}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
          />
        </Row>
        <Row label="Sound effects" description="Soft chimes when breaks start, change step and finish.">
          <Toggle label="Sound effects" checked={st.sound} onChange={(v) => update((x) => void (x.sound = v))} />
        </Row>
      </Group>
      <Group title="Desktop app" description={isDesktop ? 'Screen Break keeps running in the menu bar / system tray when you close the window.' : 'These options apply when Screen Break runs as a desktop app.'}>
        <Row label="Launch at startup" description={desktopOnly} disabled={!isDesktop}>
          <Toggle label="Launch at startup" disabled={!isDesktop} checked={st.launchAtStartup} onChange={(v) => update((x) => void (x.launchAtStartup = v))} />
        </Row>
        <Row label="Start minimized" description={desktopOnly ?? 'Open quietly in the menu bar at login.'} disabled={!isDesktop}>
          <Toggle label="Start minimized" disabled={!isDesktop} checked={st.startMinimized} onChange={(v) => update((x) => void (x.startMinimized = v))} />
        </Row>
        <Row label="Show menu bar icon" description={desktopOnly ?? 'Shows the next-break countdown in the menu bar / tray.'} disabled={!isDesktop}>
          <Toggle label="Show menu bar icon" disabled={!isDesktop} checked={st.showMenuBarIcon} onChange={(v) => update((x) => void (x.showMenuBarIcon = v))} />
        </Row>
      </Group>
      <Group title="Developer">
        <Row
          label={
            <span className="inline-flex items-center gap-2">
              <FlaskConical size={15} /> Test mode
            </span>
          }
          description="Shrinks every reminder interval to 10–30 seconds (minutes become seconds), snooze to 10 s and focus sessions to seconds. Timers restart when you switch."
        >
          <Toggle label="Test mode" checked={st.testMode} onChange={(v) => update((x) => void (x.testMode = v))} />
        </Row>
      </Group>
    </>
  )
}

// ───────────────────────── reminder basics ─────────────────────────

function ReminderBasics({ r, durationLabel = 'Break duration', durationUnit = 'sec', target, onTarget }: { r: ReminderConfig; durationLabel?: string; durationUnit?: 'sec' | 'min'; target?: number; onTarget?: (v: number) => void }) {
  const s = useSnapshot()
  const test = s.settings.testMode
  return (
    <>
      <Row label={`Enable ${r.name.toLowerCase()} reminder`}>
        <Toggle label={`Enable ${r.name}`} checked={r.enabled} onChange={(v) => updReminder(r.id, (x) => void (x.enabled = v))} />
      </Row>
      <Row label="Reminder interval" description={test ? `Test mode: fires every ${Math.min(30, Math.max(10, r.intervalMin))} seconds.` : `Every ${formatDuration(r.intervalMin * 60000)} of active work.`} disabled={!r.enabled}>
        <NumberField label={`${r.name} interval`} value={r.intervalMin} min={1} max={240} suffix="min" onChange={(v) => updReminder(r.id, (x) => void (x.intervalMin = v))} />
      </Row>
      <Row label={durationLabel} disabled={!r.enabled}>
        {durationUnit === 'min' ? (
          <NumberField label={durationLabel} value={Math.round(r.durationSec / 60)} min={1} max={20} suffix="min" onChange={(v) => updReminder(r.id, (x) => void (x.durationSec = v * 60))} />
        ) : (
          <NumberField label={durationLabel} value={r.durationSec} min={5} max={600} step={5} suffix="sec" onChange={(v) => updReminder(r.id, (x) => void (x.durationSec = v))} />
        )}
      </Row>
      {target !== undefined && onTarget && (
        <Row label="Daily target" description="Shown on your dashboard summary.">
          <NumberField label="Daily target" value={target} min={1} max={60} onChange={onTarget} />
        </Row>
      )}
    </>
  )
}

function ExercisePicker({ list, selected, onChange, min = 1 }: { list: typeof EYE_EXERCISES; selected: string[]; onChange: (ids: string[]) => void; min?: number }) {
  return (
    <div className="grid grid-cols-1 gap-2 pt-3 sm:grid-cols-2">
      {list.map((ex) => {
        const on = selected.includes(ex.id)
        const isEye = ex.animation.startsWith('eye-')
        return (
          <button
            key={ex.id}
            aria-pressed={on}
            onClick={() => {
              if (on && selected.length <= min) return
              onChange(on ? selected.filter((x) => x !== ex.id) : list.filter((e) => e.id === ex.id || selected.includes(e.id)).map((e) => e.id))
            }}
            className={cx('group flex items-center gap-3 rounded-2xl border p-3 text-left transition', on ? 'border-primary/60 bg-mint/50' : 'border-border hover:border-primary/40 hover:bg-surface-2')}
          >
            <div className={cx('grid shrink-0 place-items-center rounded-xl bg-surface', isEye ? 'h-12 w-16' : 'h-14 w-12')}>
              <Illustration name={ex.animation} className={isEye ? 'h-9 w-14' : 'h-12 w-10'} paused={!on} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{ex.name}</p>
              <p className="text-xs text-muted">{ex.durationSec >= 60 ? formatDuration(ex.durationSec * 1000) : `${ex.durationSec}s`}</p>
            </div>
            <span className={cx('grid h-5 w-5 place-items-center rounded-md border transition', on ? 'border-primary bg-primary text-primary-ink' : 'border-border')}>{on && <Check size={13} strokeWidth={3} />}</span>
          </button>
        )
      })}
    </div>
  )
}

function EyeSettings({ s }: { s: Snapshot }) {
  const r = s.settings.reminders.find((x) => x.id === 'eye')!
  return (
    <>
      <Group
        title="Eye rest"
        description="Based on the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds."
        action={
          <Button size="sm" variant="soft" onClick={() => getEngine().takeBreak(['eye'])} disabled={!r.enabled}>
            <Play size={14} /> Try now
          </Button>
        }
      >
        <ReminderBasics r={r} durationLabel="Distance-gaze duration" target={s.settings.targets.eye} onTarget={(v) => update((x) => void (x.targets.eye = v))} />
      </Group>
      <Group title="Exercise routine" description="Choose which guided exercises appear in each eye break. They run in this order.">
        <ExercisePicker list={EYE_EXERCISES} selected={s.settings.eyeExercises} onChange={(ids) => update((x) => void (x.eyeExercises = ids))} />
        <p className="pt-3 text-xs text-muted">Routine length: {formatDuration(s.settings.eyeExercises.reduce((a, id) => a + (id === 'distance' ? r.durationSec : (EYE_EXERCISES.find((e) => e.id === id)?.durationSec ?? 0)), 0) * 1000)}</p>
      </Group>
    </>
  )
}

function MovementSettings({ s }: { s: Snapshot }) {
  const r = s.settings.reminders.find((x) => x.id === 'movement')!
  return (
    <>
      <Group
        title="Movement"
        description="Get up and move regularly. Each break picks exercises from your selection to fill the duration, rotating so routines vary."
        action={
          <Button size="sm" variant="soft" onClick={() => getEngine().takeBreak(['movement'])} disabled={!r.enabled}>
            <Play size={14} /> Try now
          </Button>
        }
      >
        <ReminderBasics r={r} durationLabel="Exercise duration" durationUnit="min" target={s.settings.targets.movement} onTarget={(v) => update((x) => void (x.targets.movement = v))} />
        <Row label="Prefer gentle alternatives" description="Show seated, lower-effort versions of each exercise by default.">
          <Toggle label="Prefer gentle alternatives" checked={s.settings.gentleMovement} onChange={(v) => update((x) => void (x.gentleMovement = v))} />
        </Row>
      </Group>
      <Group title="Exercise preferences" description="All exercises are optional — pick the ones that suit you.">
        <ExercisePicker list={MOVEMENT_EXERCISES} selected={s.settings.movementExercises} onChange={(ids) => update((x) => void (x.movementExercises = ids))} />
      </Group>
    </>
  )
}

// ───────────────────────── additional + custom ─────────────────────────

function AdditionalReminders({ s }: { s: Snapshot }) {
  const [editing, setEditing] = useState<ReminderConfig | null>(null)
  const [deleting, setDeleting] = useState<ReminderConfig | null>(null)
  const customs = s.settings.reminders.filter((r) => r.kind === 'custom')
  return (
    <>
      {(['hydration', 'posture'] as const).map((id) => {
        const r = s.settings.reminders.find((x) => x.id === id)!
        return (
          <Group key={id} title={r.name} description={r.message} action={<KindIcon reminder={r} boxed size={17} />}>
            <ReminderBasics r={r} />
          </Group>
        )
      })}
      <Group
        title="Custom reminders"
        description="Create your own reminders with their own interval, duration and message."
        action={
          <Button size="sm" variant="primary" onClick={() => setEditing({ id: 'custom-' + uid(), kind: 'custom', name: '', enabled: true, intervalMin: 90, durationSec: 60, title: '', message: '', repeat: 'working-days' })}>
            <Plus size={15} /> New
          </Button>
        }
      >
        {customs.length === 0 && <p className="py-6 text-center text-sm text-muted">No custom reminders yet.</p>}
        {customs.map((r) => (
          <div key={r.id} className="flex items-center gap-3 py-3">
            <KindIcon reminder={r} boxed size={16} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.name}</p>
              <p className="truncate text-xs text-muted">
                Every {formatDuration(r.intervalMin * 60000)} · {r.durationSec >= 60 ? formatDuration(r.durationSec * 1000) : `${r.durationSec}s`} · {r.repeat === 'every-day' ? 'Every day' : 'Working days'}
              </p>
            </div>
            <Toggle label={`Enable ${r.name}`} checked={r.enabled} onChange={(v) => updReminder(r.id, (x) => void (x.enabled = v))} />
            <IconButton label="Edit" onClick={() => setEditing(r)}>
              <Pencil size={15} />
            </IconButton>
            <IconButton label="Delete" onClick={() => setDeleting(r)}>
              <Trash2 size={15} />
            </IconButton>
          </div>
        ))}
      </Group>
      {editing && <CustomEditor initial={editing} onClose={() => setEditing(null)} />}
      <Confirm
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete reminder?"
        body={`"${deleting?.name}" will be removed. Breaks already recorded for it stay in your history.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => deleting && update((x) => void (x.reminders = x.reminders.filter((r) => r.id !== deleting.id)))}
      />
    </>
  )
}

function CustomEditor({ initial, onClose }: { initial: ReminderConfig; onClose: () => void }) {
  const [r, setR] = useState(initial)
  const isNew = !getEngine().reminder(initial.id)
  const valid = r.name.trim().length > 0
  const save = () => {
    const final = { ...r, name: r.name.trim(), title: r.name.trim(), message: r.message.trim() || r.name.trim() }
    update((x) => {
      const i = x.reminders.findIndex((y) => y.id === r.id)
      if (i === -1) x.reminders.push(final)
      else x.reminders[i] = final
    })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={isNew ? 'New custom reminder' : 'Edit reminder'}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Reminder name
          <TextField label="Reminder name" value={r.name} placeholder="Stretch your legs" onChange={(v) => setR({ ...r, name: v.slice(0, 50) })} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Notification message
          <TextField label="Notification message" value={r.message} placeholder="Time to stretch." onChange={(v) => setR({ ...r, message: v.slice(0, 120) })} />
        </label>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Interval</span>
          <NumberField label="Interval" value={r.intervalMin} min={1} max={480} step={5} suffix="min" onChange={(v) => setR({ ...r, intervalMin: v })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Duration</span>
          <NumberField label="Duration" value={r.durationSec} min={5} max={1200} step={5} suffix="sec" onChange={(v) => setR({ ...r, durationSec: v })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Repeat</span>
          <Segmented
            value={r.repeat ?? 'working-days'}
            onChange={(v) => setR({ ...r, repeat: v })}
            size="sm"
            options={[
              { value: 'working-days', label: 'Working days' },
              { value: 'every-day', label: 'Every day' },
            ]}
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!valid} onClick={save}>
          {isNew ? 'Create reminder' : 'Save changes'}
        </Button>
      </div>
    </Modal>
  )
}

// ───────────────────────── schedule ─────────────────────────

export function DayPicker({ days, onChange }: { days: DayOfWeek[]; onChange: (d: DayOfWeek[]) => void }) {
  const order: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0]
  return (
    <div className="flex flex-wrap gap-1.5">
      {order.map((d) => {
        const on = days.includes(d)
        return (
          <button
            key={d}
            aria-pressed={on}
            onClick={() => onChange(on ? days.filter((x) => x !== d) : [...days, d].sort())}
            className={cx('h-9 w-11 rounded-xl text-[13px] font-semibold transition', on ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-muted hover:text-text')}
          >
            {DAY_NAMES[d]}
          </button>
        )
      })}
    </div>
  )
}

function Schedule({ s }: { s: Snapshot }) {
  const sc = s.settings.schedule
  const [adding, setAdding] = useState<PausePeriod | null>(null)
  const weekend = sc.days.includes(0) && sc.days.includes(6)
  const badHours = sc.start >= sc.end
  return (
    <>
      <Group title="Working hours" description="Outside these hours reminders pause automatically and resume on your next working day.">
        <Row label="Respect working hours" description="When off, reminders run whenever the app is open.">
          <Toggle label="Respect working hours" checked={sc.enabled} onChange={(v) => update((x) => void (x.schedule.enabled = v))} />
        </Row>
        <Row label="Working days" disabled={!sc.enabled}>
          <DayPicker days={sc.days} onChange={(d) => update((x) => void (x.schedule.days = d))} />
        </Row>
        <Row label="Weekend reminders" description="Include Saturday and Sunday." disabled={!sc.enabled}>
          <Toggle
            label="Weekend reminders"
            checked={weekend}
            onChange={(v) => update((x) => void (x.schedule.days = (v ? [...new Set([...x.schedule.days, 0, 6])] : x.schedule.days.filter((d) => d !== 0 && d !== 6)).sort() as DayOfWeek[]))}
          />
        </Row>
        <Row label="Hours" description={badHours ? <span className="text-danger">End time must be after start time.</span> : undefined} disabled={!sc.enabled}>
          <TimeField label="Start time" value={sc.start} onChange={(v) => update((x) => void (x.schedule.start = v))} />
          <span className="text-muted">–</span>
          <TimeField label="End time" value={sc.end} onChange={(v) => update((x) => void (x.schedule.end = v))} />
        </Row>
        <Row label="Lunch break" description="Reminders pause during lunch." disabled={!sc.enabled}>
          <Toggle label="Lunch break" checked={sc.lunch.enabled} onChange={(v) => update((x) => void (x.schedule.lunch.enabled = v))} />
        </Row>
        {sc.lunch.enabled && (
          <Row label="Lunch time" disabled={!sc.enabled}>
            <TimeField label="Lunch start" value={sc.lunch.start} onChange={(v) => update((x) => void (x.schedule.lunch.start = v))} />
            <span className="text-muted">–</span>
            <TimeField label="Lunch end" value={sc.lunch.end} onChange={(v) => update((x) => void (x.schedule.lunch.end = v))} />
          </Row>
        )}
        {isDesktop && (
          <Row label="Away detection" description="If you're idle this long, timers restart when you come back (that counted as a break).">
            <NumberField label="Idle threshold" value={s.settings.idleThresholdMin} min={2} max={60} suffix="min" onChange={(v) => update((x) => void (x.idleThresholdMin = v))} />
          </Row>
        )}
      </Group>
      <Group
        title="Holidays & pause periods"
        description="Reminders stay off on these dates."
        action={
          <Button size="sm" variant="primary" onClick={() => setAdding({ id: uid(), label: '', start: dateKey(s.now), end: dateKey(s.now) })}>
            <Plus size={15} /> Add
          </Button>
        }
      >
        {sc.pausePeriods.length === 0 && <p className="py-6 text-center text-sm text-muted">No pause periods.</p>}
        {[...sc.pausePeriods]
          .sort((a, b) => a.start.localeCompare(b.start))
          .map((p) => {
            const past = p.end < dateKey(s.now)
            return (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <CalendarClock size={18} className="text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.label || 'Pause period'}</p>
                  <p className="text-xs text-muted">{p.start === p.end ? fmtDate(p.start) : `${fmtDate(p.start)} – ${fmtDate(p.end)}`}</p>
                </div>
                {past && <Badge tone="muted">Past</Badge>}
                {!past && p.start <= dateKey(s.now) && <Badge tone="warning">Active</Badge>}
                <IconButton label="Remove" onClick={() => update((x) => void (x.schedule.pausePeriods = x.schedule.pausePeriods.filter((y) => y.id !== p.id)))}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            )
          })}
      </Group>
      {adding && (
        <Modal open onClose={() => setAdding(null)} title="Add pause period">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Label
              <TextField label="Label" value={adding.label} placeholder="Holiday" onChange={(v) => setAdding({ ...adding, label: v.slice(0, 40) })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                From
                <input type="date" value={adding.start} onChange={(e) => e.target.value && setAdding({ ...adding, start: e.target.value, end: adding.end < e.target.value ? e.target.value : adding.end })} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                To
                <input type="date" value={adding.end} min={adding.start} onChange={(e) => e.target.value && setAdding({ ...adding, end: e.target.value })} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium" />
              </label>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdding(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={adding.end < adding.start}
              onClick={() => {
                update((x) => void x.schedule.pausePeriods.push({ ...adding, label: adding.label.trim() }))
                setAdding(null)
              }}
            >
              Add period
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}

function fmtDate(k: string) {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

// ───────────────────────── notifications ─────────────────────────

function Notifications({ s }: { s: Snapshot }) {
  const n = s.settings.notifications
  const e = getEngine()
  const [tested, setTested] = useState<null | boolean>(null)
  const perm = s.permission
  return (
    <Group title="Notifications">
      <Row
        label="Desktop notifications"
        description={
          perm === 'granted'
            ? 'System notifications with Start, Snooze and Dismiss actions.'
            : perm === 'denied'
              ? 'Notifications are blocked in your browser settings. Reminders still appear inside Screen Break and the tab title will flash.'
              : perm === 'unsupported'
                ? 'This browser does not support notifications. Reminders appear inside Screen Break.'
                : 'Allow notifications so reminders reach you while you work in other apps.'
        }
      >
        {perm === 'default' && (
          <Button size="sm" variant="soft" onClick={() => void e.requestNotificationPermission()}>
            Allow
          </Button>
        )}
        {perm === 'granted' && n.desktop && (
          <Button size="sm" variant="ghost" onClick={() => setTested(e.testNotification())}>
            {tested === null ? 'Send test' : tested ? 'Sent ✓' : 'Failed'}
          </Button>
        )}
        <Toggle label="Desktop notifications" checked={n.desktop} onChange={(v) => update((x) => void (x.notifications.desktop = v))} />
      </Row>
      <Row label="Reminder sound" description="Play a soft chime when a reminder appears.">
        <Toggle label="Reminder sound" checked={n.sound} onChange={(v) => update((x) => void (x.notifications.sound = v))} />
      </Row>
      <Row label="Snooze duration" description={s.settings.testMode ? 'Test mode uses 10 seconds.' : undefined}>
        <Select
          label="Snooze duration"
          value={n.snoozeMin}
          onChange={(v) => update((x) => void (x.notifications.snoozeMin = v))}
          options={[1, 2, 5, 10, 15, 30].map((m) => ({ value: m, label: `${m} minute${m > 1 ? 's' : ''}` }))}
        />
      </Row>
      <Row label="Notification style" description={n.style === 'prompt' ? 'A notification and a small prompt let you choose when to start.' : 'The break screen opens automatically when a reminder is due.'}>
        <Segmented
          value={n.style}
          onChange={(v) => update((x) => void (x.notifications.style = v))}
          options={[
            { value: 'prompt', label: 'Prompt' },
            { value: 'overlay', label: 'Open break' },
          ]}
        />
      </Row>
    </Group>
  )
}

// ───────────────────────── data ─────────────────────────

function Data({ s, onReplayOnboarding }: { s: Snapshot; onReplayOnboarding: () => void }) {
  const [confirm, setConfirm] = useState<'history' | 'settings' | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const e = getEngine()
  const dl = (name: string, type: string, body: string) => {
    const url = URL.createObjectURL(new Blob([body], { type }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const stamp = dateKey(s.now)
  const importSettings = (file: File) => {
    file
      .text()
      .then((t) => {
        const parsed = JSON.parse(t)
        const incoming = parsed.settings ?? parsed
        if (!incoming || !Array.isArray(incoming.reminders)) throw new Error('No settings found in this file.')
        e.updateSettings(() => mergeDefaults(incoming, defaultSettings()))
        setImportMsg('Settings imported.')
      })
      .catch((err) => setImportMsg(`Couldn't import: ${err.message}`))
  }
  return (
    <>
      <Group title="Export" description={`${s.history.breaks.length} breaks, ${s.history.sessions.length} sessions and ${s.history.focus.length} focus sessions recorded.`}>
        <Row label="Export history" description="Download everything as CSV (spreadsheets) or JSON (full backup incl. settings).">
          <Button size="sm" onClick={() => dl(`screen-break-${stamp}.csv`, 'text/csv', toCSV(s.history))}>
            <Download size={15} /> CSV
          </Button>
          <Button size="sm" onClick={() => dl(`screen-break-${stamp}.json`, 'application/json', JSON.stringify({ exportedAt: new Date().toISOString(), settings: s.settings, history: s.history }, null, 2))}>
            <Download size={15} /> JSON
          </Button>
        </Row>
        <Row label="Import settings" description={importMsg ?? 'Restore settings from a JSON backup. History is not changed.'}>
          <label className="no-drag inline-flex h-8 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-3 text-[13px] font-semibold transition hover:border-primary/50 hover:bg-surface-2">
            <Upload size={15} /> Import
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(ev) => ev.target.files?.[0] && importSettings(ev.target.files[0])} />
          </label>
        </Row>
      </Group>
      <Group title="Reset">
        <Row label="Replay onboarding" description="Walk through the setup screens again.">
          <Button size="sm" onClick={onReplayOnboarding}>
            <Play size={14} /> Replay
          </Button>
        </Row>
        <Row label="Clear history" description="Permanently delete all recorded breaks, sessions and focus time.">
          <Button size="sm" variant="danger" onClick={() => setConfirm('history')}>
            <Trash2 size={14} /> Clear
          </Button>
        </Row>
        <Row label="Reset settings" description="Restore every setting to its default. History is kept.">
          <Button size="sm" variant="danger" onClick={() => setConfirm('settings')}>
            <RotateCcw size={14} /> Reset
          </Button>
        </Row>
      </Group>
      <Confirm
        open={confirm === 'history'}
        onClose={() => setConfirm(null)}
        title="Clear all history?"
        body="This permanently deletes every recorded break, work session and focus session. Statistics will start from zero. This can't be undone — export first if you want a copy."
        confirmLabel="Clear history"
        danger
        onConfirm={() => e.clearHistory()}
      />
      <Confirm open={confirm === 'settings'} onClose={() => setConfirm(null)} title="Reset all settings?" body="Reminders, schedule, exercises and notification preferences go back to their defaults. Your history is kept." confirmLabel="Reset settings" danger onConfirm={() => e.resetSettings()} />
    </>
  )
}
