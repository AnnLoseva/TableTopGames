import type { MusicAdapterStateChange, MusicState, MusicSyncAdapter } from '../types'
import { getEffectiveMusicPosition } from '../utils'

type LocalAudioAdapterOptions = {
  isMaster: boolean
  volume: number
  onStatus: (status: string) => void
  canPublish: () => boolean
}

export class LocalAudioAdapter implements MusicSyncAdapter {
  private container: HTMLElement | null = null
  private audio: HTMLAudioElement | null = null
  private state: MusicState | null = null
  private callback: ((patch: MusicAdapterStateChange) => void) | null = null
  private isDestroying = false
  private loadedUrl = ''
  private unsupportedUrl = ''
  private unlockNeededUrl = ''
  private suppressElementEventsUntil = 0

  constructor(private options: LocalAudioAdapterOptions) {}

  mount(container: HTMLElement) {
    if (this.container === container && this.audio) {
      this.audio.controls = true
      if (this.state) void this.load(this.state)
      return
    }

    this.audio?.remove()
    this.container = container
    container.innerHTML = ''
    this.audio = document.createElement('audio')
    this.audio.className = 'audio-player'
    this.audio.controls = true
    this.audio.addEventListener('play', () => this.publishElementState(true))
    this.audio.addEventListener('pause', () => this.publishElementState(false))
    this.audio.addEventListener('ended', () => this.publishElementState(false, true))
    this.audio.addEventListener('seeked', () => this.publishElementState(this.state?.isPlaying ?? false))
    this.audio.addEventListener('error', () => this.handleUnsupportedSource())
    container.appendChild(this.audio)
    if (this.state) void this.load(this.state)
  }

  load(state: MusicState) {
    this.state = state
    if (!this.audio || !state.url) return
    const duration = Number.isFinite(this.audio.duration) ? Math.max(0, this.audio.duration) : 0
    const rawPosition = Math.max(0, Math.floor(getEffectiveMusicPosition(state)))
    const positionSeconds = duration > 0 ? Math.min(rawPosition, Math.max(0, duration - 0.25)) : rawPosition
    if (this.loadedUrl !== state.url) {
      this.suppressElementEventsUntil = Date.now() + 500
      this.loadedUrl = state.url
      this.unsupportedUrl = ''
      this.unlockNeededUrl = ''
      this.audio.src = state.url
      this.audio.load()
    }
    this.audio.volume = this.options.volume / 100
    const seekThreshold = this.options.isMaster ? 3.5 : 1.8
    if (Math.abs(this.audio.currentTime - positionSeconds) > seekThreshold) {
      this.suppressElementEventsUntil = Date.now() + 300
      this.audio.currentTime = positionSeconds
    }

    if (state.isPlaying && this.audio.paused) {
      this.playAudio()
    } else if (!state.isPlaying && !this.audio.paused) {
      this.suppressElementEventsUntil = Date.now() + 300
      this.audio.pause()
    }
  }

  play() {
    this.playAudio({ force: true })
  }

  pause() {
    this.audio?.pause()
  }

  seek(seconds: number) {
    if (!this.audio) return
    const duration = Number.isFinite(this.audio.duration) ? Math.max(0, this.audio.duration) : 0
    this.audio.currentTime = duration > 0 ? Math.min(Math.max(0, Math.floor(seconds)), Math.max(0, duration - 0.25)) : Math.max(0, Math.floor(seconds))
    if (this.state?.isPlaying) this.playAudio()
  }

  getPosition() {
    return Math.max(0, Math.floor(this.audio?.currentTime || 0))
  }

  setVolume(volume: number) {
    this.options.volume = volume
    if (this.audio) this.audio.volume = volume / 100
  }

  destroy() {
    this.isDestroying = true
    this.audio?.pause()
    this.audio?.remove()
    this.container = null
    this.audio = null
    this.loadedUrl = ''
    this.unsupportedUrl = ''
    this.unlockNeededUrl = ''
    this.isDestroying = false
  }

  onStateChange(callback: (patch: MusicAdapterStateChange) => void) {
    this.callback = callback
    return () => {
      if (this.callback === callback) this.callback = null
    }
  }

  private publishElementState(isPlaying: boolean, playbackEnded = false) {
    if (this.isDestroying) return
    if (Date.now() < this.suppressElementEventsUntil) return
    if (!this.options.isMaster || !this.audio || !this.options.canPublish()) return
    const duration = Number.isFinite(this.audio.duration) ? Math.max(0, this.audio.duration) : 0
    const positionSeconds = Math.max(0, Math.floor(this.audio.currentTime || 0))
    const nextPosition = duration > 0 ? Math.min(positionSeconds, Math.floor(duration)) : positionSeconds
    if (this.state) {
      this.state = {
        ...this.state,
        isPlaying,
        positionSeconds: nextPosition,
        updatedAt: new Date().toISOString(),
      }
    }
    this.callback?.({
      isPlaying,
      positionSeconds: nextPosition,
      playbackEnded,
    })
  }

  private playAudio(options: { force?: boolean } = {}) {
    const url = this.state?.url || this.loadedUrl
    if (url && this.unsupportedUrl === url) {
      this.options.onStatus('Этот аудиофайл не поддерживается браузером')
      return
    }
    if (options.force && url && this.unlockNeededUrl === url) {
      this.unlockNeededUrl = ''
    }
    if (url && this.unlockNeededUrl === url) {
      this.options.onStatus('Нажми «Включить музыку», чтобы запустить звук')
      return
    }

    this.audio?.play().catch(error => {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.unlockNeededUrl = url
        this.options.onStatus('Нажми «Включить музыку», чтобы запустить звук')
        return
      }
      if (error instanceof DOMException && (error.name === 'NotSupportedError' || error.name === 'AbortError')) {
        if (error.name === 'NotSupportedError') this.handleUnsupportedSource()
        return
      }
      console.warn('Не удалось запустить аудио:', error)
      this.options.onStatus('Аудиофайл не запустился')
    })
  }

  private handleUnsupportedSource() {
    const url = this.state?.url || this.loadedUrl
    if (!url || this.unsupportedUrl === url) return
    this.unsupportedUrl = url
    this.options.onStatus('Этот аудиофайл не поддерживается браузером')
    if (this.options.isMaster) {
      this.callback?.({ isPlaying: false, positionSeconds: 0 })
    }
  }
}
