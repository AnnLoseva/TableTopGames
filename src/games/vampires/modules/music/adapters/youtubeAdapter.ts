import type { MusicAdapterStateChange, MusicState, MusicSyncAdapter, YouTubeIframeApi, YouTubePlayer, YouTubePlayerStateEvent } from '../types'
import { getEffectiveMusicPosition, getYouTubeId } from '../utils'

type YouTubeAdapterOptions = {
  isMaster: boolean
  volume: number
  onStatus: (status: string) => void
  canPublish: () => boolean
}

function loadYouTubeIframeApi() {
  return new Promise<YouTubeIframeApi>((resolve, reject) => {
    const win = window as typeof window & {
      YT?: YouTubeIframeApi
      __youtubeIframeApiResolvers?: Array<(api: YouTubeIframeApi) => void>
      onYouTubeIframeAPIReady?: () => void
    }

    if (win.YT?.Player) {
      resolve(win.YT)
      return
    }

    win.__youtubeIframeApiResolvers = win.__youtubeIframeApiResolvers || []
    win.__youtubeIframeApiResolvers.push(resolve)
    win.onYouTubeIframeAPIReady = () => {
      if (!win.YT?.Player) return
      win.__youtubeIframeApiResolvers?.splice(0).forEach(callback => callback(win.YT as YouTubeIframeApi))
    }

    if (document.querySelector('script[data-youtube-iframe-api="true"]')) return

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.dataset.youtubeIframeApi = 'true'
    script.onerror = () => reject(new Error('YouTube IFrame API failed to load'))
    document.body.appendChild(script)
  })
}

export class YouTubeAdapter implements MusicSyncAdapter {
  private container: HTMLElement | null = null
  private player: YouTubePlayer | null = null
  private state: MusicState | null = null
  private callback: ((patch: MusicAdapterStateChange) => void) | null = null
  private loadedKey = ''
  private lastPublishAt = 0
  private driftTimer: number | null = null
  private cancelled = false
  private suppressStateEventsUntil = 0

  constructor(private options: YouTubeAdapterOptions) {}

  mount(container: HTMLElement) {
    if (this.container === container) {
      this.cancelled = false
      void this.ensurePlayer()
      return
    }

    if (this.player) {
      this.suppressStateEventsUntil = Date.now() + 400
      const iframe = this.player.getIframe?.() || this.container?.querySelector('iframe') || container.querySelector('iframe')
      if (iframe) {
        if (!container.contains(iframe)) {
          container.innerHTML = ''
          container.appendChild(iframe)
        }
        this.container = container
        this.cancelled = false
        this.syncPlayer()
        return
      }

      this.player.destroy()
      this.player = null
      this.loadedKey = ''
    }

    this.container = container
    this.container.innerHTML = ''
    this.cancelled = false
    void this.ensurePlayer()
  }

  async load(state: MusicState) {
    this.state = state
    await this.ensurePlayer()
    if (this.player) this.syncPlayer()
  }

  play() {
    this.player?.playVideo?.()
  }

  pause() {
    this.player?.pauseVideo?.()
  }

  seek(seconds: number) {
    this.player?.seekTo?.(Math.max(0, Math.floor(seconds)), true)
    if (this.state?.isPlaying) this.player?.playVideo?.()
  }

  getPosition() {
    return Math.max(0, Math.floor(this.getPlayerTime()))
  }

  setVolume(volume: number) {
    this.options.volume = volume
    this.player?.setVolume?.(volume)
  }

  destroy() {
    this.cancelled = true
    this.suppressStateEventsUntil = Date.now() + 5000
    if (this.driftTimer !== null) window.clearInterval(this.driftTimer)
    this.driftTimer = null
    this.player?.destroy()
    this.player = null
    this.loadedKey = ''
  }

  onStateChange(callback: (patch: MusicAdapterStateChange) => void) {
    this.callback = callback
    return () => {
      if (this.callback === callback) this.callback = null
    }
  }

  private publishPatch(patch: MusicAdapterStateChange) {
    if (this.state) {
      this.state = {
        ...this.state,
        activeUri: patch.activeUri ?? this.state.activeUri,
        isPlaying: patch.isPlaying ?? this.state.isPlaying,
        positionSeconds: patch.positionSeconds ?? this.state.positionSeconds,
        playlistIndex: patch.playlistIndex ?? this.state.playlistIndex,
        trackId: patch.trackId ?? this.state.trackId,
        updatedAt: new Date().toISOString(),
      }
    }
    this.callback?.(patch)
  }

  private async ensurePlayer() {
    if (!this.container || !this.state || this.player) return
    const api = await loadYouTubeIframeApi()
    if (this.cancelled || !this.container || !this.state) return

    this.container.innerHTML = ''
    const playerHost = document.createElement('div')
    this.container.appendChild(playerHost)
    // For playlists, don't pass a videoId – syncPlayer will call loadPlaylist after onReady
    const initialVideoId = this.state.playlistId
      ? undefined
      : (this.state.trackId || getYouTubeId(this.state.url) || undefined)
    this.player = new api.Player(playerHost, {
      videoId: initialVideoId,
      width: '100%',
      height: 260,
      playerVars: {
        autoplay: 0,
        controls: this.options.isMaster ? 1 : 0,
        disablekb: this.options.isMaster ? 0 : 1,
        enablejsapi: 1,
        fs: 1,
        modestbranding: 1,
        origin: window.location.origin,
        playsinline: 1,
        rel: 0,
      },
      events: {
        onReady: event => {
          event.target.setVolume?.(this.options.volume)
          this.syncPlayer()
          this.startDriftCheck()
        },
        onStateChange: event => this.handlePlayerState(event),
        onAutoplayBlocked: () => {
          if (this.state?.isPlaying) this.options.onStatus('Нажми «Включить музыку», чтобы запустить звук')
        },
      },
    })
  }

