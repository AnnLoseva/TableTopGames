import type { ActorListFilter, SavedActorFilter } from '../types'
import { EMPTY_ACTOR_FILTER } from './actor-filters'

const storageKey = (room: string) => `vtm-master-actor-filters:${room}`

function isFilter(value: unknown): value is ActorListFilter {
  if (!value || typeof value !== 'object') return false
  const f = value as ActorListFilter
  return typeof f.query === 'string' && typeof f.sceneScope === 'string'
}

export function loadSavedActorFilters(room: string): SavedActorFilter[] {
  if (typeof window === 'undefined' || !room) return []
  try {
    const raw = window.localStorage.getItem(storageKey(room))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item): SavedActorFilter[] => {
      if (!item || typeof item !== 'object') return []
      const row = item as SavedActorFilter
      if (typeof row.id !== 'string' || typeof row.name !== 'string' || !isFilter(row.filter)) return []
      return [{ id: row.id, name: row.name, filter: { ...EMPTY_ACTOR_FILTER, ...row.filter } }]
    })
  } catch {
    return []
  }
}

export function saveSavedActorFilters(room: string, filters: readonly SavedActorFilter[]): void {
  if (typeof window === 'undefined' || !room) return
  window.localStorage.setItem(storageKey(room), JSON.stringify(filters))
}
