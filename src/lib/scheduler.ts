import type { DayOfWeek, ReminderConfig } from './types'
import { MIN, SEC } from './time'

// ReminderScheduler — pure timing rules. Everything is driven by absolute
// `dueAt` timestamps, never by counting setInterval callbacks, so timers stay
// correct when the window is hidden, throttled or the machine sleeps.

export const ESSENTIAL_IDS = new Set(['eye'])

export interface SchedulerOptions {
  testMode: boolean
}

export function intervalMs(r: Pick<ReminderConfig, 'intervalMin'>, o: SchedulerOptions) {
  // Test mode: treat minutes as seconds, clamped to a 10–30 s range.
  if (o.testMode) return Math.min(30, Math.max(10, r.intervalMin)) * SEC
  return Math.max(1, r.intervalMin) * MIN
}

export function snoozeMs(snoozeMin: number, o: SchedulerOptions) {
  return o.testMode ? 10 * SEC : Math.max(1, snoozeMin) * MIN
}

export function combineWindowMs(o: SchedulerOptions) {
  return o.testMode ? 5 * SEC : 2 * MIN
}

export function promptTimeoutMs(o: SchedulerOptions) {
  return o.testMode ? 20 * SEC : 2 * MIN
}

/** Gap between ticks that we treat as the machine having slept. */
export const SLEEP_GAP_MS = 2 * MIN

/** Add timers for newly enabled reminders and drop disabled ones. */
export function syncTimers(now: number, reminders: ReminderConfig[], dueAt: Record<string, number>, o: SchedulerOptions) {
  const next: Record<string, number> = {}
  for (const r of reminders) {
    if (!r.enabled) continue
    next[r.id] = dueAt[r.id] ?? now + intervalMs(r, o)
  }
  return next
}

export function freshTimers(now: number, reminders: ReminderConfig[], o: SchedulerOptions) {
  return syncTimers(now, reminders, {}, o)
}

export interface DueContext {
  now: number
  reminders: ReminderConfig[]
  dueAt: Record<string, number>
  focusActive: boolean
  workingDays: DayOfWeek[]
  options: SchedulerOptions
}

export function isSuppressed(r: ReminderConfig, ctx: Pick<DueContext, 'now' | 'focusActive' | 'workingDays'>) {
  if (ctx.focusActive && !ESSENTIAL_IDS.has(r.id)) return true
  if (r.kind === 'custom' && r.repeat === 'working-days') {
    return !ctx.workingDays.includes(new Date(ctx.now).getDay() as DayOfWeek)
  }
  return false
}

/**
 * Reminders that should be shown together right now, or null. When one
 * reminder is due, others due within the combine window join the same break
 * so the user never sees two reminders back to back.
 */
export function selectDue(ctx: DueContext): string[] | null {
  const eligible = ctx.reminders.filter((r) => r.enabled && ctx.dueAt[r.id] !== undefined && !isSuppressed(r, ctx))
  const due = eligible.filter((r) => ctx.dueAt[r.id] <= ctx.now)
  if (due.length === 0) return null
  const horizon = ctx.now + combineWindowMs(ctx.options)
  const ids = eligible.filter((r) => ctx.dueAt[r.id] <= horizon).map((r) => r.id)
  const order = ['eye', 'movement', 'posture', 'hydration']
  return ids.sort((a, b) => rank(a) - rank(b))
  function rank(id: string) {
    const i = order.indexOf(id)
    return i === -1 ? order.length : i
  }
}

/** Which timers to restart after a break that covered `reminderIds`. */
export function timersToResetAfterBreak(reminderIds: string[], completed: boolean) {
  const ids = new Set(reminderIds)
  // A movement break also rests the eyes.
  if (completed && ids.has('movement')) ids.add('eye')
  return [...ids]
}
