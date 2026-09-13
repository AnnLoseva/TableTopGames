import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ChapterPage from '@/features/chronicle/components/ChapterPage'
import { findNeighbours, getPublishedChapter, listPublishedChapters } from '@/features/chronicle/server/reader'
import { getSettings } from '@/features/chronicle/server/settings'

export const revalidate = 60

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const chapter = await getPublishedChapter(slug)
  if (!chapter) return { title: 'Глава не найдена' }
  return {
    title: chapter.title,
    description: chapter.contentText.slice(0, 160),
  }
}

export default async function ChronicleChapterPage({ params }: Params) {
  const { slug } = await params
  const [settings, chapter, chapters] = await Promise.all([
    getSettings(),
    getPublishedChapter(slug),
    listPublishedChapters(),
  ])
  // A draft (or a deleted chapter) is indistinguishable from a wrong URL here,
  // by design: the reader's query can only ever see published rows.
  if (!chapter) notFound()
  return <ChapterPage chapter={chapter} neighbours={findNeighbours(chapters, slug)} settings={settings} />
}
