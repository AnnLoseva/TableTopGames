'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { createClient } from '@/games/vampires/lib/supabase'
import type { MusicChannel, MusicLibraryItem, MusicLibraryRow, MusicState } from '../types'
import {
  isMissingColumnError,
  isMissingRelationError,
  mapMusicLibraryRow,
  mapMusicRow,
  TABLE_MUSIC,
  TABLE_MUSIC_LIBRARY,
  upsertMusicLibraryItem,
} from '../utils'

let supportsExtendedMusicLoad = true
let supportsMusicLibraryAutoplay = true

function emptyMusicState(room: string): MusicState {
  return {
    room,
    url: '',
    activeUri: '',
    isPlaying: false,
    positionSeconds: 0,
    updatedAt: new Date(0).toISOString(),
    provider: 'none',
  }
}

export type RoomMusicStateContextValue = {
  room: string
  musicState: MusicState | null
  musicLoaded: boolean
  library: MusicLibraryItem[]
  libraryLoaded: boolean
  musicChannelRef: MutableRefObject<MusicChannel | null>
  libraryRef: MutableRefObject<MusicLibraryItem[]>
  setLibrary: Dispatch<SetStateAction<MusicLibraryItem[]>>
}

const RoomMusicStateContext = createContext<RoomMusicStateContextValue | null>(null)

export function useRoomMusicState(): RoomMusicStateContextValue {
  const value = useContext(RoomMusicStateContext)
  if (!value) {
    throw new Error('useRoomMusicState must be used within RoomMusicStateProvider')
  }
  return value
}

export type RoomMusicStateProviderProps = {
  room: string
  children: ReactNode
}

export function RoomMusicStateProvider({ room, children }: RoomMusicStateProviderProps) {
  const [musicState, setMusicState] = useState<MusicState | null>(null)
  const [musicLoaded, setMusicLoaded] = useState(false)
  const [library, setLibrary] = useState<MusicLibraryItem[]>([])
  const [libraryLoaded, setLibraryLoaded] = useState(false)

  const musicChannelRef = useRef<MusicChannel | null>(null)
  const libraryRef = useRef<MusicLibraryItem[]>([])

  useEffect(() => {
    libraryRef.current = library
  }, [library])

  useEffect(() => {
    setMusicState(null)
    setMusicLoaded(false)
    setLibrary([])
    setLibraryLoaded(false)
    libraryRef.current = []
  }, [room])

  useEffect(() => {
    const onState = (event: Event) => {
      const detail = (event as CustomEvent<MusicState>).detail
      if (!detail || detail.room !== room) return
      setMusicState(detail)
    }

    window.addEventListener('vtm-music-state', onState)
    return () => window.removeEventListener('vtm-music-state', onState)
  }, [room])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    const loadMusic = async () => {
      try {
        if (supportsExtendedMusicLoad) {
          const extended = await supabase
            .from(TABLE_MUSIC)
            .select('room, url, active_uri, is_playing, position_seconds, updated_at, provider, playlist_id, playlist_index, track_id, source_type')
            .eq('room', room)
            .maybeSingle()

          if (cancelled) return

          if (!extended.error) {
            setMusicState(extended.data ? mapMusicRow(extended.data) : emptyMusicState(room))
            setMusicLoaded(true)
            return
          }

          if (isMissingColumnError(extended.error)) {
            supportsExtendedMusicLoad = false
          } else {
            console.warn('Extended music load failed, attempting fallback:', extended.error)
          }
        }

        const fallback = await supabase.from(TABLE_MUSIC).select('*').eq('room', room).maybeSingle()
        if (cancelled) return
        if (fallback.error) {
          console.error('Не удалось загрузить музыку комнаты (fallback):', fallback.error)
          setMusicState(emptyMusicState(room))
          setMusicLoaded(true)
          return
        }
        setMusicState(fallback.data ? mapMusicRow(fallback.data) : emptyMusicState(room))
        setMusicLoaded(true)
      } catch (err) {
        console.error('Unexpected error loading music:', err)
        if (!cancelled) {
          setMusicState(emptyMusicState(room))
          setMusicLoaded(true)
        }
      }
    }

    const loadMusicLibrary = async () => {
      const includeAutoplay = supportsMusicLibraryAutoplay
      const selectColumns = includeAutoplay
        ? 'id, room, item_type, parent_id, name, url, autoplay, created_at'
        : 'id, room, item_type, parent_id, name, url, created_at'

      const { data, error } = await supabase
        .from(TABLE_MUSIC_LIBRARY)
        .select(selectColumns)
        .eq('room', room)
        .order('created_at', { ascending: true })
        .limit(160)

      if (error && includeAutoplay && isMissingColumnError(error)) {
        supportsMusicLibraryAutoplay = false
        await loadMusicLibrary()
        return
      }

      if (cancelled) return
      if (error) {
        if (isMissingRelationError(error)) {
          setLibrary([])
          libraryRef.current = []
          setLibraryLoaded(true)
          return
        }
        console.error('Не удалось загрузить музыкальную библиотеку:', error)
        setLibraryLoaded(true)
        return
      }

      const next = (data || []).map(row => mapMusicLibraryRow(row as unknown as MusicLibraryRow))
      libraryRef.current = next
      setLibrary(next)
      setLibraryLoaded(true)
    }

    void Promise.all([loadMusic(), loadMusicLibrary()])

    const channel = supabase
      .channel(`room-music-state:${room}`)
      .on('broadcast', { event: 'music' }, payload => {
        const music = payload.payload as MusicState
        if (!music || music.room !== room) return
        setMusicState(music)
      })
      .on('broadcast', { event: 'music-library' }, payload => {
        const item = payload.payload as MusicLibraryItem
        if (!item || item.room !== room) return
        setLibrary(prev => {
          const next = upsertMusicLibraryItem(prev, item)
          libraryRef.current = next
          return next
        })
      })
      .on('broadcast', { event: 'music-library-delete' }, payload => {
        const deleted = payload.payload as { room?: string; ids?: string[] }
        if (deleted.room !== room || !deleted.ids) return
        setLibrary(prev => {
          const idSet = new Set(deleted.ids)
          const next = prev.filter(item => !idSet.has(item.id))
          libraryRef.current = next
          return next
        })
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE_MUSIC, filter: `room=eq.${room}` },
        payload => {
          const next = (payload.new || payload.old) as Parameters<typeof mapMusicRow>[0]
          if (!next?.room) return
          setMusicState(mapMusicRow(next))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE_MUSIC_LIBRARY, filter: `room=eq.${room}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id?: string }
            if (!deleted.id) return
            setLibrary(prev => {
              const next = prev.filter(item => item.id !== deleted.id)
              libraryRef.current = next
              return next
            })
            return
          }
          const row = payload.new as MusicLibraryRow
          setLibrary(prev => {
            const next = upsertMusicLibraryItem(prev, mapMusicLibraryRow(row))
            libraryRef.current = next
            return next
          })
        },
      )
      .subscribe()

    musicChannelRef.current = channel as MusicChannel

    return () => {
      cancelled = true
      musicChannelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [room])

  const value = useMemo<RoomMusicStateContextValue>(
    () => ({
      room,
      musicState,
      musicLoaded,
      library,
      libraryLoaded,
      musicChannelRef,
      libraryRef,
      setLibrary,
    }),
    [room, musicState, musicLoaded, library, libraryLoaded],
  )

  return (
    <RoomMusicStateContext.Provider value={value}>
      {children}
    </RoomMusicStateContext.Provider>
  )
}