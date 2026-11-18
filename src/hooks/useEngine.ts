import { useEffect, useState, useSyncExternalStore } from 'react'
import { Engine, type Snapshot } from '../lib/engine'
import { desktop } from '../lib/platform'

// Single engine instance for the main window. The tray popover never creates
// one — it only mirrors state relayed through the Electron main process — so
// there is exactly one scheduler running at any time.
let instance: Engine | null = null

export function getEngine() {
  instance ??= new Engine({ desktop })
  return instance
}

export function useSnapshot(): Snapshot {
  const e = getEngine()
  return useSyncExternalStore(e.subscribe, e.getSnapshot)
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches)
  useEffect(() => {
    const mq = matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

/** Applies the theme preference to <html>. */
export function useTheme(pref: 'light' | 'dark' | 'system') {
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const dark = pref === 'dark' || (pref === 'system' && systemDark)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111714' : '#F7F9F7')
  }, [dark])
  return dark
}
