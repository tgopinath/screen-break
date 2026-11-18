// Screen Break — Electron main process.
// SystemTrayManager + native NotificationManager + power/idle monitoring.
// The scheduler itself runs in the main window's renderer (shared with the web
// build); this process keeps that window alive in the background, relays its
// state to the menu bar, and forwards commands back.

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification, powerMonitor, screen } = require('electron')
const path = require('path')
const { drawIcon } = require('./icon.cjs')

const DEV_URL = process.env.SB_DEV_URL
const isMac = process.platform === 'darwin'
const PRIMARY = [0x75, 0xb8, 0x9a]

let win = null
let trayWin = null
let tray = null
let quitting = false
let lastSnapshot = null
let wantTray = true
const notes = new Map()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showMain(true))
}

app.setAppUserModelId('com.screenbreak.app')
// Self-test runs in a throwaway profile so it never touches real user data.
if (process.env.SB_SELFTEST) app.setPath('userData', path.join(process.env.SB_SELFTEST, 'profile'))

function load(w, hash = '') {
  if (DEV_URL) return w.loadURL(DEV_URL + (hash ? `#${hash}` : ''))
  return w.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), hash ? { hash } : undefined)
}

const startHidden = () => process.argv.includes('--hidden') || (isMac && app.getLoginItemSettings().wasOpenedAsHidden)

function createMain() {
  win = new BrowserWindow({
    width: 1200,
    height: 840,
    minWidth: 380,
    minHeight: 560,
    show: false,
    title: 'Screen Break',
    backgroundColor: '#F7F9F7',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 22 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Timers must keep running accurately while the window is hidden.
      backgroundThrottling: false,
    },
  })
  load(win)
  win.once('ready-to-show', () => {
    if (!startHidden()) win.show()
  })
  win.on('close', (e) => {
    if (quitting) return
    // Closing the window keeps Screen Break running in the menu bar / tray.
    e.preventDefault()
    if (tray) win.hide()
    else win.minimize()
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
}

function showMain(focus = true) {
  if (!win) return
  if (win.isMinimized()) win.restore()
  if (focus) {
    win.show()
    win.focus()
    if (isMac) app.focus({ steal: true })
  } else if (!win.isVisible()) {
    win.showInactive()
  }
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

// ───────────── tray ─────────────

function trayImage() {
  if (isMac) {
    const img = nativeImage.createFromBitmap(drawIcon(36, { rgb: [0, 0, 0] }), { width: 36, height: 36, scaleFactor: 2 })
    img.setTemplateImage(true)
    return img
  }
  return nativeImage.createFromBitmap(drawIcon(32, { rgb: [255, 255, 255], bg: PRIMARY, glyphScale: 0.82 }), { width: 32, height: 32, scaleFactor: 2 })
}

function createTray() {
  if (tray) return
  tray = new Tray(trayImage())
  tray.setToolTip('Screen Break')
  tray.on('click', toggleTrayWindow)
  tray.on('right-click', () => {
    const paused = lastSnapshot?.paused
    tray.popUpContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open Dashboard', click: () => command({ type: 'navigate', route: 'dashboard' }) },
        { label: 'Take Eye Break', click: () => command({ type: 'break', reminderIds: ['eye'] }) },
        { label: 'Take Movement Break', click: () => command({ type: 'break', reminderIds: ['movement'] }) },
        { label: paused ? 'Resume Reminders' : 'Pause Reminders', click: () => command({ type: paused ? 'resume' : 'pause' }) },
        { type: 'separator' },
        { label: 'Quit Screen Break', click: () => quit() },
      ]),
    )
  })
  if (lastSnapshot) applySnapshot(lastSnapshot)
}

function destroyTray() {
  tray?.destroy()
  tray = null
  trayWin?.hide()
}

