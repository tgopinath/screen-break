/**
 * Native looks inside the phone apps, from the shared Kolam kits:
 * - Android app (Capacitor shell, or ?app=android): Material Design 3 app bar + navigation bar (KolamM3).
 * - iPhone app (ScreenBreak-iOS shell, or ?app=ios): Apple HIG navigation bar + tab bar (KolamIOS).
 * In a browser, and in the Electron desktop app, nothing changes (the kits are not even loaded on desktop).
 */
import { getEngine } from '../hooks/useEngine'
import { isDesktop } from './platform'

type Kit = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
declare global {
  interface Window {
    KolamM3?: Kit
    KolamIOS?: Kit
  }
}

const KIT = 'https://tgopinath.github.io/kolam-design-system'
const TITLES: Record<string, string> = { dashboard: 'Screen Break', stats: 'Statistics', settings: 'Settings' }
const page = () => (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/')
const svg = (inner: string) =>
  `<svg class="ios-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`
const EYE = svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>')
const CHART = svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>')

function load(tag: 'script' | 'link', url: string) {
  return new Promise<void>((resolve) => {
    const el = document.createElement(tag)
    if (tag === 'script') (el as HTMLScriptElement).src = url
    else Object.assign(el as HTMLLinkElement, { rel: 'stylesheet', href: url })
    el.onload = el.onerror = () => resolve()
    document.head.appendChild(el)
  })
}

let mode: 'android' | 'ios' | null = null
let m3: Kit | null = null

export async function initNative() {
  if (isDesktop) return
  await Promise.all([
    load('script', `${KIT}/m3/kolam-m3.js`),
    load('link', `${KIT}/m3/kolam-m3.css`),
    load('link', `${KIT}/ios/kolam-ios.css`),
    load('script', `${KIT}/ios/kolam-ios.js`),
  ])
  const breakNow = () => getEngine().takeBreak(['eye'])
  const ios = window.KolamIOS?.init({
    appName: 'Screen Break',
    uaTokens: ['ScreenBreak-iOS'],
    tint: { light: '#3A7A5D', dark: '#8FD1B2' },
    tabs: [
      { id: 'dashboard', label: 'Today', icon: EYE, href: '#/dashboard' },
      { id: 'stats', label: 'Statistics', icon: CHART, href: '#/stats' },
      { id: 'settings', label: 'Settings', icon: 'gearshape', href: '#/settings' },
    ],
    currentTab: 'dashboard',
    content: 'main',
  })
  if (ios) {
    mode = 'ios'
    document.documentElement.classList.remove('k-android', 'k-app')
  } else if (window.KolamM3?.isAndroid) {
    mode = 'android'
    m3 = window.KolamM3.init({
      primary: '#4C9474',
      title: 'Screen Break',
      home: '#/dashboard',
      destinations: [
        { id: 'dashboard', label: 'Today', icon: 'visibility', href: '#/dashboard' },
        { id: 'stats', label: 'Statistics', icon: 'bar_chart', href: '#/stats' },
        { id: 'settings', label: 'Settings', icon: 'settings', href: '#/settings' },
      ],
      actions: [{ icon: 'self_improvement', label: 'Take an eye break now', onClick: breakNow }],
    })
  }
  if (!mode) return
  // The app's own theme switch (light / dark / system) sets html.dark; mirror it for the kits.
  const html = document.documentElement
  const theme = () => html.setAttribute('data-theme', html.classList.contains('dark') ? 'dark' : 'light')
  new MutationObserver(theme).observe(html, { attributes: true, attributeFilter: ['class'] })
  theme()
  const sync = () => {
    // settings/<section> are the Settings page's own section tabs, so they stay one top-level screen.
    const [p] = page()
    const tab = TITLES[p] ? p : 'dashboard'
    const title = TITLES[tab]
    if (mode === 'ios') {
      const K = window.KolamIOS!
      K.tabBar.select(tab)
      K.navBar.set({ title, large: true, actions: tab === 'dashboard' ? [{ icon: EYE, label: 'Take an eye break now', onClick: breakNow }] : [] })
      // A page heading that only repeats the large title is hidden (HIG: the navigation bar names the screen).
      setTimeout(() => {
        const h1 = document.querySelector('main h1') as HTMLElement | null
        if (h1 && h1.textContent?.trim() === title) h1.hidden = true
      }, 60)
    } else {
      // The kit resets its overrides on every route change, so set ours just after it.
      setTimeout(() => {
        m3!.setTitle(title)
        m3!.setActive(tab)
        m3!.setBack(false)
      })
    }
  }
  addEventListener('hashchange', sync)
  sync()
}

export const nativeMode = () => mode
