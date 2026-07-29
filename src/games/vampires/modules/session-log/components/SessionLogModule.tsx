'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MasterModuleProps } from '@/games/vampires/modules/master-console/types'
import JournalEditor from '@/games/vampires/modules/journal/components/JournalEditor'
import { navigateToEntity } from '@/games/vampires/modules/lore/services'
import { useSessionLog } from '../hooks'
import type { SaveStatus, SessionLogEntry } from '../types'
import './session-log.css'

function formatUpdated(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso.slice(0, 16)
  }
}

function visibilityLabel(v: SessionLogEntry['visibility']): string {
  if (v === 'shared_all') return 'всем'
  if (v === 'shared_selected') return 'выбранным'
  return 'private'
}

function visibilityTone(v: SessionLogEntry['visibility']): 'private' | 'shared' {
  return v === 'private' ? 'private' : 'shared'
}

function saveStatusLabel(status: SaveStatus): string {
  switch (status) {
    case 'dirty': return 'не сохранено…'
    case 'saving': return 'сохранение…'
    case 'saved': return 'сохранено'
    case 'local': return 'local only'
    case 'error': return 'ошибка'
    case 'conflict': return 'конфликт'
    default: return '—'
  }
}

export default function SessionLogModule({ room, role, deepLinkParams }: MasterModuleProps) {
  const log = useSessionLog(room)
  const [tagDraft, setTagDraft] = useState('')
  const [linkType, setLinkType] = useState('actor')
  const [linkId, setLinkId] = useState('')
  const [linkLabel, setLinkLabel] = useState('')

  const deepLinkEntryId = deepLinkParams?.entry || deepLinkParams?.entity || null
  const [missingEntity, setMissingEntity] = useState<string | null>(null)

  useEffect(() => {
    if (!deepLinkEntryId) {
      setMissingEntity(null)
      return
    }
    log.setSelectedId(deepLinkEntryId)
  }, [deepLinkEntryId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!deepLinkEntryId || log.loading) return
    const found = log.entries.some(entry => entry.id === deepLinkEntryId)
    setMissingEntity(found ? null : deepLinkEntryId)
  }, [deepLinkEntryId, log.entries, log.loading])

  const editorKey = log.selected?.id || 'none'

  const previewById = useMemo(() => {
    const map = new Map<string, string>()
    log.filtered.forEach(entry => {
      map.set(entry.id, log.bodyPreviewText(entry.bodyHtml, 90) || 'пустая запись')
    })
    return map
  }, [log])

  if (role === 'observer') {
    return (
      <section className="sl-module">
        <div className="sl-empty">
          Observer: только published projection (session_log_published), не draft body.
        </div>
      </section>
    )
  }

  return (
    <section className="sl-module" aria-label="Журнал сессии">
      <header className="sl-header">
        <div>
          <span className="sl-kicker">хроника мастера</span>
          <h1>Журнал сессии</h1>
          <p className="sl-muted">
            draft private · publish → session_log_published · личный дневник игрока не затронут
          </p>
        </div>
        <div className="sl-header-meta">
          <span className="sl-badge" data-tone="private">☾ private default</span>
          <span className="sl-badge">{log.source === 'local' ? 'local storage' : 'remote'}</span>
          <span
            className="sl-save-pill"
            data-tone={log.saveStatus === 'idle' ? undefined : log.saveStatus}
          >
            {saveStatusLabel(log.saveStatus)}
          </span>
        </div>
      </header>

      {log.statusMessage ? (
        <p
          className="sl-status"
          data-tone={log.saveStatus === 'conflict' ? 'conflict' : log.saveStatus === 'saved' ? 'saved' : undefined}
        >
          {log.statusMessage}
        </p>
      ) : null}
      {log.error ? <p className="sl-status" data-tone="error">{log.error}</p> : null}
      {missingEntity ? (
        <p className="master-entity-missing" role="status">
          Запись журнала не найдена или удалена: <code>{missingEntity}</code>
        </p>
      ) : null}

      <div className="sl-layout">
        {/* List ≈340px */}
        <aside className="sl-list" aria-label="Список записей">
          <div className="sl-list-head">
            <div className="sl-list-head-row">
              <h2>Записи</h2>
              <button
                type="button"
                className="sl-btn"
                data-primary="true"
                onClick={() => void log.createEntry().catch(err => {
                  log.setStatusMessage(err instanceof Error ? err.message : 'Не удалось создать')
                })}
              >
                + создать
              </button>
            </div>
            <input
              className="sl-search"
              type="search"
              placeholder="Поиск…"
              value={log.query}
              onChange={event => log.setQuery(event.target.value)}
            />
            <div className="sl-filters">
              <select
                value={log.filterVisibility}
                onChange={event => log.setFilterVisibility(event.target.value as typeof log.filterVisibility)}
                aria-label="Фильтр visibility"
              >
                <option value="all">visibility: все</option>
                <option value="private">private</option>
                <option value="shared_all">shared all</option>
                <option value="shared_selected">shared selected</option>
              </select>
              <select
                value={log.filterStatus}
                onChange={event => log.setFilterStatus(event.target.value as typeof log.filterStatus)}
                aria-label="Фильтр status"
              >
                <option value="all">status: все</option>
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </select>
            </div>
          </div>

          <div className="sl-list-body">
            {log.loading ? <div className="sl-empty">Загрузка…</div> : null}
            {!log.loading && log.filtered.length === 0 ? (
              <div className="sl-empty">
                Нет записей. Создайте хронику сессии — draft останется private.
              </div>
            ) : null}
            {log.filtered.map(entry => {
              const active = entry.id === log.selectedId
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="sl-hit"
                  data-active={active ? 'true' : undefined}
                  onClick={() => log.setSelectedId(entry.id)}
                >
                  <strong>{entry.title || 'Без названия'}</strong>
                  <small>{previewById.get(entry.id)}</small>
                  <div className="sl-hit-meta">
                    <span className="sl-badge" data-tone={visibilityTone(entry.visibility)}>
                      {visibilityLabel(entry.visibility)}
                    </span>
                    <span
                      className="sl-badge"
                      data-tone={entry.status === 'archived' ? 'archived' : undefined}
                    >
                      {entry.status}
                    </span>
                    <span className="sl-badge">{log.sessionLabel(entry.sessionId)}</span>
                    <span className="sl-badge">{formatUpdated(entry.updatedAt)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Editor */}
        <section className="sl-editor" aria-label="Редактор записи">
          {!log.selected ? (
            <div className="sl-empty" style={{ margin: 16 }}>
              Выберите запись слева или создайте новую.
            </div>
          ) : (
            <>
              <div className="sl-editor-toolbar">
                <button
                  type="button"
                  className="sl-btn"
                  data-primary="true"
                  onClick={() => void log.publishSelected().catch(err => {
                    log.setStatusMessage(err instanceof Error ? err.message : 'Ошибка публикации')
                  })}
                >
                  показать игрокам
                </button>
                <button
                  type="button"
                  className="sl-btn"
                  onClick={() => void log.makePrivateSelected().catch(err => {
                    log.setStatusMessage(err instanceof Error ? err.message : 'Ошибка')
                  })}
                >
                  сделать приватной
                </button>
                <button
                  type="button"
                  className="sl-btn"
                  onClick={() => void log.duplicateSelected()}
                >
                  дублировать
                </button>
                <button
                  type="button"
                  className="sl-btn"
                  data-danger="true"
                  onClick={() => void log.archiveSelected()}
                >
                  в архив
                </button>
                <button
                  type="button"
                  className="sl-btn"
                  onClick={() => void log.createHook().catch(err => {
                    log.setStatusMessage(err instanceof Error ? err.message : 'Не удалось создать крюк')
                  })}
                >
                  создать сюжетный крюк
                </button>
                <button
                  type="button"
                  className="sl-btn"
                  onClick={() => void log.addToTimeline().catch(err => {
                    log.setStatusMessage(err instanceof Error ? err.message : 'Timeline error')
                  })}
                >
                  добавить в timeline
                </button>
                <span className="sl-muted" style={{ margin: 0 }}>
                  v{log.selected.version} · {formatUpdated(log.selected.updatedAt)}
                </span>
              </div>

              <div className="sl-editor-body">
                {log.conflictRemote ? (
                  <div className="sl-conflict" role="alert">
                    <strong>Конфликт версий</strong>
                    <p className="sl-muted" style={{ margin: 0 }}>
                      Другое окно сохранило v{log.conflictRemote.version}
                      {' '}({formatUpdated(log.conflictRemote.updatedAt)}).
                      Draft body remote не смешивается автоматически.
                    </p>
                    <div className="sl-conflict-actions">
                      <button type="button" className="sl-btn" data-primary="true" onClick={() => void log.resolveConflictKeepMine()}>
                        оставить мою
                      </button>
                      <button type="button" className="sl-btn" onClick={() => log.resolveConflictTakeTheirs()}>
                        взять их
                      </button>
                    </div>
                  </div>
                ) : null}

                <label className="sl-field">
                  <span>title</span>
                  <input
                    value={log.selected.title}
                    onChange={event => log.patchSelected({ title: event.target.value })}
                    maxLength={200}
                  />
                </label>

                <div className="sl-meta-row">
                  <label className="sl-field">
                    <span>session</span>
                    <select
                      value={log.selected.sessionId || ''}
                      onChange={event => log.patchSelected({
                        sessionId: event.target.value || null,
                      })}
                    >
                      <option value="">— без сессии —</option>
                      {log.sessions.map(session => (
                        <option key={session.id} value={session.id}>
                          с.{session.sequenceNumber} · ночь {session.nightNumber} · {session.status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="sl-field">
                    <span>visibility</span>
                    <select
                      value={log.selected.visibility}
                      onChange={event => log.patchSelected({
                        visibility: event.target.value as SessionLogEntry['visibility'],
                      })}
                    >
                      <option value="private">private</option>
                      <option value="shared_all">shared with all players</option>
                      <option value="shared_selected">shared with selected</option>
                    </select>
                  </label>
                  <label className="sl-field">
                    <span>status</span>
                    <select
                      value={log.selected.status}
                      onChange={event => log.patchSelected({
                        status: event.target.value as SessionLogEntry['status'],
                      })}
                    >
                      <option value="draft">draft</option>
                      <option value="published">published</option>
                      <option value="archived">archived</option>
                    </select>
                  </label>
                </div>

                <div className="sl-editor-pane">
                  <JournalEditor
                    key={editorKey}
                    value={log.selected.bodyHtml}
                    onChange={html => log.patchSelected({ bodyHtml: html })}
                    placeholder="Хроника сессии…"
                    compact
                  />
                </div>

                <label className="sl-field">
                  <span>tags</span>
                  <div className="sl-tags">
                    {log.selected.tags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className="sl-tag"
                        data-active="true"
                        onClick={() => log.patchSelected({
                          tags: log.selected!.tags.filter(item => item !== tag),
                        })}
                      >
                        #{tag} ×
                      </button>
                    ))}
                    <input
                      className="sl-search"
                      style={{ height: 28, flex: '1 1 100px', width: 'auto' }}
                      value={tagDraft}
                      placeholder="+ тег"
                      onChange={event => setTagDraft(event.target.value)}
                      onKeyDown={event => {
                        if (event.key !== 'Enter') return
                        const tag = tagDraft.trim().replace(/^#/, '')
                        if (!tag || !log.selected) return
                        if (log.selected.tags.includes(tag)) return
                        log.patchSelected({ tags: [...log.selected.tags, tag].slice(0, 48) })
                        setTagDraft('')
                      }}
                    />
                  </div>
                </label>

                <div>
                  <span className="sl-kicker">Связи · клик = переход</span>
                  <div className="sl-chips" style={{ marginTop: 8 }}>
                    {log.linkChips.length === 0 ? (
                      <span className="sl-muted">Нет связей — прикрепите entity ниже.</span>
                    ) : (
                      log.linkChips.map(chip => (
                        <button
                          key={chip.id}
                          type="button"
                          className="sl-chip"
                          onClick={() => navigateToEntity(chip.targetType, chip.targetId, chip.label)}
                        >
                          {chip.label || `${chip.targetType}:${chip.targetId.slice(0, 8)}`}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="sl-link-form">
                    <select value={linkType} onChange={event => setLinkType(event.target.value)}>
                      <option value="actor">NPC/actor</option>
                      <option value="scene">scene</option>
                      <option value="lore_entry">lore</option>
                      <option value="blood_bond">bond</option>
                      <option value="plot">plot</option>
                      <option value="location">location</option>
                    </select>
                    <input
                      placeholder="entity id"
                      value={linkId}
                      onChange={event => setLinkId(event.target.value)}
                    />
                    <input
                      placeholder="label"
                      value={linkLabel}
                      onChange={event => setLinkLabel(event.target.value)}
                    />
                    <button
                      type="button"
                      className="sl-btn"
                      disabled={!linkId.trim()}
                      onClick={() => {
                        const id = linkId.trim()
                        if (!id) return
                        void log.attachEntity(
                          linkType,
                          id,
                          linkLabel.trim() || `${linkType}: ${id.slice(0, 12)}`,
                        ).then(() => {
                          setLinkId('')
                          setLinkLabel('')
                        }).catch(err => {
                          log.setStatusMessage(err instanceof Error ? err.message : 'link error')
                        })
                      }}
                    >
                      прикрепить
                    </button>
                  </div>
                </div>

                {log.selected.attachments.length > 0 ? (
                  <div>
                    <span className="sl-kicker">Вложения</span>
                    <div className="sl-chips" style={{ marginTop: 8 }}>
                      {log.selected.attachments.map(item => (
                        <a
                          key={item.id}
                          className="sl-chip"
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.kind}: {item.name}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!log.chronicleId ? (
                  <p className="sl-muted">
                    Нет chronicle membership — записи сохраняются в localStorage
                    (`vtm-session-log:*`), не в player diary.
                  </p>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  )
}
