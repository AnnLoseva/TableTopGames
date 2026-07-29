'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/games/vampires/lib/supabase'
import { fetchScenes } from '@/games/vampires/modules/table/api/scene-api'
import { TABLE_SCENES } from '@/games/vampires/modules/table/constants'

/** Lightweight active-scene id for actor scene filters — not the full scene manager. */
export function useActiveSceneId(room: string) {
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)

  useEffect(() => {
    if (!room) return
    const client = createClient()
    let cancelled = false

    const load = async () => {
      const { scenes, error } = await fetchScenes(room)
      if (cancelled) return
      if (error) {
        setActiveSceneId(null)
        return
      }
      const active = scenes.find(scene => scene.isActive) || scenes[0] || null
      setActiveSceneId(active?.id ?? null)
    }

    void load()
    const channel = client
      .channel(`actors-active-scene:${room}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE_SCENES, filter: `room=eq.${room}` },
        () => void load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      void client.removeChannel(channel)
    }
  }, [room])

  return activeSceneId
}
