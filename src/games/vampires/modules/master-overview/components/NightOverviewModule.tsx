'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MasterModuleProps } from '@/games/vampires/modules/master-console/types'
import { getCharacterSheetHref } from '@/games/vampires/modules/table/utils/table-urls'
import { formatTime } from '@/games/vampires/modules/table/utils/display'
import { actorInitials } from '@/games/vampires/modules/actors/utils/actor-labels'
import { useOverviewModel, useSessionNotes } from '../hooks'
import { OVERVIEW_MACROS, runOverviewMacro } from '../services'
import { selectCoterieWarnings } from '../selectors'
import type { OverviewMacroId, PlotHeat } from '../types'
import SessionNotesEditor from './SessionNotesEditor'
import './overview.css'

const HEAT_LABELS: Record<PlotHeat, string> = {
  background: 'фон',
  smoldering: 'тлеет',
  boiling: 'кипит',
  critical: 'критично',
}

const SAVE_LABELS = {
  idle: '—',
  dirty: 'есть изменения…',
  saving: 'сохранение…',
  saved: 'сохранено',
  error: 'ошибка сохранения',
  local: 'локально (без Auth)',
} as const

export default function NightOverviewModule({
  room,
  role,
  onRequestRoll,
}: MasterModuleProps) {
  const {
    model,
    chronicleId,
    sessionLabel,
    actorsLoading,
    actorsError,
    reloadActors,
    plotsState,
  } = useOverviewModel(room)
  const notes = useSessionNotes(room, chronicleId)
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'ok' | 'error'>('ok')
  const [newPlotTitle, setNewPlotTitle] = useState('')
  const [confirmMacro, setConfirmMacro] = useState<OverviewMacroId | null>(null)

  useEffect(() => {
    if (!selectedActorId && model.coterie.members[0]) {
      setSelectedActorId(model.coterie.members[0].actorId)
    }
  }, [model.coterie.members, selectedActorId])

  const coterieWarnings = useMemo(
    () => selectCoterieWarnings(model.coterie.members),
    [model.coterie.members],
  )

  const openActorModule = useCallback((actorId: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('module', 'actors')
    url.searchParams.set('actor', actorId)
    window.history.replaceState({}, '', url.toString())
    window.dispatchEvent(new CustomEvent('master-console:navigate', {
      detail: { moduleId: 'actors', params: { actor: actorId } },
    }))
  }, [])

  const openSheet = useCallback((characterId: string | null) => {
    if (!characterId) {
      setStatusTone('error')
      setStatus('Нет полного листа у этой записи')
      return
    }
    window.open(getCharacterSheetHref(room, 'master', characterId), '_blank', 'noopener,noreferrer')
  }, [room])

  const requestRoll = useCallback((actorId: string, mode: 'pool' | 'rouse' = 'pool') => {
    const actor = model.actorsById.get(actorId)
    const normalized = model.normalizedById.get(actorId)
    if (!actor || !normalized) return
    setSelectedActorId(actorId)
    onRequestRoll?.({
      source: 'overview',
      actorId,
      displayName: normalized.displayName,
      hunger: normalized.vitals.hunger,
      characterId: actor.characterId,
      traits: mode === 'pool' ? ['Харизма', 'Убеждение'] : [],
      dice: mode === 'pool' ? 1 : 1,
      mode,
    })
  }, [model.actorsById, model.normalizedById, onRequestRoll])

  const runMacro = useCallback(async (macroId: OverviewMacroId) => {
    if (!chronicleId) {
      setStatusTone('error')
      setStatus('Нужен chronicle_id (Auth или актор в комнате)')
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      const result = await runOverviewMacro({
        macroId,
        room,
        chronicleId,
        actors: [...model.actorsById.values()],
        selectedActorId,
      })
      setStatusTone('ok')
      setStatus(result.message)
      await reloadActors()
    } catch (error) {
      setStatusTone('error')
      setStatus(error instanceof Error ? error.message : 'Макрос не выполнен')
    } finally {
      setBusy(false)
      setConfirmMacro(null)
    }
  }, [chronicleId, model.actorsById, reloadActors, room, selectedActorId])

  const onMacroClick = useCallback((macroId: OverviewMacroId, dangerous: boolean) => {
    if (dangerous) {
      setConfirmMacro(macroId)
      return
    }
    void runMacro(macroId)
  }, [runMacro])

  const execCommand = useCallback((command: string) => {
    document.execCommand(command)
  }, [])

  if (role === 'observer') {
    return (
      <section className="mo-module">
        <div className="mo-empty">Observer: обзор ночи в read-only появится после Auth membership.</div>
      </section>
    )
  }

  return (
    <section className="mo-module" aria-label="Обзор ночи">
      <header className="mo-header">
        <div>
          <span className="mo-kicker">Командный центр</span>
          <h1>Обзор ночи</h1>
          <p className="mo-muted">
            всё приватно, если не раскрыто
            {sessionLabel ? ` · ${sessionLabel}` : ''}
            {model.activeSceneName ? ` · сцена: ${model.activeSceneName}` : ''}
          </p>
        </div>
        <div>
          <span className="mo-badge" data-tone="private">☾ private by default</span>
        </div>
      </header>

      {status ? (
        <p className="mo-status-line" data-tone={statusTone === 'error' ? 'error' : undefined}>{status}</p>
      ) : null}
      {actorsError ? (
        <p className="mo-status-line" data-tone="error">{actorsError}</p>
      ) : null}

      <div className="mo-body">
        <div className="mo-col">
          {/* Coterie */}
          <section className="mo-panel" aria-label="Котерия">
            <div className="mo-panel-head">
              <h2>Котерия</h2>
              <span className="mo-badge">{model.coterie.members.length}</span>
            </div>
            <div className="mo-panel-body">
              <div className="mo-stats">
                <div className="mo-stat" data-warn={model.coterie.highHungerCount > 0 ? 'true' : undefined}>
                  <span>средний Голод</span>
                  <strong>{model.coterie.averageHunger ?? '—'}</strong>
                </div>
                <div className="mo-stat" data-warn={model.coterie.highHungerCount > 0 ? 'true' : undefined}>
                  <span>Голод 4–5</span>
                  <strong>{model.coterie.highHungerCount}</strong>
                </div>
                <div className="mo-stat" data-warn={model.coterie.criticalCount > 0 ? 'true' : undefined}>
                  <span>критичные</span>
                  <strong>{model.coterie.criticalCount}</strong>
                </div>
                <div className="mo-stat">
                  <span>последствия</span>
                  <strong>{model.coterie.openConsequenceCount}</strong>
                </div>
              </div>

              {model.coterie.sharedAnchors.length ? (
                <p className="mo-muted">
                  якоря: {model.coterie.sharedAnchors.join(' · ')}
                </p>
              ) : null}
              {coterieWarnings.length ? (
                <div className="mo-warn" style={{ marginBottom: 10 }}>
                  {coterieWarnings.map(line => <div key={line}>{line}</div>)}
                </div>
              ) : null}

              {actorsLoading ? <div className="mo-empty">Загрузка котерии…</div> : null}
              {!actorsLoading && model.coterie.members.length === 0 ? (
                <div className="mo-empty">
                  Котерия пуста. Свяжите PC в модуле НПС (kind = player_character)
                  или дождитесь появления актёров в хронике.
                </div>
              ) : (
                <div className="mo-card-grid">
                  {model.coterie.members.map(member => (
                    <div
                      key={member.actorId}
                      className="mo-card"
                      data-critical={member.critical ? 'true' : undefined}
                      data-selected={selectedActorId === member.actorId ? 'true' : undefined}
                    >
                      <div className="mo-avatar" aria-hidden>
                        {member.portraitUrl
                          ? <img src={member.portraitUrl} alt="" />
                          : actorInitials(member.displayName)}
                      </div>
                      <div>
                        <strong>{member.displayName}</strong>
                        <small>игрок: {member.playerName}</small>
                        <div className="mo-vitals">
                          <span>Голод {member.hunger}/5</span>
                          <span>HP {member.healthCurrent}/{member.healthMax}</span>
                          <span>СВ {member.willpowerCurrent}/{member.willpowerMax}</span>
                          <span>Чел. {member.humanity}{member.stains ? ` · ${member.stains} пятн.` : ''}</span>
                        </div>
                        {member.touchstones.length ? (
                          <small>якоря: {member.touchstones.join(', ')}</small>
                        ) : null}
                        {member.warnings.length ? (
                          <div className="mo-warn">{member.warnings.join(' · ')}</div>
                        ) : null}
                      </div>
                      <div className="mo-actions">
                        <button type="button" onClick={() => setSelectedActorId(member.actorId)}>Выбрать</button>
                        <button type="button" onClick={() => openActorModule(member.actorId)}>Карточка</button>
                        <button type="button" onClick={() => openSheet(member.characterId)}>Лист</button>
                        <button type="button" onClick={() => requestRoll(member.actorId, 'pool')}>🎲</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Scene NPCs */}
          <section className="mo-panel" aria-label="НПС активной сцены">
            <div className="mo-panel-head">
              <h2>НПС в активной сцене</h2>
              <span className="mo-badge">{model.sceneNpcs.length}</span>
            </div>
            <div className="mo-panel-body">
              {!model.activeSceneId ? (
                <div className="mo-empty">
                  Нет активной сцены. Опубликуйте сцену на столе или назначьте actors.current_scene_id.
                </div>
              ) : model.sceneNpcs.length === 0 ? (
                <div className="mo-empty">
                  В сцене «{model.activeSceneName || model.activeSceneId}» нет НПС.
                  Добавьте актёров в модуле НПС → «В сцену».
                </div>
              ) : (
                <div className="mo-card-grid">
                  {model.sceneNpcs.map(npc => (
                    <div key={npc.actorId} className="mo-card">
                      <div className="mo-avatar" aria-hidden>
                        {npc.portraitUrl
                          ? <img src={npc.portraitUrl} alt="" />
                          : actorInitials(npc.displayName)}
                      </div>
                      <div>
                        <strong>{npc.displayName}</strong>
                        <small>
                          СК {npc.bloodPotency} · {npc.role} · {npc.status}
                          {npc.hiddenSecrets ? ' · скрыт' : ''}
                        </small>
                        <div className="mo-vitals">
                          <span>Голод {npc.hunger}</span>
                          <span>пул ~{npc.poolDice}к</span>
                        </div>
                      </div>
                      <div className="mo-actions">
                        <button type="button" onClick={() => requestRoll(npc.actorId, 'pool')}>🎲</button>
                        <button type="button" onClick={() => openActorModule(npc.actorId)}>карточка</button>
                        <button type="button" onClick={() => openSheet(npc.characterId)}>лист</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Plots */}
          <section className="mo-panel" aria-label="Активные сюжеты и крюки">
            <div className="mo-panel-head">
              <h2>Активные сюжеты и крюки</h2>
              <button
                type="button"
                onClick={() => {
                  window.open('/vampires/reference', '_blank', 'noopener,noreferrer')
                }}
                title="Справочник / лор (модуль Lore — следующая фаза)"
              >
                ✎ в лор
              </button>
            </div>
            <div className="mo-panel-body">
              {plotsState.plots.length === 0 ? (
                <div className="mo-empty">
                  Сюжетов пока нет. Добавьте крюк ниже — данные не демо, а рабочие записи мастера.
                </div>
              ) : (
                plotsState.plots.map(plot => (
                  <article key={plot.id} className="mo-plot">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{plot.title}</strong>
                      <span className="mo-heat" data-heat={plot.heat}>{HEAT_LABELS[plot.heat]}</span>
                    </div>
                    <label className="mo-muted">
                      след. шаг
                      <input
                        value={plot.nextStep}
                        placeholder="следующий шаг…"
                        onChange={event => void plotsState.patchPlot(plot.id, { nextStep: event.target.value })}
                      />
                    </label>
                    <div className="mo-plot-actions">
                      {(['background', 'smoldering', 'boiling', 'critical'] as PlotHeat[]).map(heat => (
                        <button
                          key={heat}
                          type="button"
                          onClick={() => void plotsState.setHeat(plot.id, heat)}
                        >
                          {HEAT_LABELS[heat]}
                        </button>
                      ))}
                      <button type="button" onClick={() => void plotsState.removePlot(plot.id)}>архив</button>
                      {plot.relatedActorIds[0] ? (
                        <button type="button" onClick={() => openActorModule(plot.relatedActorIds[0])}>
                          → актор
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
              <div className="mo-add-plot">
                <input
                  value={newPlotTitle}
                  placeholder="Новый крюк…"
                  onChange={event => setNewPlotTitle(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && newPlotTitle.trim()) {
                      void plotsState.addPlot(newPlotTitle).then(() => setNewPlotTitle(''))
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!newPlotTitle.trim() || !chronicleId}
                  onClick={() => {
                    void plotsState.addPlot(newPlotTitle).then(() => setNewPlotTitle(''))
                  }}
                >
                  +
                </button>
              </div>
              {plotsState.source === 'local' ? (
                <p className="mo-muted">Сюжеты: локальное хранение (SQL/Auth не доступны).</p>
              ) : null}
            </div>
          </section>
        </div>

        <div className="mo-col">
          {/* Macros */}
          <section className="mo-panel" aria-label="Макросы">
            <div className="mo-panel-head">
              <h2>Макросы</h2>
              <span className="mo-badge">
                {selectedActorId
                  ? model.normalizedById.get(selectedActorId)?.displayName || 'актор'
                  : 'актор не выбран'}
              </span>
            </div>
            <div className="mo-panel-body">
              <div className="mo-macros">
                {OVERVIEW_MACROS.map(macro => (
                  <button
                    key={macro.id}
                    type="button"
                    data-danger={macro.dangerous ? 'true' : undefined}
                    disabled={busy}
                    onClick={() => onMacroClick(macro.id, macro.dangerous)}
                  >
                    {macro.title}
                    {macro.shortcut ? <em>клавиша {macro.shortcut}</em> : null}
                  </button>
                ))}
              </div>
              {confirmMacro ? (
                <div className="mo-empty" style={{ marginTop: 10 }}>
                  <p>Подтвердить «{OVERVIEW_MACROS.find(item => item.id === confirmMacro)?.title}»?</p>
                  <div className="mo-plot-actions" style={{ justifyContent: 'center', marginTop: 8 }}>
                    <button type="button" onClick={() => setConfirmMacro(null)}>Отмена</button>
                    <button type="button" onClick={() => void runMacro(confirmMacro)}>Выполнить</button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {/* Session notes */}
          <section className="mo-panel" aria-label="Заметки сессии">
            <div className="mo-panel-head">
              <h2>Заметки сессии · ☾ приватно</h2>
              <span className="mo-note-status" data-status={notes.status}>
                {SAVE_LABELS[notes.status]}
              </span>
            </div>
            <div className="mo-panel-body">
              <div className="mo-note-toolbar">
                <button type="button" onClick={() => execCommand('bold')}><b>B</b></button>
                <button type="button" onClick={() => execCommand('italic')}><i>I</i></button>
                <button type="button" onClick={() => execCommand('insertUnorderedList')}>• list</button>
                <button type="button" onClick={() => void notes.saveNow()}>Сохранить</button>
              </div>
              <SessionNotesEditor
                html={notes.note?.bodyHtml || ''}
                onChange={notes.updateBody}
              />
              <label className="mo-muted" style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                привязка к entity
                <select
                  className="mo-entity-select"
                  value={notes.note ? `${notes.note.entityType}:${notes.note.entityId}` : ':'}
                  onChange={event => {
                    const [entityType, entityId] = event.target.value.split(':')
                    notes.updateEntityLink(entityType || '', entityId || '')
                  }}
                >
                  <option value=":">без привязки</option>
                  {model.coterie.members.map(member => (
                    <option key={member.actorId} value={`actor:${member.actorId}`}>
                      PC · {member.displayName}
                    </option>
                  ))}
                  {model.sceneNpcs.map(npc => (
                    <option key={npc.actorId} value={`actor:${npc.actorId}`}>
                      NPC · {npc.displayName}
                    </option>
                  ))}
                  {model.plots.map(plot => (
                    <option key={plot.id} value={`plot:${plot.id}`}>
                      сюжет · {plot.title}
                    </option>
                  ))}
                </select>
              </label>
              {notes.error ? <p className="mo-status-line" data-tone="error">{notes.error}</p> : null}
            </div>
          </section>

          {/* Consequences feed */}
          <section className="mo-panel" aria-label="Лента последствий">
            <div className="mo-panel-head">
              <h2>Лента последствий</h2>
              <span className="mo-badge">хроника</span>
            </div>
            <div className="mo-panel-body">
              {model.timeline.length === 0 ? (
                <div className="mo-empty">
                  Лента пуста. Здесь появятся броски, макросы, смены Голода и ручные записи action log.
                </div>
              ) : (
                <div className="mo-timeline">
                  {model.timeline.map(item => (
                    <article
                      key={item.id}
                      className="mo-timeline-item"
                      data-hidden={item.hidden ? 'true' : undefined}
                    >
                      <time dateTime={item.at}>{formatTime(item.at)}</time>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                      {item.consequence ? (
                        <p className="mo-consequence">→ {item.consequence}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
