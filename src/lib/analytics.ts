import type { BreakRecord, FocusSession, History, WorkSession } from './types'
import { addDays, dateKey, startOfDay } from './time'

// AnalyticsEngine — every figure is derived from recorded history. Nothing is
// estimated or invented; empty ranges produce zeros / null.

export interface Range {
  from: number // inclusive
  to: number // exclusive
}

export function dayRange(t: number): Range {
  const from = startOfDay(t)
  return { from, to: addDays(from, 1) }
}

export function lastNDays(now: number, n: number): Range {
  const to = addDays(startOfDay(now), 1)
  return { from: addDays(to, -n), to }
}

const DONE = new Set(['completed', 'partial'])

export function isDone(b: BreakRecord) {
  return DONE.has(b.status)
}

function inRange(t: number, r: Range) {
  return t >= r.from && t < r.to
}

function overlapMs(start: number, end: number, r: Range) {
  return Math.max(0, Math.min(end, r.to) - Math.max(start, r.from))
}

export function breaksIn(h: History, r: Range) {
  return h.breaks.filter((b) => inRange(b.endedAt, r))
}

export function countDone(breaks: BreakRecord[], reminderId: string) {
  return breaks.filter((b) => isDone(b) && b.reminderIds.includes(reminderId)).length
}

/** Score = (completed + ½·partial) / scheduled breaks resolved. Snoozes are pending, not counted. */
export function wellnessScore(breaks: BreakRecord[]) {
  const scheduled = breaks.filter((b) => b.trigger === 'scheduled' && b.status !== 'snoozed')
  if (scheduled.length === 0) return null
  const pts = scheduled.reduce((s, b) => s + (b.status === 'completed' ? 1 : b.status === 'partial' ? 0.5 : 0), 0)
  return {
    percent: Math.round((pts / scheduled.length) * 100),
    completed: scheduled.filter((b) => b.status === 'completed').length,
    partial: scheduled.filter((b) => b.status === 'partial').length,
    missed: scheduled.filter((b) => b.status === 'skipped' || b.status === 'missed').length,
    total: scheduled.length,
  }
}

export function allSessions(h: History, current: WorkSession | null) {
  return current ? [...h.sessions, current] : h.sessions
}

export function screenTimeMs(sessions: WorkSession[], r: Range) {
  return sessions.reduce((s, x) => s + overlapMs(x.start, x.end, r), 0)
}

export function sessionsIn(sessions: WorkSession[], r: Range) {
  return sessions.filter((x) => overlapMs(x.start, x.end, r) > 0)
}

export function focusEnd(f: FocusSession, now: number) {
  return f.end ?? Math.min(now, f.endsAt)
}

export function focusMs(focus: FocusSession[], r: Range, now: number) {
  return focus.reduce((s, f) => s + overlapMs(f.start, focusEnd(f, now), r), 0)
}

export function longestSessionMs(sessions: WorkSession[], r: Range) {
  return sessionsIn(sessions, r).reduce((m, x) => Math.max(m, x.end - x.start), 0)
}

export interface DayStats {
  key: string
  date: number
  eye: number
  movement: number
  completed: number
  partial: number
  missed: number
  screenMs: number
  focusMs: number
}

export function dailyStats(h: History, current: WorkSession | null, activeFocus: FocusSession | null, r: Range, now: number): DayStats[] {
  const sessions = allSessions(h, current)
  const focus = activeFocus ? [...h.focus, activeFocus] : h.focus
  const days: DayStats[] = []
  for (let d = startOfDay(r.from); d < r.to; d = addDays(d, 1)) {
    const dr = { from: d, to: addDays(d, 1) }
    const b = breaksIn(h, dr)
    days.push({
      key: dateKey(d),
      date: d,
      eye: countDone(b, 'eye'),
      movement: countDone(b, 'movement'),
      completed: b.filter((x) => x.status === 'completed').length,
      partial: b.filter((x) => x.status === 'partial').length,
      missed: b.filter((x) => x.status === 'skipped' || x.status === 'missed').length,
      screenMs: screenTimeMs(sessions, dr),
      focusMs: focusMs(focus, dr, now),
    })
  }
  return days
}

/** Focus minutes by hour of day (0–23). */
export function focusByHour(focus: FocusSession[], r: Range, now: number) {
  const hours = new Array(24).fill(0) as number[]
  for (const f of focus) {
    let t = Math.max(f.start, r.from)
    const end = Math.min(focusEnd(f, now), r.to)
    while (t < end) {
      const d = new Date(t)
      const next = new Date(d)
      next.setMinutes(0, 0, 0)
      next.setHours(d.getHours() + 1)
      const segEnd = Math.min(end, next.getTime())
      hours[d.getHours()] += (segEnd - t) / 60000
      t = segEnd
    }
  }
  return hours
}

export function summarize(h: History, current: WorkSession | null, activeFocus: FocusSession | null, r: Range, now: number) {
  const sessions = allSessions(h, current)
  const focus = activeFocus ? [...h.focus, activeFocus] : h.focus
  const b = breaksIn(h, r)
  const resolved = b.filter((x) => x.status !== 'snoozed')
  return {
    eye: countDone(b, 'eye'),
    movement: countDone(b, 'movement'),
    totalDone: b.filter(isDone).length,
    resolved: resolved.length,
    completionPct: resolved.length ? Math.round((resolved.filter(isDone).length / resolved.length) * 100) : null,
    focusMs: focusMs(focus, r, now),
    focusCount: focus.filter((f) => overlapMs(f.start, focusEnd(f, now), r) > 0).length,
    sessions: sessionsIn(sessions, r).length,
    screenMs: screenTimeMs(sessions, r),
    longestMs: longestSessionMs(sessions, r),
    score: wellnessScore(b),
  }
}

export function toCSV(h: History) {
  const rows = [['type', 'id', 'start', 'end', 'status', 'reminders', 'trigger', 'exercises_completed']]
  for (const b of h.breaks) {
    rows.push(['break', b.id, new Date(b.startedAt ?? b.promptedAt).toISOString(), new Date(b.endedAt).toISOString(), b.status, b.reminderIds.join('|'), b.trigger, String(b.exercises.filter((e) => e.completed).length)])
  }
  for (const s of h.sessions) rows.push(['work-session', s.id, new Date(s.start).toISOString(), new Date(s.end).toISOString(), '', '', '', ''])
  for (const f of h.focus) rows.push(['focus', f.id, new Date(f.start).toISOString(), f.end ? new Date(f.end).toISOString() : '', f.completed ? 'completed' : 'ended-early', '', '', ''])
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n')
}
