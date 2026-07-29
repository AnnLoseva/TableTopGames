'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMasterMembership } from '@/games/vampires/modules/master-console/api'
import type { MasterModuleProps } from '@/games/vampires/modules/master-console/types'
import { getCharacterSheetHref } from '@/games/vampires/modules/table/utils/table-urls'
import { createLinkedActorFromCharacter, listOwnCharacters, type OwnCharacterSummary } from '../api'
import { useActiveSceneId, useChronicleActors } from '../hooks'
import {
  createActorFromTemplate,
  describeBulkAction,
  executeBulkActorAction,
  executeSingleActorAction,
  isDangerousBulkAction,
  setActorHunger,
} from '../services'
import { getActorRollPool, normalizeActor } from '../services/actor-service'
import type {
  ActorBulkAction,
  ActorKind,
  ActorListFilter,
  ActorSortDir,
  ActorSortKey,
  ActorStatus,
  ActorTemplateId,
  MasterActor,
  SavedActorFilter,
} from '../types'
import {
  ACTOR_TEMPLATES,
  EMPTY_ACTOR_FILTER,
  collectFilterOptions,
  filterActors,
  loadSavedActorFilters,
  saveSavedActorFilters,
  sortActors,
} from '../utils'
import ActorDetailCard from './ActorDetailCard'
import ActorsTable from './ActorsTable'
import ConfirmDialog from './ConfirmDialog'
import './actors.css'

const KIND_OPTIONS: ActorKind[] = [
  'player_character',
  'full_npc',
  'compact_spc',
  'ghoul',
  'mortal',
  'thin_blood',
  'custom',
]

const STATUS_OPTIONS: ActorStatus[] = ['active', 'inactive', 'missing', 'dead', 'archived']

type PromptState =
  | { kind: 'faction' | 'tag' | 'status'; title: string; value: string; actionFactory: (value: string) => ActorBulkAction }
  | { kind: 'save_filter' | 'custom_name'; title: string; value: string }

type ImportState = {
  loading: boolean
  error: string | null
  characters: OwnCharacterSummary[]
  kind: Extract<ActorKind, 'player_character' | 'full_npc'>
  busyId: string | null
}

/** Same legacy app user the sheet/chat use (`users` table, not Supabase Auth). */
function readStoredSheetUser(): { id: string; username: string } | null {
  if (typeof window === 'undefined') return null
  const saved = window.localStorage.getItem('vtm-chat-user') || window.localStorage.getItem('vtm-sheet-user')
  if (!saved) return null
  try {
    const parsed = JSON.parse(saved) as { id?: string; username?: string }
    if (parsed?.id && parsed?.username) return { id: parsed.id, username: parsed.username }
  } catch { /* ignore broken localStorage payload */ }
  return null
}

