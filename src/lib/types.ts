// Core data model for Screen Break. All timestamps are epoch milliseconds so
// stored data stays correct across time-zone changes; local dates are derived
// at read time.

export type BuiltinKind = 'eye' | 'movement' | 'hydration' | 'posture'
export type ReminderKind = BuiltinKind | 'custom'

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday

export interface ReminderConfig {
  id: string // 'eye' | 'movement' | 'hydration' | 'posture' | 'custom-<uuid>'
  kind: ReminderKind
  name: string
  enabled: boolean
  intervalMin: number
  durationSec: number
  title: string // notification title
  message: string // notification body
  /** Custom reminders only: when they repeat. */
  repeat?: 'working-days' | 'every-day'
}

export interface PausePeriod {
  id: string
  label: string
  start: string // YYYY-MM-DD (inclusive, local)
  end: string // YYYY-MM-DD (inclusive, local)
}

export interface WorkingSchedule {
  enabled: boolean
  start: string // HH:MM
  end: string // HH:MM
  days: DayOfWeek[]
  lunch: { enabled: boolean; start: string; end: string }
  pausePeriods: PausePeriod[]
}

export type ThemePref = 'light' | 'dark' | 'system'
export type NotificationStyle = 'prompt' | 'overlay'

export interface UserSettings {
  version: 1
  userName: string
  onboarded: boolean
  theme: ThemePref
  sound: boolean
  launchAtStartup: boolean
  startMinimized: boolean
  showMenuBarIcon: boolean
  testMode: boolean
  reminders: ReminderConfig[]
  eyeExercises: string[] // selected EyeExercise ids, in order
  movementExercises: string[] // selected MovementExercise ids
  gentleMovement: boolean // prefer seated / gentle alternatives
  targets: { eye: number; movement: number }
  schedule: WorkingSchedule
  notifications: {
    desktop: boolean
    sound: boolean
    snoozeMin: number
    style: NotificationStyle
  }
  idleThresholdMin: number
}

export interface Exercise {
  id: string
  name: string
  durationSec: number
  steps: string[]
  gentle?: string
  animation: string // illustration key
}

export interface BreakStep {
  key: string
  reminderId: string
  exerciseId?: string
  title: string
  steps: string[]
  gentle?: string
  durationSec: number
  animation: string
}

export interface ExerciseRecord {
  exerciseId: string
  reminderId: string
  completed: boolean
  durationSec: number
}

export type BreakStatus = 'completed' | 'partial' | 'skipped' | 'missed' | 'snoozed'

export interface BreakRecord {
  id: string
  reminderIds: string[]
  trigger: 'scheduled' | 'manual'
  promptedAt: number
  startedAt?: number
  endedAt: number
  status: BreakStatus
  exercises: ExerciseRecord[]
}

export interface WorkSession {
  id: string
  start: number
  end: number
}

export interface FocusSession {
  id: string
  start: number
  plannedMin: number
  endsAt: number
  end?: number
  completed?: boolean
}

export interface History {
  version: 1
  breaks: BreakRecord[]
  sessions: WorkSession[]
  focus: FocusSession[]
}

export type InactiveReason =
  | 'paused'
  | 'non-working-day'
  | 'before-hours'
  | 'after-hours'
  | 'lunch'
  | 'pause-period'
  | 'away'
  | 'sleep'

export interface Availability {
  active: boolean
  reason?: InactiveReason
  /** When reminders will resume on their own, if known. */
  resumesAt?: number | null
}

export interface Prompt {
  id: string
  reminderIds: string[]
  createdAt: number
}

export interface ActiveBreak {
  id: string
  reminderIds: string[]
  trigger: 'scheduled' | 'manual'
  promptedAt: number
  startedAt: number
  steps: BreakStep[]
  stepIndex: number
  stepStartedAt: number
  /** ms elapsed in the current step before the latest resume */
  stepElapsedMs: number
  paused: boolean
  results: ExerciseRecord[]
  finished: boolean
}

export interface PauseState {
  startedAt: number
  until: number | null // null = until resumed
  remaining: Record<string, number>
}

/** Persisted runtime state — lets timers survive reloads and restarts. */
export interface RuntimeState {
  version: 1
  dueAt: Record<string, number>
  frozen: Record<string, number> | null // remaining ms while schedule-inactive
  pause: PauseState | null
  lastTick: number
  wasActive: boolean
  currentSession: WorkSession | null
  focus: FocusSession | null
  prompt: Prompt | null
  overrideUntil: number | null // "work outside hours" until this time
}
