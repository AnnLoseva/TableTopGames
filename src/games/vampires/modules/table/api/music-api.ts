/**
 * Table module API: room-level music playback state (table_music) and scene audio uploads.
 * Supabase I/O for music triggered from the campaign table lives here — not in GameTable.
 */
import { createClient } from '@/games/vampires/lib/supabase'
import type { MusicState } from '@/games/vampires/modules/music/types'
import {
  isMissingColumnError,
  safeStorageName,
  TABLE_MUSIC,
  TABLE_MUSIC_BUCKET,
  toLegacyMusicDbRow,
  toMusicDbRow,
} from '@/games/vampires/modules/music/utils'

let supportsExtendedTableMusicSchema = true

export async function upsertTableMusicState(state: MusicState) {
  let persistLegacyMusic = !supportsExtendedTableMusicSchema

  if (supportsExtendedTableMusicSchema) {
    const { error } = await createClient().from(TABLE_MUSIC).upsert(toMusicDbRow(state))
    if (isMissingColumnError(error)) {
      supportsExtendedTableMusicSchema = false
      persistLegacyMusic = true
    } else if (error) {
      console.error('Не удалось сохранить расширенное состояние музыки сцены:', error)
      persistLegacyMusic = true
    } else {
      return { error: null }
    }
  }

  if (persistLegacyMusic) {
    return createClient().from(TABLE_MUSIC).upsert(toLegacyMusicDbRow(state))
  }

  return { error: null }
}

export function buildSceneMusicStoragePath(
  room: string,
  sceneId: string,
  fileName: string,
  index: number,
) {
  const id = `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`
  const storagePath = `${room}/scenes/${sceneId}/${id}-${safeStorageName(fileName)}`
  return { id, storagePath }
}

export async function uploadSceneMusicAudioFile(
  room: string,
  sceneId: string,
  file: File,
  index: number,
) {
  const { id, storagePath } = buildSceneMusicStoragePath(room, sceneId, file.name, index)
  const supabase = createClient()
  const { error: uploadError } = await supabase.storage.from(TABLE_MUSIC_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'audio/mpeg',
  })

  if (uploadError) {
    return { error: uploadError, publicUrl: null as string | null, id, storagePath }
  }

  const { data: publicUrlData } = supabase.storage.from(TABLE_MUSIC_BUCKET).getPublicUrl(storagePath)
  return { error: null, publicUrl: publicUrlData.publicUrl, id, storagePath }
}