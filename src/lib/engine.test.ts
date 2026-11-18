import { describe, expect, it, beforeEach, vi } from 'vitest'
import { Engine } from './engine'
import { StorageManager, type KeyValueStore } from './storage'
import { NotificationManager } from './notifications'
import { MIN, SEC } from './time'
import { summarize, dayRange, wellnessScore } from './analytics'
import { getScheduleAvailability } from './schedule'
import { defaultSettings } from './defaults'

function memStore(): KeyValueStore {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }
}

// Tuesday 17 Nov 2026, 10:00 local — inside default working hours.
const T0 = new Date(2026, 10, 17, 10, 0, 0).getTime()

let t = T0
let kv: KeyValueStore
let notifier: NotificationManager
let notifySpy: ReturnType<typeof vi.spyOn>

function makeEngine(configure?: (e: Engine) => void) {
  const e = new Engine({ storage: new StorageManager(kv), clock: () => t, notifier, sound: false })
  e.updateSettings((s) => {
    s.onboarded = true
  })
  configure?.(e)
  e.tick()
  return e
}

function only(e: Engine, ids: string[]) {
  e.updateSettings((s) => {
    for (const r of s.reminders) r.enabled = ids.includes(r.id)
  })
}

/** Advance the clock second by second (like the real 1 s loop). */
function advance(e: Engine, ms: number, step = SEC) {
  const end = t + ms
  while (t < end) {
    t = Math.min(end, t + step)
    e.tick()
  }
}

beforeEach(() => {
  t = T0
  kv = memStore()
  notifier = new NotificationManager()
  notifySpy = vi.spyOn(notifier, 'notify').mockReturnValue(true)
})

describe('reminder timing', () => {
  it('1. eye reminder triggers after the configured interval', () => {
    const e = makeEngine((e) => only(e, ['eye']))
    advance(e, 20 * MIN - SEC)
    expect(e.runtime.prompt).toBeNull()
    advance(e, SEC)
    expect(e.runtime.prompt?.reminderIds).toEqual(['eye'])
  })

  it('2. movement reminder triggers at its interval', () => {
    const e = makeEngine((e) => only(e, ['movement']))
    advance(e, 59 * MIN, 10 * SEC)
    expect(e.runtime.prompt).toBeNull()
    advance(e, MIN, 10 * SEC)
    expect(e.runtime.prompt?.reminderIds).toEqual(['movement'])
  })

  it('custom intervals are honoured', () => {
    const e = makeEngine((e) => {
      only(e, ['eye'])
      e.updateSettings((s) => void (s.reminders.find((r) => r.id === 'eye')!.intervalMin = 5))
    })
    advance(e, 5 * MIN)
    expect(e.runtime.prompt?.reminderIds).toEqual(['eye'])
  })

  it('3. overlapping eye + movement reminders combine into one prompt', () => {
    const e = makeEngine((e) => {
      only(e, ['eye', 'movement'])
      e.updateSettings((s) => void (s.reminders.find((r) => r.id === 'eye')!.intervalMin = 60))
    })
    advance(e, 60 * MIN, 10 * SEC)
    expect(e.runtime.prompt?.reminderIds).toEqual(['eye', 'movement'])
    expect(notifySpy).toHaveBeenCalledTimes(1)
  })

  it('reminders due within the combine window join the current break', () => {
    const e = makeEngine((e) => only(e, ['eye', 'posture']))
    // posture due at 45 min; eye at 40 → separate. Make posture 41 min.
    e.updateSettings((s) => void (s.reminders.find((r) => r.id === 'posture')!.intervalMin = 21))
    advance(e, 20 * MIN)
    expect(e.runtime.prompt?.reminderIds).toEqual(['eye', 'posture'])
  })

  it('16. never shows a second prompt while one is open (no duplicates)', () => {
    const e = makeEngine((e) => only(e, ['eye', 'hydration']))
    advance(e, 20 * MIN)
    const first = e.runtime.prompt!.id
    advance(e, 90 * SEC)
    expect(e.runtime.prompt!.id).toBe(first)
    expect(notifySpy).toHaveBeenCalledTimes(1)
  })

  it('starting the engine loop twice does not create duplicate timers', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const e = makeEngine()
    ;(globalThis as any).document = { addEventListener() {}, removeEventListener() {}, documentElement: { classList: { contains: () => false } } }
    ;(globalThis as any).window = { addEventListener() {}, removeEventListener() {} }
    e.start()
    e.start()
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
    e.stop()
    setIntervalSpy.mockRestore()
  })

  it('unanswered prompts become "missed" and reschedule — no notification loop', () => {
    const e = makeEngine((e) => only(e, ['eye']))
    advance(e, 20 * MIN)
    advance(e, 2 * MIN + SEC)
    expect(e.runtime.prompt).toBeNull()
    expect(e.history.breaks.at(-1)?.status).toBe('missed')
    expect(notifySpy).toHaveBeenCalledTimes(1)
    advance(e, 20 * MIN - SEC)
    expect(e.runtime.prompt).toBeNull()
    advance(e, SEC)
    expect(e.runtime.prompt).not.toBeNull()
    expect(notifySpy).toHaveBeenCalledTimes(2)
  })
})

