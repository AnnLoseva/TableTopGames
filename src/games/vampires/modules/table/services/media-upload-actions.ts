import type { ChangeEvent, Dispatch, FormEvent, MutableRefObject, SetStateAction } from 'react'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import { uploadTableImageFile } from '../api/layer-api'
import type { LayerPatch, MediaTab, RightRailTab, TableLayer } from '../types'
import {
  escapeHtml,
  getDroppedMediaUrls,
  getFileText,
  getImageNameFromUrl,
  getMediaSize,
  getMediaUrlsFromText,
  getTextLayerData,
  isReadableTextFile,
  isWordLikeFile,
  parseClipboardForTablePaste,
  safeStorageName,
} from '../utils/media-utils'

export type MediaUploadActionsDeps = {
  room: string
  t: (ru: string) => string
  isMaster: boolean
  chatUser: ChatUser | null
  mediaTab: MediaTab
  mediaUrlDraft: string
  textMaterialDraft: string
  textMaterialNameDraft: string
  layersRef: MutableRefObject<TableLayer[]>
  setIsUploading: Dispatch<SetStateAction<boolean>>
  setTableStatus: Dispatch<SetStateAction<string>>
  setRightRailTab: Dispatch<SetStateAction<RightRailTab>>
  setMediaUrlDraft: Dispatch<SetStateAction<string>>
  setTextMaterialDraft: Dispatch<SetStateAction<string>>
  setTextMaterialNameDraft: Dispatch<SetStateAction<string>>
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
  createFolder: (
    parentId?: string | null,
    name?: string,
    selectAfterCreate?: boolean,
    onTable?: boolean,
  ) => Promise<string | null>
  /** Set the active-scene background (spec: background lives on the scene, not as a layer). */
  setSceneBackground: (url: string, natural: { width: number; height: number }) => void | Promise<void>
}

