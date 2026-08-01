import { useEffect, useRef, useState } from 'react'
import type { DragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { LayerContextMenu, LayerDropTarget, LayerPatch, LayerTreeNode, TableLayer } from '@/games/vampires/modules/table/types'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'

const DRAG_SELECT_THRESHOLD = 4

type LayerManagerProps = {
  layers: LayerTreeNode[]
  isMaster: boolean
  expandedFolders: Set<string>
  layerDropTarget: LayerDropTarget
  selectedLayerIds: Set<string>
  draggingLayerId: string | null
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
  setLayerContextMenu: (menu: LayerContextMenu) => void
  toggleFolder: (folderId: string) => void
}

type DragSelectRect = { left: number; top: number; width: number; height: number }

export default function LayerManager({
  layers,
  isMaster,
  expandedFolders,
  layerDropTarget,
  selectedLayerIds,
  draggingLayerId,
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
}: LayerManagerProps) {
  const { t } = useLang()
  const containerRef = useRef<HTMLDivElement>(null)
  const dragSelectRef = useRef<{ moved: boolean; baseIds: Set<string>; cleanup: () => void } | null>(null)
  const [dragSelectRect, setDragSelectRect] = useState<DragSelectRect | null>(null)

  const handleRowClick = (event: ReactMouseEvent<HTMLElement>, layerId: string) => {
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      const next = new Set(selectedLayerIds)
      if (next.has(layerId)) next.delete(layerId)
      else next.add(layerId)
      setLayerSelection([...next], layerId)
      return
    }
    setLayerSelection([layerId], layerId)
  }

  const applyDragSelectRect = (rect: DragSelectRect, baseIds: Set<string>) => {
    if (!containerRef.current) return
    const ids = Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-layer-id]'))
      .filter(element => {
        const box = element.getBoundingClientRect()
        return box.left < rect.left + rect.width
          && box.left + box.width > rect.left
          && box.top < rect.top + rect.height
          && box.top + box.height > rect.top
      })
      .map(element => element.dataset.layerId as string)
    const next = new Set(baseIds)
    ids.forEach(id => next.add(id))
    const selected = [...next]
    setLayerSelection(selected, ids[ids.length - 1] || selected[selected.length - 1] || null)
  }

  const startDragSelect = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Only start when the gesture begins on empty list background, not on a row.
    if ((event.target as HTMLElement).closest('[data-layer-id]')) return
    if (event.button !== 0 || !event.shiftKey) return
    event.preventDefault()

    const startX = event.clientX
    const startY = event.clientY

    const handleMove = (nativeEvent: PointerEvent) => {
      const state = dragSelectRef.current
      if (!state) return
      const dx = nativeEvent.clientX - startX
      const dy = nativeEvent.clientY - startY
      if (!state.moved && Math.hypot(dx, dy) < DRAG_SELECT_THRESHOLD) return
      state.moved = true
      const rect: DragSelectRect = {
        left: Math.min(startX, nativeEvent.clientX),
        top: Math.min(startY, nativeEvent.clientY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      }
      setDragSelectRect(rect)
      applyDragSelectRect(rect, state.baseIds)
    }
    const finish = () => {
      dragSelectRef.current?.cleanup()
      dragSelectRef.current = null
      setDragSelectRect(null)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    dragSelectRef.current = { moved: false, baseIds: new Set(selectedLayerIds), cleanup }
  }

  useEffect(() => () => dragSelectRef.current?.cleanup(), [])

  const renderLayerNode = (layer: LayerTreeNode, depth = 0): ReactNode => {
    const isFolder = layer.layerType === 'folder'
    const isExpanded = expandedFolders.has(layer.id)
    const isDropTarget = layerDropTarget?.layerId === layer.id
    const canDragLayer = canMoveLayer(layer)
    const isEffectivelyVisible = isLayerEffectivelyVisible(layer)

    return (
      <div className="layer-tree-item" key={layer.id}>
        <article
          className={`layer-row ${selectedLayerIds.has(layer.id) ? 'active' : ''} ${draggingLayerId === layer.id ? 'dragging' : ''} ${!isEffectivelyVisible ? 'hidden' : ''} ${layer.locked ? 'locked' : ''} ${
            isDropTarget ? `drop-${layerDropTarget?.placement}` : ''
          }`}
          data-layer-id={layer.id}
          draggable={canDragLayer}
          onDragStart={event => handleLayerDragStart(event, layer.id)}
          onDragOver={event => handleLayerDragOver(event, layer)}
          onDrop={event => handleLayerDrop(event, layer)}
          onDragEnd={handleLayerDragEnd}
          onClick={event => handleRowClick(event, layer.id)}
          onContextMenu={event => {
            event.preventDefault()
            if (!selectedLayerIds.has(layer.id)) setLayerSelection([layer.id], layer.id)
            setLayerContextMenu({ layerId: layer.id, x: event.clientX, y: event.clientY })
          }}
          onDoubleClick={() => handleManagerDoubleClick(layer)}
        >
          <button
            type="button"
            className={`layer-visibility ${layer.visible ? 'visible' : ''}`}
            draggable={false}
            onMouseDown={event => event.stopPropagation()}
            onDragStart={event => event.preventDefault()}
            onClick={event => {
              event.stopPropagation()
              void patchLayer(layer.id, { visible: !layer.visible })
            }}
            title={layer.visible ? t('Скрыть') : t('Показать')}
            aria-label={layer.visible ? t('Скрыть слой') : t('Показать слой')}
          >
            <span aria-hidden="true" />
          </button>
          <div className="layer-name" style={{ paddingLeft: 6 + depth * 18 }}>
            {isFolder ? (
              <button
                type="button"
                className="folder-toggle"
                draggable={false}
                onMouseDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation()
                  toggleFolder(layer.id)
                }}
                title={isExpanded ? t('Свернуть') : t('Открыть')}
                aria-label={isExpanded ? t('Свернуть папку') : t('Открыть папку')}
              >
                {isExpanded ? '▾' : '▸'}
              </button>
            ) : (
              <span className="folder-toggle spacer" />
            )}
            <div className="layer-thumb" aria-hidden="true">
              {isFolder ? (
                <span className="folder-thumb" />
              ) : layer.layerType === 'video' ? (
                <span className="video-thumb">▶</span>
              ) : layer.layerType === 'text' ? (
                <span className="text-thumb">T</span>
              ) : layer.layerType === 'file' ? (
                <span className="file-thumb">F</span>
              ) : (
                <img
                  src={layer.imageData}
                  alt=""
                  draggable={false}
                  width={36}
                  height={32}
                  style={{
                    width: 36,
                    height: 32,
                    maxWidth: 36,
                    maxHeight: 32,
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              )}
            </div>
            <div className="layer-title">
              <span>{layer.name}</span>
              {isMaster ? <small>{layer.ownerRole === 'master' ? 'master' : 'player'}</small> : null}
            </div>
            <div className="layer-quick-actions">
              {layer.locked ? <span className="lock-indicator" title={t('Заблокирован')}>L</span> : null}
              {!layer.onTable && layer.layerType !== 'folder' ? (
                <button
                  type="button"
                  draggable={false}
                  onMouseDown={event => event.stopPropagation()}
                  onClick={event => {
                    event.stopPropagation()
                    void placeLayerOnTable(layer.id)
                  }}
                  title={t('Вынести на стол')}
                  aria-label={t('Вынести на стол')}
                >
                  ↗
                </button>
              ) : null}
              {!layer.onTable ? (
                <button
                  type="button"
                  className="danger"
                  draggable={false}
                  onMouseDown={event => event.stopPropagation()}
                  onClick={event => {
                    event.stopPropagation()
                    void deleteLayer(layer.id)
                  }}
                  title={t('Удалить из медиа')}
                  aria-label={t('Удалить из медиа')}
                >
                  ×
                </button>
              ) : null}
              <button
                type="button"
                draggable={false}
                onMouseDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation()
                  void patchLayer(layer.id, { locked: !layer.locked })
                }}
                title={layer.locked ? t('Разблокировать') : t('Заблокировать')}
                aria-label={layer.locked ? t('Разблокировать слой') : t('Заблокировать слой')}
              >
                {layer.locked ? 'L' : 'U'}
              </button>
            </div>
          </div>
        </article>
        {isFolder && isExpanded && layer.children.length > 0 ? (
          <div className="layer-children">{layer.children.map(child => renderLayerNode(child, depth + 1))}</div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="layer-manager-select-area" ref={containerRef} onPointerDown={startDragSelect}>
      {layers.map(layer => renderLayerNode(layer))}
      {dragSelectRect ? (
        <div
          className="layer-list-selection-rect"
          style={{
            left: dragSelectRect.left,
            top: dragSelectRect.top,
            width: dragSelectRect.width,
            height: dragSelectRect.height,
          }}
        />
      ) : null}
    </div>
  )
}
