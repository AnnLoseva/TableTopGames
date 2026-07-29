'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/games/vampires/lib/supabase'
import { CHARACTERS } from '@/games/vampires/modules/table/constants'
import { loadMasterActorsByRoom } from '../api'
import { CHRONICLE_ACTORS, CHRONICLE_ACTOR_PRIVATE } from '../constants'
import type { MasterActor } from '../types'

export function useChronicleActors(room: string) {
  const [actors, setActors] = useState<MasterActor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!room) return
    try {
      const next = await loadMasterActorsByRoom(room)
      setActors(next)
      setError(null)
      setLoading(false)
    } catch (loadError) {
      setLoading(false)
      setError(loadError instanceof Error ? loadError.message : 'Failed to load actors')
    }
  }, [room])

  useEffect(() => {
    if (!room) return
    const client = createClient()
    let cancelled = false

    const load = async () => {
      try {
        const next = await loadMasterActorsByRoom(room)
        if (!cancelled) {
          setActors(next)
          setLoading(false)
          setError(null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setLoading(false)
          setError(loadError instanceof Error ? loadError.message : 'Failed to load actors')
        }
      }
    }

    void load()
    const channel = client
      .channel(`chronicle-actors:${room}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: CHRONICLE_ACTORS, filter: `room=eq.${room}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: CHRONICLE_ACTOR_PRIVATE, filter: `room=eq.${room}` }, () => void load())
      .subscribe()

    return () => {
      cancelled = true
      void client.removeChannel(channel)
    }
  }, [room])

  const linkedCharacterIds = useMemo(
    () => [...new Set(actors.flatMap(actor => actor.characterId ? [actor.characterId] : []))].sort(),
    [actors],
  )
  const linkedCharacterFilter = linkedCharacterIds.join(',')

  useEffect(() => {
    if (!room || !linkedCharacterFilter) return
    const client = createClient()
    let cancelled = false

    const channel = client
      .channel(`chronicle-actor-sheets:${room}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: CHARACTERS, filter: `id=in.(${linkedCharacterFilter})` },
        () => {
          void loadMasterActorsByRoom(room).then(next => {
            if (!cancelled) setActors(next)
          }).catch(loadError => {
            if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Failed to refresh linked sheets')
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void client.removeChannel(channel)
    }
  }, [linkedCharacterFilter, room])

  return { actors, loading, error, reload }
}
