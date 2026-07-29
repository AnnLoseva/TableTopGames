'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChronicleActors } from '@/games/vampires/modules/actors/hooks'
import { getMasterMembership } from '@/games/vampires/modules/master-console/api'
import { useMasterActionLog } from '@/games/vampires/modules/master-console/hooks'
import type { MasterRollRequest } from '@/games/vampires/modules/master-console/types'
import { ATTRIBUTE_GROUPS, SKILL_GROUPS } from '@/games/vampires/modules/table/constants/roll-traits'
import { getDieImage } from '@/games/vampires/modules/table/utils/dice-display'
import { formatTime } from '@/games/vampires/modules/table/utils/display'
import { getRollDieId } from '@/games/vampires/modules/table/utils/roll-utils'
import type { Die, RollMessage } from '@/games/vampires/modules/table/types'
import {
  actorToRollCharacter,
  applyWillpowerReroll,
  buildPoolPreview,
  listConsequences,
  revealHiddenRoll,
  rollMasterFrenzy,
  rollMasterPool,
  rollMasterRouse,
} from '../services'
import type { MasterRollBuilderState } from '../types'
import { useMasterRollHistory } from '../hooks/useMasterRollHistory'
import { useMasterUndo } from '../hooks/useMasterUndo'
import './master-rolls.css'

type MasterRollerProps = {
  room: string
  rollRequest?: MasterRollRequest | null
  onClearRollRequest?: () => void
}

const DEFAULT_STATE: MasterRollBuilderState = {
  actorId: null,
  attribute: '',
  attributeTwo: '',
  skill: '',
  discipline: '',
  modifier: 0,
  difficulty: 0,
  mode: 'normal',
  opponentActorId: null,
  hidden: true,
  useBloodSurge: false,
}

function outcomeLabel(roll: RollMessage): string {
  if (roll.meta?.bestialFailure) return 'Звериный провал'
  if (roll.meta?.messyCritical) return 'Грязный крит'
  if (roll.opposed) return roll.opposed.summary
  if (roll.poolType === 'rouse-check') return roll.successes > 0 ? 'Rouse OK' : 'Rouse fail'
  const difficulty = Number(roll.meta?.rollDifficultyModifier) || 0
  if (difficulty > 0) return roll.successes >= difficulty ? 'Успех' : 'Провал'
  if (roll.successes >= 5) return 'Крит'
  if (roll.successes === 0) return 'Провал'
  return `${roll.successes} усп.`
}

