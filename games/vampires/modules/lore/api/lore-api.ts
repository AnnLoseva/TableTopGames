import { createClient } from '@/games/vampires/lib/supabase'
import {
  CHRONICLE_LORE_CATEGORIES,
  CHRONICLE_LORE_ENTRIES,
  CHRONICLE_LORE_ENTRY_PRIVATE,
  CHRONICLE_RANDOM_TABLES,
  CATEGORIES_LOCAL_KEY,
  LORE_LOCAL_KEY,
  TABLES_LOCAL_KEY,
} from '../constants'
import {
  mapLoreCategoryRow,
  mapLoreEntryRow,
  mapRandomTableRow,
  toLoreCategoryRow,
  toLoreEntryRow,
  toRandomTableRow,
} from '../mappers'
import type {
  LoreCategory,
  LoreCategoryRow,
  LoreEntry,
  LoreEntryPrivateRow,
  LoreEntryRow,
  RandomTable,
  RandomTableRowDb,
} from '../types'

const CAT_SELECT = 'id, chronicle_id, room, slug, title, kind, sort_order, created_at, updated_at'
const ENTRY_SELECT = 'id, chronicle_id, room, category_id, category_slug, title, short_summary, body_html, tags, visibility, status, attachments, created_by, created_at, updated_at'
const PRIVATE_SELECT = 'entry_id, chronicle_id, room, private_note, updated_at'
const TABLE_SELECT = 'id, chronicle_id, room, title, description, tags, visibility, dice_expression, rows, created_by, created_at, updated_at'

function readLocal<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocal<T>(key: string, rows: T[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(rows))
}

export async function fetchLoreCategories(room: string): Promise<{ categories: LoreCategory[]; source: 'remote' | 'local' }> {
  try {
    const { data, error } = await createClient()
      .from(CHRONICLE_LORE_CATEGORIES)
      .select(CAT_SELECT)
      .eq('room', room)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return {
      categories: (data || []).map(row => mapLoreCategoryRow(row as LoreCategoryRow)),
      source: 'remote',
    }
  } catch {
    return { categories: readLocal<LoreCategory>(CATEGORIES_LOCAL_KEY(room)), source: 'local' }
  }
}

export async function upsertLoreCategory(category: LoreCategory): Promise<'remote' | 'local'> {
  try {
    const { error } = await createClient()
      .from(CHRONICLE_LORE_CATEGORIES)
      .upsert(toLoreCategoryRow({ ...category, updatedAt: new Date().toISOString() }), { onConflict: 'id' })
    if (error) throw error
    return 'remote'
  } catch {
    const all = readLocal<LoreCategory>(CATEGORIES_LOCAL_KEY(category.room))
    writeLocal(CATEGORIES_LOCAL_KEY(category.room), [
      { ...category, updatedAt: new Date().toISOString() },
      ...all.filter(item => item.id !== category.id),
    ])
    return 'local'
  }
}

/**
 * Master load: entries + private notes for the room.
 * Player path must use fetchSharedLoreEntries instead.
 */
export async function fetchMasterLoreEntries(room: string): Promise<{ entries: LoreEntry[]; source: 'remote' | 'local' }> {
  try {
    const client = createClient()
    const [{ data, error }, privateResult] = await Promise.all([
      client.from(CHRONICLE_LORE_ENTRIES).select(ENTRY_SELECT).eq('room', room).order('updated_at', { ascending: false }),
      client.from(CHRONICLE_LORE_ENTRY_PRIVATE).select(PRIVATE_SELECT).eq('room', room),
    ])
    if (error) throw error
    if (privateResult.error) throw privateResult.error
    const privateById = new Map(
      (privateResult.data || []).map(row => {
        const privateRow = row as LoreEntryPrivateRow
        return [privateRow.entry_id, privateRow] as const
      }),
    )
    return {
      entries: (data || []).map(row => {
        const entryRow = row as LoreEntryRow
        return mapLoreEntryRow(entryRow, privateById.get(entryRow.id) || null)
      }),
      source: 'remote',
    }
  } catch {
    return { entries: readLocal<LoreEntry>(LORE_LOCAL_KEY(room)), source: 'local' }
  }
}

/** Player-safe: shared+published only, no private notes table access. */
export async function fetchSharedLoreEntries(room: string): Promise<LoreEntry[]> {
  const { data, error } = await createClient()
    .from(CHRONICLE_LORE_ENTRIES)
    .select(ENTRY_SELECT)
    .eq('room', room)
    .eq('visibility', 'shared')
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data || []).map(row => mapLoreEntryRow(row as LoreEntryRow, null))
}

export async function upsertLoreEntry(entry: LoreEntry): Promise<'remote' | 'local'> {
  try {
    const client = createClient()
    const row = toLoreEntryRow({ ...entry, updatedAt: new Date().toISOString() })
    const { error } = await client.from(CHRONICLE_LORE_ENTRIES).upsert(row, { onConflict: 'id' })
    if (error) throw error
    if (entry.privateNote !== undefined) {
      const { error: privateError } = await client.from(CHRONICLE_LORE_ENTRY_PRIVATE).upsert({
        entry_id: entry.id,
        chronicle_id: entry.chronicleId,
        room: entry.room,
        private_note: entry.privateNote || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'entry_id' })
      if (privateError) throw privateError
    }
    return 'remote'
  } catch {
    const all = readLocal<LoreEntry>(LORE_LOCAL_KEY(entry.room))
    writeLocal(LORE_LOCAL_KEY(entry.room), [
      { ...entry, updatedAt: new Date().toISOString() },
      ...all.filter(item => item.id !== entry.id),
    ])
    return 'local'
  }
}

export async function fetchRandomTables(room: string): Promise<{ tables: RandomTable[]; source: 'remote' | 'local' }> {
  try {
    const { data, error } = await createClient()
      .from(CHRONICLE_RANDOM_TABLES)
      .select(TABLE_SELECT)
      .eq('room', room)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return {
      tables: (data || []).map(row => mapRandomTableRow(row as RandomTableRowDb)),
      source: 'remote',
    }
  } catch {
    return { tables: readLocal<RandomTable>(TABLES_LOCAL_KEY(room)), source: 'local' }
  }
}

export async function upsertRandomTable(table: RandomTable): Promise<'remote' | 'local'> {
  try {
    const { error } = await createClient()
      .from(CHRONICLE_RANDOM_TABLES)
      .upsert(toRandomTableRow({ ...table, updatedAt: new Date().toISOString() }), { onConflict: 'id' })
    if (error) throw error
    return 'remote'
  } catch {
    const all = readLocal<RandomTable>(TABLES_LOCAL_KEY(table.room))
    writeLocal(TABLES_LOCAL_KEY(table.room), [
      { ...table, updatedAt: new Date().toISOString() },
      ...all.filter(item => item.id !== table.id),
    ])
    return 'local'
  }
}
