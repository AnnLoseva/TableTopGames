import ReaderHome from '@/features/chronicle/components/ReaderHome'
import { listPublishedChapters } from '@/features/chronicle/server/reader'
import { getSettings } from '@/features/chronicle/server/settings'

// Chapters change only when the author publishes; revalidate keeps the reader
// on a cached page without ever caching a draft (drafts are not readable here).
export const revalidate = 60

export default async function ChronicleHomePage() {
  const [settings, chapters] = await Promise.all([getSettings(), listPublishedChapters()])
  return <ReaderHome settings={settings} chapters={chapters} />
}
