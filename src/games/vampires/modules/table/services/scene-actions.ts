import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import {
  broadcastMusicChannel,
  getMusicProvider,
  parseYouTubeUrl,
} from '@/games/vampires/modules/music/utils'
import {
  activateSceneRecord,
  copySceneDeep,
  createTableId,
  deactivateOtherScenes,
  deleteSceneFolderRecord,
  deleteSceneWithAssets,
  fetchSceneMusic,
  insertScene,
  insertSceneFolder,
  updateSceneFolderRecord,
  updateSceneRecord,
} from '../api/scene-api'
import { upsertTableMusicState } from '../api/music-api'
import type { MusicChannel } from '@/games/vampires/modules/music/types'
import type { SceneMusicTrack, TableScene, TableSceneFolder } from '../types'
import { sortSceneMusic, upsertScene } from '../utils/scene-utils'
import { DEFAULT_SCENE_HEIGHT, DEFAULT_SCENE_WIDTH } from '../constants'

export type SceneActionsDeps = {
  room: string
  roomRef: MutableRefObject<string>
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  isMaster: boolean
  scenesRef: MutableRefObject<TableScene[]>
  sceneFoldersRef: MutableRefObject<TableSceneFolder[]>
  activeSceneIdRef: MutableRefObject<string | null>
  sceneMusicRef: MutableRefObject<SceneMusicTrack[]>
  channelRef: RefObject<MusicChannel | null>
  setScenes: Dispatch<SetStateAction<TableScene[]>>
  setSceneFolders: Dispatch<SetStateAction<TableSceneFolder[]>>
  setSelectedSceneId: Dispatch<SetStateAction<string | null>>
  setActiveSceneId: Dispatch<SetStateAction<string | null>>
  setSceneStatus: Dispatch<SetStateAction<string>>
  getSelectedScene: () => TableScene | null | undefined
  getActiveScene: () => TableScene | null | undefined
  getCurrentOwnerId: () => string | null
  loadLayersForScene: (targetRoom: string, sceneId: string) => Promise<void>
  loadSceneMusic: (targetRoom: string, sceneId: string) => Promise<void>
  broadcast: (event: string, payload: unknown) => void
}

