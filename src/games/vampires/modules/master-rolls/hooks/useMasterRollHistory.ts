'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/games/vampires/lib/supabase'
import { TABLE_ROLLS } from '@/games/vampires/modules/table/constants'
import type { RollMessage } from '@/games/vampires/modules/table/types'
import { MASTER_HIDDEN_ROLLS } from '../constants'
import { loadMasterRollHistory } from '../services'

export function useMasterRollHistory(room: string) {
  const [publicRolls, setPublicRolls] = useState<RollMessage[]>([])
  const [hiddenRolls, setHiddenRolls] = useState<RollMessage[]>([])
  const [localHidden, setLocalHidden] = useState<RollMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!room) return
    try {
      const next = await loadMasterRollHistory(room)
      setPublicRolls(next.publicRolls)
      setHiddenRolls(next.hiddenRolls)
      setError(null)
      setLoading(false)
    } catch (loadError) {
      setLoading(false)
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить историю бросков')
    }
  }, [room])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!room) return
    const client = createClient()
    const channel = client
      .channel(`master-roll-history:${room}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE_ROLLS, filter: `room=eq.${room}` },
        () => void reload(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: MASTER_HIDDEN_ROLLS, filter: `room=eq.${room}` },
        () => void reload(),
      )
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [room, reload])

  const pushLocalHidden = useCallback((roll: RollMessage) => {
    setLocalHidden(prev => [roll, ...prev.filter(item => item.id !== roll.id)].slice(0, 40))
  }, [])

  const removeLocalHidden = useCallback((rollId: string) => {
    setLocalHidden(prev => prev.filter(item => item.id !== rollId))
  }, [])

  const upsertLocal = useCallback((roll: RollMessage) => {
    if (roll.hidden) {
      setLocalHidden(prev => [roll, ...prev.filter(item => item.id !== roll.id)].slice(0, 40))
      return
    }
    setPublicRolls(prev => [roll, ...prev.filter(item => item.id !== roll.id)].slice(0, 80))
  }, [])

  const combined = useMemo(() => {
    const hiddenIds = new Set(hiddenRolls.map(roll => roll.id))
    const mergedHidden = [
      ...localHidden.filter(roll => !hiddenIds.has(roll.id)),
      ...hiddenRolls,
    ]
    const all = [...mergedHidden, ...publicRolls]
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 80)
  }, [hiddenRolls, localHidden, publicRolls])

  const hiddenCount = useMemo(
    () => combined.filter(roll => roll.hidden).length,
    [combined],
  )

  return {
    rolls: combined,
    publicRolls,
    hiddenRolls: [...localHidden, ...hiddenRolls],
    hiddenCount,
    loading,
    error,
    reload,
    pushLocalHidden,
    removeLocalHidden,
    upsertLocal,
  }
}
