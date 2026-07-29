import type { CSSProperties } from 'react'
import { getFileLayerMeta } from './media-utils'
import type { ImageEditorState, LayerTreeNode, RollMessage, TableLayer } from '../types'

export function centerLayerOnPoint(point: { x: number; y: number }, size: { width: number; height: number }) {
  return {
    x: Math.round(point.x - size.width / 2),
    y: Math.round(point.y - size.height / 2),
  }
}

export function mergeRoll(rolls: RollMessage[], roll: RollMessage) {
  if (rolls.some(item => item.id === roll.id)) return rolls
  return [roll, ...rolls].slice(0, 80)
}

export function upsertLayer(layers: TableLayer[], layer: TableLayer) {
  const exists = layers.some(item => item.id === layer.id)
  const next = exists ? layers.map(item => (item.id === layer.id ? layer : item)) : [...layers, layer]
  return sortLayers(next).slice(0, 80)
}

export function sortLayers(layers: TableLayer[]) {
  return [...layers].sort((a, b) => a.zIndex - b.zIndex || a.createdAt.localeCompare(b.createdAt))
}

export function getLayerCrop(layer: TableLayer) {
  const cropX = Math.max(0, Math.min(95, layer.cropX ?? 0))
  const cropY = Math.max(0, Math.min(95, layer.cropY ?? 0))
  const cropWidth = Math.max(1, Math.min(100 - cropX, layer.cropWidth ?? 100))
  const cropHeight = Math.max(1, Math.min(100 - cropY, layer.cropHeight ?? 100))
  const cropped = cropX > 0 || cropY > 0 || cropWidth < 100 || cropHeight < 100
  return { cropX, cropY, cropWidth, cropHeight, cropped }
}

export function getCroppedMediaStyle(layer: TableLayer): CSSProperties {
  const crop = getLayerCrop(layer)
  if (!crop.cropped) return {}
  return {
    width: `${10000 / crop.cropWidth}%`,
    height: `${10000 / crop.cropHeight}%`,
    transform: `translate(${-crop.cropX}%, ${-crop.cropY}%)`,
    transformOrigin: '0 0',
  }
}

export function getLayerMediaStyle(layer: TableLayer): CSSProperties {
  const cropStyle = getCroppedMediaStyle(layer)
  return {
    ...cropStyle,
    filter: `brightness(${layer.brightness}) contrast(${layer.contrast}) saturate(${layer.saturation})`,
    transform: [
      cropStyle.transform,
      `rotate(${layer.rotation}deg)`,
      `scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`,
    ].filter(Boolean).join(' '),
  }
}

export function getSmartFloatingPosition(x: number, y: number, width: number, height: number, margin = 12) {
  if (typeof window === 'undefined') return { left: x, top: y }
  const left = x + width + margin > window.innerWidth ? Math.max(margin, x - width - margin) : Math.max(margin, x)
  const top = y + height + margin > window.innerHeight ? Math.max(margin, y - height - margin) : Math.max(margin, y)
  return { left, top }
}

export function createEditorState(layer: TableLayer): ImageEditorState {
  const crop = getLayerCrop(layer)
  return {
    cropX: crop.cropX,
    cropY: crop.cropY,
    cropWidth: crop.cropWidth,
    cropHeight: crop.cropHeight,
    rotation: layer.rotation,
    flipX: layer.flipX,
    flipY: layer.flipY,
    brightness: layer.brightness,
    contrast: layer.contrast,
    saturation: layer.saturation,
  }
}

// Shows the FULL image (no crop transform) so the user can pick the crop region
export function getEditorPreviewStyle(state: ImageEditorState): CSSProperties {
  return {
    filter: `brightness(${state.brightness}) contrast(${state.contrast}) saturate(${state.saturation})`,
    transform: `rotate(${state.rotation}deg) scale(${state.flipX ? -1 : 1}, ${state.flipY ? -1 : 1})`,
    transformOrigin: '50% 50%',
  }
}

