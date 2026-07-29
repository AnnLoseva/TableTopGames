import type { Dispatch, DragEvent, MutableRefObject, SetStateAction } from 'react'
import { ROOT_LAYER_DROP_ID } from '../constants'
import type {
  LayerContextMenu,
  LayerDropPlacement,
  LayerDropTarget,
  LayerPatch,
  MediaTab,
  RightRailTab,
  TableLayer,
} from '../types'
import {
  getAncestorIds,
  getDescendantIds,
  getLayerShareUrl,
  sortLayers,
} from '../utils/layer-utils'

export type LayerManagerDragActionsDeps = {
  isMaster: boolean
  layersRef: MutableRefObject<TableLayer[]>
  draggingLayerId: string | null
  layerDropTarget: LayerDropTarget
  setDraggingLayerId: Dispatch<SetStateAction<string | null>>
  setLayerDropTarget: Dispatch<SetStateAction<LayerDropTarget>>
  setExpandedFolders: Dispatch<SetStateAction<Set<string>>>
  setRightRailTab: Dispatch<SetStateAction<RightRailTab>>
  setMediaTab: Dispatch<SetStateAction<MediaTab>>
  setLayerContextMenu: Dispatch<SetStateAction<LayerContextMenu>>
  setPreviewLayerId: Dispatch<SetStateAction<string | null>>
  canEditLayer: (layer: TableLayer) => boolean
  patchLayers: (patches: Array<{ id: string; patch: LayerPatch }>) => Promise<void>
  setLayerSelection: (ids: string[], primaryId?: string | null) => void
  renameLayer: (layer: TableLayer) => Promise<void>
}

