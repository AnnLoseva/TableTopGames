'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MasterModuleProps } from '@/games/vampires/modules/master-console/types'
import { getMasterMembership } from '@/games/vampires/modules/master-console/api'
import { createTableId } from '@/games/vampires/modules/table/api/scene-api'
import { insertScene } from '@/games/vampires/modules/table/api/scene-api'
import { uploadTableImageFile, insertLayer } from '@/games/vampires/modules/table/api/layer-api'
import type { TableLayer } from '@/games/vampires/modules/table/types'
import { useLoreCompendium } from '../hooks'
import { navigateToEntity, systemReferenceHref } from '../services'
import type { LoreAttachment, LoreEntry, LoreSearchHit } from '../types'
import './lore.css'

function hitKey(hit: LoreSearchHit): string {
  if (hit.kind === 'entry') return `entry:${hit.entry.id}`
  if (hit.kind === 'table') return `table:${hit.table.id}`
  return hit.hit.id
}

function BodyEditor({
  html,
  onChange,
  placeholder,
}: {
  html: string
  onChange: (html: string) => void
  placeholder: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef(html)

  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    if (el.innerHTML !== html) {
      el.innerHTML = html || ''
      last.current = html
    }
  }, [html])

  return (
    <div
      ref={ref}
      className="lore-editor"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={() => {
        const next = ref.current?.innerHTML || ''
        if (next === last.current) return
        last.current = next
        onChange(next)
      }}
    />
  )
}

