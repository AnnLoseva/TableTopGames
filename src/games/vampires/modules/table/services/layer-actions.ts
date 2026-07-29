import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import { ROOT_LAYER_DROP_ID } from '../constants'
import {
  deleteLayerRecords,
  insertLayer,
  removeStorageObject,
  updateLayerRecord,
  updateLayerRecords,
} from '../api/layer-api'
import { createTableId } from '../api/scene-api'
import type {
  JournalEntry,
  LayerContextMenu,
  LayerPatch,
  MediaTab,
  RightRailTab,
  TableLayer,
  TableRole,
} from '../types'
import {
  getJournalReferencedMediaUrls,
  isMediaUrlReferencedInJournal,
} from '../utils/journal-media'
import {
  canEditLayer,
  centerLayerOnPoint,
  getDescendantIds,
  sortLayers,
  upsertLayer,
} from '../utils/layer-utils'
import { getFileLayerMeta, getStoragePathFromPublicUrl } from '../utils/media-utils'

export type LayerContextSnapshot = {
  currentSceneId: string | null
  currentOwnerId: string | null
  selectedLayer: TableLayer | null
  tableRole: TableRole | null
}

export type LayerActionsDeps = {
  room: string
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  isMaster: boolean
  chatUser: ChatUser | null
  layers: TableLayer[]
  layersRef: MutableRefObject<TableLayer[]>
  setLayers: Dispatch<SetStateAction<TableLayer[]>>
  setSelectedLayerId: Dispatch<SetStateAction<string | null>>
  setSelectedLayerIds: Dispatch<SetStateAction<Set<string>>>
  setTableStatus: Dispatch<SetStateAction<string>>
  setRightRailTab: Dispatch<SetStateAction<RightRailTab>>
  setExpandedFolders: Dispatch<SetStateAction<Set<string>>>
  setLayerContextMenu: Dispatch<SetStateAction<LayerContextMenu>>
  setMediaTab: Dispatch<SetStateAction<MediaTab>>
  broadcast: (event: string, payload: unknown) => void
  journalEntriesRef: MutableRefObject<JournalEntry[]>
  getLayerContext: () => LayerContextSnapshot
}

