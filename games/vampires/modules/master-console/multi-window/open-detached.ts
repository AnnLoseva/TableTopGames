import { getMasterContribution } from '../contributions'
import type { OpenDetachedResult } from './types'

export type OpenDetachedOptions = {
  room: string
  moduleId?: string
  layoutId?: string
  entityId?: string
  entityType?: string
  /** Features string for window.open */
  features?: string
}

/**
 * Open master console in a separate browser window (second monitor workflow).
 * Uses window.open — popup blockers yield a clear error result.
 */
export function openDetachedMasterWindow(options: OpenDetachedOptions): OpenDetachedResult {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'invalid', message: 'window unavailable' }
  }
  const room = options.room.trim()
  if (!room) {
    return { ok: false, reason: 'invalid', message: 'room required' }
  }

  const url = new URL('/master', window.location.origin)
  url.searchParams.set('room', room)
  url.searchParams.set('display', 'detached')

  if (options.layoutId) {
    url.searchParams.set('layout', options.layoutId)
  }
  if (options.moduleId && getMasterContribution(options.moduleId)) {
    url.searchParams.set('module', options.moduleId)
  }
  if (options.entityId) {
    url.searchParams.set('entity', options.entityId)
    if (options.entityType) url.searchParams.set('entityType', options.entityType)
  }

  const features = options.features
    || 'popup=yes,width=1280,height=800,menubar=no,toolbar=no,location=yes,status=no'

  const win = window.open(url.toString(), `master-detached-${room}-${options.moduleId || options.layoutId || 'view'}`, features)
  if (!win) {
    return {
      ok: false,
      reason: 'popup-blocked',
      message: 'Браузер заблокировал всплывающее окно. Разрешите pop-up для этого сайта и попробуйте снова.',
    }
  }

  try {
    win.focus()
  } catch {
    // ignore
  }

  return { ok: true, window: win, url: url.toString() }
}

/** Stable Supabase channel key — same across remounts, unique per room+topic. */
export function masterRealtimeChannelKey(room: string, topic: string): string {
  return `master:${room}:${topic}`
}
