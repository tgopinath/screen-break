import { useState } from 'react'
import { ArrowLeft, ArrowRight, Bell, BellRing, Check } from 'lucide-react'
import { getEngine, useSnapshot } from '../hooks/useEngine'
import { Button, NumberField, TimeField, Toggle, cx } from '../components/ui'
import { KindIcon } from '../components/meta'
import { Logo } from '../components/Logo'
import { Illustration } from '../components/Illustration'
import { DayPicker } from './Settings'
import { isDesktop } from '../lib/platform'

const STEPS = ['Welcome', 'Reminders', 'Hours', 'Intervals', 'Notifications', 'Done'] as const

export function Onboarding({ onDone }: { onDone: () => void }) {
  const s = useSnapshot()
  const e = getEngine()
  const [step, setStep] = useState(0)
  const st = s.settings
  const finish = () => {
    e.updateSettings((x) => void (x.onboarded = true))
    e.resetTimers()
    onDone()
  }
  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish())
  const back = () => setStep(Math.max(0, step - 1))

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-bg">
      <div className="drag h-8 shrink-0" />
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <span key={i} className={cx('h-1.5 rounded-full transition-all duration-500', i === step ? 'w-8 bg-primary' : i < step ? 'w-4 bg-primary/50' : 'w-4 bg-border')} />
            ))}
          </div>
          {step < STEPS.length - 1 && (
            <button className="no-drag text-sm font-semibold text-muted hover:text-text" onClick={finish}>
              Skip setup
            </button>
          )}
        </div>

        <div key={step} className="anim-fade-up flex flex-1 flex-col justify-center py-10">
          {step === 0 && (
            <div className="flex flex-col items-center text-center">
              <Logo size={64} />
              <div className="mt-8 flex items-end gap-2">
                <Illustration name="eye-distance" className="h-16 w-28" />
                <Illustration name="reach" className="h-24 w-20" />
                <Illustration name="water" className="h-16 w-14" />
              </div>
              <h1 className="mt-8 text-3xl font-bold tracking-tight">Welcome to Screen Break</h1>
              <p className="mt-2 text-lg text-muted">Small breaks make a big difference.</p>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">Screen Break quietly reminds you to rest your eyes, move your body and drink water — then gets out of your way.</p>
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Choose your reminders</h1>
              <p className="mt-1 text-muted">You can change these anytime.</p>
              <div className="mt-6 flex flex-col gap-2">
                {st.reminders
                  .filter((r) => r.kind !== 'custom')
                  .map((r) => (
                    <label key={r.id} className={cx('flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition', r.enabled ? 'border-primary/50 bg-surface shadow-card' : 'border-border bg-surface/50')}>
                      <KindIcon reminder={r} boxed size={20} boxSize={44} />
                      <div className="flex-1">
                        <p className="font-semibold">{r.name}</p>
                        <p className="text-[13px] text-muted">{r.message}</p>
                      </div>
                      <Toggle label={r.name} checked={r.enabled} onChange={(v) => e.updateSettings((x) => void (x.reminders.find((y) => y.id === r.id)!.enabled = v))} />
                    </label>
                  ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Set your working hours</h1>
              <p className="mt-1 text-muted">Reminders pause automatically outside these hours.</p>
              <div className="mt-6 flex flex-col gap-5 rounded-3xl border border-border bg-surface p-5 shadow-card">
                <div>
                  <p className="mb-2 text-sm font-semibold">Working days</p>
                  <DayPicker days={st.schedule.days} onChange={(d) => e.updateSettings((x) => void (x.schedule.days = d))} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Hours</p>
                  <div className="flex items-center gap-2">
                    <TimeField label="Start" value={st.schedule.start} onChange={(v) => e.updateSettings((x) => void (x.schedule.start = v))} />
                    <span className="text-muted">–</span>
                    <TimeField label="End" value={st.schedule.end} onChange={(v) => e.updateSettings((x) => void (x.schedule.end = v))} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-3 text-sm font-semibold">
                    <Toggle label="Lunch break" checked={st.schedule.lunch.enabled} onChange={(v) => e.updateSettings((x) => void (x.schedule.lunch.enabled = v))} />
                    Lunch break
                  </label>
                  {st.schedule.lunch.enabled && (
                    <div className="flex items-center gap-2">
                      <TimeField label="Lunch start" value={st.schedule.lunch.start} onChange={(v) => e.updateSettings((x) => void (x.schedule.lunch.start = v))} />
                      <span className="text-muted">–</span>
                      <TimeField label="Lunch end" value={st.schedule.lunch.end} onChange={(v) => e.updateSettings((x) => void (x.schedule.lunch.end = v))} />
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-3 text-sm text-muted">
                  <Toggle label="Respect working hours" checked={!st.schedule.enabled} onChange={(v) => e.updateSettings((x) => void (x.schedule.enabled = !v))} />
                  Remind me any time the app is open instead
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Configure intervals</h1>
              <p className="mt-1 text-muted">The defaults follow common ergonomic guidance.</p>
              <div className="mt-6 flex flex-col divide-y divide-border rounded-3xl border border-border bg-surface px-5 shadow-card">
                {st.reminders
                  .filter((r) => r.kind !== 'custom' && r.enabled)
                  .map((r) => (
                    <div key={r.id} className="flex items-center gap-3 py-4">
                      <KindIcon reminder={r} boxed size={17} />
                      <p className="flex-1 font-semibold">{r.name}</p>
                      <span className="text-sm text-muted">every</span>
                      <NumberField label={`${r.name} interval`} value={r.intervalMin} min={1} max={240} suffix="min" onChange={(v) => e.updateSettings((x) => void (x.reminders.find((y) => y.id === r.id)!.intervalMin = v))} />
                    </div>
                  ))}
                {st.reminders.every((r) => !r.enabled) && <p className="py-6 text-center text-sm text-muted">No reminders selected — go back to pick some.</p>}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center text-center">
              <div className="grid h-20 w-20 place-items-center rounded-3xl bg-mint">
                <BellRing size={34} className="text-primary-strong" />
              </div>
              <h1 className="mt-6 text-2xl font-bold tracking-tight">Enable desktop notifications</h1>
              <p className="mt-2 max-w-sm text-muted">So reminders reach you while you're working in other apps. Each one has Start, Snooze and Dismiss.</p>
              <div className="mt-6">
                {s.permission === 'granted' ? (
                  <div className="flex flex-col items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-mint px-4 py-2 text-sm font-semibold text-primary-strong">
                      <Check size={16} /> Notifications {isDesktop ? 'ready' : 'allowed'}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => e.testNotification()}>
                      Send a test notification
                    </Button>
                  </div>
                ) : s.permission === 'denied' ? (
                  <p className="max-w-sm rounded-2xl bg-warning-soft px-4 py-3 text-sm">Notifications are blocked by your browser. You'll still get in-app reminders and a flashing tab title. You can allow them later in your browser's site settings.</p>
                ) : s.permission === 'unsupported' ? (
                  <p className="max-w-sm rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">This browser doesn't support notifications. Reminders will appear inside Screen Break.</p>
                ) : (
                  <Button variant="primary" size="lg" onClick={() => void e.requestNotificationPermission()}>
                    <Bell size={17} /> Allow notifications
                  </Button>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="flex flex-col items-center text-center">
              <div className="anim-pop grid h-24 w-24 place-items-center rounded-full bg-mint">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--primary-strong)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" className="anim-draw" />
                </svg>
              </div>
              <h1 className="mt-6 text-2xl font-bold tracking-tight">You're all set</h1>
              <p className="mt-2 max-w-sm text-muted">Your first eye-rest reminder starts counting now. {isDesktop ? 'Screen Break lives in your menu bar — closing the window keeps it running.' : 'Keep this tab open so reminders can reach you.'}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={back} className={step === 0 ? 'invisible' : ''}>
            <ArrowLeft size={16} /> Back
          </Button>
          <Button variant="primary" size="lg" onClick={next}>
            {step === 0 ? 'Get started' : step === STEPS.length - 1 ? 'Open dashboard' : step === 4 && s.permission !== 'granted' ? 'Maybe later' : 'Continue'}
            {step < STEPS.length - 1 && <ArrowRight size={16} />}
          </Button>
        </div>
      </div>
    </div>
  )
}