export default function MasterRoller({
  room,
  rollRequest,
  onClearRollRequest,
}: MasterRollerProps) {
  const { actors, reload: reloadActors } = useChronicleActors(room)
  const history = useMasterRollHistory(room)
  const actionLog = useMasterActionLog(room)
  const undo = useMasterUndo(actors)

  const [state, setState] = useState<MasterRollBuilderState>(DEFAULT_STATE)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'ok' | 'error'>('ok')
  const [chronicleId, setChronicleId] = useState('')
  const [wpDraft, setWpDraft] = useState<{ rollId: string; dieIds: string[] } | null>(null)
  const [lastRollId, setLastRollId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getMasterMembership(room).then(membership => {
      if (!cancelled && membership) setChronicleId(membership.chronicleId)
    }).catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [room])

  useEffect(() => {
    if (!chronicleId && actors[0]?.chronicleId) {
      setChronicleId(actors[0].chronicleId)
    }
  }, [actors, chronicleId])

  const historyRef = useRef(history)
  historyRef.current = history
  const undoRef = useRef(undo)
  undoRef.current = undo
  const handledRequestKey = useRef<string | null>(null)

  // External request from NPC module preselects actor; rouse may auto-fire once.
  useEffect(() => {
    if (!rollRequest) {
      handledRequestKey.current = null
      return
    }
    const key = `${rollRequest.actorId}:${rollRequest.mode}:${rollRequest.dice}:${rollRequest.traits.join(',')}`
    if (handledRequestKey.current === key) return
    handledRequestKey.current = key

    setState(prev => ({
      ...prev,
      actorId: rollRequest.actorId,
      hidden: true,
      useBloodSurge: false,
      mode: 'normal',
      attribute: rollRequest.traits[0] || prev.attribute,
      skill: rollRequest.traits[1] || prev.skill,
    }))

    if (rollRequest.mode !== 'rouse') {
      onClearRollRequest?.()
      return
    }

    const actor = actors.find(item => item.id === rollRequest.actorId)
    const cid = chronicleId || actors[0]?.chronicleId
    if (!actor || !cid) return

    void (async () => {
      setBusy(true)
      try {
        const result = await rollMasterRouse({
          room,
          chronicleId: cid,
          actor,
          hidden: true,
          reason: 'Rouse Check',
        })
        historyRef.current.upsertLocal(result.roll)
        if (result.storage === 'local') historyRef.current.pushLocalHidden(result.roll)
        if (result.storage === 'hidden') {
          undoRef.current.pushUndo({
            summary: `Скрытый Rouse: ${result.roll.characterName}`,
            inverse: { type: 'delete_hidden_roll', rollId: result.roll.id },
          })
        }
        setLastRollId(result.roll.id)
        setStatusTone('ok')
        setStatus('Rouse выполнен')
        await reloadActors()
      } catch (error) {
        setStatusTone('error')
        setStatus(error instanceof Error ? error.message : 'Rouse не удался')
      } finally {
        setBusy(false)
        onClearRollRequest?.()
      }
    })()
  }, [rollRequest, actors, chronicleId, onClearRollRequest, reloadActors, room])

  const selectedActor = useMemo(
    () => actors.find(actor => actor.id === state.actorId) || null,
    [actors, state.actorId],
  )
  const opponentActor = useMemo(
    () => actors.find(actor => actor.id === state.opponentActorId) || null,
    [actors, state.opponentActorId],
  )

  const character = useMemo(
    () => (selectedActor ? actorToRollCharacter(selectedActor) : null),
    [selectedActor],
  )

  const preview = useMemo(
    () => (character ? buildPoolPreview(character, state) : null),
    [character, state],
  )

  const disciplineNames = useMemo(() => {
    if (!character) return [] as string[]
    return Object.keys(character.disciplines || {}).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [character])

  const patch = useCallback((partial: Partial<MasterRollBuilderState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])

  const ensureChronicle = useCallback(() => {
    const id = chronicleId || actors[0]?.chronicleId
    if (!id) throw new Error('Нужен chronicle_id (Auth membership или существующий актор)')
    return id
  }, [actors, chronicleId])

  const afterRoll = useCallback(async (result: Awaited<ReturnType<typeof rollMasterPool>>) => {
    history.upsertLocal(result.roll)
    if (result.roll.hidden && result.storage === 'local') history.pushLocalHidden(result.roll)
    if (result.roll.hidden && result.storage === 'hidden') {
      undo.pushUndo({
        summary: `Скрытый бросок: ${result.roll.characterName}`,
        inverse: { type: 'delete_hidden_roll', rollId: result.roll.id },
      })
    }
    setLastRollId(result.roll.id)
    setStatusTone('ok')
    setStatus(result.storage === 'public' ? 'Бросок опубликован' : 'Скрытый бросок (только мастер)')
    await reloadActors()
    await history.reload()
  }, [history, reloadActors, undo])

  const onRoll = useCallback(async () => {
    if (!selectedActor) {
      setStatusTone('error')
      setStatus('Выберите актёра')
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      const result = await rollMasterPool({
        room,
        chronicleId: ensureChronicle(),
        actor: selectedActor,
        opponent: opponentActor,
        state,
      })
      await afterRoll(result)
    } catch (error) {
      setStatusTone('error')
      setStatus(error instanceof Error ? error.message : 'Бросок не удался')
    } finally {
      setBusy(false)
    }
  }, [afterRoll, ensureChronicle, opponentActor, room, selectedActor, state])

  const onRouse = useCallback(async () => {
    if (!selectedActor) return
    setBusy(true)
    try {
      const result = await rollMasterRouse({
        room,
        chronicleId: ensureChronicle(),
        actor: selectedActor,
        hidden: state.hidden,
      })
      await afterRoll(result)
    } catch (error) {
      setStatusTone('error')
      setStatus(error instanceof Error ? error.message : 'Rouse не удался')
    } finally {
      setBusy(false)
    }
  }, [afterRoll, ensureChronicle, room, selectedActor, state.hidden])

  const onFrenzy = useCallback(async () => {
    if (!selectedActor) return
    setBusy(true)
    try {
      const result = await rollMasterFrenzy({
        room,
        chronicleId: ensureChronicle(),
        actor: selectedActor,
        hidden: state.hidden,
        difficulty: Math.max(1, state.difficulty || 3),
      })
      await afterRoll(result)
    } catch (error) {
      setStatusTone('error')
      setStatus(error instanceof Error ? error.message : 'Френзи-бросок не удался')
    } finally {
      setBusy(false)
    }
  }, [afterRoll, ensureChronicle, room, selectedActor, state.difficulty, state.hidden])

  const onReveal = useCallback(async (rollId: string) => {
    setBusy(true)
    try {
      const publicRoll = await revealHiddenRoll(rollId, {
        chronicleId: ensureChronicle(),
        room,
      })
      history.removeLocalHidden(rollId)
      history.upsertLocal(publicRoll)
      setStatusTone('ok')
      setStatus('Бросок раскрыт игрокам')
      await history.reload()
    } catch (error) {
      setStatusTone('error')
      setStatus(error instanceof Error ? error.message : 'Не удалось раскрыть')
    } finally {
      setBusy(false)
    }
  }, [ensureChronicle, history, room])

  const onConfirmWpReroll = useCallback(async (roll: RollMessage) => {
    if (!wpDraft || wpDraft.rollId !== roll.id || wpDraft.dieIds.length === 0) return
    setBusy(true)
    try {
      const next = await applyWillpowerReroll(roll, wpDraft.dieIds)
      history.upsertLocal(next)
      setWpDraft(null)
      setStatusTone('ok')
      setStatus('Переброс Силы Воли применён')
    } catch (error) {
      setStatusTone('error')
      setStatus(error instanceof Error ? error.message : 'Переброс СВ не удался')
    } finally {
      setBusy(false)
    }
  }, [history, wpDraft])

  const runConsequence = useCallback(async (actionId: string, roll: RollMessage) => {
    const actions = listConsequences(roll, actors)
    const action = actions.find(item => item.id === actionId)
    if (!action) return
    if (action.consequence === 'bestial_failure' || action.consequence === 'failed_rouse') {
      const actor = actors.find(item => item.id === action.actorId) || selectedActor
      if (!actor) return
      setBusy(true)
      try {
        const result = await rollMasterFrenzy({
          room,
          chronicleId: ensureChronicle(),
          actor,
          hidden: true,
          difficulty: 3,
        })
        await afterRoll(result)
      } catch (error) {
        setStatusTone('error')
        setStatus(error instanceof Error ? error.message : 'Контекстное действие не удалось')
      } finally {
        setBusy(false)
      }
    } else {
      setStatusTone('ok')
      setStatus(`Отмечено: ${action.label}`)
    }
  }, [actors, afterRoll, ensureChronicle, room, selectedActor])

  return (
    <>
      <section className="mr-roller" aria-label="Роллер мастера">
        <div>
          <span className="mr-kicker">За актора · Голод из листа</span>
          <h2>Роллер мастера</h2>
        </div>

        <label className="mr-field">
          <span>Актор</span>
          <select
            className="mr-actor-select"
            value={state.actorId || ''}
            onChange={event => patch({ actorId: event.target.value || null })}
          >
            <option value="">Выбрать актёра…</option>
            {actors.map(actor => (
              <option key={actor.id} value={actor.id}>
                {actor.name || actor.linkedCharacter?.name || actor.id.slice(0, 8)}
                {actor.actorRole ? ` · ${actor.actorRole}` : ''}
              </option>
            ))}
          </select>
        </label>

        {selectedActor && character && preview ? (
          <div className="mr-selected">
            <strong>☾ {character.name}</strong>
            <small>
              Голод {preview.hunger}
              {character.clan ? ` · ${character.clan}` : ''}
              {` · СК ${character.bloodPotency || 0}`}
            </small>
          </div>
        ) : null}

        <div className="mr-grid-2">
          <label className="mr-field">
            <span>Атрибут</span>
            <select value={state.attribute} onChange={event => patch({ attribute: event.target.value })}>
              <option value="">—</option>
              {ATTRIBUTE_GROUPS.map(group => (
                <optgroup key={group.name} label={group.name}>
                  {group.traits.map(name => (
                    <option key={name} value={name} disabled={state.attributeTwo === name}>{name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="mr-field">
            <span>2-й атрибут</span>
            <select value={state.attributeTwo} onChange={event => patch({ attributeTwo: event.target.value })}>
              <option value="">—</option>
              {ATTRIBUTE_GROUPS.map(group => (
                <optgroup key={group.name} label={group.name}>
                  {group.traits.map(name => (
                    <option key={name} value={name} disabled={state.attribute === name}>{name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="mr-field">
            <span>Навык</span>
            <select value={state.skill} onChange={event => patch({ skill: event.target.value })}>
              <option value="">—</option>
              {SKILL_GROUPS.map(group => (
                <optgroup key={group.name} label={group.name}>
                  {group.traits.map(name => <option key={name} value={name}>{name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="mr-field">
            <span>Дисциплина</span>
            <select value={state.discipline} onChange={event => patch({ discipline: event.target.value })}>
              <option value="">—</option>
              {disciplineNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="mr-field">
            <span>Модификатор</span>
            <input
              type="number"
              min={-20}
              max={20}
              value={state.modifier}
              onChange={event => patch({ modifier: Math.max(-20, Math.min(20, Number(event.target.value) || 0)) })}
            />
          </label>
          <label className="mr-field">
            <span>Сложность</span>
            <input
              type="number"
              min={0}
              max={20}
              value={state.difficulty}
              onChange={event => patch({ difficulty: Math.max(0, Math.min(20, Number(event.target.value) || 0)) })}
            />
          </label>
        </div>

        <div className="mr-grid-2">
          <label className="mr-field">
            <span>Тип</span>
            <select
              value={state.mode}
              onChange={event => patch({
                mode: event.target.value === 'contested' ? 'contested' : 'normal',
                opponentActorId: event.target.value === 'contested' ? state.opponentActorId : null,
              })}
            >
              <option value="normal">Обычный</option>
              <option value="contested">Встречный</option>
            </select>
          </label>
          {state.mode === 'contested' ? (
            <label className="mr-field">
              <span>Оппонент</span>
              <select
                value={state.opponentActorId || ''}
                onChange={event => patch({ opponentActorId: event.target.value || null })}
              >
                <option value="">Выбрать…</option>
                {actors.filter(actor => actor.id !== state.actorId).map(actor => (
                  <option key={actor.id} value={actor.id}>{actor.name}</option>
                ))}
              </select>
            </label>
          ) : <div />}
        </div>

        <div className="mr-toggles">
          <label data-on={state.hidden ? 'true' : undefined}>
            <input
              type="checkbox"
              checked={state.hidden}
              onChange={event => patch({ hidden: event.target.checked })}
            />
            Скрытый бросок
          </label>
          <label data-on={state.useBloodSurge ? 'true' : undefined}>
            <input
              type="checkbox"
              checked={state.useBloodSurge}
              onChange={event => patch({ useBloodSurge: event.target.checked })}
            />
            Прилив Крови
          </label>
        </div>

        {preview ? (
          <div className="mr-preview" aria-live="polite">
            <strong>{preview.dice}к</strong>
            <span>
              {preview.normalDice} обычных + {preview.hungerDice} Голода
              {state.useBloodSurge ? ` · surge +${preview.bloodSurgeBonus}` : ''}
            </span>
            <span>{preview.poolName}</span>
          </div>
        ) : null}

        {preview?.warnings.length || undo.status ? (
          <div className="mr-warnings">
            {preview?.warnings.map(warning => <p key={warning}>{warning}</p>)}
            {undo.status ? <p>{undo.status}</p> : null}
          </div>
        ) : null}

        <div className="mr-buttons">
          <button type="button" data-primary="true" disabled={busy || !selectedActor} onClick={() => void onRoll()}>
            Бросить
          </button>
          <button type="button" disabled={busy || !selectedActor} onClick={() => void onRouse()}>
            Пробуждение
          </button>
          <button type="button" disabled={busy || !selectedActor} onClick={() => void onFrenzy()}>
            Френзи
          </button>
          <button type="button" disabled={!undo.canUndo || busy} onClick={() => void undo.undoLast()}>
            Undo
          </button>
        </div>
        {status ? <p className="mr-status" data-tone={statusTone === 'error' ? 'error' : undefined}>{status}</p> : null}
      </section>

      <section className="mr-history" aria-label="Журнал бросков">
        <div className="mr-history-head">
          <h2>Журнал бросков</h2>
          {history.hiddenCount > 0 ? (
            <span className="mr-badge">{history.hiddenCount} скрытых</span>
          ) : null}
        </div>
        {history.loading ? <p className="mr-empty">Загрузка…</p> : null}
        {!history.loading && history.rolls.length === 0 ? (
          <p className="mr-empty">Бросков пока нет.</p>
        ) : (
          <div className="mr-history-list">
            {history.rolls.slice(0, 24).map(roll => {
              const consequences = listConsequences(roll, actors)
              const canWp = !roll.opposed
                && !roll.meta?.willpowerReroll?.used
                && roll.poolType !== 'rouse-check'
                && Array.isArray(roll.dice)
                && roll.dice.length > 0
              const draft = wpDraft?.rollId === roll.id ? wpDraft : null
              return (
                <article
                  key={roll.id}
                  className="mr-card"
                  data-hidden={roll.hidden ? 'true' : undefined}
                  data-latest={lastRollId === roll.id ? 'true' : undefined}
                >
                  <div className="mr-card-head">
                    <strong>{roll.characterName}</strong>
                    {roll.hidden ? <span className="mr-badge">скрытый</span> : null}
                    <time dateTime={roll.createdAt}>{formatTime(roll.createdAt)}</time>
                    <span>{outcomeLabel(roll)}</span>
                  </div>
                  <span className="mr-card-pool">{roll.poolName} · {roll.successes} усп.</span>
                  {roll.opposed ? (
                    <span className="mr-card-pool">{roll.opposed.summary}</span>
                  ) : (
                    <div className="mr-dice" aria-label="Кубики">
                      {(roll.dice as Die[]).map((die, index) => {
                        const id = getRollDieId(roll, index)
                        const selected = draft?.dieIds.includes(id)
                        const image = getDieImage(die)
                        return (
                          <button
                            key={id}
                            type="button"
                            className="mr-die"
                            data-kind={die.kind}
                            data-selected={selected ? 'true' : undefined}
                            title={image.label}
                            disabled={!canWp || Boolean(roll.meta?.willpowerReroll?.used)}
                            onClick={() => {
                              if (!canWp) return
                              setWpDraft(prev => {
                                if (!prev || prev.rollId !== roll.id) return { rollId: roll.id, dieIds: [id] }
                                const exists = prev.dieIds.includes(id)
                                const dieIds = exists
                                  ? prev.dieIds.filter(item => item !== id)
                                  : [...prev.dieIds, id].slice(0, 3)
                                return { rollId: roll.id, dieIds }
                              })
                            }}
                          >
                            {die.value}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <div className="mr-buttons">
                    {roll.hidden ? (
                      <button type="button" disabled={busy} onClick={() => void onReveal(roll.id)}>
                        Раскрыть игрокам
                      </button>
                    ) : null}
                    {canWp && draft && draft.dieIds.length > 0 ? (
                      <button type="button" disabled={busy} onClick={() => void onConfirmWpReroll(roll)}>
                        Переброс СВ ({draft.dieIds.length})
                      </button>
                    ) : null}
                  </div>
                  {consequences.length > 0 ? (
                    <div className="mr-consequences">
                      {consequences.map(action => (
                        <button
                          key={action.id}
                          type="button"
                          disabled={busy}
                          onClick={() => void runConsequence(action.id, roll)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {roll.meta?.warnings?.length ? (
                    <div className="mr-warnings">
                      {roll.meta.warnings.slice(0, 3).map(warning => <p key={warning}>{warning}</p>)}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="mr-actions" aria-label="История действий">
        <div className="mr-history-head">
          <h2>История действий</h2>
          <button type="button" disabled={!undo.canUndo || busy} onClick={() => void undo.undoLast()}>
            ⟲ Ctrl+Z
          </button>
        </div>
        <p className="mr-empty">
          Последние действия мастера · Ctrl/Cmd+Z откатит только безопасный inverse (не в полях ввода).
        </p>
        {actionLog.error ? (
          <p className="mr-status" data-tone="error">Журнал действий недоступен (Auth/schema).</p>
        ) : null}
        <div className="mr-action-list">
          {actionLog.entries.length === 0 ? (
            <p className="mr-empty">Действий пока нет.</p>
          ) : (
            actionLog.entries.slice(0, 12).map(entry => (
              <article key={entry.id} className="mr-card">
                <div className="mr-card-head">
                  <strong>{entry.summary}</strong>
                  <time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time>
                </div>
                <span className="mr-card-pool">
                  {entry.actionType}
                  {' · '}
                  {entry.actorType}:{entry.actorId.slice(0, 8)}
                  {' · '}
                  {entry.visibility === 'master' ? 'скрыто' : 'shared'}
                  {entry.inversePayload ? ' · undoable' : ''}
                </span>
              </article>
            ))
          )}
          {undo.stack.length > 0 ? (
            <article className="mr-card">
              <div className="mr-card-head">
                <strong>Стек Undo (сессия)</strong>
              </div>
              {undo.stack.slice(0, 5).map(item => (
                <span className="mr-card-pool" key={item.id}>{item.summary}</span>
              ))}
            </article>
          ) : null}
        </div>
      </section>
    </>
  )
}
