import type {
  ActiveBreak,
  Availability,
  BreakRecord,
  BreakStatus,
  BreakStep,
  ExerciseRecord,
  History,
  Prompt,
  ReminderConfig,
  RuntimeState,
  UserSettings,
  WorkSession,
} from './types'
import { defaultSettings, emptyHistory, emptyRuntime } from './defaults'
import { StorageManager, mergeDefaults } from './storage'
import { getScheduleAvailability } from './schedule'
import {
  SLEEP_GAP_MS,
  freshTimers,
  intervalMs,
  isSuppressed,
  promptTimeoutMs,
  selectDue,
  snoozeMs,
  syncTimers,
  timersToResetAfterBreak,
} from './scheduler'
import { buildEyeRoutine, buildMovementRoutine } from './exercises'
import { DAY, MIN, SEC, addDays, formatClock, formatDuration, startOfDay, uid } from './time'
import type { DesktopBridge, HostCommand, PowerEvent } from './platform'
import { NotificationManager } from './notifications'
import { sounds } from './sound'

export interface TimerView {
  reminder: ReminderConfig
  dueAt: number | null
  remainingMs: number
  intervalMs: number
  suppressed: boolean
}

export interface Snapshot {
  now: number
  settings: UserSettings
  history: History
  runtime: RuntimeState
  availability: Availability
  activeBreak: ActiveBreak | null
  lastFinished: { record: BreakRecord; at: number } | null
  timers: TimerView[]
  next: TimerView | null
  permission: ReturnType<NotificationManager['permission']>
  timeZone: string
}

type Listener = () => void

export interface EngineDeps {
  storage?: StorageManager
  clock?: () => number
  desktop?: DesktopBridge
  notifier?: NotificationManager
  sound?: boolean // allow disabling audio in tests
}

const MIN_SESSION_MS = 10 * SEC
const HISTORY_RETENTION_MS = 400 * DAY

export class Engine {
  settings: UserSettings
  history: History
  runtime: RuntimeState
  activeBreak: ActiveBreak | null = null
  lastFinished: Snapshot['lastFinished'] = null
  availability: Availability = { active: false }

  private storage: StorageManager
  private clock: () => number
  private desktop?: DesktopBridge
  private notifier: NotificationManager
  private soundEnabled: boolean
  private listeners = new Set<Listener>()
  private snap: Snapshot
  private timer: ReturnType<typeof setInterval> | null = null
  private cleanup: (() => void)[] = []
  private sleeping = false
  private away = false
  private lastPersist = 0
  private lastIdlePoll = 0
  private timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  constructor(deps: EngineDeps = {}) {
    this.storage = deps.storage ?? new StorageManager()
    this.clock = deps.clock ?? Date.now
    this.desktop = deps.desktop
    this.notifier = deps.notifier ?? new NotificationManager()
    this.soundEnabled = deps.sound ?? true
    const now = this.clock()
    this.settings = this.storage.load('settings', defaultSettings, mergeDefaults)
    this.history = this.storage.load('history', emptyHistory, mergeDefaults)
    this.runtime = this.storage.load('runtime', () => emptyRuntime(now), mergeDefaults)
    // A break in progress never survives a restart; drop stale prompts too.
    this.runtime.prompt = null
    this.runtime.dueAt = syncTimers(now, this.settings.reminders, this.runtime.dueAt, this.opts)
    // Never wait longer than one interval (e.g. settings imported or test
    // mode switched on while the app was closed).
    for (const r of this.settings.reminders) {
      const due = this.runtime.dueAt[r.id]
      if (due !== undefined) this.runtime.dueAt[r.id] = Math.min(due, now + intervalMs(r, this.opts))
    }
    this.snap = this.buildSnapshot(now)
  }

  get opts() {
    return { testMode: this.settings.testMode }
  }

  // ───────────── lifecycle ─────────────

