import type { Dispatch, DragEvent, FormEvent, RefObject, SetStateAction } from 'react'
import { ROOT_LAYER_DROP_ID } from '@/games/vampires/modules/table/constants'
import type { LayerContextMenu, LayerDropTarget, LayerPatch, LayerTreeNode, MediaTab, TableLayer } from '@/games/vampires/modules/table/types'
import LayerManager from '../layers/LayerManager'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'

type MediaLibraryProps = {
  mediaTab: MediaTab
  isMaster: boolean
  isUploading: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  folderInputRef: RefObject<HTMLInputElement | null>
  mediaSearchDraft: string
  textMaterialNameDraft: string
  textMaterialDraft: string
  libraryTree: LayerTreeNode[]
  layerDropTarget: LayerDropTarget
  expandedFolders: Set<string>
  selectedLayerIds: Set<string>
  draggingLayerId: string | null
  createNamedFolder: (parentId?: string | null, onTable?: boolean) => Promise<string | null>
  setMediaSearchDraft: Dispatch<SetStateAction<string>>
  setTextMaterialNameDraft: Dispatch<SetStateAction<string>>
  setTextMaterialDraft: Dispatch<SetStateAction<string>>
  createTextMaterial: (event: FormEvent<HTMLFormElement>) => Promise<void>
  handleLayerRootDragOver: (event: DragEvent<HTMLDivElement>) => void
  handleLayerRootDrop: (event: DragEvent<HTMLDivElement>) => Promise<void>
  uploadFiles: (files: FileList | File[], onTable?: boolean, options?: { asBackground?: boolean; point?: { x: number; y: number }; preserveFolders?: boolean }) => Promise<void>
  setLayerDropTarget: Dispatch<SetStateAction<LayerDropTarget>>
  canMoveLayer: (layer: TableLayer) => boolean
  isLayerEffectivelyVisible: (layer: TableLayer) => boolean
  handleLayerDragStart: (event: DragEvent<HTMLElement>, layerId: string) => void
  handleLayerDragOver: (event: DragEvent<HTMLElement>, target: TableLayer) => void
  handleLayerDrop: (event: DragEvent<HTMLElement>, target: TableLayer) => void
  handleLayerDragEnd: () => void
  handleManagerDoubleClick: (layer: TableLayer) => void
  patchLayer: (id: string, patch: LayerPatch) => Promise<void>
  placeLayerOnTable: (layerId: string) => Promise<void>
  deleteLayer: (layerId: string) => Promise<void>
  setLayerSelection: (ids: string[], primaryId?: string | null) => void
  setLayerContextMenu: Dispatch<SetStateAction<LayerContextMenu>>
  toggleFolder: (folderId: string) => void
}

