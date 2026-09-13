import { CHRONICLE_SETTINGS_TABLE, DEFAULT_SETTINGS } from '../constants'
import { createChronicleClient } from '../supabase'
import type { ChronicleSettings, ChronicleSettingsRow } from '../types'

type ChronicleClient = ReturnType<typeof createChronicleClient>

const SETTINGS_COLUMNS = 'id, title, subtitle, intro, show_year_to_reader, updated_at'

export async function loadSettings(client: ChronicleClient): Promise<ChronicleSettings> {
  const { data, error } = await client
    .from(CHRONICLE_SETTINGS_TABLE)
    .select(SETTINGS_COLUMNS)
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return DEFAULT_SETTINGS
  const row = data as ChronicleSettingsRow
  return {
    title: row.title,
    subtitle: row.subtitle,
    intro: row.intro,
    showYearToReader: row.show_year_to_reader,
  }
}

export async function saveSettings(
  client: ChronicleClient,
  settings: ChronicleSettings,
): Promise<ChronicleSettings> {
  const { data, error } = await client
    .from(CHRONICLE_SETTINGS_TABLE)
    .update({
      title: settings.title,
      subtitle: settings.subtitle,
      intro: settings.intro,
      show_year_to_reader: settings.showYearToReader,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select(SETTINGS_COLUMNS)
    .single()
  if (error || !data) throw error || new Error('Не удалось сохранить настройки.')
  const row = data as ChronicleSettingsRow
  return {
    title: row.title,
    subtitle: row.subtitle,
    intro: row.intro,
    showYearToReader: row.show_year_to_reader,
  }
}
