// Narrow, typed bridge between the renderer and the main process.
const { contextBridge, ipcRenderer } = require('electron')

function on(channel, cb) {
  const handler = (_e, payload) => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('screenBreak', {
  isDesktop: true,
  platform: process.platform,
  notify: (n) => ipcRenderer.send('notify', n),
  closeNotification: (id) => ipcRenderer.send('notify:close', id),
  updateTray: (s) => ipcRenderer.send('tray:update', s),
  showWindow: (focus) => ipcRenderer.send('window:show', !!focus),
  getIdleSeconds: () => ipcRenderer.invoke('idle:get'),
  setLoginItem: (open, hidden) => ipcRenderer.send('login-item', { open, hidden }),
  setShowTrayIcon: (show) => ipcRenderer.send('tray:visible', !!show),
  quit: () => ipcRenderer.send('app:quit'),
  onCommand: (cb) => on('command', cb),
  onPower: (cb) => on('power', cb),
  onTraySnapshot: (cb) => on('tray:snapshot', cb),
  sendTrayCommand: (c) => ipcRenderer.send('tray:command', c),
  requestTraySnapshot: () => ipcRenderer.send('tray:request'),
})
