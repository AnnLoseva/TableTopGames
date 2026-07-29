import type { MasterSearchHit } from './types'

const HISTORY_KEY = (room: string) => `vtm-master-search-history:${room}`
const RECENT_KEY = (room: string) => `vtm-master-search-recent:${room}`
const MAX_HISTORY = 12
const MAX_RECENT = 10

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota
  }
}

export function loadSearchHistory(room: string): string[] {
  const list = readJson<string[]>(HISTORY_KEY(room), [])
  return Array.isArray(list) ? list.filter(item => typeof item === 'string') : []
}

export function pushSearchHistory(room: string, query: string) {
  const q = query.trim()
  if (!q || q.length < 2) return
  const prev = loadSearchHistory(room).filter(item => item.toLowerCase() !== q.toLowerCase())
  writeJson(HISTORY_KEY(room), [q, ...prev].slice(0, MAX_HISTORY))
}

export function loadRecentHits(room: string): MasterSearchHit[] {
  const list = readJson<MasterSearchHit[]>(RECENT_KEY(room), [])
  return Array.isArray(list) ? list : []
}

export function pushRecentHit(room: string, hit: MasterSearchHit) {
  const prev = loadRecentHits(room).filter(item => item.id !== hit.id)
  writeJson(RECENT_KEY(room), [hit, ...prev].slice(0, MAX_RECENT))
}

export function clearSearchHistory(room: string) {
  writeJson(HISTORY_KEY(room), [])
}
