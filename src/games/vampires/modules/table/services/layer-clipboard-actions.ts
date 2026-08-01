import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import type { JournalEntry, LayerContextMenu, RightRailTab, TableLayer } from '../types'
import { getLayerClipboardText, getLayerShareUrl } from '../utils/layer-utils'

export type LayerClipboardActionsDeps = {
  room: string
  t: (ru: string) => string
  chatUser: ChatUser | null
  selectedLayerIds: Set<string>
  journalEntries: JournalEntry[]
  selectedJournalEntry: JournalEntry | null
  layersRef: MutableRefObject<TableLayer[]>
  sceneRef: RefObject<HTMLDivElement | null>
  setTableStatus: Dispatch<SetStateAction<string>>
  setLayerContextMenu: Dispatch<SetStateAction<LayerContextMenu>>
  setRightRailTab: Dispatch<SetStateAction<RightRailTab>>
  setSelectedJournalEntryId: Dispatch<SetStateAction<string>>
  setZoom: Dispatch<SetStateAction<number>>
  setPan: Dispatch<SetStateAction<{ x: number; y: number }>>
  saveJournalEntries: (entries: JournalEntry[], status?: string) => void
  broadcast: (event: string, payload: unknown) => void
}

export function createLayerClipboardActions(deps: LayerClipboardActionsDeps) {
  const getContextLayerIds = (layerId: string | null) => {
    if (layerId && deps.selectedLayerIds.has(layerId) && deps.selectedLayerIds.size > 1) {
      return [...deps.selectedLayerIds]
    }
    if (layerId) return [layerId]
    return [...deps.selectedLayerIds]
  }

  const copyTextToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      deps.setTableStatus('Скопировано')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
      deps.setTableStatus('Скопировано')
    }
  }

  const addLayerToJournal = (imageUrl: string, name: string) => {
    if (!deps.chatUser) return
    const imgHtml = `<p><img src="${imageUrl}" alt="${name}"></p>`
    const selectedEntry = deps.selectedJournalEntry
    if (selectedEntry) {
      const newText = (selectedEntry.text || '') + imgHtml
      const now = new Date().toISOString()
      const next = deps.journalEntries.map(entry =>
        entry.id === selectedEntry.id ? { ...entry, text: newText, updatedAt: now } : entry
      )
      deps.saveJournalEntries(next, 'Есть несохранённые изменения')
    } else {
      const now = new Date().toISOString()
      const entry: JournalEntry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: name || deps.t('Изображение со стола'),
        text: imgHtml,
        createdAt: now,
        updatedAt: now,
      }
      deps.saveJournalEntries([entry, ...deps.journalEntries], 'Сохранено')
      deps.setSelectedJournalEntryId(entry.id)
    }
    deps.setRightRailTab('diary')
    deps.setLayerContextMenu(null)
    deps.setTableStatus('Добавлено в дневник')
  }

  const copyLayerUrl = async (layer: TableLayer) => {
    const url = getLayerShareUrl(layer)
    await copyTextToClipboard(url || getLayerClipboardText(layer))
    deps.setLayerContextMenu(null)
  }

  const focusLayersForEveryone = (ids: string[]) => {
    const targets = ids
      .map(id => deps.layersRef.current.find(layer => layer.id === id))
      .filter((layer): layer is TableLayer => Boolean(layer))
    if (targets.length === 0 || !deps.sceneRef.current) return

    const minX = Math.min(...targets.map(layer => layer.x))
    const minY = Math.min(...targets.map(layer => layer.y))
    const maxX = Math.max(...targets.map(layer => layer.x + layer.width))
    const maxY = Math.max(...targets.map(layer => layer.y + layer.height))
    const rect = deps.sceneRef.current.getBoundingClientRect()
    const contentWidth = Math.max(1, maxX - minX)
    const contentHeight = Math.max(1, maxY - minY)
    const nextZoom = Math.min(5, Math.max(0.2, Math.min((rect.width - 80) / contentWidth, (rect.height - 80) / contentHeight)))
    const nextPan = {
      x: Math.round(rect.width / 2 - (minX + contentWidth / 2) * nextZoom),
      y: Math.round(rect.height / 2 - (minY + contentHeight / 2) * nextZoom),
    }

    deps.setZoom(nextZoom)
    deps.setPan(nextPan)
    deps.broadcast('viewport-focus', { room: deps.room, pan: nextPan, zoom: nextZoom })
  }

  return {
    getContextLayerIds,
    copyTextToClipboard,
    addLayerToJournal,
    copyLayerUrl,
    focusLayersForEveryone,
  }
}