export default function LoreModule({ room, role, deepLinkParams }: MasterModuleProps) {
  const lore = useLoreCompendium(room)
  const [tagDraft, setTagDraft] = useState('')
  const [catDraft, setCatDraft] = useState('')
  const [linkType, setLinkType] = useState('actor')
  const [linkId, setLinkId] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const deepLinkEntryId = deepLinkParams?.entry || (deepLinkParams?.entityType !== 'random_table' && deepLinkParams?.entityType !== 'table' ? deepLinkParams?.entity : null) || null
  const deepLinkTableId = deepLinkParams?.table || (deepLinkParams?.entityType === 'random_table' || deepLinkParams?.entityType === 'table' ? deepLinkParams?.entity : null) || null
  const [missingEntity, setMissingEntity] = useState<string | null>(null)

  useEffect(() => {
    if (deepLinkEntryId) {
      lore.setSelectedEntryId(deepLinkEntryId)
      lore.setSelectedTableId(null)
    } else if (deepLinkTableId) {
      lore.setSelectedTableId(deepLinkTableId)
      lore.setSelectedEntryId(null)
    }
  }, [deepLinkEntryId, deepLinkTableId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (lore.loading) return
    if (deepLinkEntryId) {
      setMissingEntity(lore.selectedEntry?.id === deepLinkEntryId ? null : deepLinkEntryId)
      return
    }
    if (deepLinkTableId) {
      setMissingEntity(lore.selectedTable?.id === deepLinkTableId ? null : deepLinkTableId)
      return
    }
    setMissingEntity(null)
  }, [deepLinkEntryId, deepLinkTableId, lore.loading, lore.selectedEntry, lore.selectedTable])

  useEffect(() => {
    if (lore.chronicleId) return
    void getMasterMembership(room).then(m => {
      if (m) lore.setChronicleId(m.chronicleId)
    }).catch(() => undefined)
  }, [lore, room])

  const onSelectHit = useCallback((hit: LoreSearchHit) => {
    if (hit.kind === 'entry') {
      lore.setSelectedEntryId(hit.entry.id)
      lore.setSelectedTableId(null)
    } else if (hit.kind === 'table') {
      lore.setSelectedTableId(hit.table.id)
      lore.setSelectedEntryId(null)
    } else {
      window.open(systemReferenceHref(hit.hit), '_blank', 'noopener,noreferrer')
    }
  }, [lore])

  const publishToggle = useCallback(() => {
    if (!lore.selectedEntry) return
    const published = lore.selectedEntry.status === 'published' && lore.selectedEntry.visibility === 'shared'
    lore.patchSelectedEntry({
      status: published ? 'draft' : 'published',
      visibility: published ? 'master' : 'shared',
    })
  }, [lore])

  const addTag = useCallback(() => {
    const tag = tagDraft.trim().replace(/^#/, '')
    if (!tag || !lore.selectedEntry) return
    if (lore.selectedEntry.tags.includes(tag)) return
    lore.patchSelectedEntry({ tags: [...lore.selectedEntry.tags, tag].slice(0, 48) })
    setTagDraft('')
  }, [lore, tagDraft])

  const createSceneFromLocation = useCallback(async () => {
    const entry = lore.selectedEntry
    if (!entry) return
    try {
      const now = new Date().toISOString()
      const scene = {
        id: createTableId(),
        room,
        name: entry.title,
        thumbnailUrl: entry.attachments.find(item => item.kind === 'image')?.url || '',
        isActive: false,
        backgroundUrl: '',
        width: 1920,
        height: 1080,
        folderId: null,
        viewMode: 'table' as const,
        createdBy: 'master',
        createdAt: now,
        updatedAt: now,
      }
      const { error } = await insertScene(scene)
      if (error) throw error
      await lore.addLink({
        targetType: 'scene',
        targetId: scene.id,
        label: `▣ Сцена: ${scene.name}`,
        relationType: 'has_scene',
      })
      lore.setStatus(`Сцена «${scene.name}» создана (черновик)`)
      navigateToEntity('scene', scene.id, scene.name)
    } catch (err) {
      lore.setStatus(err instanceof Error ? err.message : 'Не удалось создать сцену')
    }
  }, [lore, room])

  const onDropMedia = useCallback(async (files: FileList | null) => {
    const entry = lore.selectedEntry
    if (!entry || !files?.length) return
    const file = files[0]
    try {
      const uploaded = await uploadTableImageFile(room, file)
      if (uploaded.error || !uploaded.publicUrl) throw uploaded.error || new Error('upload failed')
      const attachment: LoreAttachment = {
        id: crypto.randomUUID(),
        kind: file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : 'file',
        name: file.name,
        url: uploaded.publicUrl,
      }
      lore.patchSelectedEntry({ attachments: [...entry.attachments, attachment] })

      // Optional: also place on a library layer for scene drag workflow.
      if (attachment.kind === 'image') {
        const layer: TableLayer = {
          id: createTableId(),
          room,
          sceneId: null,
          layerType: 'image',
          ownerRole: 'master',
          ownerId: 'master',
          parentId: null,
          name: attachment.name,
          imageData: attachment.url,
          x: 80,
          y: 80,
          width: 420,
          height: 280,
          cropX: null,
          cropY: null,
          cropWidth: null,
          cropHeight: null,
          zIndex: 1,
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'normal',
          rotation: 0,
          flipX: false,
          flipY: false,
          brightness: 1,
          contrast: 1,
          saturation: 1,
          onTable: false,
          isBackground: false,
          createdAt: new Date().toISOString(),
        }
        await insertLayer(layer)
      }
      lore.setStatus('Медиа добавлено (существующий table-images storage)')
    } catch (err) {
      lore.setStatus(err instanceof Error ? err.message : 'Ошибка загрузки медиа')
    }
  }, [lore, room])

  if (role === 'observer') {
    return (
      <section className="lore-module">
        <div className="lore-empty">Observer: только shared published записи (после Auth).</div>
      </section>
    )
  }

  return (
    <section className="lore-module" aria-label="Лор и таблицы">
      <header className="lore-header">
        <div>
          <span className="lore-kicker">компендиум хроники</span>
          <h1>Лор и таблицы</h1>
          <p className="lore-muted">
            системный reference отдельно · chronicle lore в Supabase · связи через entity links
          </p>
        </div>
        <div className="lore-hit-meta">
          <span className="lore-badge" data-tone="private">☾ private default</span>
          <span className="lore-badge">{lore.source === 'local' ? 'local storage' : 'remote'}</span>
        </div>
      </header>

      {lore.status ? <p className="lore-status">{lore.status}</p> : null}
      {lore.error ? <p className="lore-status" data-tone="error">{lore.error}</p> : null}
      {missingEntity ? (
        <p className="master-entity-missing" role="status">
          Запись/таблица не найдена или удалена: <code>{missingEntity}</code>
        </p>
      ) : null}

      <div className="lore-layout">
        {/* Categories ≈250px */}
        <aside className="lore-col" aria-label="Категории">
          <div className="lore-col-head">
            <h2>Категории</h2>
          </div>
          <div className="lore-col-body">
            <button
              type="button"
              className="lore-cat"
              data-active={!lore.categorySlug ? 'true' : undefined}
              onClick={() => lore.setCategorySlug(null)}
            >
              <span>Все</span>
            </button>
            {lore.mergedCategories.map(category => (
              <button
                key={category.id}
                type="button"
                className="lore-cat"
                data-active={lore.categorySlug === category.slug ? 'true' : undefined}
                onClick={() => lore.setCategorySlug(category.slug)}
              >
                <span>
                  {category.title}
                  {category.isSystem ? ' · sys' : ''}
                </span>
                <em>{category.entryCount ?? 0}</em>
              </button>
            ))}
            <div className="lore-add-cat">
              <input
                className="lore-search"
                placeholder="+ своя категория"
                value={catDraft}
                onChange={event => setCatDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && catDraft.trim()) {
                    void lore.createCategory(catDraft).then(() => setCatDraft(''))
                  }
                }}
              />
              <button
                type="button"
                className="lore-btn"
                disabled={!catDraft.trim()}
                onClick={() => {
                  void lore.createCategory(catDraft).then(() => setCatDraft(''))
                }}
              >
                +
              </button>
            </div>
          </div>
        </aside>

        {/* Search / results ≈300px */}
        <section className="lore-col" aria-label="Поиск и результаты">
          <div className="lore-col-head">
            <h2>Поиск</h2>
            <button type="button" className="lore-btn" onClick={() => void lore.createEntry()}>+ запись</button>
          </div>
          <div className="lore-col-body">
            <input
              className="lore-search"
              type="search"
              placeholder="Поиск по названию, тексту, тегам…"
              value={lore.query}
              onChange={event => lore.setQuery(event.target.value)}
            />
            <div className="lore-tags">
              {lore.allTags.slice(0, 24).map(tag => (
                <button
                  key={tag}
                  type="button"
                  className="lore-tag"
                  data-active={lore.activeTags.includes(tag) ? 'true' : undefined}
                  onClick={() => {
                    lore.setActiveTags(prev => (
                      prev.includes(tag) ? prev.filter(item => item !== tag) : [...prev, tag]
                    ))
                  }}
                >
                  #{tag}
                </button>
              ))}
              <input
                className="lore-search"
                style={{ height: 28, flex: '1 1 80px' }}
                placeholder="+ тег фильтр"
                value={tagDraft}
                onChange={event => setTagDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && tagDraft.trim()) {
                    const tag = tagDraft.trim().replace(/^#/, '')
                    lore.setActiveTags(prev => prev.includes(tag) ? prev : [...prev, tag])
                    setTagDraft('')
                  }
                }}
              />
            </div>

            {lore.categorySlug === 'random_tables' ? (
              <button type="button" className="lore-btn" data-primary="true" onClick={() => void lore.createTable()}>
                + случайная таблица
              </button>
            ) : null}

            {lore.loading ? <div className="lore-empty">Загрузка…</div> : null}
            {!lore.loading && lore.hits.length === 0 ? (
              <div className="lore-empty">
                Ничего не найдено. Создайте chronicle-запись или откройте system reference (sys).
              </div>
            ) : (
              lore.hits.map(hit => {
                const key = hitKey(hit)
                const active = (
                  (hit.kind === 'entry' && hit.entry.id === lore.selectedEntryId)
                  || (hit.kind === 'table' && hit.table.id === lore.selectedTableId)
                )
                if (hit.kind === 'entry') {
                  return (
                    <button key={key} type="button" className="lore-hit" data-active={active ? 'true' : undefined} onClick={() => onSelectHit(hit)}>
                      <strong>{hit.entry.title}</strong>
                      <small>{hit.entry.shortSummary || hit.entry.categorySlug}</small>
                      <div className="lore-hit-meta">
                        <span className="lore-badge">{hit.entry.categorySlug}</span>
                        {hit.entry.visibility === 'master' ? (
                          <span className="lore-badge" data-tone="private">☾</span>
                        ) : (
                          <span className="lore-badge" data-tone="shared">shared</span>
                        )}
                        <span className="lore-badge">{hit.entry.status}</span>
                      </div>
                    </button>
                  )
                }
                if (hit.kind === 'table') {
                  return (
                    <button key={key} type="button" className="lore-hit" data-active={active ? 'true' : undefined} onClick={() => onSelectHit(hit)}>
                      <strong>🎲 {hit.table.title}</strong>
                      <small>{hit.table.description || `${hit.table.rows.length} строк`}</small>
                    </button>
                  )
                }
                return (
                  <button key={key} type="button" className="lore-hit" onClick={() => onSelectHit(hit)}>
                    <strong>{hit.hit.title}</strong>
                    <small>{hit.hit.shortSummary}</small>
                    <div className="lore-hit-meta">
                      <span className="lore-badge" data-tone="system">system ref</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </section>

        {/* Detail */}
        <section className="lore-col" aria-label="Деталь записи">
          {!lore.selectedEntry && !lore.selectedTable ? (
            <div className="lore-empty" style={{ margin: 16 }}>
              Выберите запись, таблицу или system reference слева.
            </div>
          ) : null}

          {lore.selectedEntry ? (
            <div className="lore-detail">
              <div className="lore-detail-actions">
                <button type="button" className="lore-btn" onClick={publishToggle}>
                  {lore.selectedEntry.status === 'published' && lore.selectedEntry.visibility === 'shared'
                    ? 'Снять публикацию'
                    : 'Опубликовать'}
                </button>
                <button type="button" className="lore-btn" onClick={() => void createSceneFromLocation()}>
                  → в сцену
                </button>
                <button type="button" className="lore-btn" onClick={() => fileInputRef.current?.click()}>
                  + медиа
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept="image/*,audio/*,*/*"
                  onChange={event => void onDropMedia(event.target.files)}
                />
              </div>

              <label className="lore-field">
                <span>title</span>
                <input
                  value={lore.selectedEntry.title}
                  onChange={event => lore.patchSelectedEntry({ title: event.target.value })}
                />
              </label>
              <label className="lore-field">
                <span>category</span>
                <select
                  value={lore.selectedEntry.categorySlug}
                  onChange={event => lore.patchSelectedEntry({ categorySlug: event.target.value })}
                >
                  {lore.mergedCategories.map(category => (
                    <option key={category.slug} value={category.slug}>{category.title}</option>
                  ))}
                </select>
              </label>
              <label className="lore-field">
                <span>short summary</span>
                <input
                  value={lore.selectedEntry.shortSummary}
                  onChange={event => lore.patchSelectedEntry({ shortSummary: event.target.value })}
                />
              </label>
              <label className="lore-field">
                <span>body</span>
                <BodyEditor
                  html={lore.selectedEntry.bodyHtml}
                  placeholder="Текст записи…"
                  onChange={html => lore.patchSelectedEntry({ bodyHtml: html })}
                />
              </label>
              <label className="lore-field">
                <span>tags</span>
                <div className="lore-tags">
                  {lore.selectedEntry.tags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className="lore-tag"
                      data-active="true"
                      onClick={() => lore.patchSelectedEntry({
                        tags: lore.selectedEntry!.tags.filter(item => item !== tag),
                      })}
                    >
                      #{tag} ×
                    </button>
                  ))}
                  <input
                    className="lore-search"
                    style={{ height: 28, flex: '1 1 100px' }}
                    value={tagDraft}
                    placeholder="+ тег"
                    onChange={event => setTagDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') addTag()
                    }}
                  />
                </div>
              </label>

              <div className="lore-private">
                <span>☾ Приватная заметка мастера</span>
                <textarea
                  rows={3}
                  value={lore.selectedEntry.privateNote || ''}
                  onChange={event => lore.patchSelectedEntry({ privateNote: event.target.value })}
                  placeholder="Не попадает в shared/player payload"
                />
              </div>

              <div>
                <span className="lore-kicker">Связи · клик = переход</span>
                <div className="lore-chips" style={{ marginTop: 8 }}>
                  {lore.linkChips.length === 0 ? (
                    <span className="lore-muted">Связей пока нет — добавьте ниже (entity links).</span>
                  ) : (
                    lore.linkChips.map(chip => (
                      <button
                        key={chip.id}
                        type="button"
                        className="lore-chip"
                        onClick={() => navigateToEntity(chip.targetType, chip.targetId, chip.label)}
                      >
                        {chip.label || `${chip.targetType}:${chip.targetId.slice(0, 8)}`}
                      </button>
                    ))
                  )}
                </div>
                <div className="lore-link-form" style={{ marginTop: 8 }}>
                  <select value={linkType} onChange={event => setLinkType(event.target.value)}>
                    <option value="actor">NPC/actor</option>
                    <option value="scene">scene</option>
                    <option value="plot">plot</option>
                    <option value="location">location</option>
                    <option value="bond">blood_bond</option>
                    <option value="journal_entry">journal</option>
                    <option value="lore_entry">lore</option>
                  </select>
                  <input placeholder="entity id" value={linkId} onChange={event => setLinkId(event.target.value)} />
                  <input placeholder="label" value={linkLabel} onChange={event => setLinkLabel(event.target.value)} />
                  <button
                    type="button"
                    className="lore-btn"
                    disabled={!linkId.trim()}
                    onClick={() => {
                      void lore.addLink({
                        targetType: linkType === 'bond' ? 'blood_bond' : linkType,
                        targetId: linkId.trim(),
                        label: linkLabel.trim() || `${linkType}: ${linkId.trim().slice(0, 12)}`,
                      }).then(() => {
                        setLinkId('')
                        setLinkLabel('')
                      })
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {lore.selectedEntry.attachments.length > 0 ? (
                <div className="lore-attachments">
                  <span className="lore-kicker">Вложения</span>
                  {lore.selectedEntry.attachments.map(item => (
                    <div key={item.id} className="lore-attachment">
                      <span>{item.kind}: {item.name}</span>
                      <a href={item.url} target="_blank" rel="noreferrer">open</a>
                    </div>
                  ))}
                </div>
              ) : null}

              <div
                className="lore-empty"
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault()
                  void onDropMedia(event.dataTransfer.files)
                }}
              >
                Перетащи медиа сюда · используется table-images storage
              </div>
            </div>
          ) : null}

          {lore.selectedTable ? (
            <div className="lore-detail">
              <div className="lore-detail-actions">
                <button
                  type="button"
                  className="lore-btn"
                  data-primary="true"
                  onClick={() => void lore.rollTable(lore.selectedTable!)}
                >
                  Бросить
                </button>
                <button type="button" className="lore-btn" onClick={() => lore.addTableRow()}>+ строка</button>
              </div>
              <label className="lore-field">
                <span>title</span>
                <input
                  value={lore.selectedTable.title}
                  onChange={event => lore.patchSelectedTable({ title: event.target.value })}
                />
              </label>
              <label className="lore-field">
                <span>description</span>
                <textarea
                  rows={2}
                  value={lore.selectedTable.description}
                  onChange={event => lore.patchSelectedTable({ description: event.target.value })}
                />
              </label>
              <label className="lore-field">
                <span>dice expression (optional)</span>
                <input
                  value={lore.selectedTable.diceExpression}
                  onChange={event => lore.patchSelectedTable({ diceExpression: event.target.value })}
                  placeholder="1d6 / 2d10 …"
                />
              </label>
              <div className="lore-table-rows">
                <span className="lore-kicker">rows · weight</span>
                {lore.selectedTable.rows.map(row => (
                  <div key={row.id} className="lore-table-row">
                    <input
                      value={row.text}
                      onChange={event => lore.updateTableRow(row.id, { text: event.target.value })}
                    />
                    <input
                      type="number"
                      min={1}
                      value={row.weight}
                      onChange={event => lore.updateTableRow(row.id, {
                        weight: Math.max(1, Number(event.target.value) || 1),
                      })}
                    />
                    <button
                      type="button"
                      className="lore-btn"
                      onClick={() => lore.patchSelectedTable({
                        rows: lore.selectedTable!.rows.filter(item => item.id !== row.id),
                      })}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {lore.lastRoll && lore.lastRoll.tableId === lore.selectedTable.id ? (
                <div className="lore-roll-result">
                  <strong>Выпало:</strong> {lore.lastRoll.text}
                  <div className="lore-detail-actions" style={{ marginTop: 8 }}>
                    <button type="button" className="lore-btn" onClick={() => void lore.convertRollToEntry(lore.lastRoll!, 'note')}>
                      → note
                    </button>
                    <button type="button" className="lore-btn" onClick={() => void lore.convertRollToEntry(lore.lastRoll!, 'hook')}>
                      → hook
                    </button>
                    <button type="button" className="lore-btn" onClick={() => void lore.convertRollToEntry(lore.lastRoll!, 'consequence')}>
                      → consequence
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  )
}
