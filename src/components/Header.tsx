import { useState } from 'react'
import { BarChart3, Eye, LayoutDashboard, Monitor, Moon, Pause, PersonStanding, Play, Settings, Sun, Target, UserRound } from 'lucide-react'
import { getEngine, useSnapshot } from '../hooks/useEngine'
import { statusText } from '../lib/engine'
import { formatClock } from '../lib/time'
import { isDesktop } from '../lib/platform'
import { Logo } from './Logo'
import { IconButton, MenuItem, Popover, Segmented, cx } from './ui'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'stats', label: 'Statistics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function Header({ route, navigate }: { route: string; navigate: (r: string) => void }) {
  const s = useSnapshot()
  const now = new Date(s.now)
  const mac = isDesktop && window.screenBreak?.platform === 'darwin'
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  return (
    <>
      <header className={cx('site-header drag sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur-xl', mac && 'pt-6 sm:pt-0')}>
        <div className={cx('mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6', mac && 'sm:pl-24')}>
          <button className="no-drag flex items-center gap-2.5" onClick={() => navigate('dashboard')}>
            <Logo size={32} />
            <span className="hidden text-[17px] font-bold tracking-tight sm:inline">Screen Break</span>
          </button>
          <nav className="no-drag ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => navigate(n.id)}
                aria-current={route.startsWith(n.id) ? 'page' : undefined}
                className={cx('rounded-xl px-3.5 py-2 text-sm font-semibold transition', route.startsWith(n.id) ? 'bg-surface text-text shadow-card' : 'text-muted hover:text-text')}
              >
                {n.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right leading-tight lg:block">
              <p className="tabular text-sm font-bold">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
              <p className="text-xs text-muted">{now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            </div>
            <QuickMenu />
            <IconButton label="Settings" onClick={() => navigate('settings')} className="hidden sm:grid">
              <Settings size={18} />
            </IconButton>
            <ProfileMenu navigate={navigate} greeting={greeting} />
          </div>
        </div>
      </header>
      <nav className="site-tabbar fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Main">
        {NAV.map((n) => (
          <button key={n.id} onClick={() => navigate(n.id)} aria-current={route.startsWith(n.id) ? 'page' : undefined} className={cx('flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold', route.startsWith(n.id) ? 'text-primary-strong' : 'text-muted')}>
            <n.icon size={20} />
            {n.label}
          </button>
        ))}
      </nav>
    </>
  )
}

function QuickMenu() {
  const s = useSnapshot()
  const e = getEngine()
  const [open, setOpen] = useState(false)
  const a = s.availability
  const label = s.activeBreak ? 'On break' : s.runtime.prompt ? 'Break due' : a.active && s.next ? formatClock(s.next.remainingMs) : statusText(s)
  const act = (fn: () => void) => () => {
    fn()
    setOpen(false)
  }
  return (
    <Popover
      open={open}
      setOpen={setOpen}
      trigger={
        <button
          onClick={() => setOpen(!open)}
          aria-label="Quick actions"
          className={cx(
            'no-drag tabular flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-bold transition hover:border-primary/50',
            s.runtime.prompt ? 'border-warning/50 bg-warning-soft' : 'border-border bg-surface',
          )}
        >
          {s.runtime.focus ? <Target size={14} className="text-info" /> : <span className={cx('h-2 w-2 rounded-full', a.active ? 'bg-success' : 'bg-muted')} />}
          {label}
        </button>
      }
    >
      <div className="px-3 pb-2 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Next break{s.next ? ` · ${s.next.reminder.name}` : ''}</p>
        <p className="tabular text-2xl font-bold">{a.active && s.next && !s.runtime.prompt ? formatClock(s.next.remainingMs) : statusText(s)}</p>
      </div>
      <div className="h-px bg-border" />
      <MenuItem icon={<Eye size={16} />} onClick={act(() => e.takeBreak(['eye']))}>
        Take eye break
      </MenuItem>
      <MenuItem icon={<PersonStanding size={16} />} onClick={act(() => e.takeBreak(['movement']))}>
        Take movement break
      </MenuItem>
      {s.runtime.pause ? (
        <MenuItem icon={<Play size={16} />} onClick={act(() => e.resume())}>
          Resume reminders
        </MenuItem>
      ) : (
        <MenuItem icon={<Pause size={16} />} onClick={act(() => e.pause(null))}>
          Pause reminders
        </MenuItem>
      )}
    </Popover>
  )
}

function ProfileMenu({ navigate, greeting }: { navigate: (r: string) => void; greeting: string }) {
  const s = useSnapshot()
  const [open, setOpen] = useState(false)
  const name = s.settings.userName.trim()
  const initials = name
    ? name
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : null
  return (
    <Popover
      open={open}
      setOpen={setOpen}
      trigger={
        <button onClick={() => setOpen(!open)} aria-label="Profile and preferences" className="no-drag grid h-9 w-9 place-items-center rounded-full bg-mint text-[13px] font-bold text-primary-strong transition hover:ring-2 hover:ring-primary/40">
          {initials ?? <UserRound size={17} />}
        </button>
      }
    >
      <div className="px-3 pb-3 pt-2">
        <p className="text-sm font-bold">
          {greeting}
          {name ? `, ${name.split(' ')[0]}` : ''}
        </p>
        <p className="text-xs text-muted">Preferences</p>
      </div>
      <div className="px-3 pb-3">
        <Segmented
          size="sm"
          value={s.settings.theme}
          onChange={(v) => getEngine().updateSettings((x) => void (x.theme = v))}
          options={[
            { value: 'light', label: <Sun size={14} /> },
            { value: 'dark', label: <Moon size={14} /> },
            { value: 'system', label: <Monitor size={14} /> },
          ]}
        />
      </div>
      <div className="h-px bg-border" />
      <MenuItem
        icon={<UserRound size={16} />}
        onClick={() => {
          navigate('settings/general')
          setOpen(false)
        }}
      >
        Edit profile
      </MenuItem>
      <MenuItem
        icon={<Settings size={16} />}
        onClick={() => {
          navigate('settings')
          setOpen(false)
        }}
      >
        All settings
      </MenuItem>
    </Popover>
  )
}
