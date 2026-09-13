import type { Metadata } from 'next'
import { Suspense } from 'react'
import CharactersMapRoute from '@/features/characters_map/routes/CharactersMapRoute'
import { CHRONICLE_CHAPTERS_TABLE } from '@/features/chronicle/constants'
import { getAuthorSession } from '@/features/chronicle/server/auth'
import { createChronicleServerClient } from '@/features/chronicle/server/client'
import type { ChapterMark } from '@/features/characters_map/types'

export const metadata: Metadata = {
  title: 'Карта персонажей',
  description: 'Карта персонажей и их отношений друг с другом',
}

// The map reads owner-only data and shows the author's chapters, so it is never
// prerendered or cached.
export const dynamic = 'force-dynamic'

type ChapterRow = {
  id: string
  title: string
  chapter_number: number
  timeline_year: number | null
  timeline_month: number | null
  timeline_day: number | null
}

/**
 * Chapter markers for the map's timeline. Composed *here*, in the app layer,
 * on purpose: the chronicle may depend on the map (it reuses its date model),
 * never the other way round — so the map takes chapters as a plain prop and
 * knows nothing about where they come from.
 */
async function loadChapterMarks(): Promise<ChapterMark[]> {
  const session = await getAuthorSession()
  if (!session) return []
  const client = await createChronicleServerClient()
  const { data } = await client
    .from(CHRONICLE_CHAPTERS_TABLE)
    .select('id, title, chapter_number, timeline_year, timeline_month, timeline_day')
    .not('timeline_year', 'is', null)
    .order('timeline_year', { ascending: true })
  return ((data as ChapterRow[] | null) ?? [])
    .filter(row => row.timeline_year !== null)
    .map(row => ({
      id: row.id,
      title: row.title,
      number: row.chapter_number,
      year: row.timeline_year as number,
      month: row.timeline_month,
      day: row.timeline_day,
    }))
}

export default async function CharactersMapPage() {
  const chapterMarks = await loadChapterMarks()
  return (
    <Suspense fallback={null}>
      <CharactersMapRoute chapterMarks={chapterMarks} />
    </Suspense>
  )
}
