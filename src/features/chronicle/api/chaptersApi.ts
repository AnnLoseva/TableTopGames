import { CHRONICLE_CHAPTERS_TABLE, EMPTY_CHAPTER_DOC, slugify, uniqueSlug } from '../constants'
import { mapChapterRow } from '../mappers'
import { createChronicleClient } from '../supabase'
import type { Chapter, ChapterPatch, ChapterRow } from '../types'

type ChronicleClient = ReturnType<typeof createChronicleClient>

const CHAPTER_COLUMNS = 'id, user_id, title, slug, chapter_number, content, content_text, status, timeline_year, timeline_month, timeline_day, timeline_label, timeline_snapshot_id, author_notes, cover_image, created_at, updated_at, published_at'

async function requireUserId(client: ChronicleClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Нужен вход в аккаунт автора.')
  return data.user.id
}

/** Author-side listing: drafts included, in reading order. */
export async function listChapters(client: ChronicleClient): Promise<Chapter[]> {
  const { data, error } = await client
    .from(CHRONICLE_CHAPTERS_TABLE)
    .select(CHAPTER_COLUMNS)
    .order('chapter_number', { ascending: true })
  if (error) throw error
  return (data as ChapterRow[] ?? []).map(mapChapterRow)
}

export async function getChapter(client: ChronicleClient, id: string): Promise<Chapter | null> {
  const { data, error } = await client
    .from(CHRONICLE_CHAPTERS_TABLE)
    .select(CHAPTER_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapChapterRow(data as ChapterRow) : null
}

export async function createChapter(
  client: ChronicleClient,
  input: { title: string; number: number; year: number | null },
): Promise<Chapter> {
  const userId = await requireUserId(client)
  const existing = await listChapters(client)
  const slug = uniqueSlug(slugify(input.title), existing.map(chapter => chapter.slug))
  const { data, error } = await client
    .from(CHRONICLE_CHAPTERS_TABLE)
    .insert({
      user_id: userId,
      title: input.title,
      slug,
      chapter_number: input.number,
      content: EMPTY_CHAPTER_DOC,
      content_text: '',
      status: 'draft',
      timeline_year: input.year,
    })
    .select(CHAPTER_COLUMNS)
    .single()
  if (error || !data) throw error || new Error('Не удалось создать главу.')
  return mapChapterRow(data as ChapterRow)
}

function buildPayload(patch: ChapterPatch): Record<string, unknown> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.title !== undefined) payload.title = patch.title
  if (patch.slug !== undefined) payload.slug = patch.slug
  if (patch.number !== undefined) payload.chapter_number = patch.number
  if (patch.content !== undefined) payload.content = patch.content
  if (patch.contentText !== undefined) payload.content_text = patch.contentText
  if (patch.authorNotes !== undefined) payload.author_notes = patch.authorNotes
  if (patch.coverImage !== undefined) payload.cover_image = patch.coverImage
  if (patch.moment !== undefined) {
    payload.timeline_year = patch.moment.year
    payload.timeline_month = patch.moment.month
    payload.timeline_day = patch.moment.day
    payload.timeline_label = patch.moment.label
    payload.timeline_snapshot_id = patch.moment.snapshotId
  }
  if (patch.status !== undefined) {
    payload.status = patch.status
    // `published_at` is the reader-facing date; keep the first publish date
    // when re-publishing is just a toggle back on.
    if (patch.status === 'published') payload.published_at = new Date().toISOString()
  }
  return payload
}

export async function updateChapter(
  client: ChronicleClient,
  id: string,
  patch: ChapterPatch,
): Promise<Chapter> {
  const { data, error } = await client
    .from(CHRONICLE_CHAPTERS_TABLE)
    .update(buildPayload(patch))
    .eq('id', id)
    .select(CHAPTER_COLUMNS)
    .single()
  if (error || !data) {
    // The CHECK constraint from chronicle.sql is the real guard against
    // publishing a chapter with no place on the timeline.
    if (error?.message?.includes('chronicle_chapters_published_needs_year')) {
      throw new Error('Чтобы опубликовать главу, укажите год на шкале времени.')
    }
    if (error?.code === '23505') throw new Error('Такой адрес (slug) уже занят другой главой.')
    throw error || new Error('Не удалось сохранить главу.')
  }
  return mapChapterRow(data as ChapterRow)
}

export async function deleteChapter(client: ChronicleClient, id: string): Promise<void> {
  const { error } = await client.from(CHRONICLE_CHAPTERS_TABLE).delete().eq('id', id)
  if (error) throw error
}
