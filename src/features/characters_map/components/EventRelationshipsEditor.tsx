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
  /** The character's other lines, already labelled ("→ Мария — наставница"). */
  endableLines: { id: string; label: string }[]
  /** Ids of the lines marked as ending at this event. */
  endings: string[]
  language: MapLanguage
  onAdd: () => void
  onChange: (key: string, patch: Partial<EventRelationshipDraft>) => void
  onRemove: (draft: EventRelationshipDraft) => void
  onToggleEnding: (relationshipId: string, ends: boolean) => void
  onToggleAllEndings: (ends: boolean) => void
}

/**
 * The event↔relationship link, editor side, in two halves: lines that *start*
 * at this character event (created/updated by the route on save, stamped with
 * an appearance event carrying this event's date) and existing lines that
 * *end* here — the death case, where the edges around a character should stop
 * being drawn from that date on.
 */
export default function EventRelationshipsEditor({
  event,
  targets,
  drafts,
  endableLines,
  endings,
  language,
  onAdd,
  onChange,
  onRemove,
  onToggleEnding,
  onToggleAllEndings,
}: Props) {
  const s = t(language).characterPanel
  const allEnded = endableLines.length > 0 && endings.length === endableLines.length

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

      <p className={styles.eventRelationshipsTitle} style={{ marginTop: 10 }}>{s.eventEndingsHeading}</p>
      {endableLines.length === 0 && <p className={styles.eventRelationshipNote}>{s.eventNoLinesToEnd}</p>}
      {endableLines.length > 0 && (
        <>
          <p className={styles.eventRelationshipNote}>{s.eventEndingsHint}</p>
          {endableLines.map(line => (
            <label key={line.id} className={styles.eventEndingRow}>
              <input
                type="checkbox"
                checked={endings.includes(line.id)}
                onChange={changeEvent => onToggleEnding(line.id, changeEvent.target.checked)}
              />
              <span>{line.label}</span>
            </label>
          ))}
          <button type="button" className={styles.addButton} onClick={() => onToggleAllEndings(!allEnded)}>
            {allEnded ? s.eventEndNoneButton : s.eventEndAllButton}
          </button>
        </>
      )}
    </div>
  )
}
