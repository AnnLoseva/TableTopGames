import { createClient } from '@/games/vampires/lib/supabase'
import {
  SESSION_LOG_ENTRIES,
  SESSION_LOG_LOCAL_KEY,
  SESSION_LOG_PUBLISHED,
  SESSION_LOG_PUBLISHED_LOCAL_KEY,
} from '../constants'
import {
  mapPublishedRow,
  mapSessionLogEntryRow,
  toPublishedProjection,
  toSessionLogEntryRow,
} from '../mappers'
import type {
  SessionLogEntry,
  SessionLogEntryRow,
  SessionLogPublished,
  SessionLogPublishedRow,
} from '../types'

const ENTRY_SELECT = 'id, chronicle_id, room, session_id, title, body_html, tags, visibility, status, shared_player_ids, attachments, version, created_by, created_at, updated_at'
const PUB_SELECT = 'entry_id, chronicle_id, room, session_id, title, body_html, tags, visibility, shared_player_ids, published_at, published_version'

function readLocalEntries(room: string): SessionLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SESSION_LOG_LOCAL_KEY(room))
    if (!raw) return []
    const parsed = JSON.parse(raw) as SessionLogEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalEntries(room: string, entries: SessionLogEntry[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_LOG_LOCAL_KEY(room), JSON.stringify(entries))
}