export default function ActorsModule({
  room,
  role,
  deepLinkParams,
  onRequestRoll,
}: MasterModuleProps) {
  const { actors, loading, error, reload } = useChronicleActors(room)
  const activeSceneId = useActiveSceneId(room)

  const [filter, setFilter] = useState<ActorListFilter>(EMPTY_ACTOR_FILTER)
  const [sortKey, setSortKey] = useState<ActorSortKey>('name')
  const [sortDir, setSortDir] = useState<ActorSortDir>('asc')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set())
  const [savedFilters, setSavedFilters] = useState<SavedActorFilter[]>([])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<{
    action: ActorBulkAction
    targets: MasterActor[]
  } | null>(null)
  const [prompt, setPrompt] = useState<PromptState | null>(null)
  const [importState, setImportState] = useState<ImportState | null>(null)

  useEffect(() => {
    setSavedFilters(loadSavedActorFilters(room))
  }, [room])

  const deepLinkActorId = deepLinkParams?.actor || deepLinkParams?.entity || null
  const [missingEntity, setMissingEntity] = useState<string | null>(null)

  useEffect(() => {
    if (!deepLinkActorId) {
      setMissingEntity(null)
      return
    }
    setSelectedId(deepLinkActorId)
  }, [deepLinkActorId])

  useEffect(() => {
    if (!deepLinkActorId || loading) return
    setMissingEntity(actors.some(actor => actor.id === deepLinkActorId) ? null : deepLinkActorId)
  }, [deepLinkActorId, actors, loading])

  const mastersById = useMemo(() => {
    const map = new Map<string, MasterActor>()
    for (const actor of actors) map.set(actor.id, actor)
    return map
  }, [actors])

  const normalized = useMemo(
    () => actors.map(actor => normalizeActor(actor)),
    [actors],
  )

  const options = useMemo(() => collectFilterOptions(normalized), [normalized])

  const visible = useMemo(() => {
    const filtered = filterActors(normalized, filter, activeSceneId)
    return sortActors(filtered, sortKey, sortDir)
  }, [normalized, filter, activeSceneId, sortKey, sortDir])

  const visibleIds = useMemo(() => visible.map(row => row.id), [visible])
  const allChecked = visibleIds.length > 0 && visibleIds.every(id => checkedIds.has(id))

  const selectedMaster = selectedId ? mastersById.get(selectedId) || null : null
  const selectedNormalized = useMemo(
    () => (selectedMaster ? normalizeActor(selectedMaster) : null),
    [selectedMaster],
  )

  const chronicleId = actors[0]?.chronicleId || ''

  const resolveLogContext = useCallback(async () => {
    if (chronicleId) {
      return { chronicleId, room, sessionId: null as string | null }
    }
    const membership = await getMasterMembership(room)
    if (!membership) throw new Error('Нужен membership мастера (Auth) и chronicle_id')
    return { chronicleId: membership.chronicleId, room, sessionId: null as string | null }
  }, [chronicleId, room])

  const patchFilter = useCallback((patch: Partial<ActorListFilter>) => {
    setFilter(prev => ({ ...prev, ...patch }))
  }, [])

  const onSort = useCallback((key: ActorSortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir('asc')
      return key
    })
  }, [])

  const onToggleCheck = useCallback((id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const onToggleAll = useCallback(() => {
    setCheckedIds(prev => {
      if (visibleIds.length > 0 && visibleIds.every(id => prev.has(id))) return new Set()
      return new Set(visibleIds)
    })
  }, [visibleIds])

  const checkedMasters = useMemo(
    () => visible.flatMap(row => {
      if (!checkedIds.has(row.id)) return []
      const master = mastersById.get(row.id)
      return master ? [master] : []
    }),
    [visible, checkedIds, mastersById],
  )

  const runAction = useCallback(async (action: ActorBulkAction, targets: MasterActor[]) => {
    if (targets.length === 0) return
    setBusy(true)
    setActionError(null)
    try {
      const logContext = await resolveLogContext()
      if (targets.length === 1) {
        await executeSingleActorAction(targets[0], action, logContext)
      } else {
        await executeBulkActorAction(targets, action, logContext)
      }
      setCheckedIds(new Set())
      await reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Действие не выполнено')
    } finally {
      setBusy(false)
      setPendingAction(null)
    }
  }, [reload, resolveLogContext])

  const requestAction = useCallback((action: ActorBulkAction, targets: MasterActor[]) => {
    if (targets.length === 0) return
    if (isDangerousBulkAction(action) || targets.length > 1) {
      setPendingAction({ action, targets })
      return
    }
    void runAction(action, targets)
  }, [runAction])

  const openRoller = useCallback((actor: MasterActor) => {
    const normalizedActor = normalizeActor(actor)
    const pool = getActorRollPool(actor, ['Харизма', 'Убеждение'])
    onRequestRoll?.({
      source: 'actors',
      actorId: actor.id,
      displayName: normalizedActor.displayName,
      hunger: normalizedActor.vitals.hunger,
      characterId: actor.characterId,
      traits: pool.parts.map(part => part.name),
      dice: pool.dice,
      mode: 'pool',
    })
  }, [onRequestRoll])

  const openRouse = useCallback((actor: MasterActor) => {
    const normalizedActor = normalizeActor(actor)
    onRequestRoll?.({
      source: 'actors',
      actorId: actor.id,
      displayName: normalizedActor.displayName,
      hunger: normalizedActor.vitals.hunger,
      characterId: actor.characterId,
      traits: [],
      dice: 1,
      mode: 'rouse',
    })
  }, [onRequestRoll])

  const openFullSheet = useCallback((actor: MasterActor) => {
    if (!actor.characterId) {
      setActionError('У этого SPC нет полного листа. Сначала конвертируйте compact → full sheet.')
      return
    }
    const href = getCharacterSheetHref(room, 'master', actor.characterId)
    window.open(href, '_blank', 'noopener,noreferrer')
  }, [room])

  const createFromTemplate = useCallback(async (templateId: ActorTemplateId, name?: string) => {
    setBusy(true)
    setActionError(null)
    try {
      const logContext = await resolveLogContext()
      const created = await createActorFromTemplate({
        chronicleId: logContext.chronicleId,
        room,
        templateId,
        name,
      })
      setSelectedId(created.id)
      await reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось создать актёра')
    } finally {
      setBusy(false)
    }
  }, [reload, resolveLogContext, room])

  const linkedCharacterIds = useMemo(() => {
    const ids = new Set<string>()
    for (const actor of actors) {
      if (actor.characterId) ids.add(actor.characterId)
    }
    return ids
  }, [actors])

  const openImportDialog = useCallback(async () => {
    const user = readStoredSheetUser()
    if (!user) {
      setActionError('Войди на главной странице (аккаунт листов), чтобы импортировать своих персонажей.')
      return
    }
    setImportState({ loading: true, error: null, characters: [], kind: 'full_npc', busyId: null })
    try {
      const characters = await listOwnCharacters(user.id)
      setImportState(prev => prev ? { ...prev, loading: false, characters } : prev)
    } catch (err) {
      setImportState(prev => prev
        ? { ...prev, loading: false, error: err instanceof Error ? err.message : 'Не удалось загрузить персонажей' }
        : prev)
    }
  }, [])

  const importCharacter = useCallback(async (character: OwnCharacterSummary) => {
    setImportState(prev => prev ? { ...prev, busyId: character.id, error: null } : prev)
    try {
      const logContext = await resolveLogContext()
      const kind = importState?.kind || 'full_npc'
      const created = await createLinkedActorFromCharacter({
        chronicleId: logContext.chronicleId,
        room,
        characterId: character.id,
        name: character.name,
        imageUrl: character.image,
        kind,
      })
      setSelectedId(created.id)
      await reload()
      setImportState(prev => prev ? { ...prev, busyId: null } : prev)
    } catch (err) {
      setImportState(prev => prev
        ? { ...prev, busyId: null, error: err instanceof Error ? err.message : 'Не удалось добавить персонажа' }
        : prev)
    }
  }, [importState?.kind, reload, resolveLogContext, room])

  const onTemplateClick = useCallback((templateId: ActorTemplateId) => {
    if (templateId === 'custom') {
      setPrompt({ kind: 'custom_name', title: 'Имя нового актёра', value: 'Новый НПС' })
      return
    }
    void createFromTemplate(templateId)
  }, [createFromTemplate])

  const saveCurrentFilter = useCallback((name: string) => {
    const next: SavedActorFilter = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Фильтр',
      filter: { ...filter },
    }
    const list = [...savedFilters, next].slice(-20)
    setSavedFilters(list)
    saveSavedActorFilters(room, list)
  }, [filter, room, savedFilters])

  const submitPrompt = useCallback(() => {
    if (!prompt) return
    if (prompt.kind === 'save_filter') {
      saveCurrentFilter(prompt.value)
      setPrompt(null)
      return
    }
    if (prompt.kind === 'custom_name') {
      void createFromTemplate('custom', prompt.value)
      setPrompt(null)
      return
    }
    if (prompt.kind !== 'faction' && prompt.kind !== 'tag' && prompt.kind !== 'status') return
    const value = prompt.value.trim()
    if (!value || !checkedMasters.length) return
    if (prompt.kind === 'status' && !STATUS_OPTIONS.includes(value as ActorStatus)) {
      setActionError('Некорректный статус')
      return
    }
    requestAction(prompt.actionFactory(value), checkedMasters)
    setPrompt(null)
  }, [prompt, saveCurrentFilter, createFromTemplate, checkedMasters, requestAction])

  const handlers = useMemo(() => ({
    onSelect: (id: string) => setSelectedId(id),
    onToggleCheck,
    onOpenRoller: openRoller,
    onRouse: openRouse,
    onOpenSheet: openFullSheet,
  }), [onToggleCheck, openRoller, openRouse, openFullSheet])

  const inSceneSelected = Boolean(
    activeSceneId && selectedNormalized?.currentSceneId === activeSceneId,
  )

  if (role === 'observer') {
    return (
      <section className="actors-module" aria-label="НПС и SPC">
        <div className="actors-error">
          Observer: модуль НПС доступен только для просмотра публичных полей в следующих фазах.
        </div>
      </section>
    )
  }

  return (
    <section className="actors-module" aria-label="НПС и SPC">
      {missingEntity ? (
        <p className="master-entity-missing" role="status">
          Актор не найден или удалён: <code>{missingEntity}</code>
        </p>
      ) : null}
      <div className="actors-module-main">
        <header className="actors-header">
          <div>
            <span className="actors-kicker">Модуль</span>
            <h1>НПС и SPC</h1>
            <p>в хронике · листы, приватные поля, массовые действия</p>
          </div>
          <div className="actors-count" title="Всего в хронике">{actors.length}</div>
        </header>

        <div className="actors-toolbar">
          <div className="actors-toolbar-row">
            <input
              className="actors-search"
              type="search"
              placeholder="Поиск по имени, роли, тегу…"
              value={filter.query}
              onChange={event => patchFilter({ query: event.target.value })}
              aria-label="Глобальный поиск актёров"
            />
            <button
              type="button"
              data-active={filter.sceneScope === 'all' ? 'true' : undefined}
              onClick={() => patchFilter({ sceneScope: 'all' })}
            >
              все
            </button>
            <button
              type="button"
              data-active={filter.sceneScope === 'in_scene' ? 'true' : undefined}
              onClick={() => patchFilter({ sceneScope: 'in_scene' })}
              disabled={!activeSceneId}
              title={activeSceneId ? 'В текущей активной сцене' : 'Нет активной сцены'}
            >
              в сцене
            </button>
            <select
              className="actors-select"
              value={filter.faction || ''}
              onChange={event => patchFilter({ faction: event.target.value || null })}
              aria-label="Фракция"
            >
              <option value="">faction</option>
              {options.factions.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <select
              className="actors-select"
              value={filter.clan || ''}
              onChange={event => patchFilter({ clan: event.target.value || null })}
              aria-label="Клан"
            >
              <option value="">clan</option>
              {options.clans.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <select
              className="actors-select"
              value={filter.kind || ''}
              onChange={event => patchFilter({ kind: (event.target.value || null) as ActorKind | null })}
              aria-label="Тип актёра"
            >
              <option value="">actor kind</option>
              {KIND_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <select
              className="actors-select"
              value={filter.status || ''}
              onChange={event => patchFilter({ status: (event.target.value || null) as ActorStatus | null })}
              aria-label="Статус"
            >
              <option value="">status</option>
              {STATUS_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <select
              className="actors-select"
              value={filter.tag || ''}
              onChange={event => patchFilter({ tag: event.target.value || null })}
              aria-label="Тег"
            >
              <option value="">tags</option>
              {options.tags.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <button type="button" onClick={() => setFilter(EMPTY_ACTOR_FILTER)}>Сбросить</button>
            <button
              type="button"
              onClick={() => setPrompt({ kind: 'save_filter', title: 'Имя сохранённого фильтра', value: '' })}
            >
              Сохранить фильтр
            </button>
            {savedFilters.length > 0 ? (
              <select
                className="actors-select"
                defaultValue=""
                onChange={event => {
                  const found = savedFilters.find(item => item.id === event.target.value)
                  if (found) setFilter({ ...found.filter })
                  event.currentTarget.value = ''
                }}
                aria-label="Сохранённые фильтры"
              >
                <option value="">сохранённые…</option>
                {savedFilters.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            ) : null}
          </div>

          <div className="actors-templates">
            <span>Создать из шаблона:</span>
            {ACTOR_TEMPLATES.map(template => (
              <button
                key={template.id}
                type="button"
                disabled={busy}
                onClick={() => onTemplateClick(template.id)}
              >
                + {template.label}
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => void openImportDialog()}
              title="Добавить любого из своих персонажей как актёра с привязанным полным листом"
            >
              + Мои персонажи
            </button>
          </div>
        </div>

        {loading ? <div className="actors-loading">Загрузка актёров…</div> : null}
        {!loading && error ? (
          <div className="actors-error">
            <div>{error}</div>
            <button type="button" onClick={() => void reload()}>Повторить</button>
          </div>
        ) : null}
        {!loading && !error && visible.length === 0 ? (
          <div className="actors-empty">
            <strong>Список пуст</strong>
            <span>Создайте SPC из шаблона или сбросьте фильтры.</span>
          </div>
        ) : null}
        {!loading && !error && visible.length > 0 ? (
          <ActorsTable
            rows={visible}
            mastersById={mastersById}
            selectedId={selectedId}
            checkedIds={checkedIds}
            sortKey={sortKey}
            sortDir={sortDir}
            activeSceneId={activeSceneId}
            allChecked={allChecked}
            onToggleAll={onToggleAll}
            onSort={onSort}
            handlers={handlers}
          />
        ) : null}

        <div className="actors-bulk" aria-label="Массовые действия">
          <strong>Выбрано: {checkedMasters.length}</strong>
          <button
            type="button"
            disabled={!checkedMasters.length || !activeSceneId || busy}
            onClick={() => activeSceneId && requestAction({ type: 'add_to_scene', sceneId: activeSceneId }, checkedMasters)}
          >
            В сцену
          </button>
          <button
            type="button"
            disabled={!checkedMasters.length || busy}
            onClick={() => requestAction({ type: 'remove_from_scene' }, checkedMasters)}
          >
            Убрать из сцены
          </button>
          <button
            type="button"
            disabled={!checkedMasters.length || busy}
            onClick={() => requestAction({ type: 'increment_hunger', delta: 1 }, checkedMasters)}
          >
            +1 Голод
          </button>
          <button
            type="button"
            disabled={!checkedMasters.length || busy}
            onClick={() => setPrompt({
              kind: 'faction',
              title: 'Новая фракция',
              value: '',
              actionFactory: value => ({ type: 'set_faction', faction: value }),
            })}
          >
            Фракция…
          </button>
          <button
            type="button"
            disabled={!checkedMasters.length || busy}
            onClick={() => setPrompt({
              kind: 'status',
              title: 'Новый статус (active / inactive / missing / dead / archived)',
              value: 'inactive',
              actionFactory: value => ({ type: 'set_status', status: value as ActorStatus }),
            })}
          >
            Статус…
          </button>
          <button
            type="button"
            disabled={!checkedMasters.length || busy}
            onClick={() => setPrompt({
              kind: 'tag',
              title: 'Добавить tag',
              value: '',
              actionFactory: value => ({ type: 'add_tag', tag: value }),
            })}
          >
            Тег…
          </button>
          <button
            type="button"
            disabled={!checkedMasters.length || busy}
            onClick={() => requestAction({ type: 'clone' }, checkedMasters)}
          >
            Клонировать
          </button>
          <button
            type="button"
            data-danger="true"
            disabled={!checkedMasters.length || busy}
            onClick={() => requestAction({ type: 'archive' }, checkedMasters)}
          >
            Архивировать
          </button>
          {actionError ? <span className="actors-error" role="alert">{actionError}</span> : null}
        </div>
      </div>

      <ActorDetailCard
        master={selectedMaster}
        normalized={selectedNormalized}
        inScene={inSceneSelected}
        onOpenRoller={() => selectedMaster && openRoller(selectedMaster)}
        onRouse={() => selectedMaster && openRouse(selectedMaster)}
        onOpenSheet={() => selectedMaster && openFullSheet(selectedMaster)}
        onClone={() => selectedMaster && requestAction({ type: 'clone' }, [selectedMaster])}
        onToggleScene={() => {
          if (!selectedMaster) return
          if (inSceneSelected) {
            requestAction({ type: 'remove_from_scene' }, [selectedMaster])
          } else if (activeSceneId) {
            requestAction({ type: 'add_to_scene', sceneId: activeSceneId }, [selectedMaster])
          } else {
            setActionError('Нет активной сцены')
          }
        }}
        onArchive={() => selectedMaster && requestAction({ type: 'archive' }, [selectedMaster])}
        onSetHunger={value => {
          if (!selectedMaster) return
          void (async () => {
            try {
              await setActorHunger(selectedMaster, value)
              await reload()
            } catch (err) {
              setActionError(err instanceof Error ? err.message : 'Не удалось изменить Голод')
            }
          })()
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title="Подтвердите действие"
        message={pendingAction
          ? `${describeBulkAction(pendingAction.action, pendingAction.targets.length)}. Результат будет записан в журнал действий мастера.`
          : ''}
        confirmLabel="Выполнить"
        danger={pendingAction?.action.type === 'archive'}
        busy={busy}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          if (pendingAction) void runAction(pendingAction.action, pendingAction.targets)
        }}
      />

      {prompt ? (
        <div className="actors-dialog-backdrop" role="presentation" onClick={() => setPrompt(null)}>
          <div
            className="actors-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="actors-prompt-title"
            onClick={event => event.stopPropagation()}
          >
            <h3 id="actors-prompt-title">{prompt.title}</h3>
            <input
              className="actors-search"
              autoFocus
              value={prompt.value}
              onChange={event => setPrompt({ ...prompt, value: event.target.value })}
              onKeyDown={event => {
                if (event.key === 'Enter') submitPrompt()
              }}
            />
            <div className="actors-dialog-actions" style={{ marginTop: 12 }}>
              <button type="button" onClick={() => setPrompt(null)}>Отмена</button>
              <button type="button" data-danger="true" onClick={submitPrompt}>OK</button>
            </div>
          </div>
        </div>
      ) : null}

      {importState ? (
        <div className="actors-dialog-backdrop" role="presentation" onClick={() => setImportState(null)}>
          <div
            className="actors-dialog actors-import-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="actors-import-title"
            onClick={event => event.stopPropagation()}
          >
            <h3 id="actors-import-title">Мои персонажи</h3>
            <p>Персонаж добавляется как актёр с привязанным полным листом. Лист остаётся источником правды.</p>
            <label className="actors-import-kind">
              Добавлять как:
              <select
                className="actors-select"
                value={importState.kind}
                onChange={event => setImportState(prev => prev
                  ? { ...prev, kind: event.target.value as ImportState['kind'] }
                  : prev)}
              >
                <option value="full_npc">full_npc</option>
                <option value="player_character">player_character</option>
              </select>
            </label>
            {importState.loading ? <div className="actors-loading">Загрузка персонажей…</div> : null}
            {importState.error ? <div className="actors-error" role="alert">{importState.error}</div> : null}
            {!importState.loading && importState.characters.length === 0 && !importState.error ? (
              <div className="actors-empty">
                <strong>Персонажей не найдено</strong>
                <span>Создайте персонажа в листе персонажа, затем вернитесь сюда.</span>
              </div>
            ) : null}
            <ul className="actors-import-list">
              {importState.characters.map(character => {
                const alreadyLinked = linkedCharacterIds.has(character.id)
                return (
                  <li key={character.id}>
                    {character.image ? (
                      <img src={character.image} alt="" loading="lazy" />
                    ) : (
                      <span className="actors-import-avatar" aria-hidden="true" />
                    )}
                    <span className="actors-import-name">
                      {character.name}
                      {character.clan ? <small>{character.clan}</small> : null}
                    </span>
                    <button
                      type="button"
                      disabled={alreadyLinked || importState.busyId === character.id}
                      onClick={() => void importCharacter(character)}
                    >
                      {alreadyLinked ? 'Уже в хронике' : importState.busyId === character.id ? 'Добавляю…' : 'Добавить'}
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="actors-dialog-actions" style={{ marginTop: 12 }}>
              <button type="button" onClick={() => setImportState(null)}>Закрыть</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
