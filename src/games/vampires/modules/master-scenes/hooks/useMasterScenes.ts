'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/games/vampires/lib/supabase'
import { getMasterMembership } from '@/games/vampires/modules/master-console/api'
import { TABLE_SCENES, TABLE_IMAGES, TABLE_SCENE_MUSIC } from '@/games/vampires/modules/table/constants'
import type { SceneMusicTrack, TableLayer, TableScene } from '@/games/vampires/modules/table/types'
import { fetchSceneMeta, fetchSceneInteractives } from '../api'
import {
  archiveMasterScene,
  buildSceneListItems,
  cloneMasterScene,
  createMasterScene,
  loadRoomScenes,
  loadSceneLayers,
  loadSceneTracks,
  publishSceneToPlayers,
  renameMasterScene,
  patchMasterLayer,
} from '../services'
import { upsertSceneMeta } from '../api'
import type { LightPresetId, MasterSceneMeta, SceneInteractive } from '../types'
import { isLightPresetId } from '../utils/light-presets'

export function useMasterScenes(room: string) {
  const [scenes, setScenes] = useState<TableScene[]>([])
  const [meta, setMeta] = useState<MasterSceneMeta[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [layers, setLayers] = useState<TableLayer[]>([])
  const [music, setMusic] = useState<SceneMusicTrack[]>([])
  const [interactives, setInteractives] = useState<SceneInteractive[]>([])
  const [layerCounts, setLayerCounts] = useState<Map<string, number>>(new Map())
  const [musicFlags, setMusicFlags] = useState<Map<string, boolean>>(new Map())
  const [chronicleId, setChronicleId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const metaById = useMemo(() => new Map(meta.map(item => [item.sceneId, item])), [meta])
  const publishedSceneId = useMemo(
    () => scenes.find(scene => scene.isActive)?.id || null,
    [scenes],
  )

  const reloadScenes = useCallback(async () => {
    if (!room) return
    try {
      const [nextScenes, metaResult] = await Promise.all([
        loadRoomScenes(room),
        fetchSceneMeta(room),
      ])
      setScenes(nextScenes)
      setMeta(metaResult.meta)
      setError(null)
      setLoading(false)

      const counts = new Map<string, number>()
      const musicMap = new Map<string, boolean>()
      await Promise.all(nextScenes.map(async scene => {
        const [sceneLayers, tracks] = await Promise.all([
          loadSceneLayers(room, scene.id).catch(() => [] as TableLayer[]),
          loadSceneTracks(room, scene.id).catch(() => [] as SceneMusicTrack[]),
        ])
        counts.set(scene.id, sceneLayers.length)
        musicMap.set(scene.id, tracks.length > 0)
      }))
      setLayerCounts(counts)
      setMusicFlags(musicMap)

      setSelectedSceneId(prev => {
        if (prev && nextScenes.some(scene => scene.id === prev)) return prev
        const active = nextScenes.find(scene => scene.isActive)
        return active?.id || nextScenes[0]?.id || null
      })
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Не удалось загрузить сцены')
    }
  }, [room])

  const reloadSelection = useCallback(async (sceneId: string | null) => {
    if (!room || !sceneId) {
      setLayers([])
      setMusic([])
      setInteractives([])
      return
    }
    const [nextLayers, tracks, objects] = await Promise.all([
      loadSceneLayers(room, sceneId),
      loadSceneTracks(room, sceneId),
      fetchSceneInteractives(room, sceneId),
    ])
    setLayers(nextLayers)
    setMusic(tracks)
    setInteractives(objects.objects)
    setLayerCounts(prev => new Map(prev).set(sceneId, nextLayers.length))
    setMusicFlags(prev => new Map(prev).set(sceneId, tracks.length > 0))
  }, [room])

  useEffect(() => {
    void reloadScenes()
  }, [reloadScenes])

  useEffect(() => {
    void reloadSelection(selectedSceneId)
  }, [selectedSceneId, reloadSelection])

  useEffect(() => {
    if (!room) return
    void getMasterMembership(room).then(membership => {
      if (membership) setChronicleId(membership.chronicleId)
    }).catch(() => undefined)
  }, [room])

  useEffect(() => {
    if (!chronicleId && scenes[0]) {
      // cannot infer chronicle from scene; leave empty until membership/actors provide it
    }
  }, [chronicleId, scenes])

  useEffect(() => {
    if (!room) return
    const client = createClient()
    const channel = client
      .channel(`master-scenes:${room}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_SCENES, filter: `room=eq.${room}` }, () => {
        void reloadScenes()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_IMAGES, filter: `room=eq.${room}` }, () => {
        if (selectedSceneId) void reloadSelection(selectedSceneId)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_SCENE_MUSIC, filter: `room=eq.${room}` }, () => {
        if (selectedSceneId) void reloadSelection(selectedSceneId)
      })
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [room, reloadScenes, reloadSelection, selectedSceneId])

  const listItems = useMemo(
    () => buildSceneListItems(scenes, metaById, layerCounts, musicFlags, selectedSceneId),
    [scenes, metaById, layerCounts, musicFlags, selectedSceneId],
  )

  const selectedMeta = selectedSceneId ? metaById.get(selectedSceneId) || null : null
  const draftPresetId = (
    selectedMeta?.draftLightPreset && isLightPresetId(selectedMeta.draftLightPreset)
      ? selectedMeta.draftLightPreset
      : ''
  ) as LightPresetId | ''

  const ensureChronicle = useCallback(() => {
    if (!chronicleId) throw new Error('Нужен chronicle_id (Auth membership)')
    return chronicleId
  }, [chronicleId])

  const createScene = useCallback(async (name?: string) => {
    setBusy(true)
    try {
      const scene = await createMasterScene({ room, name: name || 'Новая сцена' })
      if (chronicleId) {
        await upsertSceneMeta({
          sceneId: scene.id,
          chronicleId,
          room,
          sortOrder: scenes.length,
          archived: false,
          encounterMarker: '',
          draftLightPreset: '',
          publishedLightPreset: '',
          status: 'draft',
          notes: '',
          updatedAt: new Date().toISOString(),
        })
      }
      setStatus('Сцена создана (черновик)')
      await reloadScenes()
      setSelectedSceneId(scene.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать сцену')
    } finally {
      setBusy(false)
    }
  }, [chronicleId, reloadScenes, room, scenes.length])

  const renameScene = useCallback(async (sceneId: string, name: string) => {
    const scene = scenes.find(item => item.id === sceneId)
    if (!scene || !name.trim()) return
    setBusy(true)
    try {
      await renameMasterScene(scene, name)
      setStatus('Сцена переименована')
      await reloadScenes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось переименовать')
    } finally {
      setBusy(false)
    }
  }, [reloadScenes, scenes])

  const cloneScene = useCallback(async (sceneId: string) => {
    const scene = scenes.find(item => item.id === sceneId)
    if (!scene) return
    setBusy(true)
    try {
      const cid = ensureChronicle()
      const sourceLayers = await loadSceneLayers(room, sceneId)
      const clone = await cloneMasterScene({
        room,
        source: scene,
        layers: sourceLayers,
        chronicleId: cid,
      })
      setStatus('Сцена клонирована')
      await reloadScenes()
      setSelectedSceneId(clone.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось клонировать')
    } finally {
      setBusy(false)
    }
  }, [ensureChronicle, reloadScenes, room, scenes])

  const archiveScene = useCallback(async (sceneId: string) => {
    const scene = scenes.find(item => item.id === sceneId)
    if (!scene) return
    setBusy(true)
    try {
      await archiveMasterScene({
        scene,
        meta: metaById.get(sceneId) || null,
        chronicleId: ensureChronicle(),
      })
      setStatus('Сцена в архиве')
      await reloadScenes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось архивировать')
    } finally {
      setBusy(false)
    }
  }, [ensureChronicle, metaById, reloadScenes, scenes])

  const publishSelected = useCallback(async () => {
    if (!selectedSceneId) return
    setBusy(true)
    try {
      await publishSceneToPlayers({
        room,
        sceneId: selectedSceneId,
        chronicleId: ensureChronicle(),
        lightPreset: draftPresetId || undefined,
        meta: selectedMeta,
      })
      setStatus('Сцена показана игрокам')
      await reloadScenes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Публикация не удалась')
    } finally {
      setBusy(false)
    }
  }, [draftPresetId, ensureChronicle, reloadScenes, room, selectedMeta, selectedSceneId])

  const setDraftPreset = useCallback(async (presetId: LightPresetId | '') => {
    if (!selectedSceneId) return
    const base = selectedMeta || {
      sceneId: selectedSceneId,
      chronicleId: chronicleId || 'local',
      room,
      sortOrder: 0,
      archived: false,
      encounterMarker: '',
      draftLightPreset: '',
      publishedLightPreset: '',
      status: 'draft' as const,
      notes: '',
      updatedAt: new Date().toISOString(),
    }
    const next = {
      ...base,
      chronicleId: chronicleId || base.chronicleId,
      draftLightPreset: presetId,
      status: base.status === 'published' ? 'draft' as const : base.status,
      updatedAt: new Date().toISOString(),
    }
    await upsertSceneMeta(next)
    setMeta(prev => [next, ...prev.filter(item => item.sceneId !== selectedSceneId)])
    setStatus(presetId ? `Пресет «${presetId}» в preview (не опубликован)` : 'Пресет сброшен')
  }, [chronicleId, room, selectedMeta, selectedSceneId])

  const setEncounterMarker = useCallback(async (sceneId: string, marker: string) => {
    const base = metaById.get(sceneId)
    if (!chronicleId && !base) return
    const next: MasterSceneMeta = {
      sceneId,
      chronicleId: chronicleId || base?.chronicleId || 'local',
      room,
      sortOrder: base?.sortOrder ?? 0,
      archived: base?.archived ?? false,
      encounterMarker: marker,
      draftLightPreset: base?.draftLightPreset || '',
      publishedLightPreset: base?.publishedLightPreset || '',
      status: base?.status || 'draft',
      notes: base?.notes || '',
      updatedAt: new Date().toISOString(),
    }
    await upsertSceneMeta(next)
    setMeta(prev => [next, ...prev.filter(item => item.sceneId !== sceneId)])
  }, [chronicleId, metaById, room])

  const updateLayer = useCallback(async (layerId: string, patch: Parameters<typeof patchMasterLayer>[1]) => {
    await patchMasterLayer(layerId, patch)
    setLayers(prev => prev.map(layer => (layer.id === layerId ? { ...layer, ...patch } : layer)))
    // Layer patches on draft scene do not auto-publish; only active scene is on player table.
  }, [])

  return {
    listItems,
    scenes,
    selectedSceneId,
    setSelectedSceneId,
    publishedSceneId,
    layers,
    music,
    interactives,
    setInteractives,
    selectedMeta,
    draftPresetId,
    chronicleId,
    setChronicleId,
    loading,
    error,
    busy,
    status,
    setStatus,
    createScene,
    renameScene,
    cloneScene,
    archiveScene,
    publishSelected,
    setDraftPreset,
    setEncounterMarker,
    updateLayer,
    reloadScenes,
    reloadSelection,
  }
}