export function getEditorImageStyle(state: ImageEditorState): CSSProperties {
  return {
    width: `${10000 / state.cropWidth}%`,
    height: `${10000 / state.cropHeight}%`,
    transform: `translate(${-state.cropX}%, ${-state.cropY}%) rotate(${state.rotation}deg) scale(${state.flipX ? -1 : 1}, ${state.flipY ? -1 : 1})`,
    transformOrigin: '50% 50%',
    filter: `brightness(${state.brightness}) contrast(${state.contrast}) saturate(${state.saturation})`,
  }
}

export function canEditLayer(
  layer: TableLayer,
  options: { isMaster: boolean; chatUserId?: string | null },
) {
  if (options.isMaster) return true
  if (layer.ownerRole === 'master') return false
  if (!layer.ownerId) return true
  return Boolean(options.chatUserId && layer.ownerId === options.chatUserId)
}

export function getDescendantIds(layers: TableLayer[], layerId: string) {
  const ids = new Set<string>()
  const visit = (parentId: string) => {
    layers.forEach(layer => {
      if (layer.parentId !== parentId || ids.has(layer.id)) return
      ids.add(layer.id)
      visit(layer.id)
    })
  }
  visit(layerId)
  return ids
}

export function getAncestorIds(layers: TableLayer[], layerId: string) {
  const ids: string[] = []
  const visited = new Set<string>()
  let parentId = layers.find(layer => layer.id === layerId)?.parentId || null
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    ids.push(parentId)
    parentId = layers.find(layer => layer.id === parentId)?.parentId || null
  }
  return ids
}

export function isLayerEffectivelyVisible(layer: TableLayer, layers: TableLayer[]) {
  if (!layer.onTable) return false
  if (layer.layerType === 'folder') return false
  if (!layer.visible) return false
  let parentId = layer.parentId
  const visited = new Set<string>()
  while (parentId) {
    if (visited.has(parentId)) return true
    visited.add(parentId)
    const parent = layers.find(item => item.id === parentId)
    if (!parent) return true
    if (!parent.visible) return false
    parentId = parent.parentId
  }
  return true
}

export function getLayerShareUrl(layer: TableLayer) {
  if (layer.layerType === 'file') return getFileLayerMeta(layer.imageData, layer.name).url
  if (layer.layerType === 'image' || layer.layerType === 'video') return layer.imageData
  return ''
}

/** Video, text, and file layers expose native content; move only via the drag handle. */
export function layerUsesInteractiveDragHandle(layer: TableLayer) {
  return layer.layerType === 'video' || layer.layerType === 'text' || layer.layerType === 'file'
}

export function isInteractiveLayerContentTarget(layer: TableLayer, target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  if (layer.layerType === 'video') return Boolean(target.closest('iframe, video'))
  if (layer.layerType === 'text') return Boolean(target.closest('.scene-text-material div, .scene-text-material pre'))
  if (layer.layerType === 'file') return Boolean(target.closest('.scene-file-material a, .scene-file-material iframe'))
  return false
}

export function getLayerClipboardText(layer: TableLayer) {
  const url = getLayerShareUrl(layer)
  if (layer.layerType === 'image' && url) return `![${layer.name}](${url})`
  if (url) return `[${layer.name}](${url})`
  if (layer.layerType === 'text') return `${layer.name}\n\n${layer.imageData}`
  return layer.name
}

export function buildLayerTree(sourceLayers: TableLayer[]) {
  const nodeMap = new Map<string, LayerTreeNode>()
  sortLayers(sourceLayers).forEach(layer => nodeMap.set(layer.id, { ...layer, children: [] }))

  const roots: LayerTreeNode[] = []
  nodeMap.forEach(node => {
    const parent = node.parentId ? nodeMap.get(node.parentId) : null
    if (parent && parent.id !== node.id) parent.children.push(node)
    else roots.push(node)
  })

  const sortNodes = (nodes: LayerTreeNode[]) => {
    nodes.sort((a, b) => b.zIndex - a.zIndex || b.createdAt.localeCompare(a.createdAt))
    nodes.forEach(node => sortNodes(node.children))
    return nodes
  }

  return sortNodes(roots)
}
