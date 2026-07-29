import { type Dispatch, type DragEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject, type SetStateAction, type TouchEvent, type WheelEvent } from 'react'
import {
  createEditorState,
  getLayerCrop,
  getEditorPreviewStyle,
  getLayerMediaStyle,
  isInteractiveLayerContentTarget,
  layerUsesInteractiveDragHandle,
} from '@/games/vampires/modules/table/utils/layer-utils'
import {
  getDocumentEmbedUrl,
  getEmbeddableVideoUrl,
  getFileLayerMeta,
} from '@/games/vampires/modules/table/utils/media-utils'
import type { DragState, ImageEditorDraft, ImageEditorState, LayerContextMenu, SelectionRect, TableLayer } from '@/games/vampires/modules/table/types'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'

type TableCanvasProps = {
  layersLength: number
  zoom: number
  pan: { x: number; y: number }
  handNotice: string
  isDraggingOver: boolean
  /** Stage rectangle: size follows the scene background; everything outside is the master's workspace. */
  stage: { width: number; height: number; backgroundUrl: string }
  /** Player view: clip media (and mark the workspace) by the stage bounds. */
  clipMediaToStage: boolean
  tokenLayer: ReactNode
  visibleLayers: TableLayer[]
  selectedLayerId: string | null
  selectedLayerIds: Set<string>
  imageEditor: ImageEditorDraft | null
  selectionRect: SelectionRect
  sceneRef: RefObject<HTMLDivElement | null>
  suppressNextContextMenuRef: RefObject<boolean>
  canEditLayer: (layer: TableLayer) => boolean
  raiseHand: () => void
  setZoom: Dispatch<SetStateAction<number>>
  setIsDraggingOver: Dispatch<SetStateAction<boolean>>
  setLayerContextMenu: Dispatch<SetStateAction<LayerContextMenu>>
  setLayerSelection: (ids: string[], primaryId?: string | null) => void
  setSelectedLayerId: Dispatch<SetStateAction<string | null>>
  setImageEditor: Dispatch<SetStateAction<ImageEditorDraft | null>>
  startPan: (event: PointerEvent<HTMLDivElement>) => void
  updateLayerDrag: (event: PointerEvent<HTMLDivElement>) => void
  finishLayerDrag: () => void
  startSceneTouch: (event: TouchEvent<HTMLDivElement>) => void
  updateSceneTouch: (event: TouchEvent<HTMLDivElement>) => void
  finishSceneTouch: (event: TouchEvent<HTMLDivElement>) => void
  handleWheel: (event: WheelEvent<HTMLDivElement>) => void
  handleDrop: (event: DragEvent<HTMLDivElement>) => Promise<void>
  startLayerDrag: (event: PointerEvent<HTMLElement>, layer: TableLayer, mode: 'move' | 'resize', corner?: DragState['corner']) => void
  openImageEditor: (layer: TableLayer) => void
  revealLayerInTableManager: (layer: TableLayer) => void
  updateEditorCropDrag: (event: PointerEvent<HTMLElement>) => void
  finishEditorCropDrag: () => void
  startEditorCropDrag: (event: PointerEvent<HTMLElement>, handle: NonNullable<ImageEditorDraft['drag']>['handle']) => void
  applyImageEditor: (saveAsNew?: boolean) => Promise<void>
  updateImageEditor: (updater: (state: ImageEditorState) => ImageEditorState, commit?: boolean) => void
  undoImageEditor: () => void
  redoImageEditor: () => void
  previewLayerOpacity: (id: string, opacity: number) => void
  commitLayerOpacity: (id: string, input: HTMLInputElement) => void
}