  start() {
    if (this.timer) return // never create duplicate loops
    this.tick()
    this.timer = setInterval(() => this.tick(), 1000)
    const onVis = () => this.tick()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    this.cleanup.push(() => document.removeEventListener('visibilitychange', onVis))
    this.cleanup.push(() => window.removeEventListener('focus', onVis))
    if (this.desktop) {
      this.cleanup.push(this.desktop.onPower((e) => this.handlePower(e)))
      this.cleanup.push(this.desktop.onCommand((c) => this.handleCommand(c)))
      this.desktop.setLoginItem(this.settings.launchAtStartup, this.settings.startMinimized)
      this.desktop.setShowTrayIcon(this.settings.showMenuBarIcon)
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.cleanup.forEach((f) => f())
    this.cleanup = []
    this.persist(true)
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l)
    return () => void this.listeners.delete(l)
  }

  getSnapshot = () => this.snap

  /** Optional hook for the router (set by the UI). */
  onNavigate?: (route: string) => void

  // ───────────── the tick ─────────────

  tick(now = this.clock()) {
    const gap = now - this.runtime.lastTick
    if (gap > SLEEP_GAP_MS) this.handleGap(this.runtime.lastTick, now)
    this.runtime.lastTick = now

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz !== this.timeZone) this.timeZone = tz // schedule re-evaluates below with new local time

    if (this.runtime.overrideUntil && now >= this.runtime.overrideUntil) this.runtime.overrideUntil = null
    if (this.runtime.pause?.until && now >= this.runtime.pause.until) this.resume(now)

    if (this.desktop && now - this.lastIdlePoll > 5 * SEC) {
      this.lastIdlePoll = now
      void this.desktop.getIdleSeconds().then((s) => this.setAway(s >= this.settings.idleThresholdMin * 60, s))
    }

    const avail = this.computeAvailability(now)
    const was = this.runtime.wasActive
    if (was && !avail.active) this.becomeInactive(now)
    if (!was && avail.active) this.becomeActive(now)
    this.runtime.wasActive = avail.active
    this.availability = avail

    // Focus session end
    const f = this.runtime.focus
    if (f && now >= f.endsAt) this.endFocus(true, now)

    // Active break progression
    if (this.activeBreak) this.advanceBreak(now)

    // Prompt timeout → missed
    const p = this.runtime.prompt
    if (p && now - p.createdAt > promptTimeoutMs(this.opts)) this.resolvePrompt(p, 'missed', now)

    if (avail.active && !this.activeBreak && !this.runtime.prompt) {
      const due = selectDue({
        now,
        reminders: this.settings.reminders,
        dueAt: this.runtime.dueAt,
        focusActive: !!this.runtime.focus,
        workingDays: this.settings.schedule.days,
        options: this.opts,
      })
      if (due) this.raisePrompt(due, now)
    }

