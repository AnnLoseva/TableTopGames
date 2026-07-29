'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/games/vampires/lib/supabase'
import { MASTER_LAYOUTS } from '../persistence/constants'
import type { MasterLayout } from '../persistence/types'
import { masterRealtimeChannelKey } from '../multi-window/open-detached'
import {
  findLayoutByNameOrId,
  getLayoutState,
  listLayouts,
  saveLayoutAsCopy,
  saveLayoutWithVersion,
  type LayoutSaveConflict,
} from '../layouts'
import { defaultLayoutState, type MasterLayoutState } from '../layouts/layout-schema'

export function useMasterLayouts(room: string, initialLayoutKey?: string | null) {
  const [layouts, setLayouts] = useState<MasterLayout[]>([])
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<'remote' | 'local'>('local')
  const [conflict, setConflict] = useState<LayoutSaveConflict | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!room) return
    try {
      const result = await listLayouts(room)
      setLayouts(result.layouts)
      setSource(result.source)
      setError(null)
      setActiveLayoutId(prev => {
        if (prev && result.layouts.some(item => item.id === prev)) return prev
        const fromUrl = findLayoutByNameOrId(result.layouts, initialLayoutKey)
        if (fromUrl) return fromUrl.id
        const def = result.layouts.find(item => item.isDefault) || result.layouts[0]
        return def?.id || null
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load master layouts')
    } finally {
      setLoading(false)
    }
  }, [room, initialLayoutKey])

  useEffect(() => {
    if (!room) return
    setLoading(true)
    void reload()

    // Stable channel name — no crypto.randomUUID per mount (avoids subscription spam)
    const client = createClient()
    const channel = client
      .channel(masterRealtimeChannelKey(room, 'layouts'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: MASTER_LAYOUTS, filter: `room=eq.${room}` },
        () => void reload(),
      )
      .subscribe()

    return () => {
      void client.removeChannel(channel)
    }
  }, [room, reload])

  useEffect(() => {
    if (!initialLayoutKey || !layouts.length) return
    const match = findLayoutByNameOrId(layouts, initialLayoutKey)
    if (match) setActiveLayoutId(match.id)
  }, [initialLayoutKey, layouts])

  const activeLayout = layouts.find(item => item.id === activeLayoutId) || null
  const activeState: MasterLayoutState = activeLayout
    ? getLayoutState(activeLayout)
    : defaultLayoutState()

  const saveActive = useCallback(async (state: MasterLayoutState, name?: string) => {
    if (!activeLayout) {
      setStatus('Нет активной раскладки')
      return null
    }
    const draft: MasterLayout = {
      ...activeLayout,
      name: name || activeLayout.name,
      layoutJson: state as unknown as MasterLayout['layoutJson'],
    }
    const result = await saveLayoutWithVersion(draft, activeLayout.layoutVersion)
    if (!result.ok) {
      if ('conflict' in result && result.conflict) {
        setConflict(result.conflict)
        setStatus(result.conflict.message)
        return null
      }
      setStatus('error' in result ? result.error : 'save failed')
      return null
    }
    setConflict(null)
    setLayouts(prev => [result.layout, ...prev.filter(item => item.id !== result.layout.id)])
    setActiveLayoutId(result.layout.id)
    setStatus(result.source === 'local' ? 'Раскладка сохранена (local)' : 'Раскладка сохранена')
    return result.layout
  }, [activeLayout])

  const resolveConflictKeepMine = useCallback(async () => {
    if (!conflict) return
    const result = await saveLayoutWithVersion(
      { ...conflict.local, layoutVersion: conflict.remote.layoutVersion },
      conflict.remote.layoutVersion,
    )
    if (result.ok) {
      setConflict(null)
      setLayouts(prev => [result.layout, ...prev.filter(item => item.id !== result.layout.id)])
      setStatus('Сохранена локальная версия (overwrite)')
    }
  }, [conflict])

  const resolveConflictTakeTheirs = useCallback(() => {
    if (!conflict) return
    setLayouts(prev => [conflict.remote, ...prev.filter(item => item.id !== conflict.remote.id)])
    setActiveLayoutId(conflict.remote.id)
    setConflict(null)
    setStatus('Загружена remote-версия раскладки')
  }, [conflict])

  const resolveConflictSaveCopy = useCallback(async () => {
    if (!conflict) return
    const result = await saveLayoutAsCopy(conflict.local)
    if (result.ok) {
      setConflict(null)
      setLayouts(prev => [result.layout, ...prev])
      setActiveLayoutId(result.layout.id)
      setStatus(`Сохранена копия: ${result.layout.name}`)
    }
  }, [conflict])

  return {
    layouts,
    activeLayout,
    activeLayoutId,
    setActiveLayoutId,
    activeState,
    loading,
    error,
    source,
    conflict,
    status,
    setStatus,
    reload,
    saveActive,
    resolveConflictKeepMine,
    resolveConflictTakeTheirs,
    resolveConflictSaveCopy,
  }
}
