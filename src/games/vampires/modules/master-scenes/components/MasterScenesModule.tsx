'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { MasterModuleProps } from '@/games/vampires/modules/master-console/types'
import { getMasterMembership } from '@/games/vampires/modules/master-console/api'
import type { TableLayer } from '@/games/vampires/modules/table/types'
import { useMasterScenes } from '../hooks'
import {
  deleteSceneInteractive,
  projectInteractivePublic,
  upsertSceneInteractive,
} from '../api'
import { playSceneMusicTrack } from '../services'
import type { InteractiveObjectType, LightPresetId, SceneInteractive } from '../types'
import { LIGHT_MOOD_PRESETS, getLightPreset } from '../utils/light-presets'
import { categorizeLayer, groupLayersByCategory, LAYER_CATEGORY_LABELS } from '../utils/layer-categories'
import './master-scenes.css'

const OBJECT_TYPES: { id: InteractiveObjectType; label: string }[] = [
  { id: 'door', label: 'Дверь' },
  { id: 'light', label: 'Свет' },
  { id: 'trap', label: 'Ловушка' },
  { id: 'hotspot', label: 'Hotspot' },
  { id: 'sound_trigger', label: 'Звук' },
  { id: 'note', label: 'Заметка' },
  { id: 'custom', label: 'Custom' },
]

function layerPreviewStyle(layer: TableLayer): CSSProperties {
  // Normalize coordinates into a virtual 1200×700 stage for master preview.
  const stageW = 1200
  const stageH = 700
  const left = Math.max(0, Math.min(92, (layer.x / stageW) * 100))
  const top = Math.max(0, Math.min(92, (layer.y / stageH) * 100))
  const width = Math.max(4, Math.min(60, (layer.width / stageW) * 100))
  const height = Math.max(4, Math.min(60, (layer.height / stageH) * 100))
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
    opacity: layer.opacity,
    zIndex: layer.zIndex,
    filter: `brightness(${layer.brightness}) contrast(${layer.contrast}) saturate(${layer.saturation})`,
  }
}

