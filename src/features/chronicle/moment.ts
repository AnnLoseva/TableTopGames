import { formatEventDate } from '@/features/characters_map/timeline'
import type { ChapterMoment } from './types'

/**
 * A chapter's in-world moment, formatted for display: `1931`, `март 1931`,
 * `12 марта 1931`.
 *
 * Reuses the relationship map's pure date formatter on purpose — the chronicle
 * and the map must agree on what a date *is*, since a chapter hands its moment
 * straight to the map's timeline. The dependency only ever points this way:
 * `characters_map` knows nothing about the chronicle.
 */
export function formatMoment(
  moment: { year: number | null; month: number | null; day: number | null },
): string {
  if (moment.year === null) return ''
  return formatEventDate({ year: moment.year, month: moment.month, day: moment.day }, 'ru')
}

/** `?year=1931&month=3&day=12` for the map's deep link. */
export function momentQuery(moment: ChapterMoment, chapterId: string): string {
  const params = new URLSearchParams()
  if (moment.year !== null) params.set('year', String(moment.year))
  if (moment.month !== null) params.set('month', String(moment.month))
  if (moment.day !== null) params.set('day', String(moment.day))
  params.set('chapter', chapterId)
  return params.toString()
}