export function createLayerManagerDragActions(deps: LayerManagerDragActionsDeps) {
  const toggleFolder = (folderId: string) => {
    deps.setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const revealLayerInTableManager = (layer: TableLayer) => {
    if (!layer.onTable || !deps.canEditLayer(layer)) return
    deps.setRightRailTab('media')
    deps.setMediaTab('layers')
    deps.setExpandedFolders(prev => {
      const next = new Set(prev)
      getAncestorIds(deps.layersRef.current, layer.id).forEach(id => next.add(id))
      return next
    })
    deps.setLayerSelection([layer.id], layer.id)
  }

  const handleManagerDoubleClick = (layer: TableLayer) => {
    if (!layer.onTable && layer.layerType !== 'folder') {
      deps.setPreviewLayerId(layer.id)
      return
    }
    if (layer.layerType === 'folder') {
      toggleFolder(layer.id)
      return
    }
    void deps.renameLayer(layer)
  }

  const canMoveLayer = (layer: TableLayer) => {
    if (layer.locked) return false
    return deps.canEditLayer(layer)
  }

  const canDropLayerOn = (dragged: TableLayer, target: TableLayer, placement: LayerDropPlacement) => {
    if (!canMoveLayer(dragged)) return false
    if (dragged.id === target.id) return false
    if (placement === 'inside' && target.layerType !== 'folder') return false
    if (dragged.layerType === 'folder' && getDescendantIds(deps.layersRef.current, dragged.id).has(target.id)) return false
    return true
  }

  const handleLayerDragStart = (event: DragEvent<HTMLElement>, layerId: string) => {
    const layer = deps.layersRef.current.find(item => item.id === layerId)
    if (!layer || !canMoveLayer(layer)) {
      event.preventDefault()
      return
    }

    const shareUrl = getLayerShareUrl(layer)
    event.dataTransfer.effectAllowed = 'copyMove'
    event.dataTransfer.setData('text/plain', layerId)
    if (shareUrl) {
      event.dataTransfer.setData('text/uri-list', shareUrl)
      event.dataTransfer.setData('application/x-vtm-layer', JSON.stringify({
        id: layer.id,
        title: layer.name,
        url: shareUrl,
        layerType: layer.layerType,
      }))
    }
    deps.setDraggingLayerId(layerId)
    deps.setLayerContextMenu(null)
  }

  const handleLayerDragOver = (event: DragEvent<HTMLElement>, target: TableLayer) => {
    const draggedId = deps.draggingLayerId || event.dataTransfer.getData('text/plain')
    if (!draggedId || draggedId === target.id) return
    const dragged = deps.layersRef.current.find(layer => layer.id === draggedId)
    if (!dragged) return

    const rect = event.currentTarget.getBoundingClientRect()
    const y = event.clientY - rect.top
    const ratio = y / Math.max(1, rect.height)
    const placement: LayerDropPlacement =
      target.layerType === 'folder' && ratio > 0.28 && ratio < 0.72 ? 'inside' : ratio < 0.5 ? 'before' : 'after'
    if (!canDropLayerOn(dragged, target, placement)) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    deps.setLayerDropTarget({ layerId: target.id, placement })
  }

  const handleLayerDrop = async (event: DragEvent<HTMLElement>, target: TableLayer) => {
    event.preventDefault()
    const draggedId = deps.draggingLayerId || event.dataTransfer.getData('text/plain')
    const dragged = deps.layersRef.current.find(layer => layer.id === draggedId)
    if (!dragged || dragged.id === target.id) return

    const placement = deps.layerDropTarget?.layerId === target.id ? deps.layerDropTarget.placement : 'after'
    if (!canDropLayerOn(dragged, target, placement)) return
    const nextParentId = placement === 'inside' ? target.id : target.parentId
    const draggableLayers = deps.layersRef.current.filter(layer => deps.isMaster || deps.canEditLayer(layer))
    const siblings = sortLayers(draggableLayers.filter(layer => layer.parentId === nextParentId && layer.id !== dragged.id)).reverse()
    const targetIndex = siblings.findIndex(layer => layer.id === target.id)
    const insertIndex = placement === 'inside' ? 0 : placement === 'before' ? Math.max(0, targetIndex) : Math.max(0, targetIndex + 1)
    siblings.splice(insertIndex, 0, { ...dragged, parentId: nextParentId })

    const highestZ = Math.max(1, ...deps.layersRef.current.map(layer => layer.zIndex)) + siblings.length
    const patches = siblings.map((layer, index) => ({
      id: layer.id,
      patch: {
        parentId: layer.id === dragged.id ? nextParentId : layer.parentId,
        zIndex: highestZ - index,
      },
    }))

    if (nextParentId) deps.setExpandedFolders(prev => new Set(prev).add(nextParentId))
    deps.setDraggingLayerId(null)
    deps.setLayerDropTarget(null)
    await deps.patchLayers(patches)
  }

  const handleLayerRootDragOver = (event: DragEvent<HTMLDivElement>) => {
    const draggedId = deps.draggingLayerId || event.dataTransfer.getData('text/plain')
    const dragged = deps.layersRef.current.find(layer => layer.id === draggedId)
    if (!dragged || !canMoveLayer(dragged)) return

    if (event.currentTarget !== event.target) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    deps.setLayerDropTarget({ layerId: ROOT_LAYER_DROP_ID, placement: 'inside' })
  }

  const handleLayerRootDrop = async (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target && deps.layerDropTarget?.layerId !== ROOT_LAYER_DROP_ID) return
    event.preventDefault()
    const draggedId = deps.draggingLayerId || event.dataTransfer.getData('text/plain')
    const dragged = deps.layersRef.current.find(layer => layer.id === draggedId)
    if (!dragged || !canMoveLayer(dragged)) return

    const draggableLayers = deps.layersRef.current.filter(layer => deps.isMaster || deps.canEditLayer(layer))
    const siblings = sortLayers(draggableLayers.filter(layer => layer.parentId === null && layer.id !== dragged.id)).reverse()
    siblings.push({ ...dragged, parentId: null })

    const highestZ = Math.max(1, ...deps.layersRef.current.map(layer => layer.zIndex)) + siblings.length
    const patches = siblings.map((layer, index) => ({
      id: layer.id,
      patch: {
        parentId: layer.id === dragged.id ? null : layer.parentId,
        zIndex: highestZ - index,
      },
    }))

    deps.setDraggingLayerId(null)
    deps.setLayerDropTarget(null)
    await deps.patchLayers(patches)
  }

  const handleLayerDragEnd = () => {
    deps.setDraggingLayerId(null)
    deps.setLayerDropTarget(null)
  }

  return {
    toggleFolder,
    revealLayerInTableManager,
    handleManagerDoubleClick,
    canMoveLayer,
    handleLayerDragStart,
    handleLayerDragOver,
    handleLayerDrop,
    handleLayerRootDragOver,
    handleLayerRootDrop,
    handleLayerDragEnd,
  }
}