export function createSceneActions(deps: SceneActionsDeps) {
  const publishSceneTrack = async (track: SceneMusicTrack, options: { play?: boolean } = { play: true }) => {
    const now = new Date().toISOString()
    const provider = getMusicProvider(track.url)
    const youtube = provider === 'youtube' ? parseYouTubeUrl(track.url) : { videoId: '', playlistId: undefined }
    const payload = {
      room: deps.roomRef.current,
      url: track.url,
      activeUri: provider === 'youtube' ? youtube.playlistId || youtube.videoId : track.url,
      isPlaying: Boolean(options.play),
      positionSeconds: 0,
      updatedAt: now,
      provider,
      playlistId: youtube.playlistId,
      playlistIndex: youtube.playlistId ? Math.max(0, track.orderIndex) : undefined,
      trackId: youtube.videoId || undefined,
      sourceType: provider,
    }
    await upsertTableMusicState(payload)
    window.dispatchEvent(new CustomEvent('vtm-music-state', { detail: payload }))
    broadcastMusicChannel(deps.channelRef.current, 'music', payload)
  }

  const playSceneAutoplayMusic = async (sceneId: string) => {
    const tracks = sceneId === deps.activeSceneIdRef.current
      ? deps.sceneMusicRef.current
      : (await fetchSceneMusic(deps.roomRef.current, sceneId)).tracks
    const track = sortSceneMusic(tracks).find(item => item.autoplay && item.isDefault)
      || sortSceneMusic(tracks).find(item => item.autoplay)
    if (!track?.url) return
    await publishSceneTrack(track, { play: true })
  }

  const createScene = async (folderId: string | null = null) => {
    if (!deps.isMaster) return
    const name = window.prompt(deps.t('Название сцены'), deps.t('Новая сцена'))?.trim()
    if (!name) return
    const now = new Date().toISOString()
    const scene: TableScene = {
      id: createTableId(),
      room: deps.room,
      name,
      thumbnailUrl: '',
      isActive: deps.scenesRef.current.length === 0,
      backgroundUrl: '',
      width: DEFAULT_SCENE_WIDTH,
      height: DEFAULT_SCENE_HEIGHT,
      folderId,
      viewMode: 'table',
      createdBy: deps.getCurrentOwnerId(),
      createdAt: now,
      updatedAt: now,
    }
    const { error } = await insertScene(scene)
    if (error) {
      console.error('Не удалось создать сцену:', error)
      deps.setSceneStatus('Сцена не создана')
      return
    }
    deps.setScenes(prev => upsertScene(prev, scene))
    deps.setSelectedSceneId(scene.id)
    deps.broadcast('scene', scene)
  }

  const renameScene = async () => {
    const selectedScene = deps.getSelectedScene()
    if (!deps.isMaster || !selectedScene) return
    const name = window.prompt(deps.t('Новое название сцены'), selectedScene.name)?.trim()
    if (!name || name === selectedScene.name) return
    const updatedAt = new Date().toISOString()
    const next = { ...selectedScene, name, updatedAt }
    deps.setScenes(prev => upsertScene(prev, next))
    const { error } = await updateSceneRecord(selectedScene.id, { name, updated_at: updatedAt })
    if (error) {
      console.error('Не удалось переименовать сцену:', error)
      deps.setSceneStatus('Название сцены не сохранилось')
      return
    }
    deps.broadcast('scene', next)
  }

  const activateScene = async (sceneId: string) => {
    if (!deps.isMaster) return
    const scene = deps.scenesRef.current.find(item => item.id === sceneId)
    if (!scene) return
    await deactivateOtherScenes(deps.room, sceneId)
    const { error } = await activateSceneRecord(sceneId)
    if (error) {
      console.error('Не удалось переключить сцену:', error)
      deps.setSceneStatus('Сцена не переключилась')
      return
    }
    deps.setActiveSceneId(sceneId)
    deps.activeSceneIdRef.current = sceneId
    deps.setSelectedSceneId(sceneId)
    deps.setScenes(prev => prev.map(item => ({ ...item, isActive: item.id === sceneId })))
    await deps.loadLayersForScene(deps.room, sceneId)
    await deps.loadSceneMusic(deps.room, sceneId)
    deps.broadcast('scene-active', { room: deps.room, sceneId })
    void playSceneAutoplayMusic(sceneId)
  }

  const deleteScene = async () => {
    const selectedScene = deps.getSelectedScene()
    if (!deps.isMaster || !selectedScene) return
    if (deps.scenesRef.current.length <= 1) {
      window.alert(deps.t('Нельзя удалить единственную сцену.'))
      return
    }
    const ok = window.confirm(deps.tf('Удалить сцену "{name}" вместе с её слоями, медиа и музыкой?', { name: selectedScene.name }))
    if (!ok) return
    const activeScene = deps.getActiveScene()
    const nextActive = selectedScene.isActive
      ? deps.scenesRef.current.find(scene => scene.id !== selectedScene.id)
      : activeScene
    const { error } = await deleteSceneWithAssets(selectedScene.id)
    if (error) {
      console.error('Не удалось удалить сцену:', error)
      deps.setSceneStatus('Сцена не удалена')
      return
    }
    deps.setScenes(prev => prev.filter(scene => scene.id !== selectedScene.id))
    deps.broadcast('scene-delete', { room: deps.room, id: selectedScene.id, nextActiveSceneId: nextActive?.id })
    if (nextActive?.id && selectedScene.isActive) await activateScene(nextActive.id)
    else deps.setSelectedSceneId(nextActive?.id || null)
  }

  const createSceneFolder = async () => {
    if (!deps.isMaster) return null
    const name = window.prompt(deps.t('Название папки (сессии)'), deps.t('Новая сессия'))?.trim()
    if (!name) return null
    const now = new Date().toISOString()
    const folder: TableSceneFolder = {
      id: createTableId(),
      room: deps.room,
      name,
      orderIndex: deps.sceneFoldersRef.current.length,
      createdAt: now,
      updatedAt: now,
    }
    const { error } = await insertSceneFolder(folder)
    if (error) {
      console.error('Не удалось создать папку сцен:', error)
      deps.setSceneStatus('Папка не создана')
      return null
    }
    deps.setSceneFolders(prev => [...prev, folder])
    deps.broadcast('scene-folder', folder)
    return folder.id
  }

  const renameSceneFolder = async (folder: TableSceneFolder) => {
    if (!deps.isMaster) return
    const name = window.prompt(deps.t('Новое название папки'), folder.name)?.trim()
    if (!name || name === folder.name) return
    const updatedAt = new Date().toISOString()
    const next = { ...folder, name, updatedAt }
    deps.setSceneFolders(prev => prev.map(item => (item.id === folder.id ? next : item)))
    const { error } = await updateSceneFolderRecord(folder.id, { name, updated_at: updatedAt })
    if (error) {
      console.error('Не удалось переименовать папку сцен:', error)
      deps.setSceneStatus('Название папки не сохранилось')
      return
    }
    deps.broadcast('scene-folder', next)
  }

  const deleteSceneFolder = async (folder: TableSceneFolder) => {
    if (!deps.isMaster) return
    const ok = window.confirm(deps.tf('Удалить папку "{name}"? Сцены внутри останутся без папки.', { name: folder.name }))
    if (!ok) return
    const { error } = await deleteSceneFolderRecord(folder.id)
    if (error) {
      console.error('Не удалось удалить папку сцен:', error)
      deps.setSceneStatus('Папка не удалена')
      return
    }
    deps.setSceneFolders(prev => prev.filter(item => item.id !== folder.id))
    deps.setScenes(prev => prev.map(scene => (scene.folderId === folder.id ? { ...scene, folderId: null } : scene)))
    deps.broadcast('scene-folder-delete', { room: deps.room, id: folder.id })
  }

  const moveSceneToFolder = async (sceneId: string, folderId: string | null) => {
    if (!deps.isMaster) return
    const scene = deps.scenesRef.current.find(item => item.id === sceneId)
    if (!scene || scene.folderId === folderId) return
    const updatedAt = new Date().toISOString()
    const next = { ...scene, folderId, updatedAt }
    deps.setScenes(prev => upsertScene(prev, next))
    const { error } = await updateSceneRecord(sceneId, { folder_id: folderId, updated_at: updatedAt })
    if (error) {
      console.error('Не удалось перенести сцену в папку:', error)
      deps.setSceneStatus('Перенос сцены не сохранился')
      return
    }
    deps.broadcast('scene', next)
  }

  const copyScene = async (scene: TableScene, folderId: string | null) => {
    if (!deps.isMaster) return
    const { scene: cloned, error } = await copySceneDeep(scene, folderId)
    if (error || !cloned) {
      console.error('Не удалось скопировать сцену:', error)
      deps.setSceneStatus('Сцена не скопирована')
      return
    }
    deps.setScenes(prev => upsertScene(prev, cloned))
    deps.setSelectedSceneId(cloned.id)
    deps.broadcast('scene', cloned)
  }

  /** Flips the active scene between the bounded table and free workspace. */
  const setSceneViewMode = async (viewMode: 'table' | 'free') => {
    if (!deps.isMaster) return
    const scene = deps.getActiveScene()
    if (!scene || scene.viewMode === viewMode) return
    const updatedAt = new Date().toISOString()
    const next = { ...scene, viewMode, updatedAt }
    deps.setScenes(prev => upsertScene(prev, next))
    const { error } = await updateSceneRecord(scene.id, { view_mode: viewMode, updated_at: updatedAt })
    if (error) {
      console.error('Не удалось сохранить режим сцены:', error)
      deps.setSceneStatus('Режим стола не сохранился')
      return
    }
    deps.broadcast('scene', next)
  }

  /**
   * Set the active-scene background from an image URL; stage size follows the
   * image's natural size (spec: scene size = background size). Never touches
   * existing layers or tokens.
   */
  const setSceneBackground = async (
    url: string,
    natural: { width: number; height: number },
    targetSceneId?: string,
  ) => {
    if (!deps.isMaster) return
    const sceneId = targetSceneId || deps.activeSceneIdRef.current
    const scene = deps.scenesRef.current.find(item => item.id === sceneId)
    if (!scene) return
    const width = Math.max(320, Math.round(natural.width) || DEFAULT_SCENE_WIDTH)
    const height = Math.max(320, Math.round(natural.height) || DEFAULT_SCENE_HEIGHT)
    const updatedAt = new Date().toISOString()
    const next = { ...scene, backgroundUrl: url, width, height, updatedAt }
    deps.setScenes(prev => upsertScene(prev, next))
    const { error } = await updateSceneRecord(scene.id, {
      background_url: url,
      width,
      height,
      updated_at: updatedAt,
    })
    if (error) {
      console.error('Не удалось сохранить фон сцены:', error)
      deps.setSceneStatus('Фон сцены не сохранился')
      return
    }
    deps.broadcast('scene', next)
  }

  const clearSceneBackground = async (targetSceneId?: string) => {
    if (!deps.isMaster) return
    const sceneId = targetSceneId || deps.activeSceneIdRef.current
    const scene = deps.scenesRef.current.find(item => item.id === sceneId)
    if (!scene) return
    const updatedAt = new Date().toISOString()
    const next = {
      ...scene,
      backgroundUrl: '',
      width: DEFAULT_SCENE_WIDTH,
      height: DEFAULT_SCENE_HEIGHT,
      updatedAt,
    }
    deps.setScenes(prev => upsertScene(prev, next))
    const { error } = await updateSceneRecord(scene.id, {
      background_url: '',
      width: DEFAULT_SCENE_WIDTH,
      height: DEFAULT_SCENE_HEIGHT,
      updated_at: updatedAt,
    })
    if (error) {
      console.error('Не удалось сбросить фон сцены:', error)
      deps.setSceneStatus('Фон сцены не сбросился')
      return
    }
    deps.broadcast('scene', next)
  }

  return {
    createScene,
    renameScene,
    activateScene,
    deleteScene,
    createSceneFolder,
    renameSceneFolder,
    deleteSceneFolder,
    moveSceneToFolder,
    copyScene,
    setSceneViewMode,
    publishSceneTrack,
    playSceneAutoplayMusic,
    setSceneBackground,
    clearSceneBackground,
  }
}