export function createLayerActions(deps: LayerActionsDeps) {
  const canEdit = (layer: TableLayer) => canEditLayer(layer, {
    isMaster: deps.isMaster,
    chatUserId: deps.chatUser?.id,
  })

  const setLayerSelection = (ids: string[], primaryId = ids[0] || null) => {
    deps.setSelectedLayerIds(new Set(ids))
    deps.setSelectedLayerId(primaryId)
  }

  const patchLayer = async (id: string, patch: LayerPatch) => {
    const existingLayer = deps.layersRef.current.find(layer => layer.id === id)
    if (existingLayer && !canEdit(existingLayer)) return

    const nextLayers = sortLayers(deps.layersRef.current.map(layer => (
      layer.id === id ? { ...layer, ...patch } : layer
    )))
    deps.layersRef.current = nextLayers
    deps.setLayers(nextLayers)
    deps.broadcast('layer-update', { id, room: deps.room, patch })

    const { error } = await updateLayerRecord(id, patch)
    if (error) {
      console.error('Не удалось обновить слой:', error)
      deps.setTableStatus('Слой не сохранился')
    }
  }

  const patchLayers = async (patches: Array<{ id: string; patch: LayerPatch }>) => {
    if (patches.length === 0) return

    const patchMap = new Map(patches.map(item => [item.id, item.patch]))
    const nextLayers = sortLayers(deps.layersRef.current.map(layer => (
      { ...layer, ...(patchMap.get(layer.id) || {}) }
    )))
    deps.layersRef.current = nextLayers
    deps.setLayers(nextLayers)
    patches.forEach(item => deps.broadcast('layer-update', { id: item.id, room: deps.room, patch: item.patch }))

    const results = await updateLayerRecords(patches)
    if (results.some(result => result.error)) {
      console.error('Не удалось обновить порядок слоёв:', results.find(result => result.error)?.error)
      deps.setTableStatus('Порядок слоёв не сохранился')
    }
  }

  const patchSelectedLayers = async (ids: string[], patchFor: (layer: TableLayer) => LayerPatch) => {
    const patches = ids
      .map(id => deps.layersRef.current.find(layer => layer.id === id))
      .filter((layer): layer is TableLayer => Boolean(layer))
      .filter(layer => canEdit(layer))
      .map(layer => ({ id: layer.id, patch: patchFor(layer) }))
    await patchLayers(patches)
  }

  const addMediaLayer = async (
    imageData: string,
    name: string,
    natural: { width: number; height: number },
    layerType: 'image' | 'video' | 'text' | 'file' = 'image',
    index = 0,
    point?: { x: number; y: number },
    onTable = true,
    overrides: LayerPatch = {},
  ) => {
    const context = deps.getLayerContext()
    if (!deps.isMaster && !deps.chatUser) {
      window.alert(deps.t('Сначала войди в аккаунт игрока в чате, чтобы материалы получили владельца.'))
      deps.setRightRailTab('chat')
      return
    }
    if (!context.currentSceneId) {
      window.alert(deps.t('Сначала нужна активная сцена.'))
      return
    }
    const maxZ = deps.layersRef.current.reduce((max, layer) => Math.max(max, layer.zIndex), 0)
    const fitWidth = Math.min(760, Math.max(220, natural.width))
    const fitHeight = Math.max(160, Math.round((fitWidth / Math.max(1, natural.width)) * Math.max(1, natural.height)))
    const ownerRole = context.tableRole ?? 'player'
    const activeFolder = context.selectedLayer?.layerType === 'folder' && canEdit(context.selectedLayer)
      ? context.selectedLayer
      : null
    const width = typeof overrides.width === 'number' ? overrides.width : fitWidth
    const height = typeof overrides.height === 'number' ? overrides.height : fitHeight
    let x = Math.round((activeFolder?.x ?? 80) + ((deps.layersRef.current.length + index) % 6) * 28)
    let y = Math.round((activeFolder?.y ?? 70) + ((deps.layersRef.current.length + index) % 6) * 24)
    if (point) {
      ({ x, y } = centerLayerOnPoint(point, { width, height }))
    }
    const layer: TableLayer = {
      id: createTableId(),
      room: deps.room,
      sceneId: context.currentSceneId,
      layerType,
      ownerRole,
      ownerId: context.currentOwnerId,
      parentId: activeFolder?.id || null,
      name,
      imageData,
      x,
      y,
      width,
      height,
      cropX: null,
      cropY: null,
      cropWidth: null,
      cropHeight: null,
      zIndex: maxZ + 1,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      rotation: 0,
      flipX: false,
      flipY: false,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      onTable,
      createdAt: new Date().toISOString(),
    }
    Object.assign(layer, overrides)

    const { error } = await insertLayer(layer)

    deps.layersRef.current = upsertLayer(deps.layersRef.current, layer)
    deps.setLayers(deps.layersRef.current)
    setLayerSelection([layer.id], layer.id)
    deps.broadcast('layer', layer)

    if (error) {
      console.error('Не удалось сохранить слой стола:', error)
      deps.setTableStatus('Слой показан онлайн, но не сохранён')
      window.alert(deps.t('Слой показан онлайн, но не сохранился. Нужно обновить table_images в Supabase.'))
    }
    return layer.id
  }

  const createFolder = async (
    parentId: string | null = null,
    name?: string,
    selectAfterCreate = true,
    onTable = true,
  ) => {
    const context = deps.getLayerContext()
    if (!deps.isMaster && !deps.chatUser) {
      window.alert(deps.t('Сначала войди в аккаунт игрока в чате, чтобы папка получила владельца.'))
      deps.setRightRailTab('chat')
      return null
    }
    if (!context.currentSceneId) {
      window.alert(deps.t('Сначала нужна активная сцена.'))
      return null
    }
    const maxZ = deps.layersRef.current.reduce((max, layer) => Math.max(max, layer.zIndex), 0)
    const siblingCount = deps.layersRef.current.filter(
      layer => layer.layerType === 'folder' && layer.parentId === parentId,
    ).length
    const parentFolder = parentId ? deps.layersRef.current.find(layer => layer.id === parentId) : null
    const folder: TableLayer = {
      id: createTableId(),
      room: deps.room,
      sceneId: context.currentSceneId,
      layerType: 'folder',
      ownerRole: context.tableRole ?? 'player',
      ownerId: context.currentOwnerId,
      parentId,
      name: name?.trim() || deps.tf('Папка {n}', { n: siblingCount + 1 }),
      imageData: '',
      x: (parentFolder?.x ?? 120) + (siblingCount % 5) * 36,
      y: (parentFolder?.y ?? 120) + (siblingCount % 5) * 28,
      width: 520,
      height: 320,
      cropX: null,
      cropY: null,
      cropWidth: null,
      cropHeight: null,
      zIndex: maxZ + 1,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      rotation: 0,
      flipX: false,
      flipY: false,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      onTable,
      createdAt: new Date().toISOString(),
    }

    const { error } = await insertLayer(folder)

    deps.layersRef.current = upsertLayer(deps.layersRef.current, folder)
    deps.setLayers(deps.layersRef.current)
    if (selectAfterCreate) setLayerSelection([folder.id], folder.id)
    if (parentId) deps.setExpandedFolders(prev => new Set(prev).add(parentId))
    deps.broadcast('layer', folder)

    if (error) {
      console.error('Не удалось сохранить папку:', error)
      deps.setTableStatus('Папка показана онлайн, но не сохранена')
    }
    return folder.id
  }

  const deleteLayer = async (layerId: string) => {
    const layer = deps.layersRef.current.find(item => item.id === layerId)
      || deps.layers.find(item => item.id === layerId)
    if (layer && !window.confirm(deps.tf('Удалить "{name}"?', { name: layer.name }))) return
    const childIds = getDescendantIds(deps.layersRef.current, layerId)
    const requestedDeleteIds = new Set([layerId, ...childIds])
    const deleteIds = deps.isMaster
      ? requestedDeleteIds
      : new Set([...requestedDeleteIds].filter(id => {
        const item = deps.layersRef.current.find(layer => layer.id === id)
        return item ? canEdit(item) : false
      }))
    if (deleteIds.size === 0) return

    const deletedLayers = deps.layersRef.current.filter(item => deleteIds.has(item.id))
    const nextLayers = deps.layersRef.current.filter(item => !deleteIds.has(item.id))
    deps.layersRef.current = nextLayers
    deps.setLayers(nextLayers)
    deps.setSelectedLayerId(prev => (prev && deleteIds.has(prev) ? null : prev))
    deps.setSelectedLayerIds(prev => new Set([...prev].filter(id => !deleteIds.has(id))))
    deleteIds.forEach(id => deps.broadcast('layer-delete', { id, room: deps.room }))
    await deleteLayerRecords([...deleteIds])

    const journalUrls = getJournalReferencedMediaUrls(deps.journalEntriesRef.current)
    await Promise.all(deletedLayers.map(async deletedLayer => {
      const fileUrl = deletedLayer.layerType === 'file'
        ? getFileLayerMeta(deletedLayer.imageData, deletedLayer.name).url
        : deletedLayer.imageData
      const stillUsed = nextLayers.some(item => {
        const itemUrl = item.layerType === 'file'
          ? getFileLayerMeta(item.imageData, item.name).url
          : item.imageData
        return itemUrl && itemUrl === fileUrl
      })
      if (stillUsed) return
      if (isMediaUrlReferencedInJournal(fileUrl, journalUrls)) return
      const storagePath = getStoragePathFromPublicUrl(fileUrl)
      if (storagePath) {
        const { error } = await removeStorageObject(storagePath)
        if (error) console.error('Не удалось удалить файл слоя из Storage:', error)
      }
    }))
  }

  const moveLayersToFolder = async (ids: string[], folderId: string | null) => {
    const folder = folderId ? deps.layersRef.current.find(layer => layer.id === folderId) : null
    const patches = ids
      .map(id => deps.layersRef.current.find(layer => layer.id === id))
      .filter((layer): layer is TableLayer => Boolean(layer))
      .filter(layer => canEdit(layer) && layer.layerType !== 'folder' && layer.id !== folderId)
      .filter(layer => !folder || !getDescendantIds(deps.layersRef.current, layer.id).has(folder.id))
      .map(layer => ({ id: layer.id, patch: { parentId: folderId } }))
    if (folderId) deps.setExpandedFolders(prev => new Set(prev).add(folderId))
    await patchLayers(patches)
  }

  const createFolderForSelection = async (ids: string[]) => {
    const folderName = window.prompt(deps.t('Название новой папки'), deps.t('Новая папка'))?.trim()
    if (!folderName) return
    const folderId = await createFolder(null, folderName, false, true)
    if (!folderId) return
    await moveLayersToFolder(ids, folderId)
  }

  const placeLayerOnTable = async (layerId: string, point?: { x: number; y: number }) => {
    const layer = deps.layersRef.current.find(item => item.id === layerId)
    if (!layer || !canEdit(layer)) return
    if (!layer.onTable) {
      if (layer.layerType === 'folder') {
        const ids = [layer.id, ...getDescendantIds(deps.layersRef.current, layer.id)]
        await patchSelectedLayers(ids, () => ({ onTable: true, visible: true }))
        setLayerSelection(ids, layer.id)
        return
      }
      await addMediaLayer(
        layer.imageData,
        layer.name,
        { width: layer.width, height: layer.height },
        layer.layerType,
        0,
        point,
        true,
      )
      return
    }
    const maxZ = deps.layersRef.current.reduce((max, item) => Math.max(max, item.zIndex), 0)
    const position = point
      ? centerLayerOnPoint(point, { width: layer.width, height: layer.height })
      : { x: 120, y: 120 }
    await patchLayer(layer.id, {
      onTable: true,
      visible: true,
      parentId: null,
      x: position.x,
      y: position.y,
      zIndex: maxZ + 1,
    })
    setLayerSelection([layer.id], layer.id)
  }

  const reorderLayers = async (ids: string[], direction: 'top' | 'up' | 'down' | 'bottom') => {
    const selected = ids
      .map(id => deps.layersRef.current.find(layer => layer.id === id))
      .filter((layer): layer is TableLayer => Boolean(layer))
      .filter(layer => canEdit(layer))
    if (selected.length === 0) return

    const patches: Array<{ id: string; patch: LayerPatch }> = []
    const groups = new Map<string, TableLayer[]>()
    selected.forEach(layer => {
      const key = layer.parentId || ROOT_LAYER_DROP_ID
      groups.set(key, [...(groups.get(key) || []), layer])
    })

    groups.forEach(groupSelected => {
      const selectedIds = new Set(groupSelected.map(layer => layer.id))
      const parentId = groupSelected[0]?.parentId ?? null
      const siblings = sortLayers(deps.layersRef.current.filter(layer => layer.parentId === parentId))
      const ordered = siblings.filter(layer => !selectedIds.has(layer.id))
      const picked = siblings.filter(layer => selectedIds.has(layer.id))
      const firstIndex = Math.min(...picked.map(layer => siblings.findIndex(item => item.id === layer.id)))
      const insertIndex = direction === 'top'
        ? ordered.length
        : direction === 'bottom'
          ? 0
          : direction === 'up'
            ? Math.min(ordered.length, firstIndex + 1)
            : Math.max(0, firstIndex - 1)
      ordered.splice(insertIndex, 0, ...picked)
      ordered.forEach((layer, index) => {
        const nextZ = index + 1
        if (layer.zIndex !== nextZ) patches.push({ id: layer.id, patch: { zIndex: nextZ } })
      })
    })

    await patchLayers(patches)
  }

  const deleteSelectedLayers = async (ids: string[]) => {
    for (const id of ids) await deleteLayer(id)
  }

  const duplicateLayer = async (layer: TableLayer) => {
    if (!canEdit(layer) || layer.layerType === 'folder') return
    await addMediaLayer(
      layer.imageData,
      `${layer.name} copy`,
      { width: layer.width, height: layer.height },
      layer.layerType === 'video'
        ? 'video'
        : layer.layerType === 'text'
          ? 'text'
          : layer.layerType === 'file'
            ? 'file'
            : 'image',
      0,
      undefined,
      layer.onTable,
      {
        x: layer.x + 28,
        y: layer.y + 28,
        parentId: layer.parentId,
        cropX: layer.cropX,
        cropY: layer.cropY,
        cropWidth: layer.cropWidth,
        cropHeight: layer.cropHeight,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        rotation: layer.rotation,
        flipX: layer.flipX,
        flipY: layer.flipY,
        brightness: layer.brightness,
        contrast: layer.contrast,
        saturation: layer.saturation,
      },
    )
  }

  const renameLayer = async (layer: TableLayer) => {
    const nextName = window.prompt(deps.t('Новое имя слоя'), layer.name)?.trim()
    if (!nextName || nextName === layer.name) return
    await patchLayer(layer.id, { name: nextName })
    deps.setLayerContextMenu(null)
  }

  const resetLayerCrop = async (layer: TableLayer) => {
    await patchLayer(layer.id, { cropX: null, cropY: null, cropWidth: null, cropHeight: null })
    deps.setLayerContextMenu(null)
  }

  const createNamedFolder = async (parentId: string | null = null, onTable = true) => {
    const nextName = window.prompt(deps.t('Название папки'), deps.t('Новая папка'))?.trim()
    if (!nextName) return null
    return createFolder(parentId, nextName, true, onTable)
  }

  const copyLayerToPersonalMedia = async (layer: TableLayer) => {
    if (layer.layerType === 'folder') return
    await addMediaLayer(
      layer.imageData,
      `${layer.name} copy`,
      { width: layer.width, height: layer.height },
      layer.layerType === 'video'
        ? 'video'
        : layer.layerType === 'text'
          ? 'text'
          : layer.layerType === 'file'
            ? 'file'
            : 'image',
      0,
      undefined,
      false,
      {
        parentId: null,
        visible: true,
        locked: false,
        cropX: layer.cropX,
        cropY: layer.cropY,
        cropWidth: layer.cropWidth,
        cropHeight: layer.cropHeight,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        rotation: layer.rotation,
        flipX: layer.flipX,
        flipY: layer.flipY,
        brightness: layer.brightness,
        contrast: layer.contrast,
        saturation: layer.saturation,
      },
    )
    deps.setRightRailTab('media')
    deps.setMediaTab('library')
    deps.setLayerContextMenu(null)
    deps.setTableStatus('Скопировано в мои медиа')
  }

  return {
    patchLayer,
    patchLayers,
    patchSelectedLayers,
    addMediaLayer,
    createFolder,
    deleteLayer,
    moveLayersToFolder,
    createFolderForSelection,
    placeLayerOnTable,
    reorderLayers,
    deleteSelectedLayers,
    duplicateLayer,
    renameLayer,
    resetLayerCrop,
    createNamedFolder,
    copyLayerToPersonalMedia,
    setLayerSelection,
    canEditLayer: canEdit,
  }
}