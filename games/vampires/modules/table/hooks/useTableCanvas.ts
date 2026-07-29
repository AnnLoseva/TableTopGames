'use client'

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { updateLayerRecords } from '../api/layer-api'
import type {
  DragState,
  LayerPatch,
  SelectionRect,
  TableLayer,
  TouchGestureState,
} from '../types'
import { getDescendantIds, layerUsesInteractiveDragHandle } from '../utils/layer-utils'
import { isEditablePasteTarget, parseClipboardForTablePaste } from '../utils/media-utils'

export type UseTableCanvasOptions = {
  room: string
  zoom: number
  pan: { x: number; y: number }
  isMaster: boolean
  selectedLayerIds: Set<string>
  visibleLayers: TableLayer[]
  sceneRef: MutableRefObject<HTMLDivElement | null>
  panRef: MutableRefObject<{ x: number; y: number }>
  layersRef: MutableRefObject<TableLayer[]>
  suppressNextContextMenuRef: MutableRefObject<boolean>
  setZoom: Dispatch<SetStateAction<number>>
  setPan: Dispatch<SetStateAction<{ x: number; y: number }>>
  setLayers: Dispatch<SetStateAction<TableLayer[]>>
  setTableStatus: Dispatch<SetStateAction<string>>
  setSelectionRect: Dispatch<SetStateAction<SelectionRect>>
  setSelectedLayerIds: Dispatch<SetStateAction<Set<string>>>
  setSelectedLayerId: Dispatch<SetStateAction<string | null>>
  setIsDraggingOver: Dispatch<SetStateAction<boolean>>
  broadcast: (event: string, payload: unknown) => void
  canEditLayer: (layer: TableLayer) => boolean
  patchLayer: (id: string, patch: LayerPatch) => Promise<void>
  setLayerSelection: (ids: string[], primaryId?: string | null) => void
  placeLayerOnTable: (layerId: string, point?: { x: number; y: number }) => Promise<void>
  uploadFiles: (
    files: FileList | File[],
    onTable?: boolean,
    options?: { asBackground?: boolean; point?: { x: number; y: number }; preserveFolders?: boolean },
  ) => Promise<void>
  addRemoteMediaUrls: (
    items: Array<{ url: string; layerType: 'image' | 'video' }>,
    point?: { x: number; y: number },
    onTable?: boolean,
  ) => Promise<boolean>
  getDroppedMediaUrls: (dataTransfer: DataTransfer) => Array<{ url: string; layerType: 'image' | 'video' }>
  pasteOnTable: (clipboardData: DataTransfer, point?: { x: number; y: number }) => Promise<boolean>
}