export function createMediaUploadActions(deps: MediaUploadActionsDeps) {
  const uploadFiles = async (
    files: FileList | File[],
    onTable = true,
    options: { asBackground?: boolean; point?: { x: number; y: number }; preserveFolders?: boolean } = {},
  ) => {
    const uploadItems = Array.from(files).map(file => ({
      file,
      relativePath: options.preserveFolders ? file.webkitRelativePath || file.name : file.name,
    }))
    if (uploadItems.length === 0) return
    if (!deps.isMaster && !deps.chatUser) {
      window.alert(deps.t('Сначала войди в аккаунт игрока, чтобы добавлять медиа в комнату.'))
      deps.setRightRailTab('chat')
      return
    }

    deps.setIsUploading(true)

    try {
      const folderIds = new Map<string, string | null>()

      const ensureFolder = async (folderPath: string, onTableForFolder: boolean) => {
        const parts = folderPath.split('/').map(part => part.trim()).filter(Boolean)
        if (parts.length === 0) return null

        let parentId: string | null = null
        let pathKey = ''

        for (const part of parts) {
          pathKey = pathKey ? `${pathKey}/${part}` : part
          if (folderIds.has(pathKey)) {
            parentId = folderIds.get(pathKey) ?? null
            continue
          }

          const existing = deps.layersRef.current.find(layer =>
            layer.layerType === 'folder'
            && layer.parentId === parentId
            && layer.name === part
            && layer.onTable === onTableForFolder,
          )
          const folderId = existing?.id || await deps.createFolder(parentId, part, false, onTableForFolder)
          folderIds.set(pathKey, folderId)
          if (folderId) parentId = folderId
        }

        return parentId
      }

      for (const [index, item] of uploadItems.entries()) {
        const file = item.file
        const relativeParts = item.relativePath.split('/').filter(Boolean)
        const parentFolderPath = relativeParts.length > 1 ? relativeParts.slice(0, -1).join('/') : ''
        const parentId = options.preserveFolders && parentFolderPath
          ? await ensureFolder(parentFolderPath, onTable)
          : undefined
        const layerType: 'image' | 'video' | 'text' | 'file' = file.type.startsWith('image/')
          ? 'image'
          : file.type.startsWith('video/')
            ? 'video'
            : isReadableTextFile(file)
              ? 'text'
              : 'file'
        const objectUrl = URL.createObjectURL(file)
        const natural = layerType === 'image' || layerType === 'video'
          ? await getMediaSize(objectUrl, layerType)
          : isWordLikeFile(file)
            ? { width: 460, height: 320 }
            : { width: 440, height: 300 }
        URL.revokeObjectURL(objectUrl)

        const storageFolderPath = options.preserveFolders
          ? relativeParts.slice(0, -1).map(part => safeStorageName(part)).filter(Boolean).join('/')
          : ''
        const { error: uploadError, publicUrl } = await uploadTableImageFile(deps.room, file, { storageFolderPath })

        if (uploadError || !publicUrl) {
          console.error('Не удалось загрузить файл в Storage:', uploadError)
          window.alert(deps.t('Файл не загрузился в Supabase Storage. Примени обновлённый SQL для bucket table-images.'))
          continue
        }

        if (options.asBackground && layerType === 'image') {
          // Scene background is a scene property, not a layer: the stage size
          // follows the image's natural size and nothing lands on the canvas.
          await deps.setSceneBackground(publicUrl, natural)
          continue
        }

        const layerData = layerType === 'text'
          ? getTextLayerData(file, await getFileText(file))
          : layerType === 'file'
            ? JSON.stringify({
              url: publicUrl,
              type: file.type || 'application/octet-stream',
              wordLike: isWordLikeFile(file),
              pdf: /\.pdf$/i.test(file.name) || /pdf/i.test(file.type),
              name: file.name,
            })
            : publicUrl
        await deps.addMediaLayer(
          layerData,
          file.name,
          natural,
          layerType,
          index,
          options.point,
          onTable,
          {
            ...(parentId !== undefined ? { parentId } : {}),
          },
        )
      }

      deps.setTableStatus('Сцена онлайн')
    } finally {
      deps.setIsUploading(false)
    }
  }

  const addRemoteMediaUrls = async (
    items: Array<{ url: string; layerType: 'image' | 'video' }>,
    point?: { x: number; y: number },
    onTable = true,
  ) => {
    if (items.length === 0) return false
    deps.setIsUploading(true)

    try {
      for (const [index, item] of items.entries()) {
        const natural = await getMediaSize(item.url, item.layerType)
        await deps.addMediaLayer(
          item.url,
          getImageNameFromUrl(item.url),
          natural,
          item.layerType,
          index,
          point ? { x: point.x + index * 28, y: point.y + index * 24 } : undefined,
          onTable,
        )
      }
      deps.setTableStatus('Сцена онлайн')
      return true
    } finally {
      deps.setIsUploading(false)
    }
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await uploadFiles(event.target.files, deps.mediaTab !== 'library')
      event.target.value = ''
    }
  }

  const handleMediaUrlSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const items = getMediaUrlsFromText(deps.mediaUrlDraft)
    if (items.length === 0) {
      window.alert(deps.t('Вставь ссылку на YouTube или прямую ссылку на файл: jpg, png, webp, gif, svg, mp4, webm, mov, m4v, ogg.'))
      return
    }

    const added = await addRemoteMediaUrls(items)
    if (added) deps.setMediaUrlDraft('')
  }

  const createTextMaterial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = deps.textMaterialDraft.trim()
    if (!text) return
    await deps.addMediaLayer(
      text,
      deps.textMaterialNameDraft.trim() || deps.t('Текст мастера'),
      { width: 420, height: 260 },
      'text',
      0,
      undefined,
      false,
    )
    deps.setTextMaterialDraft('')
    deps.setTextMaterialNameDraft('')
  }

  const handleSceneMediaDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    if (droppedFiles.length > 0) {
      await uploadFiles(droppedFiles, false, { preserveFolders: true })
      return
    }

    const mediaUrls = getDroppedMediaUrls(event.dataTransfer)
    if (mediaUrls.length > 0) await addRemoteMediaUrls(mediaUrls, undefined, false)
  }

  const pasteOnTable = async (
    clipboardData: DataTransfer,
    point?: { x: number; y: number },
  ) => {
    const payload = parseClipboardForTablePaste(clipboardData, deps.t('Текст'))
    if (!payload) return false

    if (payload.kind === 'files') {
      await uploadFiles(payload.files, true, { point, preserveFolders: false })
      return true
    }

    if (payload.kind === 'media-urls') {
      await addRemoteMediaUrls(payload.items, point, true)
      return true
    }

    const lineCount = payload.text.split(/\r?\n/).length
    const height = Math.min(640, Math.max(180, lineCount * 22 + 56))
    await deps.addMediaLayer(
      `<pre>${escapeHtml(payload.text)}</pre>`,
      payload.title,
      { width: 420, height },
      'text',
      0,
      point,
      true,
    )
    deps.setTableStatus('Сцена онлайн')
    return true
  }

  const handleTableLayerPanelDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    if (droppedFiles.length > 0) {
      await uploadFiles(droppedFiles, true, { preserveFolders: true })
      return
    }
    const mediaUrls = getDroppedMediaUrls(event.dataTransfer)
    if (mediaUrls.length > 0) await addRemoteMediaUrls(mediaUrls, undefined, true)
  }

  return {
    uploadFiles,
    addRemoteMediaUrls,
    handleImageUpload,
    handleMediaUrlSubmit,
    createTextMaterial,
    handleSceneMediaDrop,
    handleTableLayerPanelDrop,
    pasteOnTable,
  }
}