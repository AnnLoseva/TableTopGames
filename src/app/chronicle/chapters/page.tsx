import type { Metadata } from 'next'
import ReaderHome from '@/features/chronicle/components/ReaderHome'
import { listPublishedChapters } from '@/features/chronicle/server/reader'
import { getSettings } from '@/features/chronicle/server/settings'

export const revalidate = 60

export const metadata: Metadata = { title: 'Все главы' }

export default async function ChronicleChaptersPage() {
  const [settings, chapters] = await Promise.all([getSettings(), listPublishedChapters()])
  return <ReaderHome settings={settings} chapters={chapters} />
}
