import { createAccountClient } from '@/platform/account/supabase'
import { DND_JOURNAL_PAGES_TABLE } from '../constants'
import { mapPageRow } from '../mappers'
import { mergeJournalBody } from '../merge'
import type { DndJournalPage, DndJournalPageEditablePatch, DndJournalPageRow, DndPageType } from '../types'

const PAGE_COLUMNS = 'id, user_id, title, body_markdown, type, aliases, is_favorite, is_pinned, is_archived, folder_id, sort_order, created_at, updated_at, deleted_at'

type JournalClient = ReturnType<typeof createAccountClient>

async function requireUserId(client: JournalClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Нужен вход в общий аккаунт TableTopGames.')
  return data.user.id
}

export async function listJournalPages(client: JournalClient): Promise<DndJournalPage[]> {
  const { data, error } = await client
    .from(DND_JOURNAL_PAGES_TABLE)
    .select(PAGE_COLUMNS)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as DndJournalPageRow[] ?? []).map(mapPageRow)
}

export async function createJournalPage(
  client: JournalClient,
  input: { title: string; type: DndPageType; bodyMarkdown?: string; folderId?: string | null; sortOrder?: number },
): Promise<DndJournalPage> {
  const userId = await requireUserId(client)
  const nowIso = new Date().toISOString()
  const { data, error } = await client
    .from(DND_JOURNAL_PAGES_TABLE)
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      title: input.title,
      body_markdown: input.bodyMarkdown ?? '',
      type: input.type,
      aliases: [],
      is_favorite: false,
      is_pinned: false,
      is_archived: false,
      folder_id: input.folderId ?? null,
      sort_order: input.sortOrder ?? 0,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select(PAGE_COLUMNS)
    .single()
  if (error || !data) throw error || new Error('Не удалось создать страницу журнала.')
  return mapPageRow(data as DndJournalPageRow)
}

/**
 * Reconciles `incomingBody` against whatever is currently persisted before
 * writing it, so a concurrent writer (another tab, or eventually the iPad
 * app) can't have its unique paragraphs silently overwritten. `baseline` is
 * the body this edit started from; if the row still matches it, nothing
 * changed underneath and the incoming text is written as-is (the common,
 * fast path). See `../merge.ts` for the paragraph-level policy.
 */
async function reconcileBodyMarkdown(
  client: JournalClient,
  id: string,
  incomingBody: string,
  baseline: string,
): Promise<string> {
  const { data, error } = await client
    .from(DND_JOURNAL_PAGES_TABLE)
    .select('body_markdown')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return incomingBody
  const currentBody = (data as { body_markdown: string }).body_markdown
  if (currentBody === baseline) return incomingBody
  return mergeJournalBody(currentBody, incomingBody)
}

export async function updateJournalPage(
  client: JournalClient,
  id: string,
  patch: DndJournalPageEditablePatch,
  options?: { baselineBodyMarkdown?: string },
): Promise<DndJournalPage> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.title !== undefined) row.title = patch.title
  if (patch.bodyMarkdown !== undefined) {
    row.body_markdown = options?.baselineBodyMarkdown !== undefined
      ? await reconcileBodyMarkdown(client, id, patch.bodyMarkdown, options.baselineBodyMarkdown)
      : patch.bodyMarkdown
  }
  if (patch.type !== undefined) row.type = patch.type
  if (patch.aliases !== undefined) row.aliases = patch.aliases
  if (patch.isFavorite !== undefined) row.is_favorite = patch.isFavorite
  if (patch.isPinned !== undefined) row.is_pinned = patch.isPinned
  if (patch.isArchived !== undefined) row.is_archived = patch.isArchived
  if (patch.folderId !== undefined) row.folder_id = patch.folderId
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder

  const { data, error } = await client
    .from(DND_JOURNAL_PAGES_TABLE)
    .update(row)
    .eq('id', id)
    .select(PAGE_COLUMNS)
    .single()
  if (error || !data) throw error || new Error('Не удалось сохранить страницу журнала.')
  return mapPageRow(data as DndJournalPageRow)
}

export async function softDeleteJournalPage(client: JournalClient, id: string): Promise<void> {
  const nowIso = new Date().toISOString()
  const { error } = await client
    .from(DND_JOURNAL_PAGES_TABLE)
    .update({ deleted_at: nowIso, updated_at: nowIso })
    .eq('id', id)
  if (error) throw error
}
