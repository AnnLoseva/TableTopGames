'use client'

import { useCallback, useEffect, useState } from 'react'
import { archivePlotHook, fetchPlotHooks, upsertPlotHook } from '../api'
import type { PlotHeat, PlotHook } from '../types'

export function usePlotHooks(room: string, chronicleId: string) {
  const [plots, setPlots] = useState<PlotHook[]>([])
  const [source, setSource] = useState<'remote' | 'local' | 'loading'>('loading')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!room) return
    try {
      const result = await fetchPlotHooks(room)
      setPlots(result.plots.filter(plot => plot.status === 'active'))
      setSource(result.source)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить сюжеты')
      setSource('local')
    }
  }, [room])

  useEffect(() => {
    void reload()
  }, [reload])

  const addPlot = useCallback(async (title: string) => {
    if (!chronicleId || !title.trim()) return
    const plot: PlotHook = {
      id: crypto.randomUUID(),
      chronicleId,
      room,
      title: title.trim(),
      nextStep: '',
      heat: 'background',
      status: 'active',
      relatedActorIds: [],
      relatedLocationIds: [],
      relatedSessionIds: [],
      loreEntryId: '',
      sortOrder: plots.length,
      createdBy: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await upsertPlotHook(plot)
    setPlots(prev => [...prev, plot])
  }, [chronicleId, plots.length, room])

  const patchPlot = useCallback(async (plotId: string, patch: Partial<Pick<PlotHook, 'nextStep' | 'heat' | 'title'>>) => {
    const current = plots.find(plot => plot.id === plotId)
    if (!current) return
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
    await upsertPlotHook(next)
    setPlots(prev => prev.map(plot => (plot.id === plotId ? next : plot)))
  }, [plots])

  const setHeat = useCallback(async (plotId: string, heat: PlotHeat) => {
    await patchPlot(plotId, { heat })
  }, [patchPlot])

  const removePlot = useCallback(async (plotId: string) => {
    await archivePlotHook(room, plotId)
    setPlots(prev => prev.filter(plot => plot.id !== plotId))
  }, [room])

  return {
    plots,
    source,
    error,
    reload,
    addPlot,
    patchPlot,
    setHeat,
    removePlot,
  }
}
