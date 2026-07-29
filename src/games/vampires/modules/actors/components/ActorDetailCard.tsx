'use client'

import type { MasterActor, NormalizedActor } from '../types'
import { dotsString, sheetTypeLabel, willpowerLabel } from '../utils/actor-labels'
import { getActorRollPool } from '../services/actor-service'

type ActorDetailCardProps = {
  master: MasterActor | null
  normalized: NormalizedActor | null
  inScene: boolean
  onOpenRoller: () => void
  onRouse: () => void
  onOpenSheet: () => void
  onClone: () => void
  onToggleScene: () => void
  onArchive: () => void
  onSetHunger: (value: number) => void
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="actors-field">
      <dt>{label}</dt>
      <dd>{value.trim() ? value : '—'}</dd>
    </div>
  )
}

export default function ActorDetailCard({
  master,
  normalized,
  inScene,
  onOpenRoller,
  onRouse,
  onOpenSheet,
  onClone,
  onToggleScene,
  onArchive,
  onSetHunger,
}: ActorDetailCardProps) {
  if (!master || !normalized) {
    return (
      <aside className="actors-detail" aria-label="Карточка персонажа">
        <div className="actors-detail-head">
          <span className="actors-kicker">Карточка</span>
          <h2>Никто не выбран</h2>
          <p className="actors-muted">Выберите строку в таблице, чтобы увидеть краткую карточку и GM-поля.</p>
        </div>
      </aside>
    )
  }

  const privateFields = master.privateFields
  const pool = getActorRollPool(master, ['Харизма', 'Убеждение'])
  const bonds = typeof privateFields?.privateData.bonds === 'string'
    ? privateFields.privateData.bonds
    : typeof privateFields?.privateData.bondsText === 'string'
      ? String(privateFields.privateData.bondsText)
      : ''
  const hooks = typeof privateFields?.privateData.hooks === 'string'
    ? privateFields.privateData.hooks
    : privateFields?.plans || ''
  const scenesNote = normalized.currentSceneId
    ? `scene:${normalized.currentSceneId.slice(0, 8)}…`
    : 'не в сцене'

  return (
    <aside className="actors-detail" aria-label={`Карточка ${normalized.displayName}`}>
      <div className="actors-detail-head">
        <span className="actors-kicker">{sheetTypeLabel(normalized)}</span>
        <h2>{normalized.displayName}</h2>
        <p className="actors-muted">{normalized.actorRole || 'без роли'}</p>
        <div className="actors-detail-meta">
          {normalized.faction ? <span className="actors-badge">{normalized.faction}</span> : null}
          {normalized.clan ? <span className="actors-badge">{normalized.clan}</span> : null}
          {inScene ? <span className="actors-badge" data-tone="scene">в сцене</span> : null}
          <span className="actors-badge">{normalized.status}</span>
        </div>
      </div>

      <div className="actors-detail-body">
        <div className="actors-stat-grid">
          <div className="actors-stat">
            <span>СК</span>
            <strong className="actors-dots">{dotsString(normalized.vitals.bloodPotency)}</strong>
          </div>
          <div className="actors-stat">
            <span>Воля</span>
            <strong>{willpowerLabel(normalized)}</strong>
          </div>
          <div className="actors-stat">
            <span>Голод</span>
            <div className="actors-hunger-editor">
              <strong className="actors-dots">{dotsString(normalized.vitals.hunger)}</strong>
              <input
                type="number"
                min={0}
                max={5}
                value={normalized.vitals.hunger}
                onChange={event => onSetHunger(Number(event.target.value))}
                aria-label="Изменить Голод"
              />
            </div>
          </div>
          <div className="actors-stat">
            <span>Основной пул</span>
            <strong>{pool.dice}к</strong>
          </div>
        </div>

        <div className="actors-private">
          <span>☾ Видно только мастеру</span>
          <dl>
            <Field label="Мотивация" value={privateFields?.motivation || ''} />
            <Field label="Секреты" value={privateFields?.secrets || ''} />
            <Field label="Узы и отношения" value={bonds || privateFields?.notes || ''} />
            <Field label="Крюки" value={hooks} />
            <Field label="Связанные сцены" value={scenesNote} />
          </dl>
        </div>
      </div>

      <div className="actors-detail-actions">
        <button type="button" data-primary="true" onClick={onOpenSheet}>Полный лист →</button>
        <button type="button" onClick={onOpenRoller}>🎲 пул</button>
        <button type="button" onClick={onRouse}>Пробуждение</button>
        <button type="button" onClick={onClone}>Клонировать</button>
        <button type="button" onClick={onToggleScene}>{inScene ? 'Убрать из сцены' : 'В сцену'}</button>
        <button type="button" onClick={onArchive}>Архивировать</button>
      </div>
    </aside>
  )
}
