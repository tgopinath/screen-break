import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg'

export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      {...rest}
      className={cx(
        'no-drag inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-[15px]',
        variant === 'primary' && 'bg-primary text-primary-ink shadow-[0_6px_16px_-6px_var(--primary)] hover:brightness-[1.05] hover:shadow-[0_8px_22px_-6px_var(--primary)]',
        variant === 'secondary' && 'border border-border bg-surface text-text hover:border-primary/50 hover:bg-surface-2',
        variant === 'soft' && 'bg-mint text-primary-strong hover:brightness-[0.98] dark:hover:brightness-110',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-text',
        variant === 'danger' && 'border border-danger/30 bg-danger-soft text-danger hover:border-danger/60',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Tooltip text={label}>
      <button
        {...rest}
        aria-label={label}
        className={cx('no-drag grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-text active:scale-95', className)}
      >
        {children}
      </button>
    </Tooltip>
  )
}

export function Card({ className, children, interactive, ...rest }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      {...rest}
      className={cx(
        'rounded-3xl border border-border bg-surface shadow-card',
        interactive && 'transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-pop',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'no-drag relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40',
        checked ? 'bg-primary' : 'bg-border',
      )}
    >
      <span className={cx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="no-drag inline-flex rounded-xl bg-surface-2 p-1" role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg font-semibold transition-all',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-[13px]',
            o.value === value ? 'bg-surface text-text shadow-card' : 'text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Select<T extends string | number>({ value, options, onChange, label, className }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <select
      aria-label={label}
      value={String(value)}
      onChange={(e) => {
        const o = options.find((x) => String(x.value) === e.target.value)
        if (o) onChange(o.value)
      }}
      className={cx(
        'no-drag h-10 cursor-pointer appearance-none rounded-xl border border-border bg-surface bg-[length:16px] bg-[right_10px_center] bg-no-repeat pl-3 pr-9 text-sm font-medium text-text transition hover:border-primary/50 focus:border-primary focus:outline-none',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23829087' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function NumberField({ value, onChange, min, max, suffix, label, step = 1 }: { value: number; onChange: (v: number) => void; min: number; max: number; suffix?: string; label: string; step?: number }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = (raw: string) => {
    const n = Math.round(Number(raw))
    if (!Number.isFinite(n)) return setDraft(String(value))
    const c = Math.min(max, Math.max(min, n))
    setDraft(String(c))
    if (c !== value) onChange(c)
  }
  return (
    <div className="no-drag inline-flex h-10 items-center rounded-xl border border-border bg-surface transition focus-within:border-primary hover:border-primary/50">
      <button type="button" aria-label={`Decrease ${label}`} className="h-full px-2.5 text-muted hover:text-text disabled:opacity-30" disabled={value <= min} onClick={() => commit(String(value - step))}>
        −
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
        className="tabular w-10 bg-transparent text-center text-sm font-semibold outline-none"
      />
      {suffix && <span className="pr-1 text-xs text-muted">{suffix}</span>}
      <button type="button" aria-label={`Increase ${label}`} className="h-full px-2.5 text-muted hover:text-text disabled:opacity-30" disabled={value >= max} onClick={() => commit(String(value + step))}>
        +
      </button>
    </div>
  )
}

export function TimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="no-drag tabular h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text transition hover:border-primary/50 focus:border-primary focus:outline-none"
    />
  )
}

export function TextField({ value, onChange, label, placeholder, className }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; className?: string }) {
  return (
    <input
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cx('no-drag h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text placeholder:text-muted/70 transition hover:border-primary/50 focus:border-primary focus:outline-none', className)}
    />
  )
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const id = useId()
  return (
    <span className="group/tt relative inline-flex" aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg bg-text px-2 py-1 text-[11px] font-medium text-bg opacity-0 shadow-pop transition duration-150 group-hover/tt:translate-y-0 group-hover/tt:opacity-100 group-hover/tt:delay-300"
      >
        {text}
      </span>
    </span>
  )
}

export function ProgressBar({ value, color = 'var(--primary)', className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: color }} />
    </div>
  )
}

export function Ring({ value, size = 44, stroke = 5, color = 'var(--primary)', track = 'var(--surface-2)', children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="anim-fade-in fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={cx('anim-scale-in max-h-[90vh] w-full overflow-auto rounded-3xl border border-border bg-surface p-6 shadow-pop outline-none', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Confirm({ open, title, body, confirmLabel, onConfirm, onClose, danger }: { open: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm leading-relaxed text-muted">{body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export function Popover({ trigger, children, align = 'right', open, setOpen }: { trigger: ReactNode; children: ReactNode; align?: 'left' | 'right'; open: boolean; setOpen: (v: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])
  return (
    <div className="relative" ref={ref}>
      {trigger}
      {open && <div className={cx('anim-scale-in absolute top-full z-40 mt-2 min-w-56 rounded-2xl border border-border bg-surface p-1.5 shadow-pop', align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left')}>{children}</div>}
    </div>
  )
}

export function MenuItem({ icon, children, onClick, hint }: { icon?: ReactNode; children: ReactNode; onClick: () => void; hint?: string }) {
  return (
    <button onClick={onClick} className="no-drag flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-surface-2">
      {icon && <span className="text-muted">{icon}</span>}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </button>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

export function Badge({ children, tone = 'mint' }: { children: ReactNode; tone?: 'mint' | 'warning' | 'muted' | 'danger' | 'info' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tone === 'mint' && 'bg-mint text-primary-strong',
        tone === 'warning' && 'bg-warning-soft text-[#b07425] dark:text-warning',
        tone === 'muted' && 'bg-surface-2 text-muted',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'info' && 'bg-info-soft text-info',
      )}
    >
      {children}
    </span>
  )
}