describe('snooze, skip, pause', () => {
  it('4. snooze re-prompts after the snooze duration', () => {
    const e = makeEngine((e) => only(e, ['eye']))
    advance(e, 20 * MIN)
    e.snoozePrompt()
    expect(e.runtime.prompt).toBeNull()
    advance(e, 5 * MIN - SEC)
    expect(e.runtime.prompt).toBeNull()
    advance(e, SEC)
    expect(e.runtime.prompt?.reminderIds).toEqual(['eye'])
  })

  it('skip records a skipped break and restarts the interval', () => {
    const e = makeEngine((e) => only(e, ['eye']))
    advance(e, 20 * MIN)
    e.dismissPrompt()
    expect(e.history.breaks.at(-1)?.status).toBe('skipped')
    expect(e.runtime.dueAt.eye).toBe(t + 20 * MIN)
  })

  it('5. pausing stops reminders; 6. resuming restores the remaining time', () => {
    const e = makeEngine((e) => only(e, ['eye']))
    advance(e, 15 * MIN)
    e.pause(null)
    advance(e, 30 * MIN, 10 * SEC)
    expect(e.runtime.prompt).toBeNull()
    expect(notifySpy).not.toHaveBeenCalled()
    e.resume()
    expect(e.runtime.dueAt.eye).toBe(t + 5 * MIN)
    advance(e, 5 * MIN)
    expect(e.runtime.prompt?.reminderIds).toEqual(['eye'])
  })

  it('timed pause resumes automatically', () => {
    const e = makeEngine((e) => only(e, ['eye']))
    e.pause(10 * MIN)
    advance(e, 10 * MIN)
    expect(e.runtime.pause).toBeNull()
    expect(e.availability.active).toBe(true)
  })
})

