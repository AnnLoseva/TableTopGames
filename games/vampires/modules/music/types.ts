import type { MutableRefObject } from 'react'
import type { Module } from '@/core/hub'

export type MusicModule = Module<'music', 'vtm5'>

export type MusicProvider = 'none' | 'youtube' | 'file'

export type MusicState = {
  room: string
  url: string
  activeUri: string
  isPlaying: boolean
  positionSeconds: number
  updatedAt: string
  provider?: MusicProvider
  playlistId?: string
  playlistIndex?: number
  trackId?: string
  sourceType?: string
}

export type MusicRow = {
  room: string
  url: string
  active_uri: string | null
  is_playing: boolean | null
  position_seconds: number | null
  updated_at: string
  provider?: MusicProvider | 'spotify' | null
  playlist_id?: string | null
  playlist_index?: number | null
  track_id?: string | null
  source_type?: string | null
}

export type MusicLibraryItem = {
  id: string
  room: string
  itemType: 'track' | 'folder'
  parentId: string | null
  name: string
  url: string
  autoplay?: boolean
  createdAt: string
}

export type MusicLibraryRow = {
  id: string
  room: string
  item_type: 'track' | 'folder' | null
  parent_id: string | null
  name: string
  url: string | null
  autoplay?: boolean | null
  created_at: string
}

export type MusicTreeNode = MusicLibraryItem & {
  children: MusicTreeNode[]
}

export type MusicDropTarget = {
  id: string | null
} | null

export type YouTubePlayerStateEvent = {
  data: number
  target: YouTubePlayer
}

export type YouTubePlayer = {
  loadVideoById?: (options: { videoId: string; startSeconds?: number }) => void
  cueVideoById?: (options: { videoId: string; startSeconds?: number }) => void
  loadPlaylist?: (options: { list: string; listType?: string; index?: number; startSeconds?: number }) => void
  cuePlaylist?: (options: { list: string; listType?: string; index?: number; startSeconds?: number }) => void
  nextVideo?: () => void
  previousVideo?: () => void
  setLoop?: (loopPlaylists: boolean) => void
  setShuffle?: (shufflePlaylist: boolean) => void
  playVideo?: () => void
  pauseVideo?: () => void
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void
  setVolume?: (volume: number) => void
  getCurrentTime?: () => number
  getPlayerState?: () => number
  getPlaylistIndex?: () => number
  getVideoData?: () => { video_id?: string }
  getIframe?: () => HTMLIFrameElement
  destroy: () => void
}

export type YouTubeIframeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId?: string
      height?: string | number
      width?: string | number
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (event: { target: YouTubePlayer }) => void
        onStateChange?: (event: YouTubePlayerStateEvent) => void
        onAutoplayBlocked?: () => void
      }
    }
  ) => YouTubePlayer
}

export type MusicAdapterStateChange = Partial<Omit<MusicState, 'room' | 'updatedAt' | 'url' | 'provider'>> & {
  url?: string
  provider?: MusicProvider
  playbackEnded?: boolean
}

export type MusicSyncAdapter = {
  mount: (container: HTMLElement) => void | Promise<void>
  load: (state: MusicState) => void | Promise<void>
  play: () => void
  pause: () => void
  seek: (seconds: number) => void
  getPosition?: () => number
  setVolume?: (volume: number) => void
  destroy: () => void
  onStateChange: (callback: (patch: MusicAdapterStateChange) => void) => () => void
}

export type MusicChannel = {
  send: (args: { type: 'broadcast'; event: string; payload: unknown }) => Promise<unknown> | unknown
  httpSend?: (event: string, payload: unknown, options?: { timeout?: number }) => Promise<unknown> | unknown
}

export type MusicChannelRef = MutableRefObject<MusicChannel | null>
