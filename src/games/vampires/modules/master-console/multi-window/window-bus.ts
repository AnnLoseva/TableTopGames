import type { MasterWindowSignal } from './types'

const CHANNEL_PREFIX = 'vtm-master-window'
const STORAGE_KEY_PREFIX = 'vtm-master-window-signal'

function channelName(room: string) {
  return `${CHANNEL_PREFIX}:${room}`
}

function storageKey(room: string) {
  return `${STORAGE_KEY_PREFIX}:${room}`
}

export function createWindowId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `win-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Cross-window bus for the same browser profile.
 * Prefers BroadcastChannel; falls back to localStorage events.
 * Payload must stay small — ids/versions only, never module state blobs.
 */
export function createMasterWindowBus(room: string) {
  const listeners = new Set<(signal: MasterWindowSignal) => void>()
  let channel: BroadcastChannel | null = null
  let disposed = false

  const emit = (signal: MasterWindowSignal) => {
    if (disposed) return
    listeners.forEach(listener => {
      try {
        listener(signal)
      } catch (err) {
        console.warn('[master-window-bus] listener error', err)
      }
    })
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey(room) || !event.newValue) return
    try {
      const parsed = JSON.parse(event.newValue) as MasterWindowSignal & { _ts?: number }
      emit(parsed)
    } catch {
      // ignore
    }
  }

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(channelName(room))
      channel.onmessage = (event: MessageEvent<MasterWindowSignal>) => {
        if (event.data?.type) emit(event.data)
      }
    } catch {
      channel = null
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
  }

  return {
    post(signal: MasterWindowSignal) {
      if (disposed) return
      // Size guard — reject accidental fat payloads
      try {
        const raw = JSON.stringify(signal)
        if (raw.length > 4096) {
          console.warn('[master-window-bus] signal too large, dropped', signal.type)
          return
        }
      } catch {
        return
      }

      if (channel) {
        try {
          channel.postMessage(signal)
        } catch {
          // fall through to storage
        }
      }
      if (typeof window !== 'undefined') {
        try {
          // storage event only fires in *other* windows
          window.localStorage.setItem(
            storageKey(room),
            JSON.stringify({ ...signal, _ts: Date.now() }),
          )
        } catch {
          // quota / private mode
        }
      }
    },
    subscribe(listener: (signal: MasterWindowSignal) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      disposed = true
      listeners.clear()
      if (channel) {
        try {
          channel.close()
        } catch {
          // ignore
        }
        channel = null
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage)
      }
    },
  }
}

export type MasterWindowBus = ReturnType<typeof createMasterWindowBus>
