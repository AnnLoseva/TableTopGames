'use client'

import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import type { LayerContextMenu, TableLayer } from '../types'
import SmartContextMenu from './SmartContextMenu'

export type LayerContextMenuPanelProps = {
  layerContextMenu: NonNullable<LayerContextMenu>
  layers: TableLayer[]
  isMaster: boolean
  chatUser: ChatUser | null
  tableManagerLayers: TableLayer[]
  libraryLayers: TableLayer[]
  getContextLayerIds: (layerId: string | null) => string[]
  canEditLayer: (layer: TableLayer) => boolean
  addLayerToJournal: (imageData: string, name: string) => void
  copyLayerUrl: (layer: TableLayer) => void
  renameLayer: (layer: TableLayer) => void
  patchSelectedLayers: (ids: string[], patchFn: (layer: TableLayer) => { visible?: boolean; locked?: boolean }) => void | Promise<void>
  reorderLayers: (ids: string[], direction: 'top' | 'up' | 'down' | 'bottom') => void
  moveLayersToFolder: (ids: string[], folderId: string) => void
  createFolderForSelection: (ids: string[]) => void
  focusLayersForEveryone: (ids: string[]) => void
  deleteSelectedLayers: (ids: string[]) => void
  setLayerAsBackground: (layer: TableLayer) => void | Promise<void>
  onClose: () => void
}

export default function LayerContextMenuPanel({
  layerContextMenu,
  layers,
  isMaster,
  chatUser,
  tableManagerLayers,
  libraryLayers,
  getContextLayerIds,
  canEditLayer,
  addLayerToJournal,
  copyLayerUrl,
  renameLayer,
  patchSelectedLayers,
  reorderLayers,
  moveLayersToFolder,
  createFolderForSelection,
  focusLayersForEveryone,
  deleteSelectedLayers,
  setLayerAsBackground,
  onClose,
}: LayerContextMenuPanelProps) {
  const { t } = useLang()

  const ids = getContextLayerIds(layerContextMenu.layerId)
  const contextLayers = ids
    .map(id => layers.find(item => item.id === id))
    .filter((item): item is TableLayer => Boolean(item))
  if (contextLayers.length === 0) return null

  const layer = layerContextMenu.layerId
    ? layers.find(item => item.id === layerContextMenu.layerId)
    : null
  const firstLayer = layer || contextLayers[0]
  const allVisible = contextLayers.every(item => item.visible)
  const allLocked = contextLayers.every(item => item.locked)
  const singleLayer = contextLayers.length === 1 ? contextLayers[0] : null
  const canManageContext = contextLayers.every(item => canEditLayer(item))
  const hasReadOnlyActions = Boolean(singleLayer && singleLayer.layerType !== 'folder')
  const movableIds = canManageContext ? ids.filter(id => layers.find(item => item.id === id)?.layerType !== 'folder') : []
  const folderScope = firstLayer.onTable ? tableManagerLayers : libraryLayers
  const availableFolders = canManageContext ? folderScope.filter(item => item.layerType === 'folder' && !ids.includes(item.id)) : []
  if (!canManageContext && !hasReadOnlyActions) return null

  return (
    <SmartContextMenu
      x={layerContextMenu.x}
      y={layerContextMenu.y}
      onClick={event => event.stopPropagation()}
    >
      {canManageContext ? (
        <button type="button" onClick={() => {
          focusLayersForEveryone(ids.length > 0 ? ids : [firstLayer.id])
          onClose()
        }}>{t('Указать всем')}</button>
      ) : null}

      {singleLayer && singleLayer.layerType !== 'folder' ? (
        <>
          {chatUser && !isMaster && singleLayer.layerType === 'image' ? (
            <button
              type="button"
              style={{ fontWeight: 600, color: '#ffd89a', borderColor: 'rgba(214,170,101,0.5)' }}
              onClick={() => addLayerToJournal(singleLayer.imageData, singleLayer.name)}
            >
              📖 {t('Добавить в дневник')}
            </button>
          ) : null}
          <button type="button" onClick={() => {
            copyLayerUrl(singleLayer)
            onClose()
          }}>{t('Копировать изображение')}</button>
        </>
      ) : null}

      {canManageContext ? (
        <>
          {isMaster && singleLayer && singleLayer.layerType === 'image' ? (
            <button
              type="button"
              style={{ fontWeight: 600 }}
              onClick={() => {
                void setLayerAsBackground(singleLayer)
                onClose()
              }}
            >
              🖼 {t('Установить как фон')}
            </button>
          ) : null}
          {singleLayer ? <button type="button" onClick={() => renameLayer(singleLayer)}>{t('Переименовать')}</button> : null}
          <button type="button" onClick={() => {
            patchSelectedLayers(ids, () => ({ visible: !allVisible }))
            onClose()
          }}>
            {allVisible ? t('Скрыть') : t('Показать')}
          </button>
          <button type="button" onClick={() => {
            patchSelectedLayers(ids, () => ({ locked: !allLocked }))
            onClose()
          }}>
            {allLocked ? t('Разблокировать') : t('Заблокировать')}
          </button>
          <div className="context-menu-group">
            <span>{t('Порядок слоя')}</span>
            <button type="button" onClick={() => {
              reorderLayers(ids, 'top')
              onClose()
            }}>{t('На самый верх')}</button>
            <button type="button" onClick={() => {
              reorderLayers(ids, 'up')
              onClose()
            }}>{t('Выше')}</button>
            <button type="button" onClick={() => {
              reorderLayers(ids, 'down')
              onClose()
            }}>{t('Ниже')}</button>
            <button type="button" onClick={() => {
              reorderLayers(ids, 'bottom')
              onClose()
            }}>{t('На самый низ')}</button>
          </div>
          {movableIds.length > 0 ? (
            <div className="context-menu-group">
              <span>{t('Поместить в папку')}</span>
              {availableFolders.map(folder => (
                <button type="button" key={folder.id} onClick={() => {
                  moveLayersToFolder(movableIds, folder.id)
                  onClose()
                }}>{folder.name}</button>
              ))}
              <button type="button" onClick={() => {
                createFolderForSelection(movableIds)
                onClose()
              }}>{t('Создать новую папку')}</button>
            </div>
          ) : null}
          <button type="button" className="danger" onClick={() => {
            deleteSelectedLayers(ids)
            onClose()
          }}>{t('Удалить')}</button>
        </>
      ) : null}
    </SmartContextMenu>
  )
}