export function useTableCanvas(options: UseTableCanvasOptions) {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const dragRef = useRef<DragState | null>(null)
  const dragAnimationFrameRef = useRef<number | null>(null)
  const pendingDragPointerRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const dragLayerElementsRef = useRef<Map<string, HTMLElement>>(new Map())
  const dragPreviewPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const dragPreviewBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const touchGestureRef = useRef<TouchGestureState | null>(null)
  const zoomRef = useRef(options.zoom)

  useEffect(() => {
    zoomRef.current = options.zoom
  }, [options.zoom])

  useEffect(() => () => {
    if (dragAnimationFrameRef.current !== null) cancelAnimationFrame(dragAnimationFrameRef.current)
  }, [])

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (!event.clipboardData || isEditablePasteTarget(event.target)) return
      if (!parseClipboardForTablePaste(event.clipboardData)) return

      event.preventDefault()

      const opts = optionsRef.current
      const rect = opts.sceneRef.current?.getBoundingClientRect()
      const zoom = zoomRef.current
      const point = rect
        ? {
          x: (rect.width / 2 - opts.panRef.current.x) / zoom,
          y: (rect.height / 2 - opts.panRef.current.y) / zoom,
        }
        : undefined

      void opts.pasteOnTable(event.clipboardData, point)
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  const previewLayerOpacity = (id: string, opacity: number) => {
    const element = Array.from(
      optionsRef.current.sceneRef.current?.querySelectorAll<HTMLElement>('.scene-layer[data-layer-id]') || [],
    ).find(item => item.dataset.layerId === id)
    if (element) element.style.opacity = String(opacity)
  }

  const commitLayerOpacity = (id: string, input: HTMLInputElement) => {
    const opacity = Number(input.value)
    if (!Number.isFinite(opacity) || input.dataset.committedValue === String(opacity)) return
    input.dataset.committedValue = String(opacity)
    void optionsRef.current.patchLayer(id, { opacity })
  }

  const getScenePointFromClient = (clientX: number, clientY: number) => {
    const rect = optionsRef.current.sceneRef.current?.getBoundingClientRect()
    const zoom = zoomRef.current
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - optionsRef.current.panRef.current.x) / zoom,
      y: (clientY - rect.top - optionsRef.current.panRef.current.y) / zoom,
    }
  }

  const getScenePoint = (event: React.PointerEvent<HTMLElement>) => (
    getScenePointFromClient(event.clientX, event.clientY)
  )

  const prepareLayerDragPreview = (ids: Set<string>, mode: 'move' | 'resize') => {
    const elements = new Map<string, HTMLElement>()
    optionsRef.current.sceneRef.current?.querySelectorAll<HTMLElement>('.scene-layer[data-layer-id]').forEach(element => {
      const id = element.dataset.layerId
      if (!id || !ids.has(id)) return
      element.style.willChange = mode === 'move' ? 'transform' : 'left, top, width, height'
      elements.set(id, element)
    })
    dragLayerElementsRef.current = elements
    dragPreviewPositionsRef.current = new Map()
    dragPreviewBoundsRef.current = null
    pendingDragPointerRef.current = null
  }

  const applyLayerMovePreview = (drag: DragState, clientX: number, clientY: number) => {
    const zoom = zoomRef.current
    const sceneDx = (clientX - drag.startClientX) / zoom
    const sceneDy = (clientY - drag.startClientY) / zoom
    const positions = new Map<string, { x: number; y: number }>()
    positions.set(drag.id, {
      x: Math.round(drag.startX + sceneDx),
      y: Math.round(drag.startY + sceneDy),
    })
    drag.childStartPositions.forEach(child => {
      positions.set(child.id, {
        x: Math.round(child.x + sceneDx),
        y: Math.round(child.y + sceneDy),
      })
    })
    dragPreviewPositionsRef.current = positions

    dragLayerElementsRef.current.forEach(element => {
      element.style.transform = `translate3d(${sceneDx}px, ${sceneDy}px, 0)`
    })
  }

  const applyLayerResizePreview = (drag: DragState, clientX: number, clientY: number) => {
    const zoom = zoomRef.current
    const sceneDx = (clientX - drag.startClientX) / zoom
    const sceneDy = (clientY - drag.startClientY) / zoom
    const horizontal = drag.corner?.includes('w') ? -sceneDx : sceneDx
    const vertical = drag.corner?.includes('n') ? -sceneDy : sceneDy
    const widthFromX = drag.startWidth + horizontal
    const widthFromY = (drag.startHeight + vertical) * drag.aspectRatio
    const width = Math.max(60, Math.round(Math.abs(horizontal) > Math.abs(vertical) ? widthFromX : widthFromY))
    const height = Math.max(60, Math.round(width / drag.aspectRatio))
    const x = drag.corner?.includes('w') ? Math.round(drag.startX + drag.startWidth - width) : drag.startX
    const y = drag.corner?.includes('n') ? Math.round(drag.startY + drag.startHeight - height) : drag.startY
    dragPreviewBoundsRef.current = { x, y, width, height }

    const element = dragLayerElementsRef.current.get(drag.id)
    if (!element) return
    element.style.left = `${x}px`
    element.style.top = `${y}px`
    element.style.width = `${width}px`
    element.style.height = `${height}px`
  }

  const startLayerDrag = (
    event: React.PointerEvent<HTMLElement>,
    layer: TableLayer,
    mode: 'move' | 'resize',
    corner: DragState['corner'] = 'se',
  ) => {
    const opts = optionsRef.current
    if (event.button !== 0) return
    if (!opts.canEditLayer(layer)) return
    if (layer.locked) return
    const target = event.target as HTMLElement
    if (mode === 'move' && layerUsesInteractiveDragHandle(layer)) {
      if (!target.closest('.layer-drag-handle')) {
        opts.setLayerSelection([layer.id], layer.id)
        return
      }
    }
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const nextSelection = opts.selectedLayerIds.has(layer.id) ? opts.selectedLayerIds : new Set([layer.id])
    opts.setSelectedLayerIds(nextSelection)
    opts.setSelectedLayerId(layer.id)
    const moveIds = new Set<string>()
    if (mode === 'move') {
      nextSelection.forEach(id => {
        moveIds.add(id)
        getDescendantIds(opts.layersRef.current, id).forEach(childId => moveIds.add(childId))
      })
      moveIds.delete(layer.id)
    }
    dragRef.current = {
      id: layer.id,
      mode,
      corner,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: layer.x,
      startY: layer.y,
      startWidth: layer.width,
      startHeight: layer.height,
      startPanX: opts.panRef.current.x,
      startPanY: opts.panRef.current.y,
      aspectRatio: Math.max(0.01, layer.width / layer.height),
      childStartPositions: opts.layersRef.current
        .filter(item => moveIds.has(item.id))
        .map(item => ({ id: item.id, x: item.x, y: item.y })),
    }
    prepareLayerDragPreview(new Set([layer.id, ...moveIds]), mode)
  }

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const opts = optionsRef.current
    if (event.button !== 2 && event.button !== 0) return
    const target = event.target as HTMLElement
    const emptySceneTarget = target.classList.contains('scene') || target.classList.contains('scene-world')
    if (event.button === 0 && !emptySceneTarget) return
    // Right-click drag pans the table; context menu opens only on click without movement
    // (see suppressNextContextMenuRef in updateLayerDrag + openLayerContextMenu).
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    opts.suppressNextContextMenuRef.current = false
    if (event.button === 0) {
      const point = getScenePoint(event)
      opts.setLayerSelection([])
      opts.setSelectionRect({ x: point.x, y: point.y, width: 0, height: 0 })
      dragRef.current = {
        id: '',
        mode: 'select',
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: point.x,
        startY: point.y,
        startWidth: 0,
        startHeight: 0,
        startPanX: opts.panRef.current.x,
        startPanY: opts.panRef.current.y,
        aspectRatio: 1,
        childStartPositions: [],
      }
      return
    }
    dragRef.current = {
      id: '',
      mode: 'pan',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
      startPanX: opts.panRef.current.x,
      startPanY: opts.panRef.current.y,
      aspectRatio: 1,
      childStartPositions: [],
    }
  }

  const updateLayerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const opts = optionsRef.current

    const dx = event.clientX - drag.startClientX
    const dy = event.clientY - drag.startClientY

    if (drag.mode === 'pan') {
      if (Math.abs(dx) + Math.abs(dy) > 6) opts.suppressNextContextMenuRef.current = true
      opts.setPan({ x: drag.startPanX + dx, y: drag.startPanY + dy })
      return
    }

    if (drag.mode === 'select') {
      const point = getScenePoint(event)
      const x = Math.min(drag.startX, point.x)
      const y = Math.min(drag.startY, point.y)
      const width = Math.abs(point.x - drag.startX)
      const height = Math.abs(point.y - drag.startY)
      const rect = { x, y, width, height }
      opts.setSelectionRect(rect)
      const selected = opts.visibleLayers
        .filter(layer => (
          layer.x < x + width
          && layer.x + layer.width > x
          && layer.y < y + height
          && layer.y + layer.height > y
        ))
        .map(layer => layer.id)
      opts.setLayerSelection(selected)
      return
    }

    if (drag.mode === 'move' || drag.mode === 'resize') {
      pendingDragPointerRef.current = { clientX: event.clientX, clientY: event.clientY }
      if (dragAnimationFrameRef.current === null) {
        dragAnimationFrameRef.current = requestAnimationFrame(() => {
          dragAnimationFrameRef.current = null
          const pending = pendingDragPointerRef.current
          const activeDrag = dragRef.current
          if (!pending || !activeDrag) return
          if (activeDrag.mode === 'move') applyLayerMovePreview(activeDrag, pending.clientX, pending.clientY)
          if (activeDrag.mode === 'resize') applyLayerResizePreview(activeDrag, pending.clientX, pending.clientY)
        })
      }
    }
  }

  const finishLayerDrag = async () => {
    const drag = dragRef.current
    if (!drag) return
    const opts = optionsRef.current

    if ((drag.mode === 'move' || drag.mode === 'resize') && pendingDragPointerRef.current) {
      if (dragAnimationFrameRef.current !== null) cancelAnimationFrame(dragAnimationFrameRef.current)
      dragAnimationFrameRef.current = null
      if (drag.mode === 'move') {
        applyLayerMovePreview(drag, pendingDragPointerRef.current.clientX, pendingDragPointerRef.current.clientY)
      }
      if (drag.mode === 'resize') {
        applyLayerResizePreview(drag, pendingDragPointerRef.current.clientX, pendingDragPointerRef.current.clientY)
      }
    }
    dragRef.current = null
    pendingDragPointerRef.current = null
    if (drag.mode === 'select') {
      opts.setSelectionRect(null)
      return
    }
    if (drag.mode === 'pan') return
    if (drag.mode === 'move') {
      const positions = dragPreviewPositionsRef.current
      dragPreviewPositionsRef.current = new Map()
      if (positions.size === 0) {
        dragLayerElementsRef.current.forEach(element => {
          element.style.transform = ''
          element.style.willChange = ''
        })
        dragLayerElementsRef.current = new Map()
        return
      }

      const nextLayers = opts.layersRef.current.map(layer => {
        const position = positions.get(layer.id)
        return position ? { ...layer, ...position } : layer
      })
      opts.layersRef.current = nextLayers
      dragLayerElementsRef.current.forEach((element, id) => {
        const position = positions.get(id)
        if (position) {
          element.style.left = `${position.x}px`
          element.style.top = `${position.y}px`
        }
        element.style.transform = ''
        element.style.willChange = ''
      })
      dragLayerElementsRef.current = new Map()
      opts.setLayers(nextLayers)

      const updates = Array.from(positions, ([id, position]) => ({ id, ...position }))
      opts.broadcast('layer-move', { room: opts.room, updates })
      const results = await updateLayerRecords(
        updates.map(update => ({ id: update.id, patch: { x: update.x, y: update.y } })),
      )
      if (results.some(result => result.error)) {
        console.error('Не удалось сохранить перемещение слоёв:', results.filter(result => result.error).map(result => result.error))
        opts.setTableStatus('Позиция слоя не сохранилась')
      }
      return
    }
    const bounds = dragPreviewBoundsRef.current
    dragPreviewBoundsRef.current = null
    dragLayerElementsRef.current.forEach(element => {
      element.style.willChange = ''
    })
    dragLayerElementsRef.current = new Map()
    if (bounds) await opts.patchLayer(drag.id, bounds)
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const opts = optionsRef.current
    const rect = event.currentTarget.getBoundingClientRect()
    const nextZoom = Math.min(5, Math.max(0.2, opts.zoom * (event.deltaY > 0 ? 0.9 : 1.1)))
    const cursorX = event.clientX - rect.left
    const cursorY = event.clientY - rect.top
    const worldX = (cursorX - opts.pan.x) / opts.zoom
    const worldY = (cursorY - opts.pan.y) / opts.zoom
    opts.setPan({
      x: Math.round(cursorX - worldX * nextZoom),
      y: Math.round(cursorY - worldY * nextZoom),
    })
    opts.setZoom(nextZoom)
  }

  const getTouchCenter = (touches: React.TouchList | TouchList) => {
    const first = touches[0]
    const second = touches[1] || touches[0]
    return {
      x: (first.clientX + second.clientX) / 2,
      y: (first.clientY + second.clientY) / 2,
    }
  }

  const getTouchDistance = (touches: React.TouchList | TouchList) => {
    if (touches.length < 2) return 1
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.max(1, Math.hypot(dx, dy))
  }

  const startSceneTouch = (event: React.TouchEvent<HTMLDivElement>) => {
    const opts = optionsRef.current
    const rect = opts.sceneRef.current?.getBoundingClientRect()
    if (!rect) return

    if (event.touches.length >= 2) {
      event.preventDefault()
      dragRef.current = null
      opts.setSelectionRect(null)
      const center = getTouchCenter(event.touches)
      touchGestureRef.current = {
        mode: 'pinch',
        startClientX: center.x,
        startClientY: center.y,
        startPanX: opts.panRef.current.x,
        startPanY: opts.panRef.current.y,
        startDistance: getTouchDistance(event.touches),
        startZoom: opts.zoom,
        worldCenterX: (center.x - rect.left - opts.panRef.current.x) / opts.zoom,
        worldCenterY: (center.y - rect.top - opts.panRef.current.y) / opts.zoom,
      }
      return
    }

    const target = event.target as HTMLElement
    const emptySceneTarget = target.classList.contains('scene') || target.classList.contains('scene-world')
    if (!emptySceneTarget) return

    event.preventDefault()
    const touch = event.touches[0]
    touchGestureRef.current = {
      mode: 'pan',
      startClientX: touch.clientX,
      startClientY: touch.clientY,
      startPanX: opts.panRef.current.x,
      startPanY: opts.panRef.current.y,
      startDistance: 1,
      startZoom: opts.zoom,
      worldCenterX: 0,
      worldCenterY: 0,
    }
  }

  const updateSceneTouch = (event: React.TouchEvent<HTMLDivElement>) => {
    const gesture = touchGestureRef.current
    const opts = optionsRef.current
    const rect = opts.sceneRef.current?.getBoundingClientRect()
    if (!gesture || !rect) return

    event.preventDefault()
    if (gesture.mode === 'pinch' && event.touches.length >= 2) {
      const center = getTouchCenter(event.touches)
      const nextZoom = Math.min(5, Math.max(0.2, gesture.startZoom * (getTouchDistance(event.touches) / gesture.startDistance)))
      opts.setZoom(nextZoom)
      opts.setPan({
        x: Math.round(center.x - rect.left - gesture.worldCenterX * nextZoom),
        y: Math.round(center.y - rect.top - gesture.worldCenterY * nextZoom),
      })
      return
    }

    if (gesture.mode === 'pan' && event.touches.length === 1) {
      const touch = event.touches[0]
      opts.setPan({
        x: Math.round(gesture.startPanX + touch.clientX - gesture.startClientX),
        y: Math.round(gesture.startPanY + touch.clientY - gesture.startClientY),
      })
    }
  }

  const finishSceneTouch = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 0) touchGestureRef.current = null
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const opts = optionsRef.current
    opts.setIsDraggingOver(false)
    const libraryLayerId = event.dataTransfer.getData('application/x-vtm-library-layer')
    if (libraryLayerId) {
      await opts.placeLayerOnTable(libraryLayerId, getScenePointFromClient(event.clientX, event.clientY))
      return
    }
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    if (droppedFiles.some(file => file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      await opts.uploadFiles(droppedFiles, true, {
        point: getScenePointFromClient(event.clientX, event.clientY),
        preserveFolders: true,
      })
      return
    }

    const mediaUrls = opts.getDroppedMediaUrls(event.dataTransfer)
    if (mediaUrls.length > 0) {
      await opts.addRemoteMediaUrls(mediaUrls, getScenePointFromClient(event.clientX, event.clientY))
      return
    }

    if (droppedFiles.length > 0) {
      await opts.uploadFiles(droppedFiles, true, {
        point: getScenePointFromClient(event.clientX, event.clientY),
        preserveFolders: true,
      })
    }
  }

  return {
    previewLayerOpacity,
    commitLayerOpacity,
    getScenePointFromClient,
    startLayerDrag,
    startPan,
    updateLayerDrag,
    finishLayerDrag,
    handleWheel,
    startSceneTouch,
    updateSceneTouch,
    finishSceneTouch,
    handleDrop,
  }
}