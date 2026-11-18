import { Armchair, Bell, Eye, GlassWater, PersonStanding, type LucideIcon } from 'lucide-react'
import type { ReminderConfig } from '../lib/types'

export interface KindMeta {
  icon: LucideIcon
  color: string
  soft: string
}

const META: Record<string, KindMeta> = {
  eye: { icon: Eye, color: 'var(--primary)', soft: 'var(--mint)' },
  movement: { icon: PersonStanding, color: 'var(--warning)', soft: 'var(--warning-soft)' },
  hydration: { icon: GlassWater, color: 'var(--info)', soft: 'var(--info-soft)' },
  posture: { icon: Armchair, color: '#a08fd0', soft: 'color-mix(in oklab, #a08fd0 18%, var(--surface))' },
  custom: { icon: Bell, color: 'var(--danger)', soft: 'var(--danger-soft)' },
}

export function kindMeta(r: Pick<ReminderConfig, 'kind'> | undefined): KindMeta {
  return META[r?.kind ?? 'custom'] ?? META.custom
}

export function KindIcon({ reminder, size = 18, boxed = false, boxSize = 36 }: { reminder: Pick<ReminderConfig, 'kind'> | undefined; size?: number; boxed?: boolean; boxSize?: number }) {
  const m = kindMeta(reminder)
  const Icon = m.icon
  if (!boxed) return <Icon size={size} style={{ color: m.color }} />
  return (
    <span className="grid shrink-0 place-items-center rounded-xl" style={{ width: boxSize, height: boxSize, background: m.soft }}>
      <Icon size={size} style={{ color: m.color }} strokeWidth={2.2} />
    </span>
  )
}
