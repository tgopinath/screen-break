import { useEffect, useState } from 'react'
import { Eye, LayoutDashboard, Pause, PersonStanding, Play, Power, Settings } from 'lucide-react'
import { desktop, type HostCommand, type TraySnapshot } from '../lib/platform'
import { Logo } from '../components/Logo'
import { cx } from '../components/ui'

// Compact menu-bar / system-tray popover. It holds no timers of its own: the
// main window's engine relays a snapshot every second via the main process,
// and buttons send commands back the same way.

export function TrayView() {
  const [s, setS] = useState<TraySnapshot | null>(null)
  useEffect(() => {
    if (!desktop) return
    const off = desktop.onTraySnapshot(setS)
    desktop.requestTraySnapshot()
    return off
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!s?.dark)
    document.body.style.background = 'transparent'
  }, [s?.dark])
  const send = (c: HostCommand | { type: 'open' } | { type: 'quit' }) => desktop?.sendTrayCommand(c)
  return <TrayPanel s={s} send={send} />
}

export function TrayPanel({ s, send }: { s: TraySnapshot | null; send: (c: HostCommand | { type: 'open' } | { type: 'quit' }) => void }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-2xl border border-border bg-surface p-3 text-text">
      <div className="flex items-center gap-2 px-1">
        <Logo size={22} />
        <span className="text-sm font-bold">Screen Break</span>
        <span className={cx('ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold', s?.active ? 'bg-mint text-primary-strong' : 'bg-surface-2 text-muted')}>{s?.statusLabel ?? '…'}</span>
      </div>
      <div className="mt-3 rounded-xl bg-surface-2 px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Next break · {s?.nextLabel ?? '—'}</p>
        <p className="tabular text-3xl font-bold leading-tight">{s?.nextIn ?? '—'}</p>
        <p className="text-xs text-muted">
          Session {s?.sessionLabel ?? '0m'}
          {s?.focusLabel ? ` · Focus ${s.focusLabel}` : ''}
        </p>
      </div>
      <div className="mt-2 flex flex-col">
        <TrayButton icon={<Eye size={16} />} label="Take Eye Break" onClick={() => send({ type: 'break', reminderIds: ['eye'] })} />
        <TrayButton icon={<PersonStanding size={16} />} label="Take Movement Break" onClick={() => send({ type: 'break', reminderIds: ['movement'] })} />
        <TrayButton icon={s?.paused ? <Play size={16} /> : <Pause size={16} />} label={s?.paused ? 'Resume Reminders' : 'Pause Reminders'} onClick={() => send({ type: s?.paused ? 'resume' : 'pause' })} />
        <div className="my-1 h-px bg-border" />
        <TrayButton icon={<LayoutDashboard size={16} />} label="Open Dashboard" onClick={() => send({ type: 'navigate', route: 'dashboard' })} />
        <TrayButton icon={<Settings size={16} />} label="Settings" onClick={() => send({ type: 'navigate', route: 'settings' })} />
        <TrayButton icon={<Power size={16} />} label="Quit Screen Break" onClick={() => send({ type: 'quit' })} />
      </div>
    </div>
  )
}

function TrayButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition hover:bg-surface-2">
      <span className="text-muted">{icon}</span>
      {label}
    </button>
  )
}
