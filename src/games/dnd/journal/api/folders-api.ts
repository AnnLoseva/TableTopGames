import { createAccountClient } from '@/platform/account/supabase'
import { DND_JOURNAL_FOLDERS_TABLE, DND_JOURNAL_PAGES_TABLE } from '../constants'
import { mapFolderRow } from '../mappers'
import type { DndJournalCategory, DndJournalFolder, DndJournalFolderRow } from '../types'

const FOLDER_COLUMNS = 'id, user_id, section_id, parent_folder_id, name, sort_order, created_at, updated_at, deleted_at'

type JournalClient = ReturnType<typeof createAccountClient>

async function requireUserId(client: JournalClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Нужен вход в общий аккаунт TableTopGames.')
  return data.user.id
}

export async function listJournalFolders(client: JournalClient): Promise<DndJournalFolder[]> {
  const { data, error } = await client
    .from(DND_JOURNAL_FOLDERS_TABLE)
    .select(FOLDER_COLUMNS)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data as DndJournalFolderRow[] ?? []).map(mapFolderRow)
}

export async function createJournalFolder(
  client: JournalClient,
  input: {
    sectionId: DndJournalCategory
    parentFolderId: string | null
    name: string
    sortOrder: number
  },
): Promise<DndJournalFolder> {
  const userId = await requireUserId(client)
  const nowIso = new Date().toISOString()
  const { data, error } = await client
    .from(DND_JOURNAL_FOLDERS_TABLE)
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      section_id: input.sectionId,
      parent_folder_id: input.parentFolderId,
      name: input.name.trim(),
      sort_order: input.sortOrder,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select(FOLDER_COLUMNS)
    .single()
  if (error || !data) throw error || new Error('Не удалось создать папку.')
  return mapFolderRow(data as DndJournalFolderRow)
}

export async function renameJournalFolder(
  client: JournalClient,
  id: string,
  name: string,
): Promise<DndJournalFolder> {
  const { data, error } = await client
    .from(DND_JOURNAL_FOLDERS_TABLE)
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(FOLDER_COLUMNS)
    .single()
  if (error || !data) throw error || new Error('Не удалось переименовать папку.')
  return mapFolderRow(data as DndJournalFolderRow)
}

/**
 * Soft-deletes one folder without destroying content: direct pages and child
 * folders move to the section root first. This mirrors the app's safe default.
 */
export async function softDeleteJournalFolder(client: JournalClient, id: string): Promise<void> {
  const nowIso = new Date().toISOString()
  const pageMove = await client
    .from(DND_JOURNAL_PAGES_TABLE)
    .update({ folder_id: null, updated_at: nowIso })
    .eq('folder_id', id)
  if (pageMove.error) throw pageMove.error

  const childMove = await client
    .from(DND_JOURNAL_FOLDERS_TABLE)
    .update({ parent_folder_id: null, updated_at: nowIso })
    .eq('parent_folder_id', id)
  if (childMove.error) throw childMove.error

  const deletion = await client
    .from(DND_JOURNAL_FOLDERS_TABLE)
    .update({ deleted_at: nowIso, updated_at: nowIso })
    .eq('id', id)
  if (deletion.error) throw deletion.error
}
