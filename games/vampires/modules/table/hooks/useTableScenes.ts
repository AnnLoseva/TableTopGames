'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  assignOrphanLayersToScene,
  createTableId,
  fetchSceneMusic,
  fetchScenes,
  insertScene,
} from '../api/scene-api'
import type { SceneMusicTrack, TableScene } from '../types'
import { sortSceneMusic } from '../utils/scene-utils'
import { DEFAULT_SCENE_HEIGHT, DEFAULT_SCENE_WIDTH } from '../constants'

export function useTableScenes(room: string, defaultSceneName: string) {
  const [scenes, setScenes] = useState<TableScene[]>([])
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [sceneMusic, setSceneMusic] = useState<SceneMusicTrack[]>([])
  const [sceneMusicDraft, setSceneMusicDraft] = useState('')
  const [sceneStatus, setSceneStatus] = useState('Сцены загружаются...')
  const scenesRef = useRef<TableScene[]>([])
  const activeSceneIdRef = useRef<string | null>(null)
  const sceneMusicRef = useRef<SceneMusicTrack[]>([])

  useEffect(() => {
    scenesRef.current = scenes
  }, [scenes])

  useEffect(() => {
    activeSceneIdRef.current = activeSceneId
  }, [activeSceneId])

  useEffect(() => {
    sceneMusicRef.current = sceneMusic
  }, [sceneMusic])

  const loadSceneMusic = useCallback(async (targetRoom: string, sceneId: string) => {
    const { tracks, error } = await fetchSceneMusic(targetRoom, sceneId)

    if (error) {
      console.error('Не удалось загрузить музыку сцены:', error)
      setSceneMusic([])
      sceneMusicRef.current = []
      return
    }
    sceneMusicRef.current = tracks
    setSceneMusic(tracks)
  }, [])

  const ensureDefaultScene = useCallback(async (targetRoom: string) => {
    const { scenes: loadedScenes, error } = await fetchScenes(targetRoom)

    if (error) {
      console.error('Не удалось загрузить сцены:', error)
      setSceneStatus('Нужно применить SQL для сцен')
      return null
    }

    let nextScenes = loadedScenes

    if (nextScenes.length === 0) {
      const now = new Date().toISOString()
      const scene: TableScene = {
        id: createTableId(),
        room: targetRoom,
        name: defaultSceneName,
        thumbnailUrl: '',
        isActive: true,
        backgroundUrl: '',
        width: DEFAULT_SCENE_WIDTH,
        height: DEFAULT_SCENE_HEIGHT,
        createdBy: 'master',
        createdAt: now,
        updatedAt: now,
      }
      const { error: insertError } = await insertScene(scene)
      if (insertError) {
        console.error('Не удалось создать дефолтную сцену:', insertError)
        setSceneStatus('Дефолтная сцена не создана')
        return null
      }
      nextScenes = [scene]
      await assignOrphanLayersToScene(targetRoom, scene.id)
    }

    const active = nextScenes.find(scene => scene.isActive) || nextScenes[0]
    await assignOrphanLayersToScene(targetRoom, active.id)
    setScenes(nextScenes.map(scene => ({ ...scene, isActive: scene.id === active.id })))
    setActiveSceneId(active.id)
    activeSceneIdRef.current = active.id
    setSelectedSceneId(prev => (prev && nextScenes.some(scene => scene.id === prev) ? prev : active.id))
    setSceneStatus('Сцены онлайн')
    return active.id
  }, [defaultSceneName])

  return {
    scenes,
    setScenes,
    activeSceneId,
    setActiveSceneId,
    selectedSceneId,
    setSelectedSceneId,
    sceneMusic,
    setSceneMusic,
    sceneMusicDraft,
    setSceneMusicDraft,
    sceneStatus,
    setSceneStatus,
    scenesRef,
    activeSceneIdRef,
    sceneMusicRef,
    loadSceneMusic,
    ensureDefaultScene,
  }
}