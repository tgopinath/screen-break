export const SEC = 1000
export const MIN = 60 * SEC
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR

export function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** mm:ss, or h:mm:ss for an hour or more. */
export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** "1h 25m", "12m", "45s" */
export function formatDuration(ms: number) {
  const totalMin = Math.floor(ms / MIN)
  if (ms < MIN) return `${Math.max(0, Math.round(ms / SEC))}s`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

export function parseHM(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes()
}

export function dateKey(t: number | Date) {
  const d = typeof t === 'number' ? new Date(t) : t
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function startOfDay(t: number) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function addDays(t: number, n: number) {
  const d = new Date(t)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

export function atMinutes(dayStart: number, minutes: number) {
  const d = new Date(dayStart)
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return d.getTime()
}

export function formatTime12(t: number) {
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatHM12(hm: string) {
  const mins = parseHM(hm)
  return formatTime12(atMinutes(startOfDay(Date.now()), mins))
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function uid() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
}
