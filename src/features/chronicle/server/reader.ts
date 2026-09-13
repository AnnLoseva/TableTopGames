import 'server-only'
import { CHRONICLE_PUBLISHED_VIEW } from '../constants'
import { mapPublicChapterRow } from '../mappers'
import type { PublicChapter, PublicChapterRow } from '../types'
import { createChronicleServerClient } from './client'

const PUBLIC_COLUMNS = 'id, title, slug, chapter_number, content, content_text, timeline_year, timeline_month, timeline_day, timeline_label, cover_image, published_at'

/**
 * Everything the reader is allowed to see, in reading order (chapter number),
 * which is deliberately *not* chronological order — the story jumps around the
 * timeline and that is the point.
 *
 * Every reader query goes through the `chronicle_published_chapters` view.
 * Drafts and `author_notes` are not filtered out here; they are unreachable —
 * the anon role has no access to the underlying table at all.
 */
export async function listPublishedChapters(): Promise<PublicChapter[]> {
  const client = await createChronicleServerClient()
  const { data, error } = await client
    .from(CHRONICLE_PUBLISHED_VIEW)
    .select(PUBLIC_COLUMNS)
    .order('chapter_number', { ascending: true })
  if (error) throw error
  return (data as PublicChapterRow[] ?? []).map(mapPublicChapterRow)
}

export async function getPublishedChapter(slug: string): Promise<PublicChapter | null> {
  const client = await createChronicleServerClient()
  const { data, error } = await client
    .from(CHRONICLE_PUBLISHED_VIEW)
    .select(PUBLIC_COLUMNS)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data ? mapPublicChapterRow(data as PublicChapterRow) : null
}

export type ChapterNeighbours = {
  previous: Pick<PublicChapter, 'slug' | 'title' | 'number'> | null
  next: Pick<PublicChapter, 'slug' | 'title' | 'number'> | null
}

/** Previous/next in *reading* order, for the chapter footer. */
export function findNeighbours(chapters: PublicChapter[], slug: string): ChapterNeighbours {
  const index = chapters.findIndex(chapter => chapter.slug === slug)
  if (index === -1) return { previous: null, next: null }
  const brief = (chapter: PublicChapter | undefined) => (chapter
    ? { slug: chapter.slug, title: chapter.title, number: chapter.number }
    : null)
  return { previous: brief(chapters[index - 1]), next: brief(chapters[index + 1]) }
}