    this.trackSession(now, avail.active && !this.activeBreak)
    this.persist(false, now)
    this.emit(now)
  }

  private computeAvailability(now: number): Availability {
    if (this.sleeping) return { active: false, reason: 'sleep' }
    const p = this.runtime.pause
    if (p) return { active: false, reason: 'paused', resumesAt: p.until }
    if (this.away) return { active: false, reason: 'away' }
    if (this.runtime.overrideUntil && now < this.runtime.overrideUntil) return { active: true }
    return getScheduleAvailability(now, this.settings.schedule)
  }

  private becomeInactive(now: number) {
    if (!this.runtime.pause) {
      this.runtime.frozen = this.remainingMap(now)
    }
    if (this.runtime.prompt) this.dropPrompt(this.runtime.prompt)
  }

  private becomeActive(now: number) {
    // Coming back from outside hours, lunch, sleep or being away: that was a
    // natural break, so start every timer fresh. (Manual pause restores its
    // remaining time in resume() before we get here.)
    if (this.runtime.frozen) {
      this.runtime.dueAt = freshTimers(now, this.settings.reminders, this.opts)
      this.runtime.frozen = null
    }
    this.runtime.dueAt = syncTimers(now, this.settings.reminders, this.runtime.dueAt, this.opts)
  }

  private handleGap(prevTick: number, now: number) {
    // Machine slept (or app was closed). Close the open session where it
    // actually stopped and restart timers instead of firing a burst of
    // overdue reminders.
    if (this.runtime.currentSession) {
      this.runtime.currentSession.end = Math.min(this.runtime.currentSession.end, prevTick)
      this.closeSession()
    }
    if (this.runtime.prompt) this.resolvePrompt(this.runtime.prompt, 'missed', prevTick, false)
    if (this.activeBreak) this.finishBreak('skip', prevTick)
    if (!this.runtime.pause) {
      this.runtime.frozen = null
      this.runtime.dueAt = freshTimers(now, this.settings.reminders, this.opts)
    }
  }

  handlePower(e: PowerEvent) {
    const now = this.clock()
    if (e === 'suspend' || e === 'lock-screen') {
      this.sleeping = true
      this.tick(now)
    } else {
      this.sleeping = false
      this.tick(now)
    }
  }

  setAway(away: boolean, idleSec = 0) {
    if (away === this.away) return
    const now = this.clock()
    if (away && this.runtime.currentSession) {
      // Session ended when the user stopped interacting, not when we noticed.
      this.runtime.currentSession.end = Math.max(this.runtime.currentSession.start, now - idleSec * 1000)
      this.closeSession()
    }
    this.away = away
    this.tick(now)
  }

  private handleCommand(c: HostCommand) {
    switch (c.type) {
      case 'break':
        this.takeBreak(c.reminderIds)
        break
      case 'pause':
        this.pause(null)
        break
      case 'resume':
        this.resume()
        break
      case 'navigate':
        this.onNavigate?.(c.route)
        break
      case 'notification-action': {
        const p = this.runtime.prompt
        if (!p || p.id !== c.promptId) {
          if (c.action === 'click') this.desktop?.showWindow(true)
          return
        }
        if (c.action === 'start' || c.action === 'click') this.startPromptBreak()
        else if (c.action === 'snooze') this.snoozePrompt()
        else this.dismissPrompt()
      }
    }
  }

  // ───────────── timers ─────────────

  private remainingMap(now: number) {
    const out: Record<string, number> = {}
    for (const [id, t] of Object.entries(this.runtime.dueAt)) {
      const r = this.reminder(id)
      // Timers held for an open prompt/break restart from a full interval.
      out[id] = t === Number.MAX_SAFE_INTEGER && r ? intervalMs(r, this.opts) : Math.max(0, t - now)
    }
    return out
  }

  private reschedule(ids: string[], now: number, ms?: number) {
    for (const id of ids) {
      const r = this.reminder(id)
      if (!r || !r.enabled) continue
      this.runtime.dueAt[id] = now + (ms ?? intervalMs(r, this.opts))
    }
  }

  reminder(id: string) {
    return this.settings.reminders.find((r) => r.id === id)
  }

  resetTimers() {
    const now = this.clock()
    if (this.runtime.prompt) this.dropPrompt(this.runtime.prompt)
    this.runtime.dueAt = freshTimers(now, this.settings.reminders, this.opts)
    if (this.runtime.frozen) this.runtime.frozen = this.remainingMap(now)
    if (this.runtime.pause) this.runtime.pause.remaining = this.remainingMap(now)
    this.commit(now)
  }

  pause(durationMs: number | null) {
    const now = this.clock()
    if (this.runtime.pause) {
      this.runtime.pause.until = durationMs === null ? null : now + durationMs
      return this.commit(now)
    }
    if (this.runtime.prompt) this.dropPrompt(this.runtime.prompt)
    const remaining = this.runtime.frozen ?? this.remainingMap(now)
    this.runtime.pause = { startedAt: now, until: durationMs === null ? null : now + durationMs, remaining }
    this.commit(now)
  }

  resume(now = this.clock()) {
    const p = this.runtime.pause
    if (!p) return
    this.runtime.pause = null
    const restored: Record<string, number> = {}
    for (const r of this.settings.reminders) {
      if (!r.enabled) continue
      const rem = p.remaining[r.id]
      restored[r.id] = now + Math.max(5 * SEC, rem ?? intervalMs(r, this.opts))
    }
    this.runtime.dueAt = restored
    const sched = this.computeAvailability(now)
    // If we resume outside working hours, keep the remaining time frozen; the
    // schedule will start fresh timers when work begins.
    this.runtime.frozen = sched.active ? null : this.remainingMap(now)
    if (!sched.active) this.runtime.wasActive = false
    if (sched.active) this.runtime.wasActive = true
    this.commit(now)
  }

  workOutsideHoursToday() {
    const now = this.clock()
    this.runtime.overrideUntil = addDays(startOfDay(now), 1)
    this.commit(now)
  }

  clearOverride() {
    this.runtime.overrideUntil = null
    this.commit()
  }

  // ───────────── prompts ─────────────

  private raisePrompt(reminderIds: string[], now: number) {
    const prompt: Prompt = { id: uid(), reminderIds, createdAt: now }
    this.runtime.prompt = prompt
    // Hold timers so nothing can re-trigger while this prompt is open.
    for (const id of reminderIds) this.runtime.dueAt[id] = Number.MAX_SAFE_INTEGER
    const rs = reminderIds.map((id) => this.reminder(id)!).filter(Boolean)
    const title = rs.length === 1 ? rs[0].title : combinedTitle(rs)
    const body = rs.length === 1 ? rs[0].message : rs.map((r) => r.message).join(' ')

    if (this.soundEnabled && this.settings.sound && this.settings.notifications.sound) sounds.reminder()

    if (this.settings.notifications.style === 'overlay') {
      this.startPromptBreak(now)
      this.desktop?.showWindow(true)
      return
    }
    let delivered = false
    if (this.settings.notifications.desktop) {
      delivered = this.notifier.notify({
        id: prompt.id,
        title,
        body,
        withActions: true,
        silent: true, // we play our own chime (or none)
        onClick: () => this.startPromptBreak(),
      })
    }
    // Fallback when notifications are off or blocked: surface the window so
    // the in-app prompt is seen.
    if (!delivered) this.desktop?.showWindow(false)
  }

  private dropPrompt(p: Prompt) {
    this.notifier.close(p.id)
    this.runtime.prompt = null
    // Restore timers that were held for this prompt.
    for (const id of p.reminderIds) if (this.runtime.dueAt[id] === Number.MAX_SAFE_INTEGER) this.reschedule([id], this.clock())
  }

  private resolvePrompt(p: Prompt, status: 'missed' | 'skipped' | 'snoozed', at: number, reschedule = true) {
    this.notifier.close(p.id)
    this.runtime.prompt = null
    this.record({ reminderIds: p.reminderIds, trigger: 'scheduled', promptedAt: p.createdAt, endedAt: at, status, exercises: [] })
    if (!reschedule) return
    if (status === 'snoozed') this.reschedule(p.reminderIds, at, snoozeMs(this.settings.notifications.snoozeMin, this.opts))
    else this.reschedule(p.reminderIds, at)
  }

  startPromptBreak(now = this.clock()) {
    const p = this.runtime.prompt
    if (!p) return
    this.notifier.close(p.id)
    this.runtime.prompt = null
    this.beginBreak(p.reminderIds, 'scheduled', p.createdAt, now)
  }

  snoozePrompt() {
    const p = this.runtime.prompt
    if (!p) return
    const now = this.clock()
    this.resolvePrompt(p, 'snoozed', now)
    this.commit(now)
  }

  dismissPrompt() {
    const p = this.runtime.prompt
    if (!p) return
    const now = this.clock()
    this.resolvePrompt(p, 'skipped', now)
    this.commit(now)
  }

  // ───────────── breaks ─────────────

  /** "Take a break now" — manual break, merged with any open prompt. */
  takeBreak(reminderIds: string[]) {
    const now = this.clock()
    if (this.activeBreak) return this.desktop?.showWindow(true)
    const p = this.runtime.prompt
    let ids = reminderIds
    let trigger: 'manual' | 'scheduled' = 'manual'
    let promptedAt = now
    if (p) {
      this.notifier.close(p.id)
      this.runtime.prompt = null
      ids = [...new Set([...p.reminderIds, ...reminderIds])]
      trigger = 'scheduled'
      promptedAt = p.createdAt
    }
    this.desktop?.showWindow(true)
    this.beginBreak(ids, trigger, promptedAt, now)
  }

  buildSteps(reminderIds: string[]): BreakStep[] {
    const steps: BreakStep[] = []
    const movementCount = this.history.breaks.filter((b) => b.reminderIds.includes('movement')).length
    const ordered = [...reminderIds].sort((a, b) => order(a) - order(b))
    for (const id of ordered) {
      const r = this.reminder(id)
      if (!r) continue
      if (r.kind === 'eye') {
        for (const e of buildEyeRoutine(this.settings.eyeExercises, r.durationSec)) {
          steps.push({ key: uid(), reminderId: id, exerciseId: e.id, title: e.name, steps: e.steps, durationSec: e.durationSec, animation: e.animation })
        }
      } else if (r.kind === 'movement') {
        for (const e of buildMovementRoutine(this.settings.movementExercises, r.durationSec, movementCount)) {
          steps.push({ key: uid(), reminderId: id, exerciseId: e.id, title: e.name, steps: e.steps, gentle: e.gentle, durationSec: e.durationSec, animation: e.animation })
        }
      } else if (r.kind === 'hydration') {
        steps.push({ key: uid(), reminderId: id, title: 'Drink some water', steps: ['Grab your glass or bottle.', 'Take a few slow sips.', 'Refill it for later if it is empty.'], durationSec: r.durationSec, animation: 'water' })
      } else if (r.kind === 'posture') {
        steps.push({ key: uid(), reminderId: id, title: 'Check your posture', steps: ['Sit back fully in your chair.', 'Feet flat on the floor, knees at hip height.', 'Relax your shoulders; screen at eye level.'], durationSec: r.durationSec, animation: 'posture' })
      } else {
        steps.push({ key: uid(), reminderId: id, title: r.name, steps: [r.message], durationSec: r.durationSec, animation: 'custom' })
      }
    }
    return steps
    function order(id: string) {
      const i = ['eye', 'movement', 'posture', 'hydration'].indexOf(id)
      return i === -1 ? 9 : i
    }
  }

  private beginBreak(reminderIds: string[], trigger: 'manual' | 'scheduled', promptedAt: number, now: number) {
    const steps = this.buildSteps(reminderIds)
    if (steps.length === 0) return
    // Hold these timers for the duration of the break.
    for (const id of reminderIds) if (this.runtime.dueAt[id] !== undefined) this.runtime.dueAt[id] = Number.MAX_SAFE_INTEGER
    this.activeBreak = {
      id: uid(),
      reminderIds,
      trigger,
      promptedAt,
      startedAt: now,
      steps,
      stepIndex: 0,
      stepStartedAt: now,
      stepElapsedMs: 0,
      paused: false,
      results: [],
      finished: false,
    }
    this.lastFinished = null
    this.trackSession(now, false)
    this.commit(now)
  }

  stepElapsed(b: ActiveBreak, now = this.clock()) {
    return b.stepElapsedMs + (b.paused || b.finished ? 0 : now - b.stepStartedAt)
  }

  private advanceBreak(now: number) {
    const b = this.activeBreak!
    if (b.paused || b.finished) return
    const step = b.steps[b.stepIndex]
    if (this.stepElapsed(b, now) >= step.durationSec * 1000) this.moveToNextStep(true, now)
  }

  private moveToNextStep(completed: boolean, now: number) {
    const b = this.activeBreak!
    const step = b.steps[b.stepIndex]
    b.results.push(stepResult(step, completed))
    if (b.stepIndex + 1 >= b.steps.length) {
      b.finished = true
      b.stepElapsedMs = step.durationSec * 1000
      if (this.soundEnabled && this.settings.sound) sounds.complete()
      // Record right away — if every step was skipped it counts as skipped.
      this.finishBreak(b.results.some((r) => r.completed) ? 'complete' : 'skip', now)
      return
    }
    b.stepIndex++
    b.stepStartedAt = now
    b.stepElapsedMs = 0
    if (this.soundEnabled && this.settings.sound) sounds.step()
  }

  pauseBreak() {
    const b = this.activeBreak
    if (!b || b.paused || b.finished) return
    const now = this.clock()
    b.stepElapsedMs = this.stepElapsed(b, now)
    b.paused = true
    this.commit(now)
  }

  resumeBreak() {
    const b = this.activeBreak
    if (!b || !b.paused) return
    const now = this.clock()
    b.paused = false
    b.stepStartedAt = now
    this.commit(now)
  }

  skipStep() {
    const b = this.activeBreak
    if (!b || b.finished) return
    const now = this.clock()
    this.moveToNextStep(false, now)
    this.commit(now)
  }

  /** 'complete' = user finished (or pressed Complete); 'skip' = abandoned. */
  finishBreak(how: 'complete' | 'skip', now = this.clock()) {
    const b = this.activeBreak
    if (!b) return
    const results = [...b.results]
    if (how === 'complete' && !b.finished && results.length < b.steps.length) {
      // Pressing Complete mid-exercise counts it if you were at least halfway.
      const cur = b.steps[results.length]
      results.push(stepResult(cur, this.stepElapsed(b, now) >= cur.durationSec * 500))
    }
    for (let i = results.length; i < b.steps.length; i++) results.push(stepResult(b.steps[i], false))
    const anyDone = results.some((r) => r.completed)
    let status: BreakStatus
    if (how === 'complete') status = 'completed'
    else status = anyDone ? 'partial' : 'skipped'
    const rec = this.record({ reminderIds: b.reminderIds, trigger: b.trigger, promptedAt: b.promptedAt, startedAt: b.startedAt, endedAt: now, status, exercises: results })
    this.activeBreak = null
    this.lastFinished = how === 'complete' ? { record: rec, at: now } : null
    const ids = timersToResetAfterBreak(b.reminderIds, status !== 'skipped')
    this.reschedule(ids, now)
    this.commit(now)
  }

  dismissFinished() {
    this.lastFinished = null
    this.commit()
  }

  private record(r: Omit<BreakRecord, 'id'>) {
    const rec: BreakRecord = { id: uid(), ...r }
    this.history.breaks.push(rec)
    this.persist(true)
    return rec
  }

  // ───────────── focus ─────────────

  startFocus(minutes: number) {
    const now = this.clock()
    if (this.runtime.focus) this.endFocus(false, now)
    const unit = this.settings.testMode ? SEC : MIN
    this.runtime.focus = { id: uid(), start: now, plannedMin: minutes, endsAt: now + minutes * unit }
    this.commit(now)
  }

  endFocus(completed: boolean, now = this.clock()) {
    const f = this.runtime.focus
    if (!f) return
    this.runtime.focus = null
    this.history.focus.push({ ...f, end: Math.min(now, f.endsAt), completed })
    if (completed) {
      if (this.soundEnabled && this.settings.sound) sounds.complete()
      if (this.settings.notifications.desktop) {
        this.notifier.notify({ id: 'focus-' + f.id, title: 'Focus session complete 🎯', body: `Nice work — ${f.plannedMin} ${this.settings.testMode ? 'seconds (test)' : 'minutes'} of focus.`, withActions: false, silent: true })
      }
    }
    this.persist(true)
    this.commit(now)
  }

  // ───────────── sessions ─────────────

  private trackSession(now: number, active: boolean) {
    const cur = this.runtime.currentSession
    if (active) {
      if (cur) cur.end = now
      else this.runtime.currentSession = { id: uid(), start: now, end: now }
    } else if (cur) {
      this.closeSession()
    }
  }

  private closeSession() {
    const cur = this.runtime.currentSession
    if (!cur) return
    this.runtime.currentSession = null
    if (cur.end - cur.start >= MIN_SESSION_MS) {
      this.history.sessions.push(cur)
      this.persist(true)
    }
  }

  currentSessionMs(now = this.clock()) {
    const c = this.runtime.currentSession
    return c ? now - c.start : 0
  }

  // ───────────── settings & data ─────────────

  updateSettings(fn: (s: UserSettings) => UserSettings | void) {
    const now = this.clock()
    const prev = this.settings
    const draft = structuredClone(prev)
    this.settings = fn(draft) ?? draft
    const testChanged = prev.testMode !== this.settings.testMode
    if (testChanged) {
      this.runtime.dueAt = freshTimers(now, this.settings.reminders, this.opts)
    } else {
      // Restart timers for reminders whose interval changed or were just enabled.
      const dueAt = { ...this.runtime.dueAt }
      for (const r of this.settings.reminders) {
        const old = prev.reminders.find((x) => x.id === r.id)
        if (!r.enabled) delete dueAt[r.id]
        else if (!old || !old.enabled || old.intervalMin !== r.intervalMin) {
          if (dueAt[r.id] !== Number.MAX_SAFE_INTEGER) dueAt[r.id] = now + intervalMs(r, this.opts)
        }
      }
      this.runtime.dueAt = syncTimers(now, this.settings.reminders, dueAt, this.opts)
    }
    if (this.runtime.frozen) this.runtime.frozen = this.remainingMap(now)
    if (this.runtime.pause) {
      const rem = this.remainingMap(now)
      this.runtime.pause.remaining = { ...rem, ...pick(this.runtime.pause.remaining, Object.keys(rem), this.settings.reminders, prev.reminders) }
    }
    const p = this.runtime.prompt
    if (p && p.reminderIds.some((id) => !this.reminder(id)?.enabled)) this.dropPrompt(p)
    if (this.desktop) {
      if (prev.launchAtStartup !== this.settings.launchAtStartup || prev.startMinimized !== this.settings.startMinimized) {
        this.desktop.setLoginItem(this.settings.launchAtStartup, this.settings.startMinimized)
      }
      if (prev.showMenuBarIcon !== this.settings.showMenuBarIcon) this.desktop.setShowTrayIcon(this.settings.showMenuBarIcon)
    }
    this.storage.save('settings', this.settings)
    this.commit(now)
  }

  resetSettings() {
    const keep = this.settings.onboarded
    this.settings = { ...defaultSettings(), onboarded: keep }
    this.runtime.dueAt = freshTimers(this.clock(), this.settings.reminders, this.opts)
    this.runtime.pause = null
    this.runtime.frozen = null
    this.storage.save('settings', this.settings)
    this.commit()
  }

  clearHistory() {
    this.history = emptyHistory()
    if (this.runtime.currentSession) this.runtime.currentSession = { ...this.runtime.currentSession, start: this.clock() }
    this.persist(true)
    this.commit()
  }

  async requestNotificationPermission() {
    const res = await this.notifier.requestPermission()
    this.commit()
    return res
  }

  testNotification() {
    const id = 'test-' + uid()
    return this.notifier.notify({ id, title: 'Screen Break notifications are on ✅', body: 'This is how your break reminders will appear.', withActions: false, silent: true })
  }

  // ───────────── persistence & snapshot ─────────────

  private persist(force: boolean, now = this.clock()) {
    if (!force && now - this.lastPersist < 5 * SEC) return
    this.lastPersist = now
    const cutoff = now - HISTORY_RETENTION_MS
    if (this.history.breaks.length && this.history.breaks[0].endedAt < cutoff) {
      this.history.breaks = this.history.breaks.filter((b) => b.endedAt >= cutoff)
      this.history.sessions = this.history.sessions.filter((s) => s.end >= cutoff)
      this.history.focus = this.history.focus.filter((f) => f.start >= cutoff)
    }
    this.storage.save('runtime', this.runtime)
    this.storage.save('history', this.history)
  }

  private commit(now = this.clock()) {
    this.persist(true, now)
    this.emit(now)
  }

  private emit(now: number) {
    this.snap = this.buildSnapshot(now)
    this.updateTray()
    this.listeners.forEach((l) => l())
  }

  private buildSnapshot(now: number): Snapshot {
    const frozen = this.runtime.pause?.remaining ?? this.runtime.frozen
    const timers: TimerView[] = this.settings.reminders
      .filter((r) => r.enabled)
      .map((r) => {
        const iv = intervalMs(r, this.opts)
        const due = this.runtime.dueAt[r.id]
        const held = due === Number.MAX_SAFE_INTEGER
        let remainingMs: number
        if (held) remainingMs = 0
        else if (frozen) remainingMs = frozen[r.id] ?? iv
        else remainingMs = due === undefined ? iv : Math.max(0, due - now)
        return {
          reminder: r,
          dueAt: held || frozen ? null : (due ?? null),
          remainingMs,
          intervalMs: iv,
          suppressed: isSuppressed(r, { now, focusActive: !!this.runtime.focus, workingDays: this.settings.schedule.days }),
        }
      })
    const candidates = timers.filter((t) => !t.suppressed)
    const next = candidates.length ? candidates.reduce((a, b) => (b.remainingMs < a.remainingMs ? b : a)) : null
    return {
      now,
      settings: this.settings,
      history: this.history,
      runtime: { ...this.runtime },
      availability: this.availability,
      activeBreak: this.activeBreak ? { ...this.activeBreak } : null,
      lastFinished: this.lastFinished,
      timers,
      next,
      permission: this.notifier.permission(),
      timeZone: this.timeZone,
    }
  }

  private updateTray() {
    if (!this.desktop) return
    const s = this.snap
    const a = s.availability
    const next = s.next
    const statusLabel = statusText(s)
    const nextIn = next && a.active && !s.activeBreak ? formatClock(next.remainingMs) : '—'
    this.desktop.updateTray({
      title: s.activeBreak ? 'Break' : a.active && next ? formatClock(next.remainingMs) : a.reason === 'paused' ? 'Paused' : '',
      nextLabel: next ? next.reminder.name : 'No reminders enabled',
      nextIn,
      statusLabel,
      sessionLabel: formatDuration(this.currentSessionMs(s.now)),
      paused: !!s.runtime.pause,
      active: a.active,
      focusLabel: s.runtime.focus ? formatClock(s.runtime.focus.endsAt - s.now) : null,
      dark: document.documentElement.classList.contains('dark'),
    })
  }
}

