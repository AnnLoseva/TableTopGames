import { createClient } from '@/games/vampires/lib/supabase'
import type { MusicChannel, MusicState } from './types'
import { broadcastMusicChannel, getEffectiveMusicPosition, getMusicProvider, isMissingColumnError, isMusicLifecycleSafe, normalizeMusicState, TABLE_MUSIC, toLegacyMusicDbRow, toMusicDbRow } from './utils'

type MusicEngineOptions = {
  room: string
  isMaster: boolean
  getChannel: () => MusicChannel | null
  onState: (state: MusicState) => void
  onStatus: (status: string) => void
}

const POSITION_ONLY_THROTTLE_MS = 1800
let supportsExtendedMusicSchema = true

export class MusicSyncEngine {
  private state: MusicState
  private lastPersistAt = 0
  private lifecycleLocked = false
  private removeLifecycleListeners: (() => void) | null = null

  constructor(private options: MusicEngineOptions) {
    this.state = {
      room: options.room,
      url: '',
      activeUri: '',
      isPlaying: false,
      positionSeconds: 0,
      updatedAt: new Date(0).toISOString(),
      provider: 'none',
    }

    if (typeof window !== 'undefined') {
      const lock = () => {
        this.lifecycleLocked = true
      }
      window.addEventListener('pagehide', lock)
      window.addEventListener('beforeunload', lock)
      this.removeLifecycleListeners = () => {
        window.removeEventListener('pagehide', lock)
        window.removeEventListener('beforeunload', lock)
      }
    }
  }

  destroy() {
    this.lifecycleLocked = true
    this.removeLifecycleListeners?.()
    this.removeLifecycleListeners = null
  }

  getCurrentState() {
    return this.state
  }

  getEffectivePosition() {
    return getEffectiveMusicPosition(this.state)
  }

  canPublishLifecycleEvent() {
    return !this.lifecycleLocked && isMusicLifecycleSafe()
  }

  applyIncoming(next: MusicState) {
    if (!next || next.room !== this.options.room) return
    const currentTime = new Date(this.state.updatedAt).getTime()
    const nextTime = new Date(next.updatedAt).getTime()
    if (Number.isFinite(currentTime) && Number.isFinite(nextTime) && nextTime < currentTime) return

    const mapped = normalizeMusicState({
      ...next,
      provider: next.provider || getMusicProvider(next.url),
    })
    if (
      mapped.updatedAt === this.state.updatedAt &&
      mapped.url === this.state.url &&
      mapped.activeUri === this.state.activeUri &&
      mapped.isPlaying === this.state.isPlaying &&
      mapped.positionSeconds === this.state.positionSeconds &&
      mapped.trackId === this.state.trackId &&
      mapped.playlistIndex === this.state.playlistIndex
    ) {
      return
    }

    this.state = mapped
    this.options.onState(this.state)
  }

  async publishMusicState(patch: Partial<Omit<MusicState, 'room' | 'updatedAt'>>, options: { persist?: boolean } = {}) {
    if (!this.options.isMaster) {
      this.options.onStatus('Музыкой управляет мастер')
      return
    }

    const nowMs = Date.now()
    const current = this.state
    const next = normalizeMusicState({
      ...current,
      ...patch,
      room: this.options.room,
      url: (patch.url ?? current.url).trim(),
      activeUri: patch.activeUri ?? current.activeUri,
      provider: patch.provider ?? current.provider ?? getMusicProvider(patch.url ?? current.url),
      isPlaying: patch.isPlaying ?? current.isPlaying,
      positionSeconds: Math.max(0, Math.floor(patch.positionSeconds ?? current.positionSeconds)),
      updatedAt: new Date(nowMs).toISOString(),
    })

    this.state = next
    this.options.onState(next)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vtm-music-state', { detail: next }))
    }
    broadcastMusicChannel(this.options.getChannel(), 'music', next)

    const onlyPosition = Object.keys(patch).every(key => key === 'positionSeconds' || key === 'updatedAt')
    if (options.persist === false || (onlyPosition && nowMs - this.lastPersistAt < POSITION_ONLY_THROTTLE_MS)) return
    this.lastPersistAt = nowMs

    const supabase = createClient()
    if (supportsExtendedMusicSchema) {
      const { error } = await supabase.from(TABLE_MUSIC).upsert(toMusicDbRow(next))
      if (!error) return
      if (isMissingColumnError(error)) {
        supportsExtendedMusicSchema = false
      } else {
        console.error('Не удалось сохранить расширенное состояние музыки:', error)
      }
    }

    const legacy = await supabase.from(TABLE_MUSIC).upsert(toLegacyMusicDbRow(next))

    if (legacy.error) {
      console.error('Не удалось сохранить музыку комнаты:', legacy.error)
      this.options.onStatus('Музыка отправлена онлайн, но не сохранена')
    }
  }
}