describe('breaks & history', () => {
  it('completing a break records it and resets timers (movement also resets eye)', () => {
    const e = makeEngine((e) => only(e, ['eye', 'movement']))
    e.takeBreak(['movement'])
    expect(e.activeBreak).not.toBeNull()
    const total = e.activeBreak!.steps.reduce((s, x) => s + x.durationSec, 0)
    advance(e, total * SEC + SEC)
    expect(e.activeBreak).toBeNull()
    expect(e.lastFinished).not.toBeNull()
    const rec = e.history.breaks.at(-1)!
    expect(rec.status).toBe('completed')
    expect(rec.trigger).toBe('manual')
    expect(rec.exercises.every((x) => x.completed)).toBe(true)
    expect(e.runtime.dueAt.eye).toBe(rec.endedAt + 20 * MIN)
    expect(e.runtime.dueAt.movement).toBe(rec.endedAt + 60 * MIN)
  })

  it('skipping exercises marks them incomplete; abandoning after one is partial', () => {
    const e = makeEngine((e) => only(e, ['movement']))
    e.takeBreak(['movement'])
    const first = e.activeBreak!.steps[0].durationSec
    advance(e, first * SEC)
    e.skipStep()
    e.finishBreak('skip')
    const rec = e.history.breaks.at(-1)!
    expect(rec.status).toBe('partial')
    expect(rec.exercises[0].completed).toBe(true)
    expect(rec.exercises[1].completed).toBe(false)
  })

  it('pausing a break freezes its countdown', () => {
    const e = makeEngine((e) => only(e, ['eye']))
    e.takeBreak(['eye'])
    advance(e, 5 * SEC)
    e.pauseBreak()
    advance(e, 60 * SEC)
    expect(e.activeBreak!.finished).toBe(false)
    expect(e.stepElapsed(e.activeBreak!)).toBe(5 * SEC)
    e.resumeBreak()
    advance(e, 15 * SEC)
    expect(e.activeBreak).toBeNull()
    expect(e.history.breaks.at(-1)?.status).toBe('completed')
  })

  it('13/14. analytics reflect exactly what was recorded', () => {
    const e = makeEngine((e) => only(e, ['eye']))
    advance(e, 20 * MIN)
    e.startPromptBreak()
    advance(e, 21 * SEC)
    expect(e.activeBreak).toBeNull()
    advance(e, 20 * MIN - SEC)
    e.dismissPrompt()
    const s = summarize(e.history, e.runtime.currentSession, null, dayRange(t), t)
    expect(s.eye).toBe(1)
    expect(s.score).toEqual({ percent: 50, completed: 1, partial: 0, missed: 1, total: 2 })
    expect(s.screenMs).toBeGreaterThan(39 * MIN)
    expect(s.screenMs).toBeLessThanOrEqual(40 * MIN + 21 * SEC)
  })

  it('wellness score is null with no scheduled breaks (never fabricated)', () => {
    expect(wellnessScore([])).toBeNull()
  })
})