function readLocalPublished(room: string): SessionLogPublished[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SESSION_LOG_PUBLISHED_LOCAL_KEY(room))
    if (!raw) return []
    const parsed = JSON.parse(raw) as SessionLogPublished[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalPublished(room: string, rows: SessionLogPublished[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_LOG_PUBLISHED_LOCAL_KEY(room), JSON.stringify(rows))
}

export async function fetchMasterSessionLog(room: string): Promise<{
  entries: SessionLogEntry[]
  source: 'remote' | 'local'
}> {
  try {
    const { data, error } = await createClient()
      .from(SESSION_LOG_ENTRIES)
      .select(ENTRY_SELECT)
      .eq('room', room)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return {
      entries: (data || []).map(row => mapSessionLogEntryRow(row as SessionLogEntryRow)),
      source: 'remote',
    }
  } catch {
    return { entries: readLocalEntries(room), source: 'local' }
  }
}

/** Player path — published projection only, never draft body. */
export async function fetchPublishedSessionLog(room: string): Promise<SessionLogPublished[]> {
  const { data, error } = await createClient()
    .from(SESSION_LOG_PUBLISHED)
    .select(PUB_SELECT)
    .eq('room', room)
    .order('published_at', { ascending: false })
  if (error) throw error
  return (data || []).map(row => mapPublishedRow(row as SessionLogPublishedRow))
}

export type SaveEntryResult =
  | { ok: true; entry: SessionLogEntry; source: 'remote' | 'local' }
  | { ok: false; conflict: true; remote: SessionLogEntry }
  | { ok: false; conflict: false; error: string }

/**
 * Save with optimistic concurrency on version/updated_at.
 * Does not write on every keystroke — caller debounces.
 */
export async function saveSessionLogEntry(
  entry: SessionLogEntry,
  baseVersion: number,
): Promise<SaveEntryResult> {
  const next: SessionLogEntry = {
    ...entry,
    version: baseVersion + 1,
    updatedAt: new Date().toISOString(),
  }

  try {
    const client = createClient()
    // Conflict if remote version advanced past our base.
    const { data: existing, error: readError } = await client
      .from(SESSION_LOG_ENTRIES)
      .select(ENTRY_SELECT)
      .eq('id', entry.id)
      .maybeSingle()
    if (readError) throw readError
    if (existing) {
      const remote = mapSessionLogEntryRow(existing as SessionLogEntryRow)
      if (remote.version > baseVersion) {
        return { ok: false, conflict: true, remote }
      }
    }

    const { error } = await client
      .from(SESSION_LOG_ENTRIES)
      .upsert(toSessionLogEntryRow(next), { onConflict: 'id' })
    if (error) throw error
    return { ok: true, entry: next, source: 'remote' }
  } catch (err) {
    // Local fallback: still check local version
    const all = readLocalEntries(entry.room)
    const local = all.find(item => item.id === entry.id)
    if (local && local.version > baseVersion) {
      return { ok: false, conflict: true, remote: local }
    }
    writeLocalEntries(entry.room, [next, ...all.filter(item => item.id !== entry.id)])
    return { ok: true, entry: next, source: 'local' }
  }
}

export async function createSessionLogEntry(entry: SessionLogEntry): Promise<SaveEntryResult> {
  return saveSessionLogEntry(entry, 0)
}

export async function publishSessionLogEntry(entry: SessionLogEntry): Promise<SessionLogEntry> {
  if (entry.visibility === 'private') {
    throw new Error('Сначала выберите visibility shared_all или shared_selected')
  }
  const projection = toPublishedProjection({
    ...entry,
    status: 'published',
  })
  if (!projection) throw new Error('Нельзя опубликовать private draft')

  const publishedEntry: SessionLogEntry = {
    ...entry,
    status: 'published',
    updatedAt: new Date().toISOString(),
    version: entry.version + 1,
  }

  try {
    const client = createClient()
    const { error: entryError } = await client
      .from(SESSION_LOG_ENTRIES)
      .upsert(toSessionLogEntryRow(publishedEntry), { onConflict: 'id' })
    if (entryError) throw entryError

    const { error: pubError } = await client.from(SESSION_LOG_PUBLISHED).upsert({
      entry_id: projection.entryId,
      chronicle_id: projection.chronicleId,
      room: projection.room,
      session_id: projection.sessionId,
      title: projection.title,
      body_html: projection.bodyHtml,
      tags: projection.tags,
      visibility: projection.visibility,
      shared_player_ids: projection.sharedPlayerIds,
      published_at: projection.publishedAt,
      published_version: publishedEntry.version,
    }, { onConflict: 'entry_id' })
    if (pubError) throw pubError
    return publishedEntry
  } catch {
    // Local dual write
    const all = readLocalEntries(entry.room)
    writeLocalEntries(entry.room, [publishedEntry, ...all.filter(item => item.id !== entry.id)])
    const pubs = readLocalPublished(entry.room)
    writeLocalPublished(entry.room, [
      { ...projection, publishedVersion: publishedEntry.version },
      ...pubs.filter(item => item.entryId !== entry.id),
    ])
    return publishedEntry
  }
}

export async function unpublishSessionLogEntry(entry: SessionLogEntry): Promise<SessionLogEntry> {
  const next: SessionLogEntry = {
    ...entry,
    status: 'draft',
    visibility: 'private',
    version: entry.version + 1,
    updatedAt: new Date().toISOString(),
  }
  try {
    const client = createClient()
    await client.from(SESSION_LOG_PUBLISHED).delete().eq('entry_id', entry.id)
    const { error } = await client
      .from(SESSION_LOG_ENTRIES)
      .upsert(toSessionLogEntryRow(next), { onConflict: 'id' })
    if (error) throw error
    return next
  } catch {
    const all = readLocalEntries(entry.room)
    writeLocalEntries(entry.room, [next, ...all.filter(item => item.id !== entry.id)])
    writeLocalPublished(
      entry.room,
      readLocalPublished(entry.room).filter(item => item.entryId !== entry.id),
    )
    return next
  }
}

export async function archiveSessionLogEntry(entry: SessionLogEntry): Promise<SessionLogEntry> {
  const next: SessionLogEntry = {
    ...entry,
    status: 'archived',
    version: entry.version + 1,
    updatedAt: new Date().toISOString(),
  }
  try {
    await createClient().from(SESSION_LOG_PUBLISHED).delete().eq('entry_id', entry.id)
    const { error } = await createClient()
      .from(SESSION_LOG_ENTRIES)
      .upsert(toSessionLogEntryRow(next), { onConflict: 'id' })
    if (error) throw error
    return next
  } catch {
    const all = readLocalEntries(entry.room)
    writeLocalEntries(entry.room, [next, ...all.filter(item => item.id !== entry.id)])
    writeLocalPublished(
      entry.room,
      readLocalPublished(entry.room).filter(item => item.entryId !== entry.id),
    )
    return next
  }
}