export default function MasterScenesModule({ room, role, deepLinkParams }: MasterModuleProps) {
  const scenes = useMasterScenes(room)
  const [newName, setNewName] = useState('')
  const [objectName, setObjectName] = useState('')
  const [objectType, setObjectType] = useState<InteractiveObjectType>('door')
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [missingEntity, setMissingEntity] = useState<string | null>(null)

  const deepLinkSceneId = deepLinkParams?.scene || deepLinkParams?.entity || null

  useEffect(() => {
    if (!deepLinkSceneId) {
      setMissingEntity(null)
      return
    }
    scenes.setSelectedSceneId(deepLinkSceneId)
  }, [deepLinkSceneId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!deepLinkSceneId || scenes.loading) return
    const found = scenes.listItems.some(item => item.scene.id === deepLinkSceneId)
    setMissingEntity(found ? null : deepLinkSceneId)
  }, [deepLinkSceneId, scenes.listItems, scenes.loading])

  const selected = useMemo(
    () => scenes.listItems.find(item => item.scene.id === scenes.selectedSceneId) || null,
    [scenes.listItems, scenes.selectedSceneId],
  )

  const grouped = useMemo(() => groupLayersByCategory(scenes.layers), [scenes.layers])
  const preset = getLightPreset(scenes.draftPresetId)
  const previewLayers = useMemo(
    () => scenes.layers.filter(layer => layer.onTable && layer.visible && layer.layerType !== 'folder'),
    [scenes.layers],
  )

  const ensureChronicle = useCallback(async () => {
    if (scenes.chronicleId) return scenes.chronicleId
    const membership = await getMasterMembership(room)
    if (!membership) throw new Error('Нужен Auth membership мастера')
    scenes.setChronicleId(membership.chronicleId)
    return membership.chronicleId
  }, [room, scenes])

  const addInteractive = useCallback(async () => {
    if (!scenes.selectedSceneId || !objectName.trim()) return
    try {
      const chronicleId = await ensureChronicle()
      const object: SceneInteractive = {
        id: crypto.randomUUID(),
        chronicleId,
        room,
        sceneId: scenes.selectedSceneId,
        objectType,
        name: objectName.trim(),
        layerId: null,
        x: 100,
        y: 100,
        publicState: { label: objectName.trim(), state: objectType === 'door' ? 'closed' : 'idle' },
        privateConfig: objectType === 'trap'
          ? { damage: 'aggravated', hidden: true, note: '' }
          : {},
        revealed: objectType === 'door' || objectType === 'light',
        sortOrder: scenes.interactives.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await upsertSceneInteractive(object)
      if (object.revealed) await projectInteractivePublic(object)
      scenes.setInteractives(prev => [...prev, object])
      setObjectName('')
      scenes.setStatus('Интерактив добавлен (private config не уходит игрокам)')
    } catch (err) {
      scenes.setStatus(err instanceof Error ? err.message : 'Не удалось добавить объект')
    }
  }, [ensureChronicle, objectName, objectType, room, scenes])

  const toggleReveal = useCallback(async (object: SceneInteractive) => {
    const next = {
      ...object,
      revealed: !object.revealed,
      updatedAt: new Date().toISOString(),
    }
    await upsertSceneInteractive(next)
    await projectInteractivePublic(next)
    scenes.setInteractives(prev => prev.map(item => (item.id === object.id ? next : item)))
  }, [scenes])

  const togglePublicState = useCallback(async (object: SceneInteractive, key: string, value: unknown) => {
    const next = {
      ...object,
      publicState: { ...object.publicState, [key]: value },
      updatedAt: new Date().toISOString(),
    }
    await upsertSceneInteractive(next)
    if (next.revealed) await projectInteractivePublic(next)
    scenes.setInteractives(prev => prev.map(item => (item.id === object.id ? next : item)))
  }, [scenes])

  if (role === 'observer') {
    return <section className="ms-module"><div className="ms-empty">Observer: сцены read-only — в следующей фазе.</div></section>
  }

  return (
    <section className="ms-module" aria-label="Сцены и слои">
      <header className="ms-header">
        <div>
          <span className="ms-kicker">видимость · туман · свет</span>
          <h1>Сцены и слои</h1>
          <p className="ms-muted">
            игроки видят только опубликованную сцену · GM-слои не уходят на table canvas
          </p>
        </div>
        <div className="ms-badges">
          <span className="ms-badge" data-tone="published">
            игрокам: {scenes.listItems.find(item => item.isPublished)?.scene.name || '—'}
          </span>
          <span className="ms-badge">
            preview: {selected?.scene.name || '—'}
          </span>
        </div>
      </header>

      {scenes.status ? <p className="ms-status">{scenes.status}</p> : null}
      {scenes.error ? <p className="ms-status" data-tone="error">{scenes.error}</p> : null}
      {missingEntity ? (
        <p className="master-entity-missing" role="status">
          Сцена не найдена или удалена: <code>{missingEntity}</code>
        </p>
      ) : null}

      <div className="ms-layout">
        {/* Scene list ≈266px */}
        <aside className="ms-col" aria-label="Список сцен">
          <div className="ms-col-head">
            <h2>Сцены</h2>
            <button type="button" disabled={scenes.busy} onClick={() => void scenes.createScene(newName || undefined)}>
              + новая
            </button>
          </div>
          <div className="ms-col-body">
            <div className="ms-add-row">
              <input
                value={newName}
                placeholder="Название сцены"
                onChange={event => setNewName(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    void scenes.createScene(newName || undefined)
                    setNewName('')
                  }
                }}
              />
            </div>

            {scenes.loading ? <div className="ms-empty">Загрузка сцен…</div> : null}
            {!scenes.loading && scenes.listItems.length === 0 ? (
              <div className="ms-empty">
                Сцен нет. Создайте первую — строки `table_scenes` те же, что у `/vampires/table`.
              </div>
            ) : null}

            {scenes.listItems.map(item => (
              <button
                key={item.scene.id}
                type="button"
                className="ms-scene-card"
                data-selected={item.isPreview ? 'true' : undefined}
                data-published={item.isPublished ? 'true' : undefined}
                onClick={() => scenes.setSelectedSceneId(item.scene.id)}
              >
                <strong>{item.scene.name}</strong>
                <small>
                  {item.layerCount} слоёв
                  {item.hasMusic ? ' · музыка' : ''}
                  {item.meta?.status ? ` · ${item.meta.status}` : ''}
                </small>
                <div className="ms-badges">
                  {item.isPublished ? <span className="ms-badge" data-tone="published">опубликована</span> : (
                    <span className="ms-badge">черновик/preview</span>
                  )}
                  {item.hasMusic ? <span className="ms-badge" data-tone="music">♪</span> : null}
                  {item.encounterMarker ? (
                    <span className="ms-badge" data-tone="ambush">{item.encounterMarker}</span>
                  ) : null}
                </div>
              </button>
            ))}

            {selected ? (
              <div className="ms-scene-actions" style={{ display: 'grid', gap: 6 }}>
                <button
                  type="button"
                  className="ms-btn"
                  onClick={() => {
                    const name = window.prompt('Новое название', selected.scene.name)?.trim()
                    if (name) void scenes.renameScene(selected.scene.id, name)
                  }}
                >
                  Переименовать
                </button>
                <button type="button" className="ms-btn" disabled={scenes.busy} onClick={() => void scenes.cloneScene(selected.scene.id)}>
                  Клонировать
                </button>
                <button
                  type="button"
                  className="ms-btn"
                  onClick={() => {
                    const marker = window.prompt('Маркер encounter/ambush (пусто = сброс)', selected.encounterMarker || '') ?? ''
                    void scenes.setEncounterMarker(selected.scene.id, marker.trim())
                  }}
                >
                  Encounter marker
                </button>
                <button
                  type="button"
                  className="ms-btn"
                  disabled={scenes.busy || selected.isPublished}
                  onClick={() => void scenes.archiveScene(selected.scene.id)}
                >
                  Архивировать
                </button>
              </div>
            ) : null}
          </div>
        </aside>

        {/* Preview */}
        <main className="ms-col" aria-label="Предпросмотр мастера">
          <div className="ms-col-head">
            <h2>Предпросмотр мастера</h2>
            <span className="ms-badge">{selected?.isPublished ? 'также опубликована' : 'черновик'}</span>
          </div>
          <div className="ms-col-body">
            <div className="ms-publish-bar">
              <div>
                <strong>{selected?.scene.name || 'Сцена не выбрана'}</strong>
                <p className="ms-muted" style={{ margin: 0 }}>
                  Изменения preview не уходят игрокам, пока не нажмёте «Показать игрокам».
                </p>
              </div>
              <button
                type="button"
                className="ms-btn"
                data-primary="true"
                disabled={!selected || scenes.busy}
                onClick={() => setConfirmPublish(true)}
              >
                Показать игрокам
              </button>
            </div>

            {confirmPublish ? (
              <div className="ms-empty">
                Опубликовать «{selected?.scene.name}»? Игроки получат `scene-active` с fade, без GM-слоёв.
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
                  <button type="button" className="ms-btn" onClick={() => setConfirmPublish(false)}>Отмена</button>
                  <button
                    type="button"
                    className="ms-btn"
                    data-primary="true"
                    onClick={() => {
                      setConfirmPublish(false)
                      void scenes.publishSelected()
                    }}
                  >
                    Опубликовать
                  </button>
                </div>
              </div>
            ) : null}

            <div className="ms-preview" aria-label="Canvas preview">
              <div
                className="ms-preview-canvas"
                style={{ filter: preset?.filterCss || undefined }}
              >
                {previewLayers.length === 0 ? (
                  <div className="ms-preview-empty">
                    Нет on-table слоёв в preview.
                    <br />
                    Слои сцены те же, что в `table_images` — управляйте справа или на `/vampires/table`.
                  </div>
                ) : (
                  previewLayers.map(layer => (
                    <div
                      key={layer.id}
                      className="ms-preview-layer"
                      data-category={categorizeLayer(layer)}
                      style={layerPreviewStyle(layer)}
                      title={`${layer.name} · ${categorizeLayer(layer)}`}
                    >
                      {layer.layerType === 'image' || layer.layerType === 'video' ? (
                        layer.layerType === 'video'
                          ? <video src={layer.imageData} muted />
                          : <img src={layer.imageData} alt="" />
                      ) : (
                        <div style={{ padding: 6, fontSize: 10 }}>{layer.name}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="ms-preview-meta">
                <span>{preset ? `настроение: ${preset.label}` : 'настроение: default'}</span>
                <span>слоёв on-table: {previewLayers.length}</span>
                <span>GM outline = золотой пунктир</span>
              </div>
            </div>

            <section aria-label="Свет и настроение">
              <h2 style={{ margin: '0 0 8px', fontSize: 12 }}>Свет и настроение</h2>
              <p className="ms-muted">Пресет меняет только master preview, пока сцена не опубликована.</p>
              <div className="ms-presets">
                {LIGHT_MOOD_PRESETS.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    data-active={scenes.draftPresetId === item.id ? 'true' : undefined}
                    onClick={() => void scenes.setDraftPreset(
                      scenes.draftPresetId === item.id ? '' : item.id as LightPresetId,
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {preset ? <p className="ms-muted">{preset.ambience}</p> : null}
            </section>

            <section aria-label="Музыка сцены">
              <h2 style={{ margin: '0 0 8px', fontSize: 12 }}>Музыка сцены</h2>
              {scenes.music.length === 0 ? (
                <div className="ms-empty">Нет tracks `table_scene_music` у этой сцены.</div>
              ) : (
                scenes.music.map(track => (
                  <div key={track.id} className="ms-music-row">
                    <span>{track.title || track.url}</span>
                    <button
                      type="button"
                      className="ms-btn"
                      onClick={() => {
                        void playSceneMusicTrack(track, { play: true })
                        scenes.setStatus('Музыка через table_music (глобальный engine)')
                      }}
                    >
                      ▶ play
                    </button>
                  </div>
                ))
              )}
            </section>
          </div>
        </main>

        {/* Layers + interactives ≈300px */}
        <aside className="ms-col" aria-label="Слои и интерактив">
          <div className="ms-col-head">
            <h2>Слои</h2>
            <span className="ms-badge">{scenes.layers.length}</span>
          </div>
          <div className="ms-col-body">
            {(['gm', 'fog', 'players'] as const).map(category => (
              <div key={category} className="ms-layer-group">
                <h3>{LAYER_CATEGORY_LABELS[category]} · {grouped[category].length}</h3>
                {grouped[category].length === 0 ? (
                  <div className="ms-empty" style={{ padding: 10 }}>пусто</div>
                ) : (
                  grouped[category].map(layer => (
                    <div key={layer.id} className="ms-layer-row">
                      <div>
                        <strong title={layer.name}>{layer.name || layer.layerType}</strong>
                        <small>
                          {layer.layerType} · z{layer.zIndex}
                          {layer.locked ? ' · lock' : ''}
                          {layer.onTable ? ' · on table' : ' · library'}
                        </small>
                      </div>
                      <div className="ms-layer-controls">
                        <button
                          type="button"
                          title="visibility"
                          onClick={() => void scenes.updateLayer(layer.id, { visible: !layer.visible })}
                        >
                          {layer.visible ? 'виден' : 'скрыт'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void scenes.updateLayer(layer.id, { locked: !layer.locked })}
                        >
                          {layer.locked ? '🔒' : '🔓'}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={layer.opacity}
                          onChange={event => {
                            const opacity = Number(event.target.value)
                            void scenes.updateLayer(layer.id, { opacity })
                          }}
                          title="opacity"
                        />
                        {category !== 'gm' ? (
                          <button
                            type="button"
                            onClick={() => void scenes.updateLayer(layer.id, { ownerRole: 'master' })}
                            title="Сделать GM-слоем"
                          >
                            →GM
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void scenes.updateLayer(layer.id, { ownerRole: 'player' })}
                            title="Сделать player-слоем"
                          >
                            →PC
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}

            <section aria-label="Интерактив сцены">
              <h2 style={{ margin: '8px 0', fontSize: 12 }}>Интерактив сцены</h2>
              <div className="ms-add-row">
                <select value={objectType} onChange={event => setObjectType(event.target.value as InteractiveObjectType)}>
                  {OBJECT_TYPES.map(item => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div className="ms-add-row" style={{ marginTop: 6 }}>
                <input
                  value={objectName}
                  placeholder="Имя объекта"
                  onChange={event => setObjectName(event.target.value)}
                />
                <button type="button" className="ms-btn" onClick={() => void addInteractive()}>+</button>
              </div>

              {scenes.interactives.length === 0 ? (
                <div className="ms-empty" style={{ marginTop: 8 }}>
                  Двери, свет, ловушки… private config не публикуется.
                </div>
              ) : (
                scenes.interactives.map(object => (
                  <article
                    key={object.id}
                    className="ms-interactive"
                    data-hidden={!object.revealed ? 'true' : undefined}
                  >
                    <strong>{object.name}</strong>
                    <small>
                      {object.objectType}
                      {object.revealed ? '' : ' · ☾ скрыт'}
                      {typeof object.publicState.state === 'string' ? ` · ${String(object.publicState.state)}` : ''}
                    </small>
                    <div className="ms-interactive-actions">
                      {object.objectType === 'door' ? (
                        <button
                          type="button"
                          onClick={() => void togglePublicState(
                            object,
                            'state',
                            object.publicState.state === 'open' ? 'closed' : 'open',
                          )}
                        >
                          {object.publicState.state === 'open' ? 'закрыть' : 'открыть'}
                        </button>
                      ) : null}
                      {object.objectType === 'light' ? (
                        <button
                          type="button"
                          onClick={() => void togglePublicState(
                            object,
                            'state',
                            object.publicState.state === 'on' ? 'off' : 'on',
                          )}
                        >
                          {object.publicState.state === 'on' ? 'погасить' : 'вкл'}
                        </button>
                      ) : null}
                      <button type="button" onClick={() => void toggleReveal(object)}>
                        {object.revealed ? 'скрыть' : 'раскрыть'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void deleteSceneInteractive(room, object.id)
                          scenes.setInteractives(prev => prev.filter(item => item.id !== object.id))
                        }}
                      >
                        удалить
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>
        </aside>
      </div>
    </section>
  )
}
