'use client'

import { useMemo } from 'react'
import type { ComponentProps, DragEvent, FormEvent } from 'react'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import { ROOT_LAYER_DROP_ID } from '@/games/vampires/modules/table/constants'
import type {
  CharacterToken,
  LayerContextMenu,
  TableLayer,
  TableScene,
} from '@/games/vampires/modules/table/types'
import { buildLayerTree } from '@/games/vampires/modules/table/utils/layer-utils'
import LayerManager from './LayerManager'

type LayerManagerProps = Omit<ComponentProps<typeof LayerManager>, 'layers'>

type SceneLayerPanelProps = {
  visible: boolean
  activeScene: TableScene | null | undefined
  backgroundLayers: TableLayer[]
  tableManagerLayers: TableLayer[]
  tokens: CharacterToken[]
  textMaterialNameDraft: string
  textMaterialDraft: string
  layerManagerProps: LayerManagerProps
  clearSceneBackground: () => Promise<void>
  setLayerAsBackground: (layer: TableLayer) => void | Promise<void>
  setLayerSelection: LayerManagerProps['setLayerSelection']
  setLayerContextMenu: (menu: NonNullable<LayerContextMenu>) => void
  setTextMaterialNameDraft: (value: string) => void
  setTextMaterialDraft: (value: string) => void
  createTextMaterial: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  handleLayerRootDragOver: (event: DragEvent<HTMLDivElement>) => void
  handleLayerRootDrop: (event: DragEvent<HTMLDivElement>) => void | Promise<void>
  focusCharacterToken: (characterId: string) => void
  canManageToken: (token: CharacterToken) => boolean
  deleteToken: (tokenId: string) => void | Promise<void>
}

export default function SceneLayerPanel({
  visible,
  activeScene,
  backgroundLayers,
  tableManagerLayers,
  tokens,
  textMaterialNameDraft,
  textMaterialDraft,
  layerManagerProps,
  clearSceneBackground,
  setLayerAsBackground,
  setLayerSelection,
  setLayerContextMenu,
  setTextMaterialNameDraft,
  setTextMaterialDraft,
  createTextMaterial,
  handleLayerRootDragOver,
  handleLayerRootDrop,
  focusCharacterToken,
  canManageToken,
  deleteToken,
}: SceneLayerPanelProps) {
  const { t } = useLang()
  const mediaLayers = useMemo(
    () => tableManagerLayers.filter(layer => layer.layerType === 'folder' || (['image', 'video'].includes(layer.layerType) && !layer.isBackground)),
    [tableManagerLayers],
  )
  const textLayers = useMemo(
    () => tableManagerLayers.filter(layer => ['text', 'file'].includes(layer.layerType)),
    [tableManagerLayers],
  )

  const renderManagedLayers = (items: TableLayer[]) => (
    <div
      className={`layer-list ${layerManagerProps.layerDropTarget?.layerId === ROOT_LAYER_DROP_ID ? 'drop-root' : ''}`}
      onDragOver={handleLayerRootDragOver}
      onDrop={handleLayerRootDrop}
    >
      {items.length === 0
        ? <p className="panel-empty">{t('Пусто')}</p>
        : <LayerManager {...layerManagerProps} layers={buildLayerTree(items)} />}
    </div>
  )

  return (
    <section className={`scene-layer-panel ${visible ? '' : 'table-right-panel-hidden'}`}>
      <header>
        <strong>{t('Слои сцены')}</strong>
        <span>{activeScene?.name || t('активная сцена')}</span>
      </header>
      <div className="scene-layer-groups">
        <details open>
          <summary>
            <span>{t('Фон')}</span>
            <span className="scene-layer-group-actions">
              <span>{backgroundLayers.length}</span>
              {activeScene?.backgroundUrl ? (
                <button
                  type="button"
                  onClick={event => {
                    event.preventDefault()
                    event.stopPropagation()
                    void clearSceneBackground()
                  }}
                  title={t('Сбросить фон сцены')}
                >
                  {t('Сбросить')}
                </button>
              ) : null}
            </span>
          </summary>
          <div className="layer-list">
            {backgroundLayers.length === 0 ? <p className="panel-empty">{t('Пусто')}</p> : backgroundLayers.map(layer => (
              <button
                type="button"
                className={`token-manager-row ${activeScene?.backgroundUrl === layer.imageData ? 'active' : ''}`}
                key={layer.id}
                onClick={() => void setLayerAsBackground(layer)}
                onContextMenu={event => {
                  event.preventDefault()
                  setLayerSelection([layer.id], layer.id)
                  setLayerContextMenu({ layerId: layer.id, x: event.clientX, y: event.clientY })
                }}
                title={t('Сделать активным фоном')}
              >
                <div className="layer-thumb" aria-hidden="true">
                  <img src={layer.imageData} alt="" draggable={false} width={36} height={32} />
                </div>
                <div className="layer-title"><span>{layer.name}</span></div>
                <div className="token-manager-actions">
                  {activeScene?.backgroundUrl === layer.imageData ? <span className="background-active-badge">{t('активен')}</span> : null}
                </div>
              </button>
            ))}
          </div>
        </details>

        <details open>
          <summary>{t('Картинки / декорации')}<span>{mediaLayers.length}</span></summary>
          {renderManagedLayers(mediaLayers)}
        </details>

        <details open>
          <summary>{t('Текст / документы')}<span>{textLayers.length}</span></summary>
          <form className="text-material-form scene-text-material-form" onSubmit={createTextMaterial}>
            <input
              value={textMaterialNameDraft}
              onChange={event => setTextMaterialNameDraft(event.target.value)}
              placeholder={t('Название текста')}
            />
            <textarea
              value={textMaterialDraft}
              onChange={event => setTextMaterialDraft(event.target.value)}
              placeholder={t('Текст, дневник, заметка...')}
              rows={3}
            />
            <button type="submit" disabled={!textMaterialDraft.trim()}>{t('Добавить текст')}</button>
          </form>
          {renderManagedLayers(textLayers)}
        </details>

        <details open>
          <summary>{t('Токены')}<span>{tokens.length}</span></summary>
          <div className="layer-list token-manager-list">
            {tokens.length === 0 ? <p className="panel-empty">{t('Пусто')}</p> : tokens.map(token => (
              <article className="token-manager-row" key={token.id}>
                <div className="layer-thumb" aria-hidden="true">
                  {token.imageUrl
                    ? <img src={token.imageUrl} alt="" draggable={false} width={36} height={32} />
                    : <span className="text-thumb">{(token.characterName || '?').slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="layer-title"><span>{token.characterName || t('Безымянный')}</span></div>
                <div className="token-manager-actions">
                  <button type="button" onClick={() => focusCharacterToken(token.characterId)} title={t('Найти на столе')}>
                    {t('Найти')}
                  </button>
                  {canManageToken(token) ? (
                    <button type="button" className="danger" onClick={() => void deleteToken(token.id)} title={t('Убрать токен со стола')}>
                      ×
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </details>
      </div>
    </section>
  )
}
