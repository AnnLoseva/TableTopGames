'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import { useRoomMusicState } from '../hooks/useRoomMusicState'
import type { MusicLibraryItem, MusicState } from '../types'

const MUSIC_VOLUME_STORAGE_KEY = 'vtm-youtube-volume'
const MUSIC_PLAYER_COMMAND_EVENT = 'vtm-player-command'
const MUSIC_UNLOCK_REQUEST_EVENT = 'vtm-music-unlock-request'

function clampMusicVolume(volume: number) {
  return Math.min(100, Math.max(0, Math.round(volume)))
}

function getTrackLabel(state: MusicState, library: MusicLibraryItem[]) {
  const item = library.find(
    entry => entry.itemType === 'track' && (entry.id === state.activeUri || entry.url === state.url),
  )
  if (item?.name) return item.name
  if (state.provider === 'youtube') return 'YouTube'
  try {
    const url = new URL(state.url)
    const fileName = decodeURIComponent(url.pathname.split('/').pop() || '')
    return fileName || url.hostname
  } catch {
    return state.url
  }
}

export default function MusicTopbarControl() {
  const { t } = useLang()
  const { room, musicState, library } = useRoomMusicState()
  const [volume, setVolume] = useState(70)
  const [muted, setMuted] = useState(false)
  const volumeBeforeMuteRef = useRef(70)

  const applyVolume = useCallback((nextVolume: number) => {
    const clamped = clampMusicVolume(nextVolume)
    setVolume(clamped)
    window.localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(clamped))
    window.dispatchEvent(new CustomEvent(MUSIC_PLAYER_COMMAND_EVENT, {
      detail: { room, command: 'set-volume', volume: clamped },
    }))
  }, [room])

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY))
    if (!Number.isFinite(saved)) return
    const clamped = clampMusicVolume(saved)
    setVolume(clamped)
    volumeBeforeMuteRef.current = clamped
    setMuted(clamped === 0)
  }, [])

  const trackLabel = useMemo(() => {
    if (!musicState?.url) return t('Музыка не выбрана')
    const name = getTrackLabel(musicState, library)
    if (!name) return t('Музыка не выбрана')
    return musicState.isPlaying ? name : `${name} · ${t('Пауза')}`
  }, [library, musicState, t])

  const displayVolume = muted ? 0 : volume
  const sliderDisabled = !musicState?.url

  const toggleMute = () => {
    if (muted || volume === 0) {
      setMuted(false)
      const restored = volumeBeforeMuteRef.current > 0 ? volumeBeforeMuteRef.current : 70
      applyVolume(restored)
      window.dispatchEvent(new CustomEvent(MUSIC_UNLOCK_REQUEST_EVENT))
      return
    }

    volumeBeforeMuteRef.current = volume > 0 ? volume : volumeBeforeMuteRef.current
    setMuted(true)
    applyVolume(0)
  }

  const onVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value)
    if (next > 0) {
      setMuted(false)
      volumeBeforeMuteRef.current = next
    } else {
      setMuted(true)
    }
    applyVolume(next)
  }

  return (
    <div className="tbl-music" title={t('Громкость музыки — только у тебя')}>
      <button
        type="button"
        className={`tbl-music-note ${muted || displayVolume === 0 ? 'muted' : ''}`}
        aria-label={muted || displayVolume === 0 ? t('Включить музыку') : t('Выключить музыку')}
        onClick={toggleMute}
      >
        <span aria-hidden="true">♪</span>
      </button>
      <div className="tbl-music-body">
        <span className="tbl-music-track">{trackLabel}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={displayVolume}
          disabled={sliderDisabled}
          aria-label={t('Громкость')}
          style={{ '--vol': `${displayVolume}%` } as CSSProperties}
          onChange={onVolumeChange}
        />
      </div>
      <span className="tbl-music-val">{displayVolume}</span>
    </div>
  )
}