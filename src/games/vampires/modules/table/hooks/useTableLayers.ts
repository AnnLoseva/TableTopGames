'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchLayersForScene } from '../api/layer-api'
import type { TableLayer } from '../types'

export type LayersLoadResult = {
  ok: boolean
  status: string
}

export function useTableLayers() {
  const [layers, setLayers] = useState<TableLayer[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(new Set())
  const layersRef = useRef<TableLayer[]>([])

  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  const loadLayersForScene = useCallback(async (
    targetRoom: string,
    sceneId: string,
  ): Promise<LayersLoadResult> => {
    const { layers: next, error } = await fetchLayersForScene(targetRoom, sceneId)

    if (error) {
      console.error('Не удалось загрузить слои сцены:', error)
      return { ok: false, status: 'Слои сцены не загрузились' }
    }

    layersRef.current = next
    setLayers(next)
    setSelectedLayerId(null)
    setSelectedLayerIds(new Set())
    return {
      ok: true,
      status: next.length ? 'Сцена онлайн' : 'Пустая сцена',
    }
  }, [])

  return {
    layers,
    setLayers,
    layersRef,
    selectedLayerId,
    setSelectedLayerId,
    selectedLayerIds,
    setSelectedLayerIds,
    loadLayersForScene,
  }
}