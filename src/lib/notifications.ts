import { desktop } from './platform'

// NotificationManager — native notifications on desktop (with Start / Snooze /
// Dismiss actions), the Notification API on the web, and an in-app fallback
// (floating prompt + tab title) when permission is unavailable.

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

export interface NotifyOptions {
  id: string
  title: string
  body: string
  withActions: boolean
  silent: boolean
  onClick?: () => void
}

export class NotificationManager {
  private shown = new Set<string>()
  private webNotes = new Map<string, Notification>()
  private titleTimer: ReturnType<typeof setInterval> | null = null
  private baseTitle = typeof document !== 'undefined' ? document.title : ''

  permission(): PermissionState {
    if (desktop) return 'granted'
    if (typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission
  }

  async requestPermission(): Promise<PermissionState> {
    if (desktop) return 'granted'
    if (typeof Notification === 'undefined') return 'unsupported'
    try {
      return await Notification.requestPermission()
    } catch {
      return Notification.permission
    }
  }

  /** Returns false when the system notification could not be shown. */
  notify(o: NotifyOptions): boolean {
    if (this.shown.has(o.id)) return true // never notify twice for one prompt
    this.shown.add(o.id)
    if (this.shown.size > 200) this.shown = new Set([...this.shown].slice(-50))

    if (desktop) {
      desktop.notify({
        id: o.id,
        title: o.title,
        body: o.body,
        silent: o.silent,
        actions: o.withActions
          ? [
              { type: 'start', text: 'Start break' },
              { type: 'snooze', text: 'Snooze 5 min' },
              { type: 'dismiss', text: 'Dismiss' },
            ]
          : [],
      })
      return true
    }
    if (this.permission() !== 'granted') {
      this.flashTitle(o.title)
      return false
    }
    try {
      const n = new Notification(o.title, { body: o.body, tag: o.id, silent: o.silent })
      n.onclick = () => {
        window.focus()
        o.onClick?.()
        n.close()
      }
      this.webNotes.set(o.id, n)
      return true
    } catch {
      this.flashTitle(o.title)
      return false
    }
  }

  close(id: string) {
    desktop?.closeNotification(id)
    this.webNotes.get(id)?.close()
    this.webNotes.delete(id)
    this.stopFlash()
  }

  private flashTitle(text: string) {
    if (typeof document === 'undefined') return
    this.stopFlash()
    let on = false
    this.titleTimer = setInterval(() => {
      on = !on
      document.title = on ? `⏰ ${text}` : this.baseTitle
    }, 1200)
  }

  stopFlash() {
    if (this.titleTimer) clearInterval(this.titleTimer)
    this.titleTimer = null
    if (typeof document !== 'undefined') document.title = this.baseTitle
  }
}