function createTrayWindow() {
  trayWin = new BrowserWindow({
    width: 288,
    height: 404,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  load(trayWin, '/tray')
  trayWin.on('blur', () => trayWin?.hide())
}

function toggleTrayWindow() {
  if (!trayWin) createTrayWindow()
  if (trayWin.isVisible()) return trayWin.hide()
  const tb = tray.getBounds()
  const wb = trayWin.getBounds()
  const display = screen.getDisplayMatching(tb)
  const wa = display.workArea
  let x = Math.round(tb.x + tb.width / 2 - wb.width / 2)
  // macOS menu bar is on top; Windows taskbar is usually at the bottom.
  let y = isMac || tb.y < wa.y + wa.height / 2 ? Math.round(tb.y + tb.height + 4) : Math.round(tb.y - wb.height - 4)
  x = Math.min(Math.max(x, wa.x + 4), wa.x + wa.width - wb.width - 4)
  y = Math.min(Math.max(y, wa.y + 4), wa.y + wa.height - wb.height - 4)
  trayWin.setPosition(x, y, false)
  if (lastSnapshot) trayWin.webContents.send('tray:snapshot', lastSnapshot)
  trayWin.show()
  trayWin.focus()
}

function applySnapshot(s) {
  lastSnapshot = s
  if (tray) {
    if (isMac) tray.setTitle(s.title ? ` ${s.title}` : '', { fontType: 'monospacedDigit' })
    tray.setToolTip(s.active ? `Screen Break — ${s.nextLabel} in ${s.nextIn}` : `Screen Break — ${s.statusLabel}`)
  }
  if (trayWin && !trayWin.isDestroyed() && trayWin.isVisible()) trayWin.webContents.send('tray:snapshot', s)
}

function command(c) {
  trayWin?.hide()
  if (c.type === 'navigate' || c.type === 'break' || c.type === 'open') showMain(true)
  if (c.type === 'open') return
  send('command', c)
}

function quit() {
  quitting = true
  app.quit()
}

// ───────────── IPC ─────────────

ipcMain.on('tray:update', (_e, s) => applySnapshot(s))
ipcMain.on('tray:request', (e) => lastSnapshot && e.sender.send('tray:snapshot', lastSnapshot))
ipcMain.on('tray:command', (_e, c) => (c.type === 'quit' ? quit() : command(c)))
ipcMain.on('tray:visible', (_e, show) => {
  wantTray = show
  show ? createTray() : destroyTray()
})
ipcMain.on('window:show', (_e, focus) => showMain(focus))
ipcMain.on('app:quit', () => quit())
ipcMain.handle('idle:get', () => powerMonitor.getSystemIdleTime())
ipcMain.on('login-item', (_e, { open, hidden }) => {
  if (!app.isPackaged) return // avoid registering the dev Electron binary at login
  app.setLoginItemSettings({ openAtLogin: open, openAsHidden: hidden, args: hidden ? ['--hidden'] : [] })
})

ipcMain.on('notify', (_e, n) => {
  if (!Notification.isSupported()) {
    showMain(false)
    return
  }
  const note = new Notification({
    title: n.title,
    body: n.body,
    silent: n.silent,
    actions: n.actions.map((a) => ({ type: 'button', text: a.text })),
    timeoutType: n.actions.length ? 'never' : 'default',
  })
  note.on('action', (_ev, index) => send('command', { type: 'notification-action', promptId: n.id, action: n.actions[index]?.type ?? 'click' }))
  note.on('click', () => {
    showMain(true)
    send('command', { type: 'notification-action', promptId: n.id, action: 'click' })
  })
  note.on('close', () => notes.delete(n.id))
  notes.set(n.id, note)
  note.show()
})
ipcMain.on('notify:close', (_e, id) => {
  notes.get(id)?.close()
  notes.delete(id)
})

// ───────────── lifecycle ─────────────

app.whenReady().then(() => {
  createMain()
  if (wantTray) createTray()
  for (const ev of ['suspend', 'resume', 'lock-screen', 'unlock-screen']) {
    powerMonitor.on(ev, () => send('power', ev))
  }
  app.on('activate', () => showMain(true))
})

// ───────────── self-test (SB_SELFTEST=<dir>) ─────────────
// Drives the real desktop app and writes screenshots + a JSON report, so the
// tray, close-to-tray, commands and power events can be verified unattended.
async function selfTest(dir) {
  const fs = require('fs')
  fs.mkdirSync(dir, { recursive: true })
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const shot = async (w, name) => fs.writeFileSync(path.join(dir, name), (await w.webContents.capturePage()).toPNG())
  const report = { steps: [] }
  const log = (step, data) => report.steps.push({ step, ...data })
  await wait(2500)
  // Fresh profile: skip onboarding, ignore working hours, use test-mode intervals.
  await win.webContents.executeJavaScript(`(() => { const k = 'screen-break:v1:settings'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.onboarded = true; s.testMode = true; s.schedule = Object.assign(s.schedule || {}, { enabled: false }); localStorage.setItem(k, JSON.stringify(s)); location.reload() })()`)
  await wait(4000)
  await shot(win, '1-main.png')
  log('main window', { visible: win.isVisible(), trayExists: !!tray, trayTitle: tray?.getTitle?.(), snapshot: lastSnapshot })
  toggleTrayWindow()
  await wait(2000)
  await shot(trayWin, '2-tray.png')
  log('tray popover', { visible: trayWin.isVisible(), bounds: trayWin.getBounds(), trayBounds: tray.getBounds(), displays: screen.getAllDisplays().map((d) => ({ bounds: d.bounds, workArea: d.workArea })) })
  trayWin.hide()
  win.close()
  await wait(800)
  log('close window', { windowVisible: win.isVisible(), windowDestroyed: win.isDestroyed(), appAlive: true, trayTitle: tray?.getTitle?.() })
  await wait(2500)
  log('ticking while hidden', { trayTitle: tray?.getTitle?.(), snapshot: lastSnapshot })
  command({ type: 'pause' })
  await wait(1500)
  log('tray: pause', { paused: lastSnapshot?.paused, status: lastSnapshot?.statusLabel, trayTitle: tray?.getTitle?.() })
  command({ type: 'resume' })
  await wait(1500)
  log('tray: resume', { paused: lastSnapshot?.paused, status: lastSnapshot?.statusLabel })
  send('power', 'suspend')
  await wait(1500)
  log('power: suspend', { status: lastSnapshot?.statusLabel })
  send('power', 'resume')
  await wait(1500)
  log('power: resume', { status: lastSnapshot?.statusLabel, nextIn: lastSnapshot?.nextIn })
  command({ type: 'break', reminderIds: ['eye'] })
  await wait(2500)
  await shot(win, '3-break.png')
  log('tray: eye break', { windowVisible: win.isVisible(), status: lastSnapshot?.statusLabel, trayTitle: tray?.getTitle?.() })
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2))
  quit()
}

if (process.env.SB_SELFTEST) app.whenReady().then(() => selfTest(process.env.SB_SELFTEST))

app.on('before-quit', () => {
  quitting = true
})

// Keep running in the menu bar when every window is closed.
app.on('window-all-closed', () => {})
