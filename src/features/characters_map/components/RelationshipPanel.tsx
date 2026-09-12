'use client'

import { useEffect, useState } from 'react'
import type { MapCharacter, MapRelationship, RelationshipEvent, RelationshipKind } from '../types'
import {
  DEFAULT_RELATIONSHIP_COLOR,
  RELATIONSHIP_DESCRIPTION_MAX_LENGTH,
  RELATIONSHIP_LABEL_MAX_LENGTH,
  createRelationshipEvent,
} from '../constants'
import { t, type MapLanguage } from '../i18n'
import { formatEventDate, relationshipStart, sortDated } from '../timeline'
import EventDateFields from './EventDateFields'
import styles from './SidePanel.module.css'
import timelineStyles from './CharacterSheetView.module.css'

type SavePatch = {
  label: string
  description: string
  color: string
  kind: RelationshipKind
  events: RelationshipEvent[]
}

type Props = {
  relationship: MapRelationship
  displayRelationship: MapRelationship
  language: MapLanguage
  from: MapCharacter
  to: MapCharacter
  isEditor: boolean
  onClose: () => void
  onSave: (patch: SavePatch) => Promise<void>
  onDelete: () => Promise<void>
  onSelectCharacter: (id: string) => void
}

export default function RelationshipPanel({
  relationship,
  displayRelationship,
  language,
  from,
  to,
  isEditor,
  onClose,
  onSave,
  onDelete,
  onSelectCharacter,
}: Props) {
  const s = t(language).relationshipPanel
  const [isEditing, setIsEditing] = useState(false)
  const [label, setLabel] = useState(relationship.label)
  const [description, setDescription] = useState(relationship.description)
  const [color, setColor] = useState(relationship.color || DEFAULT_RELATIONSHIP_COLOR)
  const [kind, setKind] = useState<RelationshipKind>(relationship.kind)
  const [events, setEvents] = useState<RelationshipEvent[]>(relationship.events)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')

  // Where the line starts existing — `null` means "always on the map", i.e.
  // the owner wants the line but hasn't decided when it began.
  const startEvent = relationshipStart(displayRelationship)

  useEffect(() => {
    setLabel(relationship.label)
    setDescription(relationship.description)
    setColor(relationship.color || DEFAULT_RELATIONSHIP_COLOR)
    setKind(relationship.kind)
    setEvents(relationship.events)
    setIsEditing(false)
    setError('')
  }, [relationship.id, relationship.label, relationship.description, relationship.color, relationship.kind, relationship.events])

  useEffect(() => {
    if (!isEditor) setIsEditing(false)
  }, [isEditor])

  const handleSave = async () => {
    if (!label.trim()) {
      setError(s.errorLabelRequired)
      return
    }
    setIsBusy(true)
    setError('')
    try {
      await onSave({ label: label.trim(), description, color, kind, events })
      setIsEditing(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : s.errorSave)
    } finally {
      setIsBusy(false)
    }
  }

  const addEvent = () => {
    setEvents(previous => [...previous, createRelationshipEvent(new Date().getFullYear())])
  }

  const updateEvent = (id: string, patch: Partial<RelationshipEvent>) => {
    setEvents(previous => previous.map(event => (event.id === id ? { ...event, ...patch } : event)))
  }

  const removeEvent = (id: string) => {
    setEvents(previous => previous.filter(event => event.id !== id))
  }

  const handleDelete = async () => {
    if (!window.confirm(s.confirmDelete(displayRelationship.label))) return
    setIsBusy(true)
    try {
      await onDelete()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : s.errorDelete)
      setIsBusy(false)
    }
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label={s.ariaClose}>×</button>
      </div>
      <div className={styles.body}>
        <div className={styles.relLine}>
          <button type="button" className={styles.secondaryButton} onClick={() => onSelectCharacter(from.id)}>
            {from.name}
          </button>
          <span className={styles.relArrow}>{relationship.kind === 'mutual' ? '↔' : '→'}</span>
          <button type="button" className={styles.secondaryButton} onClick={() => onSelectCharacter(to.id)}>
            {to.name}
          </button>
        </div>

        {!isEditing && (
          <>
            <h2 className={styles.name}>
              <span className={styles.colorSwatch} style={{ background: relationship.color || DEFAULT_RELATIONSHIP_COLOR }} />
              {displayRelationship.label}
            </h2>
            <p className={styles.description} style={{ textAlign: 'center' }}>
              {relationship.kind === 'mutual' ? s.mutualLabel : s.directedLabel(from.name, to.name)}
            </p>
            {displayRelationship.description && <p className={styles.description}>{displayRelationship.description}</p>}

            <p className={styles.description} style={{ textAlign: 'center' }}>
              {s.startsLabel}: {startEvent ? formatEventDate(startEvent, language) : s.alwaysVisible}
            </p>

            {displayRelationship.events.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h3 className={timelineStyles.sectionTitle} style={{ textAlign: 'left' }}>{s.historyHeading}</h3>
                {sortDated(displayRelationship.events).map(event => (
                  <div key={event.id} className={timelineStyles.timelineEventView} style={{ marginBottom: 8 }}>
                    <span className={timelineStyles.timelineYearBadge}>{formatEventDate(event, language)}</span>
                    <div>
                      <p className={timelineStyles.timelineEventTitle}>
                        {event.title || s.eventFallbackTitle}
                        {event.appears && s.appearsSuffix}
                      </p>
                      {event.description && <p className={timelineStyles.timelineEventDescription}>{event.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isEditor && (
              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setIsEditing(true)}>
                  {t(language).common.edit}
                </button>
                <button type="button" className={styles.dangerButton} onClick={handleDelete} disabled={isBusy}>
                  {t(language).common.delete}
                </button>
              </div>
            )}
          </>
        )}

        {isEditing && (
          <>
            <div className={styles.field}>
              <label htmlFor="rel-kind">{s.kindLabel}</label>
              <select id="rel-kind" value={kind} onChange={event => setKind(event.target.value as RelationshipKind)}>
                <option value="directed">{s.directedOption(from.name, to.name)}</option>
                <option value="mutual">{s.mutualOption}</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="rel-label">{s.labelLabel}</label>
              <input
                id="rel-label"
                type="text"
                value={label}
                maxLength={RELATIONSHIP_LABEL_MAX_LENGTH}
                onChange={event => setLabel(event.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="rel-color">{s.colorLabel}</label>
              <input id="rel-color" type="color" value={color} onChange={event => setColor(event.target.value)} />
            </div>
            <div className={styles.field}>
              <label htmlFor="rel-description">{s.descriptionLabel}</label>
              <textarea
                id="rel-description"
                rows={6}
                value={description}
                maxLength={RELATIONSHIP_DESCRIPTION_MAX_LENGTH}
                onChange={event => setDescription(event.target.value)}
              />
            </div>

            <h3 className={timelineStyles.sectionTitle} style={{ textAlign: 'left', marginTop: 4 }}>{s.historyHeading}</h3>
            {events.map(event => (
              <div key={event.id} className={timelineStyles.timelineEventRow}>
                <div className={timelineStyles.timelineEventFields}>
                  <EventDateFields
                    value={event}
                    language={language}
                    onChange={patch => updateEvent(event.id, patch)}
                  />
                  <input
                    type="text"
                    placeholder={s.eventWhatHappened}
                    value={event.title}
                    onChange={changeEvent => updateEvent(event.id, { title: changeEvent.target.value })}
                  />
                  <select
                    value={event.appears ? 'true' : ''}
                    onChange={changeEvent => updateEvent(event.id, {
                      appears: changeEvent.target.value === 'true' ? true : undefined,
                    })}
                  >
                    <option value="">{s.appearanceNoChange}</option>
                    <option value="true">{s.appearsOption}</option>
                  </select>
                  <button
                    type="button"
                    className={timelineStyles.removeButton}
                    onClick={() => removeEvent(event.id)}
                    aria-label={s.ariaRemoveEvent}
                  >
                    ×
                  </button>
                </div>
                <input
                  type="text"
                  placeholder={s.newLabelPlaceholder}
                  value={event.label ?? ''}
                  onChange={changeEvent => updateEvent(event.id, { label: changeEvent.target.value || undefined })}
                  style={{ marginBottom: 6 }}
                />
                <textarea
                  rows={2}
                  placeholder={s.newDescriptionPlaceholder}
                  value={event.description ?? ''}
                  onChange={changeEvent => updateEvent(event.id, { description: changeEvent.target.value || undefined })}
                />
              </div>
            ))}
            <button type="button" className={timelineStyles.addButton} onClick={addEvent}>{s.addEventButton}</button>

            {error && <p className={styles.errorText}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={isBusy}>
                {t(language).common.save}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => setIsEditing(false)} disabled={isBusy}>
                {t(language).common.cancel}
              </button>
            </div>
          </>
        )}

        {!isEditing && error && <p className={styles.errorText}>{error}</p>}
      </div>
    </aside>
  )
}
