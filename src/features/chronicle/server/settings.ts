import 'server-only'
import { CHRONICLE_SETTINGS_TABLE, DEFAULT_SETTINGS } from '../constants'
import type { ChronicleSettings, ChronicleSettingsRow } from '../types'
import { createChronicleServerClient } from './client'

/** Public site copy. Falls back to defaults rather than failing the page. */
export async function getSettings(): Promise<ChronicleSettings> {
  const client = await createChronicleServerClient()
  const { data, error } = await client
    .from(CHRONICLE_SETTINGS_TABLE)
    .select('id, title, subtitle, intro, show_year_to_reader, updated_at')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return DEFAULT_SETTINGS
  const row = data as ChronicleSettingsRow
  return {
    title: row.title || DEFAULT_SETTINGS.title,
    subtitle: row.subtitle,
    intro: row.intro,
    showYearToReader: row.show_year_to_reader,
  }
}
