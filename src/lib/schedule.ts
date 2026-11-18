import type { Availability, DayOfWeek, WorkingSchedule } from './types'
import { addDays, atMinutes, dateKey, minutesOfDay, parseHM, startOfDay } from './time'

// Working-hours logic. Pure functions of (now, schedule) so they are easy to
// test and naturally follow the system's current time zone.

function inPausePeriod(t: number, s: WorkingSchedule) {
  const key = dateKey(t)
  return s.pausePeriods.find((p) => key >= p.start && key <= p.end)
}

function isWorkday(t: number, s: WorkingSchedule) {
  return s.days.includes(new Date(t).getDay() as DayOfWeek) && !inPausePeriod(t, s)
}

/** Next moment (strictly after `now`) at which working time begins. */
export function nextWorkStart(now: number, s: WorkingSchedule): number | null {
  if (s.days.length === 0) return null
  const startMin = parseHM(s.start)
  const endMin = parseHM(s.end)
  const today = startOfDay(now)
  const nowMin = minutesOfDay(new Date(now))

  // Later today: after lunch, or before start.
  if (isWorkday(now, s)) {
    if (nowMin < startMin) return atMinutes(today, startMin)
    if (s.lunch.enabled) {
      const ls = parseHM(s.lunch.start)
      const le = parseHM(s.lunch.end)
      if (nowMin >= ls && nowMin < le && le < endMin) return atMinutes(today, le)
    }
  }
  for (let i = 1; i <= 400; i++) {
    const day = addDays(today, i)
    if (isWorkday(day, s)) return atMinutes(day, startMin)
  }
  return null
}

export function getScheduleAvailability(now: number, s: WorkingSchedule): Availability {
  if (!s.enabled) return { active: true }
  const pause = inPausePeriod(now, s)
  if (pause) return { active: false, reason: 'pause-period', resumesAt: nextWorkStart(now, s) }
  if (!s.days.includes(new Date(now).getDay() as DayOfWeek)) {
    return { active: false, reason: 'non-working-day', resumesAt: nextWorkStart(now, s) }
  }
  const m = minutesOfDay(new Date(now))
  const start = parseHM(s.start)
  const end = parseHM(s.end)
  if (m < start) return { active: false, reason: 'before-hours', resumesAt: nextWorkStart(now, s) }
  if (m >= end) return { active: false, reason: 'after-hours', resumesAt: nextWorkStart(now, s) }
  if (s.lunch.enabled) {
    const ls = parseHM(s.lunch.start)
    const le = parseHM(s.lunch.end)
    if (m >= ls && m < le) return { active: false, reason: 'lunch', resumesAt: atMinutes(startOfDay(now), le) }
  }
  return { active: true }
}

/** Working minutes in a given day (used for default daily targets). */
export function workingMinutesOn(day: number, s: WorkingSchedule) {
  if (!isWorkday(day, s)) return 0
  let mins = parseHM(s.end) - parseHM(s.start)
  if (s.lunch.enabled) mins -= Math.max(0, parseHM(s.lunch.end) - parseHM(s.lunch.start))
  return Math.max(0, mins)
}

export function isTodayWorkday(now: number, s: WorkingSchedule) {
  return isWorkday(now, s)
}
