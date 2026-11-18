export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="var(--primary)" />
      <path d="M6 16.5c3-5 6.5-7.2 10-7.2s7 2.2 10 7.2c-3 5-6.5 7.2-10 7.2s-7-2.2-10-7.2z" fill="none" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="16" cy="16.5" r="3.4" fill="white" />
      <path d="M22.5 6.5c1.6.4 2.6 1.4 3 3" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
    </svg>
  )
}
