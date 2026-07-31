import { createAccountClient } from '@/platform/account/supabase'
import { DND_JOURNAL_IMAGES_BUCKET, DND_JOURNAL_IMAGES_TABLE } from '../constants'
import { mapImageRow } from '../mappers'
import type { DndJournalImage, DndJournalImageRow } from '../types'

const IMAGE_COLUMNS = 'id, user_id, page_id, name, storage_path, created_at, deleted_at'

type JournalClient = ReturnType<typeof createAccountClient>

async function requireUserId(client: JournalClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Нужен вход в общий аккаунт TableTopGames.')
  return data.user.id
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'image'
}

export async function listJournalImages(client: JournalClient, pageId: string): Promise<DndJournalImage[]> {
  const { data, error } = await client
    .from(DND_JOURNAL_IMAGES_TABLE)
    .select(IMAGE_COLUMNS)
    .eq('page_id', pageId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as DndJournalImageRow[] ?? []).map(mapImageRow)
}

/**
 * Every non-deleted journal image, regardless of page. Needed so `![[name]]`
 * embeds resolve the same way as on the iPad (global name lookup).
 */
export async function listAllJournalImages(client: JournalClient): Promise<DndJournalImage[]> {
  const { data, error } = await client
    .from(DND_JOURNAL_IMAGES_TABLE)
    .select(IMAGE_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as DndJournalImageRow[] ?? []).map(mapImageRow)
}

export async function uploadJournalImage(
  client: JournalClient,
  input: { pageId: string | null; name: string; file: File },
): Promise<DndJournalImage> {
  const userId = await requireUserId(client)
  const id = crypto.randomUUID()
  const storagePath = `${userId}/${id}-${sanitizeFileName(input.file.name)}`

  const upload = await client.storage
    .from(DND_JOURNAL_IMAGES_BUCKET)
    .upload(storagePath, input.file, { contentType: input.file.type, upsert: false })
  if (upload.error) throw upload.error

  const { data, error } = await client
    .from(DND_JOURNAL_IMAGES_TABLE)
    .insert({
      id,
      user_id: userId,
      page_id: input.pageId,
      name: input.name,
      storage_path: storagePath,
      created_at: new Date().toISOString(),
    })
    .select(IMAGE_COLUMNS)
    .single()
  if (error || !data) {
    await client.storage.from(DND_JOURNAL_IMAGES_BUCKET).remove([storagePath])
    throw error || new Error('Не удалось сохранить изображение.')
  }
  return mapImageRow(data as DndJournalImageRow)
}

export function getJournalImageUrl(client: JournalClient, storagePath: string): string {
  return client.storage.from(DND_JOURNAL_IMAGES_BUCKET).getPublicUrl(storagePath).data.publicUrl
}

export async function deleteJournalImage(client: JournalClient, image: DndJournalImage): Promise<void> {
  const { error } = await client
    .from(DND_JOURNAL_IMAGES_TABLE)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', image.id)
  if (error) throw error
  await client.storage.from(DND_JOURNAL_IMAGES_BUCKET).remove([image.storagePath])
}
