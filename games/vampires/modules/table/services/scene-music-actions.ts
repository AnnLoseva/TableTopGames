import type { ChangeEvent, Dispatch, FormEvent, MutableRefObject, SetStateAction } from 'react'
import { getMusicProvider } from '@/games/vampires/modules/music/utils'
import {
  clearSceneMusicDefaults,
  createTableId,
  deleteSceneMusicRecord,
  insertSceneMusic,
  updateSceneMusicRecord,
} from '../api/scene-api'
import { uploadSceneMusicAudioFile } from '../api/music-api'
import type { SceneMusicTrack, TableScene } from '../types'
import { sortSceneMusic } from '../utils/scene-utils'

export type SceneMusicActionsDeps = {
  room: string
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  isMaster: boolean
  sceneMusicDraft: string
  sceneMusicRef: MutableRefObject<SceneMusicTrack[]>
  setSceneMusic: Dispatch<SetStateAction<SceneMusicTrack[]>>
  setSceneMusicDraft: Dispatch<SetStateAction<string>>
  setIsUploading: Dispatch<SetStateAction<boolean>>
  getSelectedScene: () => TableScene | null | undefined
  getSelectedSceneMusic: () => SceneMusicTrack[]
  broadcast: (event: string, payload: unknown) => void
}

export function createSceneMusicActions(deps: SceneMusicActionsDeps) {
  const fetchYouTubeTitle = async (url: string): Promise<string | null> => {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      const response = await fetch(oembedUrl)
      if (!response.ok) return null
      const data = await response.json() as { title?: string }
      return data.title || null
    } catch {
      return null
    }
  }

  const patchSceneMusic = async (track: SceneMusicTrack, patch: Partial<SceneMusicTrack>) => {
    if (!deps.isMaster) return
    const updatedAt = new Date().toISOString()
    const next = { ...track, ...patch, updatedAt }
    let nextTracks = deps.sceneMusicRef.current.map(item => (item.id === track.id ? next : item))
    if (patch.isDefault) {
      nextTracks = nextTracks.map(item => item.sceneId === track.sceneId ? { ...item, isDefault: item.id === track.id } : item)
      await clearSceneMusicDefaults(track.sceneId, track.id)
    }
    deps.setSceneMusic(sortSceneMusic(nextTracks))
    const { error } = await updateSceneMusicRecord(track.id, {
      title: next.title,
      url: next.url,
      source_type: next.sourceType,
      order_index: next.orderIndex,
      is_default: next.isDefault,
      autoplay: next.autoplay,
      updated_at: updatedAt,
    })
    if (error) console.error('Не удалось обновить музыку сцены:', error)
    deps.broadcast('scene-music', next)
  }

  const addSceneMusic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const selectedScene = deps.getSelectedScene()
    if (!deps.isMaster || !selectedScene) return
    const urls = deps.sceneMusicDraft.split(/\s+/).map(item => item.trim()).filter(Boolean)
    if (urls.length === 0) return
    const selectedSceneMusic = deps.getSelectedSceneMusic()
    const baseOrder = selectedSceneMusic.reduce((max, track) => Math.max(max, track.orderIndex), -1)
    for (const [index, url] of urls.entries()) {
      const now = new Date().toISOString()
      const provider = getMusicProvider(url)
      const defaultTitle = deps.tf('Трек {n}', { n: baseOrder + index + 2 })
      const youtubeTitle = provider === 'youtube' ? await fetchYouTubeTitle(url) : null
      const track: SceneMusicTrack = {
        id: createTableId(),
        room: deps.room,
        sceneId: selectedScene.id,
        title: youtubeTitle || defaultTitle,
        url,
        sourceType: provider,
        orderIndex: baseOrder + index + 1,
        isDefault: selectedSceneMusic.length === 0 && index === 0,
        autoplay: selectedSceneMusic.length === 0 && index === 0,
        createdAt: now,
        updatedAt: now,
      }
      const { error } = await insertSceneMusic(track)
      if (!error) {
        deps.setSceneMusic(prev => sortSceneMusic([...prev, track]))
        deps.broadcast('scene-music', track)
      }
    }
    deps.setSceneMusicDraft('')
  }

  const renameSceneMusic = async (track: SceneMusicTrack) => {
    const title = window.prompt(deps.t('Название трека'), track.title)?.trim()
    if (!title || title === track.title) return
    await patchSceneMusic(track, { title })
  }

  const deleteSceneMusic = async (track: SceneMusicTrack) => {
    if (!deps.isMaster) return
    deps.setSceneMusic(prev => prev.filter(item => item.id !== track.id))
    await deleteSceneMusicRecord(track.id)
    deps.broadcast('scene-music-delete', { room: deps.room, sceneId: track.sceneId, id: track.id })
  }

  const uploadSceneMusicFiles = async (files: FileList | File[]) => {
    const selectedScene = deps.getSelectedScene()
    if (!deps.isMaster || !selectedScene) return
    const audioFiles = Array.from(files).filter(file => file.type.startsWith('audio/'))
    if (audioFiles.length === 0) {
      window.alert(deps.t('Для музыки сцены можно загрузить только аудиофайлы.'))
      return
    }

    const selectedSceneMusic = deps.getSelectedSceneMusic()
    deps.setIsUploading(true)
    try {
      const baseOrder = selectedSceneMusic.reduce((max, track) => Math.max(max, track.orderIndex), -1)
      for (const [index, file] of audioFiles.entries()) {
        const { error: uploadError, publicUrl, id } = await uploadSceneMusicAudioFile(
          deps.room,
          selectedScene.id,
          file,
          index,
        )

        if (uploadError || !publicUrl || !id) {
          console.error('Не удалось загрузить музыку сцены:', uploadError)
          window.alert(deps.t('Аудиофайл не загрузился. Проверь bucket table-music и policies из SQL.'))
          continue
        }

        const now = new Date().toISOString()
        const track: SceneMusicTrack = {
          id,
          room: deps.room,
          sceneId: selectedScene.id,
          title: file.name,
          url: publicUrl,
          sourceType: 'file',
          orderIndex: baseOrder + index + 1,
          isDefault: selectedSceneMusic.length === 0 && index === 0,
          autoplay: selectedSceneMusic.length === 0 && index === 0,
          createdAt: now,
          updatedAt: now,
        }

        const { error } = await insertSceneMusic(track)

        if (!error) {
          deps.setSceneMusic(prev => sortSceneMusic([...prev, track]))
          deps.broadcast('scene-music', track)
        }
      }
    } finally {
      deps.setIsUploading(false)
    }
  }

  const handleSceneMusicUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await uploadSceneMusicFiles(event.target.files)
      event.target.value = ''
    }
  }

  const handleSceneMusicDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    if (droppedFiles.length > 0) await uploadSceneMusicFiles(droppedFiles)
  }

  const reorderSceneMusic = async (track: SceneMusicTrack, direction: 'up' | 'down') => {
    const tracks = sortSceneMusic(deps.getSelectedSceneMusic())
    const index = tracks.findIndex(item => item.id === track.id)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const swap = tracks[swapIndex]
    if (!swap) return
    await patchSceneMusic(track, { orderIndex: swap.orderIndex })
    await patchSceneMusic(swap, { orderIndex: track.orderIndex })
  }

  return {
    addSceneMusic,
    patchSceneMusic,
    renameSceneMusic,
    deleteSceneMusic,
    uploadSceneMusicFiles,
    handleSceneMusicUpload,
    handleSceneMusicDrop,
    reorderSceneMusic,
  }
}