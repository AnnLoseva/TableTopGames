import { upsertTableMusicState } from '@/games/vampires/modules/table/api/music-api'
import { getMusicProvider, parseYouTubeUrl } from '@/games/vampires/modules/music/utils'
import type { SceneMusicTrack } from '@/games/vampires/modules/table/types'

/**
 * Reuses room music state (table_music) — no second playback engine.
 * GlobalMusicEngineMount continues playback across master module switches.
 */
export async function playSceneMusicTrack(track: SceneMusicTrack, options: { play?: boolean } = { play: true }) {
  const provider = getMusicProvider(track.url)
  const youtube = provider === 'youtube' ? parseYouTubeUrl(track.url) : { videoId: '', playlistId: undefined }
  const now = new Date().toISOString()
  return upsertTableMusicState({
    room: track.room,
    url: track.url,
    activeUri: provider === 'youtube' ? youtube.playlistId || youtube.videoId : track.url,
    isPlaying: Boolean(options.play),
    positionSeconds: 0,
    updatedAt: now,
    provider,
    playlistId: youtube.playlistId,
    playlistIndex: youtube.playlistId ? Math.max(0, track.orderIndex) : undefined,
    trackId: youtube.videoId || undefined,
    sourceType: provider,
  })
}