export default function MediaLibrary({
  mediaTab,
  isMaster,
  isUploading,
  fileInputRef,
  folderInputRef,
  mediaSearchDraft,
  textMaterialNameDraft,
  textMaterialDraft,
  libraryTree,
  layerDropTarget,
  expandedFolders,
  selectedLayerIds,
  draggingLayerId,
  createNamedFolder,
  setMediaSearchDraft,
  setTextMaterialNameDraft,
  setTextMaterialDraft,
  createTextMaterial,
  handleLayerRootDragOver,
  handleLayerRootDrop,
  uploadFiles,
  setLayerDropTarget,
  canMoveLayer,
  isLayerEffectivelyVisible,
  handleLayerDragStart,
  handleLayerDragOver,
  handleLayerDrop,
  handleLayerDragEnd,
  handleManagerDoubleClick,
  patchLayer,
  placeLayerOnTable,
  deleteLayer,
  setLayerSelection,
  setLayerContextMenu,
  toggleFolder,
}: MediaLibraryProps) {
  const { t } = useLang()
  return (
    <section
      className={`library-panel table-right-panel ${mediaTab === 'library' ? '' : 'table-right-panel-hidden'}`}
      aria-label={t('Мои медиа')}
      onDragOver={event => {
        if (event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes('text/uri-list') || event.dataTransfer.types.includes('text/plain')) event.preventDefault()
      }}
      onDrop={async event => {
        const droppedFiles = Array.from(event.dataTransfer.files || [])
        if (droppedFiles.length > 0) {
          event.preventDefault()
          await uploadFiles(droppedFiles, false, { preserveFolders: true })
        }
      }}
    >
      <header>
        <strong>{isMaster ? t('Материалы мастера') : t('Мои медиа')}</strong>
        <span>{t('можно вытащить на стол')}</span>
      </header>

      <div className="media-manager-toolbar">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? t('Загрузка...') : t('Загрузить')}
        </button>
        <button type="button" onClick={() => folderInputRef.current?.click()} disabled={isUploading}>
          {t('Папка файлов')}
        </button>
        <button type="button" onClick={() => void createNamedFolder(null, false)}>{t('Папка')}</button>
      </div>
      <input
        className="media-search-input"
        data-media-search
        value={mediaSearchDraft}
        onChange={event => setMediaSearchDraft(event.target.value)}
        placeholder={t('Поиск медиа')}
      />

      {isMaster ? (
        <form className="text-material-form" onSubmit={createTextMaterial}>
          <input
            value={textMaterialNameDraft}
            onChange={event => setTextMaterialNameDraft(event.target.value)}
            placeholder={t('Название текста')}
          />
          <textarea
            value={textMaterialDraft}
            onChange={event => setTextMaterialDraft(event.target.value)}
            placeholder={t('Текст, дневник, заметка...')}
            rows={4}
          />
          <button type="submit" disabled={!textMaterialDraft.trim()}>{t('Добавить текст')}</button>
        </form>
      ) : null}

      <div
        className={`layer-list library-list ${layerDropTarget?.layerId === ROOT_LAYER_DROP_ID ? 'drop-root' : ''}`}
        onDragOver={event => {
          if (event.dataTransfer.types.includes('Files')) {
            event.preventDefault()
            return
          }
          handleLayerRootDragOver(event)
        }}
        onDrop={async event => {
          const droppedFiles = Array.from(event.dataTransfer.files || [])
          if (droppedFiles.length > 0) {
            event.preventDefault()
            await uploadFiles(droppedFiles, false, { preserveFolders: true })
            return
          }
          await handleLayerRootDrop(event)
        }}
        onDragLeave={event => {
          if (event.currentTarget === event.target) setLayerDropTarget(null)
        }}
      >
        {libraryTree.length === 0 ? (
          <p className="panel-empty">{t('Здесь будут материалы, которые ещё не лежат на столе.')}</p>
        ) : (
          <LayerManager
            layers={libraryTree}
            isMaster={isMaster}
            expandedFolders={expandedFolders}
            layerDropTarget={layerDropTarget}
            selectedLayerIds={selectedLayerIds}
            draggingLayerId={draggingLayerId}
            canMoveLayer={canMoveLayer}
            isLayerEffectivelyVisible={isLayerEffectivelyVisible}
            handleLayerDragStart={handleLayerDragStart}
            handleLayerDragOver={handleLayerDragOver}
            handleLayerDrop={handleLayerDrop}
            handleLayerDragEnd={handleLayerDragEnd}
            handleManagerDoubleClick={handleManagerDoubleClick}
            patchLayer={patchLayer}
            placeLayerOnTable={placeLayerOnTable}
            deleteLayer={deleteLayer}
            setLayerSelection={setLayerSelection}
            setLayerContextMenu={setLayerContextMenu}
            toggleFolder={toggleFolder}
          />
        )}
        <div
          className="layer-root-drop-zone"
          onDragOver={handleLayerRootDragOver}
          onDrop={handleLayerRootDrop}
        >
          {t('Перетащи сюда, чтобы вынести из папки')}
        </div>
      </div>
    </section>
  )
}
