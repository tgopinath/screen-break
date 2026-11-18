import { useState } from 'react'
import { Activity, CalendarRange, Clock3, Download, Flame, Target, Timer } from 'lucide-react'
import { useSnapshot } from '../hooks/useEngine'
import type { Snapshot } from '../lib/engine'
import { Button, Card, Segmented, SectionTitle } from '../components/ui'
import { KindIcon } from '../components/meta'
import { BarChart, ChartLegend, LineChart, type Datum } from '../components/Charts'
import { allSessions, breaksIn, countDone, dailyStats, dayRange, focusByHour, lastNDays, screenTimeMs, summarize, toCSV, type Range } from '../lib/analytics'
import { DAY_NAMES, HOUR, addDays, dateKey, formatDuration, startOfDay } from '../lib/time'

type Preset = 'today' | '7' | '30' | 'custom'

export function Statistics() {
  const s = useSnapshot()
  const [preset, setPreset] = useState<Preset>('7')
  const [custom, setCustom] = useState(() => ({ from: dateKey(addDays(s.now, -13)), to: dateKey(s.now) }))

  const range: Range =
    preset === 'today'
      ? dayRange(s.now)
      : preset === '7'
        ? lastNDays(s.now, 7)
        : preset === '30'
          ? lastNDays(s.now, 30)
          : { from: parseDate(custom.from), to: addDays(parseDate(custom.to), 1) }
  const valid = range.to > range.from
  const sum = summarize(s.history, s.runtime.currentSession, s.runtime.focus, valid ? range : dayRange(s.now), s.now)

  return (
    <div className="flex flex-col gap-5">
      <div className="anim-fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statistics</h1>
          <p className="text-sm text-muted">Everything here comes from breaks and sessions Screen Break actually recorded.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Preset>
            value={preset}
            onChange={setPreset}
            options={[
              { value: 'today', label: 'Today' },
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          <ExportButton s={s} />
        </div>
      </div>
      {preset === 'custom' && (
        <Card className="anim-fade-up flex flex-wrap items-center gap-3 p-4">
          <CalendarRange size={18} className="text-muted" />
          <label className="flex items-center gap-2 text-sm font-medium">
            From
            <input type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} className="h-9 rounded-xl border border-border bg-surface px-3 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            To
            <input type="date" value={custom.to} min={custom.from} max={dateKey(s.now)} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} className="h-9 rounded-xl border border-border bg-surface px-3 text-sm" />
          </label>
          {!valid && <span className="text-sm text-danger">Pick an end date after the start date.</span>}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi icon={<KindIcon reminder={{ kind: 'eye' }} boxed size={17} />} label="Eye breaks" value={String(sum.eye)} />
        <Kpi icon={<KindIcon reminder={{ kind: 'movement' }} boxed size={17} />} label="Movement breaks" value={String(sum.movement)} />
        <Kpi icon={<Box tone="info"><Target size={17} className="text-info" /></Box>} label="Focus time" value={formatDuration(sum.focusMs)} sub={`${sum.focusCount} sessions`} />
        <Kpi icon={<Box tone="mint"><Activity size={17} className="text-primary-strong" /></Box>} label="Break completion" value={sum.completionPct === null ? '—' : `${sum.completionPct}%`} sub={sum.resolved ? `${sum.totalDone} of ${sum.resolved} reminders` : 'No reminders yet'} />
        <Kpi icon={<Box tone="info"><Clock3 size={17} className="text-info" /></Box>} label="Screen time" value={formatDuration(sum.screenMs)} />
        <Kpi icon={<Box tone="muted"><Timer size={17} className="text-muted" /></Box>} label="Screen sessions" value={String(sum.sessions)} />
        <Kpi icon={<Box tone="warning"><Flame size={17} className="text-warning" /></Box>} label="Longest session" value={sum.longestMs ? formatDuration(sum.longestMs) : '—'} sub="Without a break" />
        <Kpi icon={<Box tone="mint"><Activity size={17} className="text-primary-strong" /></Box>} label="Wellness score" value={sum.score ? `${sum.score.percent}%` : '—'} sub={sum.score ? `${sum.score.total} scheduled` : 'No scheduled breaks'} />
      </div>

      {valid && <Charts s={s} range={range} />}
      <PeriodCards s={s} />
    </div>
  )
}

function parseDate(k: string) {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

function Box({ tone, children }: { tone: 'info' | 'mint' | 'warning' | 'muted'; children: React.ReactNode }) {
  const bg = { info: 'bg-info-soft', mint: 'bg-mint', warning: 'bg-warning-soft', muted: 'bg-surface-2' }[tone]
  return <span className={`grid h-9 w-9 place-items-center rounded-xl ${bg}`}>{children}</span>
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="anim-fade-up p-4">
      {icon}
      <p className="mt-3 text-[13px] font-semibold text-muted">{label}</p>
      <p className="tabular text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  )
}

function Charts({ s, range }: { s: Snapshot; range: Range }) {
  const single = range.to - range.from <= 24 * HOUR + 1
  let buckets: Datum[]
  let screen: Datum[]
  if (single) {
    // Hourly view for a single day
    const breaks = breaksIn(s.history, range)
    const sessions = allSessions(s.history, s.runtime.currentSession)
    buckets = []
    screen = []
    for (let h = 0; h < 24; h++) {
      const r = { from: range.from + h * HOUR, to: range.from + (h + 1) * HOUR }
      const b = breaks.filter((x) => x.endedAt >= r.from && x.endedAt < r.to)
      const label = new Date(r.from).toLocaleTimeString([], { hour: 'numeric' })
      buckets.push({
        label,
        title: label,
        values: {
          completed: b.filter((x) => x.status === 'completed').length,
          partial: b.filter((x) => x.status === 'partial').length,
          missed: b.filter((x) => x.status === 'skipped' || x.status === 'missed').length,
          eye: countDone(b, 'eye'),
          movement: countDone(b, 'movement'),
        },
      })
      screen.push({ label, title: label, values: { screen: screenTimeMs(sessions, r) / 60000 } })
    }
  } else {
    const days = dailyStats(s.history, s.runtime.currentSession, s.runtime.focus, range, s.now)
    const short = days.length <= 7
    buckets = days.map((d) => {
      const dt = new Date(d.date)
      return {
        label: short ? DAY_NAMES[dt.getDay()] : `${dt.getMonth() + 1}/${dt.getDate()}`,
        title: dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
        values: { completed: d.completed, partial: d.partial, missed: d.missed, eye: d.eye, movement: d.movement },
      }
    })
    screen = days.map((d, i) => ({ label: buckets[i].label, title: buckets[i].title, values: { screen: d.screenMs / 60000, focus: d.focusMs / 60000 } }))
  }
  const hours = focusByHour(s.runtime.focus ? [...s.history.focus, s.runtime.focus] : s.history.focus, range, s.now)
  const focusData: Datum[] = hours.map((m, h) => {
    const label = new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' })
    return { label, title: label, values: { focus: m } }
  })
  const fmtMin = (v: number) => (v >= 60 ? `${Math.round((v / 60) * 10) / 10}h` : `${Math.round(v)}m`)
  const completionSeries = [
    { key: 'completed', label: 'Completed', color: 'var(--primary)' },
    { key: 'partial', label: 'Partial', color: 'var(--warning)' },
    { key: 'missed', label: 'Skipped / missed', color: 'color-mix(in oklab, var(--danger) 55%, var(--surface-2))' },
  ]
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card className="anim-fade-up p-5 lg:col-span-2">
        <SectionTitle action={<ChartLegend series={completionSeries} />}>{single ? 'Breaks by hour' : 'Daily break completion'}</SectionTitle>
        <BarChart data={buckets} series={completionSeries} />
      </Card>
      <Card className="anim-fade-up p-5">
        <SectionTitle>Eye-rest trend</SectionTitle>
        <LineChart data={buckets} series={[{ key: 'eye', label: 'Eye breaks', color: 'var(--primary)' }]} />
      </Card>
      <Card className="anim-fade-up p-5">
        <SectionTitle>Movement activity</SectionTitle>
        <BarChart data={buckets} series={[{ key: 'movement', label: 'Movement breaks', color: 'var(--warning)' }]} />
      </Card>
      <Card className="anim-fade-up p-5">
        <SectionTitle action={!single ? <ChartLegend series={[{ key: 'screen', label: 'Screen', color: 'var(--info)' }, { key: 'focus', label: 'Focus', color: 'var(--primary)' }]} /> : undefined}>Screen time</SectionTitle>
        <BarChart
          data={screen}
          stacked={false}
          format={fmtMin}
          series={single ? [{ key: 'screen', label: 'Screen time', color: 'var(--info)' }] : [{ key: 'screen', label: 'Screen', color: 'var(--info)' }, { key: 'focus', label: 'Focus', color: 'var(--primary)' }]}
        />
      </Card>
      <Card className="anim-fade-up p-5">
        <SectionTitle>Focus time by hour of day</SectionTitle>
        <BarChart data={focusData} format={fmtMin} series={[{ key: 'focus', label: 'Focus', color: 'var(--info)' }]} />
      </Card>
    </div>
  )
}

function PeriodCards({ s }: { s: Snapshot }) {
  const week = summarize(s.history, s.runtime.currentSession, s.runtime.focus, lastNDays(s.now, 7), s.now)
  const month = summarize(s.history, s.runtime.currentSession, s.runtime.focus, lastNDays(s.now, 30), s.now)
  const row = (label: string, v: string) => (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="tabular font-semibold">{v}</span>
    </div>
  )
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {[
        { t: 'Weekly activity', d: 'Last 7 days', x: week },
        { t: 'Monthly activity', d: 'Last 30 days', x: month },
      ].map(({ t, d, x }) => (
        <Card key={t} className="anim-fade-up p-5">
          <SectionTitle action={<span className="text-xs text-muted">{d}</span>}>{t}</SectionTitle>
          <div className="divide-y divide-border">
            {row('Breaks completed', String(x.totalDone))}
            {row('Eye / movement', `${x.eye} / ${x.movement}`)}
            {row('Screen time', formatDuration(x.screenMs))}
            {row('Focus time', formatDuration(x.focusMs))}
            {row('Completion rate', x.completionPct === null ? '—' : `${x.completionPct}%`)}
            {row('Longest session', x.longestMs ? formatDuration(x.longestMs) : '—')}
          </div>
        </Card>
      ))}
    </div>
  )
}

function ExportButton({ s }: { s: Snapshot }) {
  const dl = (name: string, type: string, body: string) => {
    const url = URL.createObjectURL(new Blob([body], { type }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <Button size="sm" className="h-9" onClick={() => dl(`screen-break-history-${dateKey(startOfDay(s.now))}.csv`, 'text/csv', toCSV(s.history))}>
      <Download size={15} /> Export CSV
    </Button>
  )
}
