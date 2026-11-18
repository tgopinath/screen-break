// Bridge between the shared UI and the host: Electron (via preload) or the web.

export interface TraySnapshot {
  title: string // short countdown shown next to the menu bar icon
  nextLabel: string
  nextIn: string
  statusLabel: string
  sessionLabel: string
  paused: boolean
  active: boolean
  focusLabel: string | null
  dark: boolean
}

export type HostCommand =
  | { type: 'break'; reminderIds: string[] }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'navigate'; route: string }
  | { type: 'notification-action'; promptId: string; action: 'start' | 'snooze' | 'dismiss' | 'click' }

export type PowerEvent = 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen'

export interface NativeNotification {
  id: string
  title: string
  body: string
  actions: { type: 'start' | 'snooze' | 'dismiss'; text: string }[]
  silent: boolean
}

export interface DesktopBridge {
  isDesktop: true
  platform: string
  notify(n: NativeNotification): void
  closeNotification(id: string): void
  updateTray(s: TraySnapshot): void
  showWindow(focus: boolean): void
  getIdleSeconds(): Promise<number>
  setLoginItem(open: boolean, hidden: boolean): void
  setShowTrayIcon(show: boolean): void
  quit(): void
  onCommand(cb: (c: HostCommand) => void): () => void
  onPower(cb: (e: PowerEvent) => void): () => void
  // Tray popover window only
  onTraySnapshot(cb: (s: TraySnapshot) => void): () => void
  sendTrayCommand(c: HostCommand | { type: 'open' } | { type: 'quit' }): void
  requestTraySnapshot(): void
}

declare global {
  interface Window {
    screenBreak?: DesktopBridge
  }
}

export const desktop: DesktopBridge | undefined = typeof window !== 'undefined' ? window.screenBreak : undefined
export const isDesktop = !!desktop
export const isTrayWindow = typeof location !== 'undefined' && location.hash.startsWith('#/tray')
