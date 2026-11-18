import type { History, ReminderConfig, RuntimeState, UserSettings } from './types'
import { DEFAULT_EYE_SELECTION, DEFAULT_MOVEMENT_SELECTION } from './exercises'

export const BUILTIN_REMINDERS: ReminderConfig[] = [
  { id: 'eye', kind: 'eye', name: 'Eye rest', enabled: true, intervalMin: 20, durationSec: 20, title: 'Time to rest your eyes 👀', message: 'Look away from your screen for 20 seconds.' },
  { id: 'movement', kind: 'movement', name: 'Movement', enabled: true, intervalMin: 60, durationSec: 120, title: "Let's get moving! 🧍", message: 'Stand up and stretch for a little while.' },
  { id: 'hydration', kind: 'hydration', name: 'Hydration', enabled: true, intervalMin: 60, durationSec: 30, title: 'Time for a water break 💧', message: 'Take a moment to drink some water.' },
  { id: 'posture', kind: 'posture', name: 'Posture check', enabled: true, intervalMin: 45, durationSec: 15, title: 'Check your posture.', message: 'Relax your shoulders and sit comfortably.' },
]

export function defaultSettings(): UserSettings {
  return {
    version: 1,
    userName: '',
    onboarded: false,
    theme: 'system',
    sound: true,
    launchAtStartup: false,
    startMinimized: false,
    showMenuBarIcon: true,
    testMode: false,
    reminders: BUILTIN_REMINDERS.map((r) => ({ ...r })),
    eyeExercises: [...DEFAULT_EYE_SELECTION],
    movementExercises: [...DEFAULT_MOVEMENT_SELECTION],
    gentleMovement: false,
    targets: { eye: 24, movement: 8 },
    schedule: {
      enabled: true,
      start: '09:00',
      end: '18:00',
      days: [1, 2, 3, 4, 5],
      lunch: { enabled: true, start: '13:00', end: '14:00' },
      pausePeriods: [],
    },
    notifications: { desktop: true, sound: true, snoozeMin: 5, style: 'prompt' },
    idleThresholdMin: 5,
  }
}

export function emptyHistory(): History {
  return { version: 1, breaks: [], sessions: [], focus: [] }
}

export function emptyRuntime(now: number): RuntimeState {
  return {
    version: 1,
    dueAt: {},
    frozen: null,
    pause: null,
    lastTick: now,
    wasActive: false,
    currentSession: null,
    focus: null,
    prompt: null,
    overrideUntil: null,
  }
}
