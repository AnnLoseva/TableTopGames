'use client'

import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import type { ChatUser } from '@/games/vampires/modules/chat/types'
import { getLayerCrop } from '../utils/layer-utils'
import type { BlendMode, LayerContextMenu, LayerPatch, TableLayer } from '../types'
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
  copyLayerForDiary: (layer: TableLayer) => void
  copyLayerUrl: (layer: TableLayer) => void
  copyLayerToPersonalMedia: (layer: TableLayer) => void
  renameLayer: (layer: TableLayer) => void
  openImageEditor: (layer: TableLayer) => void
  patchLayer: (layerId: string, patch: LayerPatch) => void | Promise<void>
  patchSelectedLayers: (ids: string[], patchFn: (layer: TableLayer) => LayerPatch) => void | Promise<void>
  duplicateLayer: (layer: TableLayer) => void
  resetLayerCrop: (layer: TableLayer) => void
  reorderLayers: (ids: string[], direction: 'top' | 'up' | 'down' | 'bottom') => void
  createNamedFolder: (parentId?: string | null, onTable?: boolean) => void
  moveLayersToFolder: (ids: string[], folderId: string) => void
  createFolderForSelection: (ids: string[]) => void
  focusLayersForEveryone: (ids: string[]) => void
  deleteSelectedLayers: (ids: string[]) => void
  previewLayerOpacity: (layerId: string, opacity: number) => void
  commitLayerOpacity: (layerId: string, input: HTMLInputElement) => void
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
  copyLayerForDiary,
  copyLayerUrl,
  copyLayerToPersonalMedia,
  renameLayer,
  openImageEditor,
  patchLayer,
  patchSelectedLayers,
  duplicateLayer,
  resetLayerCrop,
  reorderLayers,
  createNamedFolder,
  moveLayersToFolder,
  createFolderForSelection,
  focusLayersForEveryone,
  deleteSelectedLayers,
  previewLayerOpacity,
  commitLayerOpacity,
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
          <div className="context-menu-group">
            <span>{t('Копировать')}</span>
            <button type="button" onClick={() => copyLayerForDiary(singleLayer)}>{t('Для дневника')}</button>
            <button type="button" onClick={() => copyLayerUrl(singleLayer)}>{t('Ссылку')}</button>
            <button type="button" onClick={() => copyLayerToPersonalMedia(singleLayer)}>{t('В мои медиа')}</button>
          </div>
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
          {singleLayer && ['image', 'video'].includes(singleLayer.layerType) ? (
            <div className="context-menu-group">
              <span>{t('Изображение')}</span>
              <button type="button" onClick={() => openImageEditor(singleLayer)}>{t('Обрезать')}</button>
              <button type="button" onClick={() => patchLayer(singleLayer.id, { rotation: (singleLayer.rotation + 90) % 360 })}>{t('Повернуть')}</button>
              <button type="button" onClick={() => duplicateLayer(singleLayer)}>{t('Дублировать')}</button>
            </div>
          ) : null}
          {singleLayer && getLayerCrop(singleLayer).cropped ? (
            <button type="button" onClick={() => resetLayerCrop(singleLayer)}>{t('Восстановить обрезанное')}</button>
          ) : null}
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
          {singleLayer && singleLayer.layerType !== 'folder' ? (
            <div className="context-menu-group context-menu-controls">
              <span>{t('Слой')}</span>
              <label>
                <small>Opacity</small>
                <input
                  key={`${singleLayer.id}:${singleLayer.opacity}`}
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  defaultValue={singleLayer.opacity}
                  data-committed-value={singleLayer.opacity}
                  onInput={event => previewLayerOpacity(singleLayer.id, Number(event.currentTarget.value))}
                  onPointerUp={event => commitLayerOpacity(singleLayer.id, event.currentTarget)}
                  onPointerCancel={event => commitLayerOpacity(singleLayer.id, event.currentTarget)}
                  onKeyUp={event => commitLayerOpacity(singleLayer.id, event.currentTarget)}
                  onBlur={event => commitLayerOpacity(singleLayer.id, event.currentTarget)}
                />
              </label>
              <label>
                <small>Blend</small>
                <select
                  value={singleLayer.blendMode}
                  onChange={event => patchLayer(singleLayer.id, { blendMode: event.target.value as BlendMode })}
                >
                  {(['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'luminosity'] as BlendMode[]).map(mode => (
                    <option value={mode} key={mode}>{mode}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
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
          {singleLayer?.layerType === 'folder' ? (
            <button type="button" onClick={() => {
              createNamedFolder(singleLayer.id, singleLayer.onTable)
              onClose()
            }}>{t('Новая папка внутри')}</button>
          ) : null}
          {contextLayers.some(item => item.parentId) ? (
            <button type="button" onClick={() => {
              patchSelectedLayers(ids, () => ({ parentId: null }))
              onClose()
            }}>{t('Вынести из папки')}</button>
          ) : null}
          {contextLayers.some(item => item.onTable) ? (
            <button type="button" onClick={() => {
              patchSelectedLayers(ids, () => ({ onTable: false, parentId: null }))
              onClose()
            }}>{t('Убрать в медиа сцены')}</button>
          ) : null}
          {contextLayers.some(item => !item.onTable) ? (
            <button type="button" onClick={() => {
              patchSelectedLayers(ids, () => ({ onTable: true, visible: true, parentId: null }))
              onClose()
            }}>{t('Вынести на стол')}</button>
          ) : null}
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
          <button type="button" onClick={() => {
            focusLayersForEveryone(ids.length > 0 ? ids : [firstLayer.id])
            onClose()
          }}>{t('Указать всем')}</button>
          <button type="button" className="danger" onClick={() => {
            deleteSelectedLayers(ids)
            onClose()
          }}>{t('Удалить')}</button>
        </>
      ) : null}
    </SmartContextMenu>
  )
}