describe('environment', () => {
  it('7. settings and timers persist across restarts', () => {
    const e = makeEngine((e) => {
      only(e, ['eye'])
      e.updateSettings((s) => void (s.reminders.find((r) => r.id === 'eye')!.intervalMin = 25))
    })
    advance(e, 10 * MIN)
    e.stop()
    t += 30 * SEC // quick relaunch
    const e2 = new Engine({ storage: new StorageManager(kv), clock: () => t, notifier, sound: false })
    expect(e2.settings.reminders.find((r) => r.id === 'eye')!.intervalMin).toBe(25)
    expect(e2.settings.onboarded).toBe(true)
    expect(e2.runtime.dueAt.eye).toBe(T0 + 25 * MIN)
  })

  it('8. sleep/wake: no burst of overdue reminders; session closed at sleep time', () => {
    const e = makeEngine((e) => only(e, ['eye', 'movement', 'hydration']))
    advance(e, 5 * MIN)
    const sleptAt = t
    t += 3 * 60 * MIN // asleep 3 hours (Date.now jumps, no ticks)
    e.tick()
    expect(e.runtime.prompt).toBeNull()
    expect(e.runtime.dueAt.eye).toBe(t + 20 * MIN)
    const last = e.history.sessions.at(-1)!
    expect(last.end).toBe(sleptAt)
  })

  it('timers never wait longer than one interval after settings change offline', () => {
    const e = makeEngine((e) => only(e, ['eye']))
    e.stop()
    const raw = JSON.parse(kv.getItem('screen-break:v1:settings')!)
    raw.testMode = true
    kv.setItem('screen-break:v1:settings', JSON.stringify(raw))
    const e2 = new Engine({ storage: new StorageManager(kv), clock: () => t, notifier, sound: false })
    expect(e2.runtime.dueAt.eye - t).toBe(20 * SEC)
  })

  it('desktop power events pause and restart timers', () => {
    const e = makeEngine((e) => only(e, ['eye']))
    advance(e, 10 * MIN)
    e.handlePower('suspend')
    expect(e.availability.reason).toBe('sleep')
    advance(e, 30 * SEC)
    e.handlePower('resume')
    expect(e.availability.active).toBe(true)
    expect(e.runtime.dueAt.eye).toBe(t + 20 * MIN)
  })

  it('12. working hours are respected and resume fresh next workday', () => {
    t = new Date(2026, 10, 17, 17, 50).getTime()
    const e = makeEngine((e) => only(e, ['eye']))
    advance(e, 15 * MIN, 10 * SEC) // passes 18:00
    expect(e.availability.reason).toBe('after-hours')
    expect(e.runtime.prompt).toBeNull()
    expect(notifySpy).not.toHaveBeenCalled()
    // Next morning 09:00 (Wednesday)
    t = new Date(2026, 10, 18, 9, 0, 1).getTime() - 2 * SEC
    e.tick()
    advance(e, 2 * SEC)
    expect(e.availability.active).toBe(true)
    expect(e.runtime.dueAt.eye).toBeGreaterThan(t + 19 * MIN)
  })

  it('lunch break pauses reminders', () => {
    t = new Date(2026, 10, 17, 12, 55).getTime()
    const e = makeEngine((e) => only(e, ['eye']))
    advance(e, 10 * MIN, 10 * SEC)
    expect(e.availability.reason).toBe('lunch')
  })

  it('weekends are inactive by default', () => {
    t = new Date(2026, 10, 21, 11, 0).getTime() // Saturday
    const e = makeEngine()
    expect(e.availability.reason).toBe('non-working-day')
    e.workOutsideHoursToday()
    e.tick()
    expect(e.availability.active).toBe(true)
  })

  it('15. working hours follow the current time zone', () => {
    const prev = process.env.TZ
    const s = defaultSettings().schedule
    const instant = Date.UTC(2026, 10, 17, 5, 0) // 10:30 in Kolkata, 00:00 in New York
    process.env.TZ = 'Asia/Kolkata'
    expect(getScheduleAvailability(instant, s).active).toBe(true)
    process.env.TZ = 'America/New_York'
    expect(getScheduleAvailability(instant, s).reason).toBe('before-hours')
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  })

  it('focus mode holds non-essential reminders but keeps eye rest', () => {
    const e = makeEngine((e) => {
      only(e, ['eye', 'posture'])
      e.updateSettings((s) => void (s.reminders.find((r) => r.id === 'posture')!.intervalMin = 10))
    })
    e.startFocus(25)
    advance(e, 20 * MIN)
    expect(e.runtime.prompt?.reminderIds).toEqual(['eye'])
    e.dismissPrompt()
    advance(e, 5 * MIN)
    expect(e.runtime.focus).toBeNull()
    expect(e.history.focus.at(-1)?.completed).toBe(true)
    advance(e, SEC)
    expect(e.runtime.prompt?.reminderIds).toEqual(['posture'])
  })

  it('test mode shrinks intervals to 10–30 seconds', () => {
    const e = makeEngine((e) => {
      only(e, ['eye', 'movement'])
      e.updateSettings((s) => void (s.testMode = true))
    })
    expect(e.runtime.dueAt.eye - t).toBe(20 * SEC)
    expect(e.runtime.dueAt.movement - t).toBe(30 * SEC)
    advance(e, 20 * SEC)
    expect(e.runtime.prompt?.reminderIds).toEqual(['eye'])
  })

  it('custom reminders can be created, fire, and be deleted', () => {
    const e = makeEngine((e) => only(e, []))
    e.updateSettings((s) => {
      s.reminders.push({ id: 'custom-legs', kind: 'custom', name: 'Stretch your legs', enabled: true, intervalMin: 90, durationSec: 60, title: 'Stretch your legs', message: 'Time to stretch.', repeat: 'working-days' })
    })
    advance(e, 90 * MIN, 30 * SEC)
    expect(e.runtime.prompt?.reminderIds).toEqual(['custom-legs'])
    e.updateSettings((s) => void (s.reminders = s.reminders.filter((r) => r.id !== 'custom-legs')))
    expect(e.runtime.prompt).toBeNull()
    expect(e.runtime.dueAt['custom-legs']).toBeUndefined()
  })
})
