'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/games/vampires/lib/supabase'
import { fetchMasterActionLog } from '../api'
import { MASTER_ACTION_LOG } from '../persistence/constants'
import type { MasterActionLogEntry } from '../persistence/types'

export function useMasterActionLog(room: string) {
  const [entries, setEntries] = useState<MasterActionLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!room) return

    const client = createClient()
    let cancelled = false

    const load = async () => {
      try {
        const next = await fetchMasterActionLog(room)
        if (!cancelled) {
          setEntries(next)
          setError(null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load master action log')
        }
      }
    }

    void load()
    const channel = client
      .channel(`master-actions:${room}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: MASTER_ACTION_LOG, filter: `room=eq.${room}` },
        () => void load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      void client.removeChannel(channel)
    }
  }, [room])

  return { entries, error }
}
