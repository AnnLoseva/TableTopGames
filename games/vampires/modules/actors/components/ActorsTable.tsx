'use client'

import { memo, useCallback, type ChangeEvent, type MouseEvent } from 'react'
import type { ActorSortDir, ActorSortKey, MasterActor, NormalizedActor } from '../types'
import {
  actorInitials,
  dotsString,
  isHighHunger,
  sheetTypeLabel,
  willpowerLabel,
} from '../utils/actor-labels'

export type ActorRowHandlers = {
  onSelect: (id: string) => void
  onToggleCheck: (id: string) => void
  onOpenRoller: (actor: MasterActor) => void
  onRouse: (actor: MasterActor) => void
  onOpenSheet: (actor: MasterActor) => void
}

type ActorsTableProps = {
  rows: readonly NormalizedActor[]
  mastersById: ReadonlyMap<string, MasterActor>
  selectedId: string | null
  checkedIds: ReadonlySet<string>
  sortKey: ActorSortKey
  sortDir: ActorSortDir
  activeSceneId: string | null
  allChecked: boolean
  onToggleAll: () => void
  onSort: (key: ActorSortKey) => void
  handlers: ActorRowHandlers
}

const SortHeader = memo(function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string
  column: ActorSortKey
  sortKey: ActorSortKey
  sortDir: ActorSortDir
  onSort: (key: ActorSortKey) => void
  className?: string
}) {
  const active = sortKey === column
  return (
    <th className={className}>
      <button type="button" onClick={() => onSort(column)}>
        {label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )
})

const ActorRow = memo(function ActorRow({
  actor,
  master,
  selected,
  checked,
  inScene,
  handlers,
}: {
  actor: NormalizedActor
  master: MasterActor | undefined
  selected: boolean
  checked: boolean
  inScene: boolean
  handlers: ActorRowHandlers
}) {
  const onRowClick = useCallback(() => handlers.onSelect(actor.id), [actor.id, handlers])
  const onCheck = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    handlers.onToggleCheck(actor.id)
  }, [actor.id, handlers])

  const run = useCallback((fn: (actor: MasterActor) => void) => (event: MouseEvent) => {
    event.stopPropagation()
    if (master) fn(master)
  }, [master])

  const hunger = actor.vitals.hunger
  const hasPrivate = Boolean(master?.privateFields && (
    master.privateFields.secrets
    || master.privateFields.motivation
    || master.privateFields.plans
    || master.privateFields.notes
  ))

  return (
    <tr data-selected={selected ? 'true' : undefined} onClick={onRowClick}>
      <td className="actors-col-check" onClick={event => event.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          aria-label={`Выбрать ${actor.displayName}`}
        />
      </td>
      <td className="actors-col-name">
        <div className="actors-name-cell">
          <div className="actors-avatar" aria-hidden>
            {actor.displayImage
              ? <img src={actor.displayImage} alt="" />
              : actorInitials(actor.displayName)}
          </div>
          <div>
            <strong title={actor.displayName}>{actor.displayName}</strong>
            <span>{actor.actorRole || '—'}</span>
          </div>
        </div>
      </td>
      <td className="actors-col-sheet">{sheetTypeLabel(actor)}</td>
      <td className="actors-col-bp">
        <span className="actors-dots" aria-label={`СК ${actor.vitals.bloodPotency}`}>
          {dotsString(actor.vitals.bloodPotency)}
        </span>
      </td>
      <td className="actors-col-hunger">
        <span
          className="actors-dots"
          data-warn={isHighHunger(hunger) ? 'true' : undefined}
          aria-label={`Голод ${hunger}${isHighHunger(hunger) ? ' !' : ''}`}
        >
          {dotsString(hunger)}{isHighHunger(hunger) ? ' !' : ''}
        </span>
      </td>
      <td className="actors-col-faction">
        <div>{actor.faction || '—'}</div>
        <div>
          {inScene ? <span className="actors-badge" data-tone="scene">в сцене</span> : null}
          {hasPrivate ? <span className="actors-badge" data-tone="private">скрыт</span> : null}
          <span className="actors-badge">{actor.status}</span>
        </div>
      </td>
      <td className="actors-col-wp">{willpowerLabel(actor)}</td>
      <td className="actors-col-actions">
        <div className="actors-row-actions">
          <button type="button" onClick={run(handlers.onOpenRoller)} title="Открыть роллер">🎲 пул</button>
          <button type="button" onClick={run(handlers.onRouse)} title="Rouse Check">Rouse</button>
          <button type="button" onClick={run(handlers.onOpenSheet)} title="Полный лист">лист →</button>
        </div>
      </td>
    </tr>
  )
})

export default function ActorsTable({
  rows,
  mastersById,
  selectedId,
  checkedIds,
  sortKey,
  sortDir,
  activeSceneId,
  allChecked,
  onToggleAll,
  onSort,
  handlers,
}: ActorsTableProps) {
  return (
    <div className="actors-table-wrap">
      <table className="actors-table">
        <thead>
          <tr>
            <th className="actors-col-check">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={onToggleAll}
                aria-label="Выбрать всех видимых"
              />
            </th>
            <SortHeader label="Имя · роль" column="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="actors-col-name" />
            <SortHeader label="Лист" column="kind" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="actors-col-sheet" />
            <SortHeader label="СК" column="bloodPotency" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="actors-col-bp" />
            <SortHeader label="Голод" column="hunger" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="actors-col-hunger" />
            <SortHeader label="Фракция · статус" column="faction" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="actors-col-faction" />
            <SortHeader label="Воля" column="willpower" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="actors-col-wp" />
            <th className="actors-col-actions">Действия</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(actor => (
            <ActorRow
              key={actor.id}
              actor={actor}
              master={mastersById.get(actor.id)}
              selected={selectedId === actor.id}
              checked={checkedIds.has(actor.id)}
              inScene={Boolean(activeSceneId && actor.currentSceneId === activeSceneId)}
              handlers={handlers}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