export function statusText(s: Snapshot) {
  if (s.activeBreak) return 'On a break'
  if (s.runtime.prompt) return 'Break due'
  const a = s.availability
  if (a.active) return s.runtime.focus ? 'Focusing' : 'Working'
  switch (a.reason) {
    case 'paused':
      return 'Paused'
    case 'lunch':
      return 'Lunch break'
    case 'away':
      return 'Away'
    case 'sleep':
      return 'Asleep'
    case 'pause-period':
      return 'Holiday'
    default:
      return 'Outside working hours'
  }
}

function stepResult(step: BreakStep, completed: boolean): ExerciseRecord {
  return { exerciseId: step.exerciseId ?? step.reminderId, reminderId: step.reminderId, completed, durationSec: step.durationSec }
}

function combinedTitle(rs: ReminderConfig[]) {
  const names = rs.map((r) => r.name.toLowerCase())
  return `Break time: ${names.slice(0, -1).join(', ')}${names.length > 1 ? ' & ' : ''}${names[names.length - 1]}`
}

function pick(remaining: Record<string, number>, ids: string[], now: ReminderConfig[], prev: ReminderConfig[]) {
  // Keep paused remaining time for reminders whose interval did not change.
  const out: Record<string, number> = {}
  for (const id of ids) {
    const a = now.find((r) => r.id === id)
    const b = prev.find((r) => r.id === id)
    if (a && b && b.enabled && a.intervalMin === b.intervalMin && remaining[id] !== undefined) out[id] = remaining[id]
  }
  return out
}

export type { WorkSession }
