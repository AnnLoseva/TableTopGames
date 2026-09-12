'use client'

import { t, type MapLanguage } from '../i18n'
import { formatEventDate, type DatedLike } from '../timeline'
import type { EventRelationshipDraft, MapCharacter } from '../types'
import styles from './CharacterSheetView.module.css'

type Props = {
  /** The character event these lines appear at — supplies their date. */
  event: DatedLike
  /** Everyone else on the map, already localized, for the "with whom" picker. */
  targets: MapCharacter[]
  drafts: EventRelationshipDraft[]
  language: MapLanguage
  onAdd: () => void
  onChange: (key: string, patch: Partial<EventRelationshipDraft>) => void
  onRemove: (draft: EventRelationshipDraft) => void
}

/**
 * The event↔relationship link, editor side: relationship lines that start at
 * one character event. Each line is created (or updated) by the route on save
 * and gets an appearance event stamped with this event's date — so the line is
 * drawn on the map from that moment on, and not before.
 */
export default function EventRelationshipsEditor({
  event,
  targets,
  drafts,
  language,
  onAdd,
  onChange,
  onRemove,
}: Props) {
  const s = t(language).characterPanel

  return (
    <div className={styles.eventRelationships}>
      <p className={styles.eventRelationshipsTitle}>{s.eventRelationshipsHeading}</p>
      {drafts.length > 0 && (
        <p className={styles.eventRelationshipNote}>
          {Number.isFinite(event.year) ? s.eventRelAppearsNote(formatEventDate(event, language)) : s.eventRelUndatedNote}
        </p>
      )}
      {targets.length === 0 && <p className={styles.eventRelationshipNote}>{s.eventRelNoTargets}</p>}
      {drafts.map(draft => (
        <div key={draft.key} className={styles.eventRelationshipRow}>
          <select
            value={draft.direction}
            onChange={changeEvent => onChange(draft.key, { direction: changeEvent.target.value as EventRelationshipDraft['direction'] })}
          >
            <option value="out">{s.eventRelDirectionOut}</option>
            <option value="in">{s.eventRelDirectionIn}</option>
            <option value="mutual">{s.eventRelDirectionMutual}</option>
          </select>
          <select
            value={draft.targetCharacterId}
            onChange={changeEvent => onChange(draft.key, { targetCharacterId: changeEvent.target.value })}
          >
            <option value="">{s.eventRelTargetPlaceholder}</option>
            {targets.map(target => (
              <option key={target.id} value={target.id}>{target.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder={s.eventRelLabelPlaceholder}
            value={draft.label}
            onChange={changeEvent => onChange(draft.key, { label: changeEvent.target.value })}
          />
          <input
            type="color"
            value={draft.color}
            onChange={changeEvent => onChange(draft.key, { color: changeEvent.target.value })}
          />
          <button
            type="button"
            className={styles.removeButton}
            onClick={() => onRemove(draft)}
            aria-label={s.ariaRemoveEventRelationship}
          >
            ×
          </button>
          <input
            type="text"
            placeholder={s.eventRelDescriptionPlaceholder}
            value={draft.description}
            onChange={changeEvent => onChange(draft.key, { description: changeEvent.target.value })}
            style={{ flex: '1 1 100%' }}
          />
        </div>
      ))}
      {targets.length > 0 && (
        <button type="button" className={styles.addButton} onClick={onAdd}>
          {s.addEventRelationshipButton}
        </button>
      )}
    </div>
  )
}
