import type { Dispatch, PointerEvent, SetStateAction } from 'react'
import { createEditorState } from '../utils/layer-utils'
import type { ImageEditorDraft, ImageEditorState, LayerContextMenu, LayerPatch, TableLayer } from '../types'

export type ImageEditorActionsDeps = {
  setImageEditor: Dispatch<SetStateAction<ImageEditorDraft | null>>
  setLayerContextMenu: Dispatch<SetStateAction<LayerContextMenu>>
  getImageEditor: () => ImageEditorDraft | null
  getLayerById: (id: string) => TableLayer | undefined
  canEditLayer: (layer: TableLayer) => boolean
  patchLayer: (id: string, patch: LayerPatch) => Promise<void>
  addMediaLayer: (
    imageData: string,
    name: string,
    natural: { width: number; height: number },
    layerType?: 'image' | 'video' | 'text' | 'file',
    index?: number,
    point?: { x: number; y: number },
    onTable?: boolean,
    overrides?: LayerPatch,
  ) => Promise<string | void>
}

export function createImageEditorActions(deps: ImageEditorActionsDeps) {
  const openImageEditor = (layer: TableLayer) => {
    if (!deps.canEditLayer(layer) || !['image', 'video'].includes(layer.layerType)) return
    deps.setImageEditor({
      layerId: layer.id,
      state: createEditorState(layer),
      history: [],
      future: [],
      aspectLocked: false,
      drag: null,
    })
    deps.setLayerContextMenu(null)
  }

  const updateImageEditor = (updater: (state: ImageEditorState) => ImageEditorState, commit = true) => {
    deps.setImageEditor(editor => {
      if (!editor) return editor
      const nextState = updater(editor.state)
      return {
        ...editor,
        state: nextState,
        history: commit ? [...editor.history, editor.state].slice(-40) : editor.history,
        future: commit ? [] : editor.future,
      }
    })
  }

  const undoImageEditor = () => {
    deps.setImageEditor(editor => {
      if (!editor || editor.history.length === 0) return editor
      const previous = editor.history[editor.history.length - 1]
      return {
        ...editor,
        state: previous,
        history: editor.history.slice(0, -1),
        future: [editor.state, ...editor.future].slice(0, 40),
      }
    })
  }

  const redoImageEditor = () => {
    deps.setImageEditor(editor => {
      if (!editor || editor.future.length === 0) return editor
      const next = editor.future[0]
      return {
        ...editor,
        state: next,
        history: [...editor.history, editor.state].slice(-40),
        future: editor.future.slice(1),
      }
    })
  }

  const applyImageEditor = async (saveAsNew = false) => {
    const imageEditor = deps.getImageEditor()
    if (!imageEditor) return
    const layer = deps.getLayerById(imageEditor.layerId)
    if (!layer) return
    const patch: LayerPatch = {
      cropX: imageEditor.state.cropX,
      cropY: imageEditor.state.cropY,
      cropWidth: imageEditor.state.cropWidth,
      cropHeight: imageEditor.state.cropHeight,
      rotation: imageEditor.state.rotation,
      flipX: imageEditor.state.flipX,
      flipY: imageEditor.state.flipY,
      brightness: imageEditor.state.brightness,
      contrast: imageEditor.state.contrast,
      saturation: imageEditor.state.saturation,
    }
    if (saveAsNew) {
      await deps.addMediaLayer(
        layer.imageData,
        `${layer.name} copy`,
        { width: layer.width, height: layer.height },
        layer.layerType === 'video' ? 'video' : 'image',
        0,
        undefined,
        layer.onTable,
        {
          ...patch,
          x: layer.x + 32,
          y: layer.y + 32,
        },
      )
    } else {
      await deps.patchLayer(layer.id, patch)
    }
    deps.setImageEditor(null)
  }

  const startEditorCropDrag = (
    event: PointerEvent<HTMLElement>,
    handle: NonNullable<ImageEditorDraft['drag']>['handle'],
  ) => {
    const imageEditor = deps.getImageEditor()
    if (!imageEditor) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    deps.setImageEditor({
      ...imageEditor,
      history: [...imageEditor.history, imageEditor.state].slice(-40),
      future: [],
      drag: {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        initial: imageEditor.state,
      },
    })
  }

  const updateEditorCropDrag = (event: PointerEvent<HTMLElement>) => {
    const imageEditor = deps.getImageEditor()
    if (!imageEditor?.drag) return
    const rect = event.currentTarget.getBoundingClientRect()
    const dx = ((event.clientX - imageEditor.drag.startX) / Math.max(1, rect.width)) * 100
    const dy = ((event.clientY - imageEditor.drag.startY) / Math.max(1, rect.height)) * 100
    const initial = imageEditor.drag.initial
    let cropX = initial.cropX
    let cropY = initial.cropY
    let cropWidth = initial.cropWidth
    let cropHeight = initial.cropHeight

    if (imageEditor.drag.handle === 'move') {
      cropX = initial.cropX + dx
      cropY = initial.cropY + dy
    } else {
      if (imageEditor.drag.handle.includes('w')) {
        cropX = initial.cropX + dx
        cropWidth = initial.cropWidth - dx
      }
      if (imageEditor.drag.handle.includes('e')) cropWidth = initial.cropWidth + dx
      if (imageEditor.drag.handle.includes('n')) {
        cropY = initial.cropY + dy
        cropHeight = initial.cropHeight - dy
      }
      if (imageEditor.drag.handle.includes('s')) cropHeight = initial.cropHeight + dy
    }

    cropWidth = Math.max(8, Math.min(100, cropWidth))
    cropHeight = Math.max(8, Math.min(100, cropHeight))
    cropX = Math.max(0, Math.min(100 - cropWidth, cropX))
    cropY = Math.max(0, Math.min(100 - cropHeight, cropY))
    deps.setImageEditor({ ...imageEditor, state: { ...imageEditor.state, cropX, cropY, cropWidth, cropHeight } })
  }

  const finishEditorCropDrag = () => {
    deps.setImageEditor(editor => (editor ? { ...editor, drag: null } : editor))
  }

  return {
    openImageEditor,
    updateImageEditor,
    undoImageEditor,
    redoImageEditor,
    applyImageEditor,
    startEditorCropDrag,
    updateEditorCropDrag,
    finishEditorCropDrag,
  }
}