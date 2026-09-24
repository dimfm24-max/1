export type BrowserSessionState = 'authenticated' | 'cleared'

export type BrowserSessionEvent = {
  epoch: string
  state: BrowserSessionState
}

const sessionEventStorageKey = 'dilife:auth-session-event'
let currentSessionEvent: BrowserSessionEvent = {
  epoch: 'initial',
  state: 'cleared',
}

export function currentBrowserSessionEpoch() {
  const storedEvent = readStoredSessionEvent()
  if (storedEvent) currentSessionEvent = storedEvent
  return currentSessionEvent.epoch
}

export function isBrowserSessionEpochCurrent(epoch: string) {
  return currentBrowserSessionEpoch() === epoch
}

export function publishBrowserSessionState(state: BrowserSessionState): BrowserSessionEvent {
  const event = {
    epoch: createEpoch(),
    state,
  } satisfies BrowserSessionEvent
  currentSessionEvent = event

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(sessionEventStorageKey, JSON.stringify(event))
    } catch {
      // Restricted browser contexts can block storage; the local epoch still protects this tab.
    }
  }

  return event
}

export function subscribeToBrowserSessionChanges(
  listener: (event: BrowserSessionEvent) => void,
) {
  if (typeof window === 'undefined') return () => undefined

  const handleStorage = (storageEvent: StorageEvent) => {
    if (storageEvent.key !== sessionEventStorageKey) return

    const sessionEvent = parseSessionEvent(storageEvent.newValue)
    if (!sessionEvent) return

    currentSessionEvent = sessionEvent
    listener(sessionEvent)
  }

  window.addEventListener('storage', handleStorage)
  return () => window.removeEventListener('storage', handleStorage)
}

const accountChangedStorageKey = 'dilife:account-changed'

/**
 * Tells the other tabs of this browser that the account itself changed - the address got
 * confirmed - so they reload it. The session stays the same; only its data is stale.
 */
export function publishAccountChanged() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(accountChangedStorageKey, String(Date.now()))
  } catch {
    // Blocked storage: other tabs catch up on their next load of the account.
  }
}

export function subscribeToAccountChanges(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined

  const handleStorage = (storageEvent: StorageEvent) => {
    if (storageEvent.key === accountChangedStorageKey) listener()
  }

  window.addEventListener('storage', handleStorage)
  return () => window.removeEventListener('storage', handleStorage)
}

function readStoredSessionEvent() {
  if (typeof localStorage === 'undefined') return null

  try {
    return parseSessionEvent(localStorage.getItem(sessionEventStorageKey))
  } catch {
    return null
  }
}

function parseSessionEvent(value: string | null): BrowserSessionEvent | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<BrowserSessionEvent>
    if (
      typeof parsed.epoch !== 'string' ||
      (parsed.state !== 'authenticated' && parsed.state !== 'cleared')
    ) {
      return null
    }
    return { epoch: parsed.epoch, state: parsed.state }
  } catch {
    return null
  }
}

function createEpoch() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}:${Math.random().toString(36).slice(2)}`
}
