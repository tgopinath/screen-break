// StorageManager — versioned localStorage persistence. Works identically in the
// browser and inside Electron (each has its own origin-scoped storage).

const PREFIX = 'screen-break:v1:'

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function memoryStore(): KeyValueStore {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  }
}

function resolveStore(): KeyValueStore {
  try {
    const ls = globalThis.localStorage
    const probe = PREFIX + 'probe'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return ls
  } catch {
    return memoryStore()
  }
}

export class StorageManager {
  constructor(private store: KeyValueStore = resolveStore()) {}

  load<T>(key: string, fallback: () => T, merge?: (stored: T, fresh: T) => T): T {
    try {
      const raw = this.store.getItem(PREFIX + key)
      if (!raw) return fallback()
      const parsed = JSON.parse(raw) as T
      return merge ? merge(parsed, fallback()) : parsed
    } catch {
      return fallback()
    }
  }

  save(key: string, value: unknown) {
    try {
      this.store.setItem(PREFIX + key, JSON.stringify(value))
    } catch (err) {
      console.warn('[storage] save failed', key, err)
    }
  }

  remove(key: string) {
    this.store.removeItem(PREFIX + key)
  }
}

/** Deep-merge stored settings over defaults so new fields get default values. */
export function mergeDefaults<T>(stored: T, fresh: T): T {
  if (Array.isArray(fresh) || typeof fresh !== 'object' || fresh === null) return (stored ?? fresh) as T
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return fresh
  const out: Record<string, unknown> = { ...(fresh as Record<string, unknown>) }
  for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
    const f = (fresh as Record<string, unknown>)[k]
    out[k] = f !== undefined && typeof f === 'object' && f !== null && !Array.isArray(f) ? mergeDefaults(v, f) : v
  }
  return out as T
}