  private getDesiredTrackId() {
    if (!this.state) return ''
    return this.state.trackId || (!this.state.playlistId ? this.state.activeUri || getYouTubeId(this.state.url) : '')
  }

  private getPlayerTime(player = this.player) {
    if (typeof player?.getCurrentTime !== 'function') {
      return this.state ? Math.max(0, Math.floor(getEffectiveMusicPosition(this.state))) : 0
    }
    return Math.max(0, player.getCurrentTime() || 0)
  }

  private syncPlayer() {
    if (!this.player || !this.state) return
    const positionSeconds = Math.max(0, Math.floor(getEffectiveMusicPosition(this.state)))
    const playlistId = this.state.playlistId
    const playlistIndex = this.state.playlistIndex ?? 0
    const trackId = this.getDesiredTrackId()
    const nextKey = playlistId ? `playlist:${playlistId}:${playlistIndex}` : `video:${trackId}`
    const currentVideoId = this.player.getVideoData?.()?.video_id || ''

    if (!playlistId && !trackId) {
      this.loadedKey = ''
      this.player.pauseVideo?.()
      return
    }

    if (playlistId && this.loadedKey !== nextKey) {
      const options = { list: playlistId, listType: 'playlist', index: playlistIndex, startSeconds: positionSeconds }
      if (this.state.isPlaying && this.player.loadPlaylist) this.player.loadPlaylist(options)
      else if (this.player.cuePlaylist) this.player.cuePlaylist(options)
      this.loadedKey = nextKey
      return
    }

    if (!playlistId && trackId && currentVideoId !== trackId) {
      if (this.state.isPlaying && this.player.loadVideoById) this.player.loadVideoById({ videoId: trackId, startSeconds: positionSeconds })
      else if (this.player.cueVideoById) this.player.cueVideoById({ videoId: trackId, startSeconds: positionSeconds })
      this.loadedKey = nextKey
      return
    }

    const currentPosition = this.getPlayerTime()
    const currentPlayerState = this.player.getPlayerState?.()
    const isActuallyPlaying = currentPlayerState === 1
    const isActuallyPaused = currentPlayerState === 2 || currentPlayerState === 5 || currentPlayerState === 0
    const seekThreshold = this.options.isMaster ? 4 : 2.25

    if (Math.abs(currentPosition - positionSeconds) > seekThreshold) {
      this.player.seekTo?.(positionSeconds, true)
    }

    if (this.state.isPlaying && !isActuallyPlaying) this.player.playVideo?.()
    if (!this.state.isPlaying && !isActuallyPaused) this.player.pauseVideo?.()
  }

  private handlePlayerState(event: YouTubePlayerStateEvent) {
    if (this.cancelled) return
    if (Date.now() < this.suppressStateEventsUntil) return
    if (event.data === 1) this.options.onStatus('Играет синхронно')
    if (event.data === 2 || event.data === 0) this.options.onStatus('Пауза')
    if (!this.options.isMaster || (event.data !== 0 && event.data !== 1 && event.data !== 2)) return
    if (!this.options.canPublish()) return

    const positionSeconds = Math.max(0, Math.floor(this.getPlayerTime(event.target)))
    const nextPlaying = event.data === 1
    const currentMusic = this.state
    if (!currentMusic) return

    const videoData = event.target.getVideoData?.() || {}
    const playlistIndex = typeof event.target.getPlaylistIndex === 'function' ? event.target.getPlaylistIndex() : currentMusic.playlistIndex
    const trackId = videoData.video_id || currentMusic.trackId
    const stateChanged = currentMusic.isPlaying !== nextPlaying
    const positionChanged = Math.abs(positionSeconds - getEffectiveMusicPosition(currentMusic)) > 1
    const playlistChanged = currentMusic.trackId !== trackId || currentMusic.playlistIndex !== playlistIndex
    const playbackEnded = event.data === 0

    if (stateChanged || positionChanged || playlistChanged || playbackEnded) {
      this.lastPublishAt = Date.now()
      this.publishPatch({
        isPlaying: nextPlaying,
        positionSeconds: playbackEnded ? 0 : positionSeconds,
        playlistIndex,
        trackId,
        activeUri: currentMusic.playlistId || trackId || currentMusic.activeUri,
        playbackEnded,
      })
    }
  }

  private startDriftCheck() {
    if (!this.options.isMaster || this.driftTimer !== null) return
    this.driftTimer = window.setInterval(() => {
      if (!this.player || !this.state || !this.options.canPublish()) return
      const now = Date.now()
      if (now - this.lastPublishAt < 900) return

      const positionSeconds = Math.max(0, Math.floor(this.getPlayerTime()))
      const expectedPosition = getEffectiveMusicPosition(this.state, now)
      if (Math.abs(positionSeconds - expectedPosition) <= 4) return

      this.lastPublishAt = now
      const videoData = this.player.getVideoData?.() || {}
      this.publishPatch({
        isPlaying: this.state.isPlaying,
        positionSeconds,
        playlistIndex: typeof this.player.getPlaylistIndex === 'function' ? this.player.getPlaylistIndex() : this.state.playlistIndex,
        trackId: videoData.video_id || this.state.trackId,
      })
    }, 1000)
  }
}