export default function TableCanvas({
  layersLength,
  zoom,
  pan,
  handNotice,
  isDraggingOver,
  stage,
  clipMediaToStage,
  tokenLayer,
  visibleLayers,
  selectedLayerId,
  selectedLayerIds,
  imageEditor,
  selectionRect,
  sceneRef,
  suppressNextContextMenuRef,
  canEditLayer,
  raiseHand,
  setZoom,
  setIsDraggingOver,
  setLayerContextMenu,
  setLayerSelection,
  setSelectedLayerId,
  setImageEditor,
  startPan,
  updateLayerDrag,
  finishLayerDrag,
  startSceneTouch,
  updateSceneTouch,
  finishSceneTouch,
  handleWheel,
  handleDrop,
  startLayerDrag,
  openImageEditor,
  revealLayerInTableManager,
  updateEditorCropDrag,
  finishEditorCropDrag,
  startEditorCropDrag,
  applyImageEditor,
  updateImageEditor,
  undoImageEditor,
  redoImageEditor,
  previewLayerOpacity,
  commitLayerOpacity,
}: TableCanvasProps) {
  const { t } = useLang()

  const openLayerContextMenu = (event: MouseEvent<HTMLElement>, layer: TableLayer) => {
    event.preventDefault()
    event.stopPropagation()
    if (suppressNextContextMenuRef.current) {
      suppressNextContextMenuRef.current = false
      return
    }
    if (!selectedLayerIds.has(layer.id)) setLayerSelection([layer.id], layer.id)
    else setSelectedLayerId(layer.id)
    setLayerContextMenu({ layerId: layer.id, x: event.clientX, y: event.clientY })
  }

  const renderLayerDragHandle = (layer: TableLayer) => {
    if (!layerUsesInteractiveDragHandle(layer)) return null
    return (
      <button
        type="button"
        className="layer-drag-handle"
        onPointerDown={event => {
          event.stopPropagation()
          startLayerDrag(event, layer, 'move')
        }}
        onContextMenu={event => openLayerContextMenu(event, layer)}
        title={t('Переместить')}
        aria-label={t('Переместить')}
      >
        ⠿
      </button>
    )
  }

  return (
    <section className="play-surface" aria-label={t('Игровой стол')}>
      <header className="surface-head" aria-label={t('Управление столом')}>
        <div className="zoom-tools canvas-actions">
          <button type="button" className="canvas-action canvas-action-hand" onClick={raiseHand} title={t('Поднять руку')}>!</button>
          <button type="button" className="canvas-action" onClick={() => setZoom(prev => Math.max(0.2, prev - 0.1))} title={t('Уменьшить')}>−</button>
          <button type="button" className="canvas-action canvas-action-reset" onClick={() => setZoom(1)} title={t('Сбросить масштаб')}>{Math.round(zoom * 100)}</button>
          <button type="button" className="canvas-action" onClick={() => setZoom(prev => Math.min(5, prev + 0.1))} title={t('Увеличить')}>+</button>
        </div>
      </header>
      {handNotice ? <div className="hand-notice" role="status">{t(handNotice)}</div> : null}

      <div
        ref={sceneRef}
        className={`scene ${isDraggingOver ? 'drag-over' : ''}`}
        onPointerDown={startPan}
        onPointerMove={updateLayerDrag}
        onPointerUp={finishLayerDrag}
        onPointerCancel={finishLayerDrag}
        onPointerLeave={finishLayerDrag}
        onTouchStart={startSceneTouch}
        onTouchMove={updateSceneTouch}
        onTouchEnd={finishSceneTouch}
        onTouchCancel={finishSceneTouch}
        onContextMenu={event => {
          event.preventDefault()
          if (suppressNextContextMenuRef.current) {
            suppressNextContextMenuRef.current = false
            return
          }
          if (selectedLayerIds.size > 0) setLayerContextMenu({ layerId: null, x: event.clientX, y: event.clientY })
        }}
        onWheel={handleWheel}
        onDragOver={event => {
          event.preventDefault()
          setIsDraggingOver(true)
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
      >
        <div
          className="scene-world"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <div
            className={`scene-stage ${stage.backgroundUrl ? 'has-background' : 'no-background'}`}
            style={{ width: stage.width, height: stage.height }}
            aria-hidden="true"
          >
            {stage.backgroundUrl ? (
              <img src={stage.backgroundUrl} alt="" draggable={false} />
            ) : null}
          </div>
          {visibleLayers.length === 0 ? (
            <div className="scene-empty">
              <h2>{t('Добавь первый слой')}</h2>
              <p>{t('Перетащи картинки прямо на стол или нажми «Добавить слой».')}</p>
            </div>
          ) : null}

          <div
            className={`scene-media-layer ${clipMediaToStage ? 'clipped' : ''}`}
            style={clipMediaToStage ? { width: stage.width, height: stage.height } : undefined}
          >
          {visibleLayers.map(layer => {
            const youtubeEmbedUrl = layer.layerType === 'video' ? getEmbeddableVideoUrl(layer.imageData) : ''
            return (
            <div
              className={`scene-layer ${layer.layerType === 'image' ? 'image-layer' : 'interactive-layer'} ${layer.layerType === 'video' ? 'video-layer' : ''} ${layer.layerType === 'file' ? 'file-layer' : ''} ${layer.layerType === 'text' ? 'text-layer' : ''} ${getLayerCrop(layer).cropped ? 'cropped-layer' : ''} ${selectedLayerIds.has(layer.id) ? 'selected' : ''} ${layer.locked || !canEditLayer(layer) ? 'locked' : ''}`}
              key={layer.id}
              data-layer-id={layer.id}
              style={{
                left: layer.x,
                top: layer.y,
                width: layer.width,
                height: layer.height,
                zIndex: layer.zIndex,
                opacity: layer.opacity,
                mixBlendMode: layer.blendMode,
              }}
              onPointerDown={event => startLayerDrag(event, layer, 'move')}
              onContextMenu={event => openLayerContextMenu(event, layer)}
              onDoubleClick={event => {
                event.preventDefault()
                event.stopPropagation()
                if (!['image', 'video'].includes(layer.layerType)) revealLayerInTableManager(layer)
              }}
              onClick={event => {
                if (isInteractiveLayerContentTarget(layer, event.target)) return
                event.stopPropagation()
                // Always select on single click — even locked/non-editable layers
                // so right-click "Добавить в дневник" is reachable without drag-selection
                if (!selectedLayerIds.has(layer.id)) {
                  setLayerSelection([layer.id], layer.id)
                }
              }}
            >
              {layer.layerType === 'video' ? (
                <>
                  {youtubeEmbedUrl ? (
                    <iframe
                      src={youtubeEmbedUrl}
                      title={layer.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={layer.imageData}
                      controls
                      loop
                      playsInline
                      draggable={false}
                      style={imageEditor?.layerId === layer.id ? getEditorPreviewStyle(imageEditor.state) : getLayerMediaStyle(layer)}
                      onError={event => {
                        event.currentTarget.style.display = 'none'
                        event.currentTarget.parentElement?.classList.add('image-load-error')
                      }}
                    />
                  )}
                  {renderLayerDragHandle(layer)}
                  <span className="broken-image-label">{layer.name}</span>
                </>
              ) : layer.layerType === 'text' ? (
                <>
                  <article className="scene-text-material">
                    <strong>{layer.name}</strong>
                    <div dangerouslySetInnerHTML={{ __html: layer.imageData }} />
                  </article>
                  {renderLayerDragHandle(layer)}
                </>
              ) : layer.layerType === 'file' ? (() => {
                const meta = getFileLayerMeta(layer.imageData, layer.name)
                const embedUrl = getDocumentEmbedUrl(meta)
                return (
                  <>
                    <article className={`scene-file-material ${embedUrl ? 'embedded-document' : ''}`}>
                      <strong>{layer.name}</strong>
                      {embedUrl ? (
                        <iframe src={embedUrl} title={layer.name} />
                      ) : (
                        <>
                          <span>{meta.type}</span>
                          <a href={meta.url} target="_blank" rel="noreferrer">{t('Открыть файл')}</a>
                        </>
                      )}
                    </article>
                    {renderLayerDragHandle(layer)}
                  </>
                )
              })() : (
                <>
                  <img
                    src={layer.imageData}
                    alt=""
                    draggable={false}
                    style={imageEditor?.layerId === layer.id ? getEditorPreviewStyle(imageEditor.state) : getLayerMediaStyle(layer)}
                    onError={event => {
                      event.currentTarget.style.display = 'none'
                      event.currentTarget.parentElement?.classList.add('image-load-error')
                    }}
                  />
                  <span className="broken-image-label">{layer.name}</span>
                </>
              )}
              {imageEditor?.layerId === layer.id ? (
                <div
                  className="inline-crop-surface"
                  onPointerDown={event => { event.preventDefault(); event.stopPropagation() }}
                  onPointerMove={updateEditorCropDrag}
                  onPointerUp={finishEditorCropDrag}
                  onPointerCancel={finishEditorCropDrag}
                >
                  <div
                    className="inline-crop-box"
                    style={{
                      left: `${imageEditor.state.cropX}%`,
                      top: `${imageEditor.state.cropY}%`,
                      width: `${imageEditor.state.cropWidth}%`,
                      height: `${imageEditor.state.cropHeight}%`,
                    }}
                    onPointerDown={event => { event.stopPropagation(); startEditorCropDrag(event, 'move') }}
                  >
                    {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map(handle => (
                      <button
                        type="button"
                        key={handle}
                        className={`crop-handle ${handle}`}
                        onPointerDown={event => startEditorCropDrag(event, handle)}
                        aria-label={t('Изменить обрезку')}
                      />
                    ))}
                  </div>
                  <div className="inline-crop-toolbar" onPointerDown={event => event.stopPropagation()}>
                    <button type="button" onClick={() => setImageEditor(null)}>{t('Отмена')}</button>
                    <button type="button" onClick={() => updateImageEditor(() => createEditorState({ ...layer, cropX: null, cropY: null, cropWidth: null, cropHeight: null, rotation: layer.rotation, flipX: layer.flipX, flipY: layer.flipY, brightness: layer.brightness, contrast: layer.contrast, saturation: layer.saturation }))}>{t('Сбросить обрезку')}</button>
                    <button type="button" onClick={() => void applyImageEditor(false)}>✓ {t('Применить')}</button>
                  </div>
                </div>
              ) : null}
              {selectedLayerId === layer.id && ['image', 'video'].includes(layer.layerType) && canEditLayer(layer) && imageEditor?.layerId !== layer.id ? (
                <label className="inline-opacity-control" onPointerDown={event => event.stopPropagation()}>
                  <span>Opacity</span>
                  <input
                    key={`${layer.id}:${layer.opacity}`}
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    defaultValue={layer.opacity}
                    data-committed-value={layer.opacity}
                    onInput={event => previewLayerOpacity(layer.id, Number(event.currentTarget.value))}
                    onPointerUp={event => commitLayerOpacity(layer.id, event.currentTarget)}
                    onPointerCancel={event => commitLayerOpacity(layer.id, event.currentTarget)}
                    onKeyUp={event => commitLayerOpacity(layer.id, event.currentTarget)}
                    onBlur={event => commitLayerOpacity(layer.id, event.currentTarget)}
                  />
                </label>
              ) : null}
              {selectedLayerId === layer.id && selectedLayerIds.size <= 1 && !layer.locked && canEditLayer(layer) && imageEditor?.layerId !== layer.id ? (
                <>
                  {(['nw', 'ne', 'sw', 'se'] as const).map(corner => (
                    <button
                      type="button"
                      className={`resize-handle ${corner}`}
                      key={corner}
                      onPointerDown={event => {
                        event.stopPropagation()
                        startLayerDrag(event, layer, 'resize', corner)
                      }}
                      title={t('Изменить размер')}
                    />
                  ))}
                </>
              ) : null}
            </div>
          )})}
          </div>
          {tokenLayer}
          {selectionRect ? (
            <div
              className="selection-rect"
              style={{
                left: selectionRect.x,
                top: selectionRect.y,
                width: selectionRect.width,
                height: selectionRect.height,
              }}
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}
