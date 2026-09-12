'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ATTRIBUTE_GROUPS,
  BLOOD_POTENCY_MAX,
  CHARACTER_DESCRIPTION_MAX_LENGTH,
  CHARACTER_KIND_LABELS,
  CHARACTER_NAME_MAX_LENGTH,
  DEFAULT_RELATIONSHIP_COLOR,
  DOT_MAX,
  GALLERY_CATEGORY_LABELS,
  HUMANITY_MAX,
  SKILL_GROUPS,
  STAINS_MAX,
  createCharacterEvent,
  withSheetDefaults,
} from '../constants'
import { attributeLabel, characterKindLabel, galleryCategoryLabel, groupTitle, skillLabel, t, type MapLanguage } from '../i18n'
import { formatEventDate, sortDated } from '../timeline'
import type {
  CharacterEvent,
  CharacterKind,
  CharacterSheet,
  Discipline,
  EventRelationshipDraft,
  GalleryCategory,
  GalleryItem,
  MapCharacter,
  MapRelationship,
} from '../types'
import DotRating from './DotRating'
import EventDateFields from './EventDateFields'
import EventRelationshipsEditor from './EventRelationshipsEditor'
import TrackBoxes from './TrackBoxes'
import styles from './CharacterSheetView.module.css'

type SavePatch = {
  name: string
  description: string
  sheet: CharacterSheet
  /** Relationship lines attached to this character's events — see the route's
   * `handleSaveCharacter`, which creates/patches them and stamps each one's
   * appearance with its source event's date. */
  eventRelationships: EventRelationshipDraft[]
  /** Lines the owner removed while editing; deleted outright on save. */
  removedRelationshipIds: string[]
}

/** Rebuilds the panel's relationship drafts from what's actually on the map:
 * a relationship belongs to an event when its appearance event points back at
 * that event's id (`sourceEventId`). */
function deriveEventRelationshipDrafts(
  character: MapCharacter,
  relationships: MapRelationship[],
): EventRelationshipDraft[] {
  const eventIds = new Set(character.sheet.events.map(event => event.id))
  const drafts: EventRelationshipDraft[] = []
  for (const relationship of relationships) {
    const link = relationship.events.find(event => event.sourceEventId && eventIds.has(event.sourceEventId))
    if (!link || !link.sourceEventId) continue
    const isOutgoing = relationship.fromCharacterId === character.id
    drafts.push({
      key: relationship.id,
      id: relationship.id,
      eventId: link.sourceEventId,
      targetCharacterId: isOutgoing ? relationship.toCharacterId : relationship.fromCharacterId,
      direction: relationship.kind === 'mutual' ? 'mutual' : isOutgoing ? 'out' : 'in',
      label: relationship.label,
      color: relationship.color || DEFAULT_RELATIONSHIP_COLOR,
      description: relationship.description,
    })
  }
  return drafts
}

type Props = {
  character: MapCharacter
  displayCharacter: MapCharacter
  /** Everyone on the map (localized) — the "with whom" picker for event lines. */
  characters: MapCharacter[]
  /** Raw relationships, for seeding the editable drafts. */
  relationships: MapRelationship[]
  /** Localized relationships, for the read-only list under each event. */
  displayRelationships: MapRelationship[]
  language: MapLanguage
  imageUrl: string | null
  isEditor: boolean
  onClose: () => void
  onSave: (patch: SavePatch) => Promise<void>
  onSelectRelationship: (id: string) => void
  onUploadImage: (file: File) => Promise<void>
  onDelete: () => Promise<void>
  getGalleryImageUrl: (imagePath: string) => string
  onAddGalleryItem: (file: File) => Promise<void>
  onUpdateGalleryItem: (itemId: string, patch: Partial<Pick<GalleryItem, 'caption' | 'category'>>) => Promise<void>
  onRemoveGalleryItem: (itemId: string) => Promise<void>
}

export default function CharacterPanel({
  character,
  displayCharacter,
  characters,
  relationships,
  displayRelationships,
  language,
  imageUrl,
  isEditor,
  onClose,
  onSave,
  onSelectRelationship,
  onUploadImage,
  onDelete,
  getGalleryImageUrl,
  onAddGalleryItem,
  onUpdateGalleryItem,
  onRemoveGalleryItem,
}: Props) {
  const s = t(language).characterPanel
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(character.name)
  const [description, setDescription] = useState(character.description)
  const [sheet, setSheet] = useState<CharacterSheet>(() => withSheetDefaults(character.sheet))
  const [eventRelationships, setEventRelationships] = useState<EventRelationshipDraft[]>(
    () => deriveEventRelationshipDrafts(character, relationships),
  )
  const [removedRelationshipIds, setRemovedRelationshipIds] = useState<string[]>([])
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const galleryFileInputRef = useRef<HTMLInputElement>(null)

  // View-mode (non-editing) text always comes from `displayCharacter` — the
  // localized version — while the edit form always seeds from `character`,
  // the raw Russian source. Editing is never done in translated text; English
  // is a derived read-only display layer, recomputed after the next edit.
  const viewSheet = displayCharacter.sheet

  useEffect(() => {
    setName(character.name)
    setDescription(character.description)
    setSheet(withSheetDefaults(character.sheet))
    setRemovedRelationshipIds([])
    setIsEditing(false)
    setError('')
    setLightboxUrl(null)
  }, [character.id, character.name, character.description, character.sheet])

  // Relationship drafts follow whatever is on the map — but only while the
  // panel is not being edited, so a background refresh (the English
  // translation scan, say) can't wipe half-typed lines.
  useEffect(() => {
    if (isEditing) return
    setEventRelationships(deriveEventRelationshipDrafts(character, relationships))
  }, [character, relationships, isEditing])

  useEffect(() => {
    if (!isEditor) setIsEditing(false)
  }, [isEditor])

  const metaFields: { key: keyof CharacterSheet; label: string }[] = [
    { key: 'clan', label: s.metaClan },
    { key: 'generation', label: s.metaGeneration },
    { key: 'predatorType', label: s.metaPredatorType },
    { key: 'sire', label: s.metaSire },
  ]

  const patchSheet = (patch: Partial<CharacterSheet>) => setSheet(previous => ({ ...previous, ...patch }))

  const handleSave = async () => {
    if (!name.trim()) {
      setError(s.errorNameRequired)
      return
    }
    if (eventRelationships.some(draft => !draft.targetCharacterId)) {
      setError(s.errorRelationshipTargetRequired)
      return
    }
    if (eventRelationships.some(draft => !draft.label.trim())) {
      setError(s.errorRelationshipLabelRequired)
      return
    }
    setIsBusy(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        description,
        sheet,
        eventRelationships: eventRelationships.map(draft => ({ ...draft, label: draft.label.trim() })),
        removedRelationshipIds,
      })
      setIsEditing(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : s.errorSave)
    } finally {
      setIsBusy(false)
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setIsBusy(true)
    setError('')
    try {
      await onUploadImage(file)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : s.errorUploadImage)
    } finally {
      setIsBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(s.confirmDelete(displayCharacter.name))) return
    setIsBusy(true)
    try {
      await onDelete()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : s.errorDelete)
      setIsBusy(false)
    }
  }

  const handleGalleryFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setIsBusy(true)
    setError('')
    try {
      await onAddGalleryItem(file)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : s.errorUploadGalleryPhoto)
    } finally {
      setIsBusy(false)
    }
  }

  const handleRemoveGalleryItem = async (itemId: string) => {
    setIsBusy(true)
    setError('')
    try {
      await onRemoveGalleryItem(itemId)
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : s.errorRemovePhoto)
    } finally {
      setIsBusy(false)
    }
  }

  const addDiscipline = () => {
    const discipline: Discipline = { id: crypto.randomUUID(), name: '', level: 1 }
    patchSheet({ disciplines: [...sheet.disciplines, discipline] })
  }

  const updateDiscipline = (id: string, patch: Partial<Discipline>) => {
    patchSheet({
      disciplines: sheet.disciplines.map(discipline => (
        discipline.id === id ? { ...discipline, ...patch } : discipline
      )),
    })
  }

  const removeDiscipline = (id: string) => {
    patchSheet({ disciplines: sheet.disciplines.filter(discipline => discipline.id !== id) })
  }

  const addEvent = () => {
    patchSheet({ events: [...sheet.events, createCharacterEvent(new Date().getFullYear())] })
  }

  const updateEvent = (id: string, patch: Partial<CharacterEvent>) => {
    patchSheet({ events: sheet.events.map(event => (event.id === id ? { ...event, ...patch } : event)) })
  }

  const removeEvent = (id: string) => {
    // Lines that were only born from this event go with it.
    const orphaned = eventRelationships.filter(draft => draft.eventId === id)
    if (orphaned.length > 0 && !window.confirm(s.confirmRemoveEventRelationship(orphaned.map(draft => draft.label).join(', ')))) {
      return
    }
    setEventRelationships(previous => previous.filter(draft => draft.eventId !== id))
    setRemovedRelationshipIds(previous => [
      ...previous,
      ...orphaned.map(draft => draft.id).filter((relationshipId): relationshipId is string => relationshipId !== null),
    ])
    patchSheet({ events: sheet.events.filter(event => event.id !== id) })
  }

  const addEventRelationship = (eventId: string) => {
    setEventRelationships(previous => [...previous, {
      key: crypto.randomUUID(),
      id: null,
      eventId,
      targetCharacterId: '',
      direction: 'out',
      label: '',
      color: DEFAULT_RELATIONSHIP_COLOR,
      description: '',
    }])
  }

  const updateEventRelationship = (key: string, patch: Partial<EventRelationshipDraft>) => {
    setEventRelationships(previous => previous.map(draft => (draft.key === key ? { ...draft, ...patch } : draft)))
  }

  const removeEventRelationship = (draft: EventRelationshipDraft) => {
    if (draft.id && !window.confirm(s.confirmRemoveEventRelationship(draft.label))) return
    setEventRelationships(previous => previous.filter(item => item.key !== draft.key))
    if (draft.id) setRemovedRelationshipIds(previous => [...previous, draft.id as string])
  }

  // Everyone but this character can be the other end of an event's line.
  const relationshipTargets = characters.filter(item => item.id !== character.id)

  const updateGalleryDraft = (id: string, patch: Partial<Pick<GalleryItem, 'caption' | 'category'>>) => {
    patchSheet({ gallery: sheet.gallery.map(item => (item.id === id ? { ...item, ...patch } : item)) })
  }

  const commitGalleryCaption = async (item: GalleryItem) => {
    try {
      await onUpdateGalleryItem(item.id, { caption: item.caption })
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : s.errorSaveCaption)
    }
  }

  const handleGalleryCategoryChange = async (item: GalleryItem, category: GalleryCategory) => {
    updateGalleryDraft(item.id, { category })
    try {
      await onUpdateGalleryItem(item.id, { category })
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : s.errorSaveCategory)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={event => event.stopPropagation()}>
        <div className={styles.topBar}>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={s.ariaClose}>×</button>
        </div>

        <div className={styles.header}>
          <div className={styles.portraitWrap}>
            {imageUrl ? <img src={imageUrl} alt={displayCharacter.name} /> : (character.name.trim().slice(0, 1).toUpperCase() || '?')}
          </div>
          <div className={styles.headerInfo}>
            {isEditing ? (
              <input
                className={styles.nameInput}
                type="text"
                value={name}
                maxLength={CHARACTER_NAME_MAX_LENGTH}
                onChange={event => setName(event.target.value)}
              />
            ) : (
              <h2 className={styles.name}>{displayCharacter.name}</h2>
            )}

            {isEditing ? (
              <input
                type="text"
                placeholder={s.conceptPlaceholder}
                value={sheet.concept}
                onChange={event => patchSheet({ concept: event.target.value })}
                className={styles.nameInput}
                style={{ fontSize: 14, fontWeight: 400, fontStyle: 'italic' }}
              />
            ) : (
              viewSheet.concept && <p className={styles.concept}>{viewSheet.concept}</p>
            )}

            <div className={styles.metaGrid}>
              {metaFields.map(field => (
                <div key={field.key} className={styles.metaItem}>
                  <span className={styles.metaLabel}>{field.label}</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={sheet[field.key] as string}
                      onChange={event => patchSheet({ [field.key]: event.target.value } as Partial<CharacterSheet>)}
                    />
                  ) : (
                    <span className={styles.metaValue}>{viewSheet[field.key] as string}</span>
                  )}
                </div>
              ))}
            </div>

            {isEditor && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={handleFileChange}
                />
                <button type="button" className={styles.fileButton} onClick={() => fileInputRef.current?.click()}>
                  {imageUrl ? s.replacePhoto : s.uploadPhoto}
                </button>
              </>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{s.timelineHeading}</h3>
          <div className={styles.driveGrid}>
            <div className={styles.driveRow}>
              <span className={styles.driveLabel}>{s.birthYearLabel}</span>
              {isEditing ? (
                <input
                  type="number"
                  value={sheet.birthYear ?? ''}
                  placeholder={s.birthYearUnset}
                  onChange={event => patchSheet({ birthYear: event.target.value === '' ? null : Number(event.target.value) })}
                />
              ) : (
                <span className={styles.driveValue}>{viewSheet.birthYear ?? s.birthYearUnset}</span>
              )}
            </div>
            <div className={styles.driveRow}>
              <span className={styles.driveLabel}>{s.birthDateLabelLabel}</span>
              {isEditing ? (
                <input
                  type="text"
                  placeholder={s.birthDateLabelPlaceholder}
                  value={sheet.birthDateLabel}
                  onChange={event => patchSheet({ birthDateLabel: event.target.value })}
                />
              ) : (
                <span className={styles.driveValue}>{viewSheet.birthDateLabel || s.dash}</span>
              )}
            </div>
            <div className={styles.driveRow}>
              <span className={styles.driveLabel}>{s.bornAsLabel}</span>
              {isEditing ? (
                <select value={sheet.baseKind} onChange={event => patchSheet({ baseKind: event.target.value as CharacterKind })}>
                  {(Object.keys(CHARACTER_KIND_LABELS) as CharacterKind[]).map(kind => (
                    <option key={kind} value={kind}>{characterKindLabel(kind, language)}</option>
                  ))}
                </select>
              ) : (
                <span className={styles.driveValue}>{characterKindLabel(viewSheet.baseKind, language)}</span>
              )}
            </div>
          </div>

          {sheet.events.length === 0 && !isEditing && <p className={styles.emptyHint}>{s.noEvents}</p>}
          {isEditing && <p className={styles.eventRelationshipNote}>{s.eventDateHint}</p>}
          {isEditing && sheet.events.map(event => (
            <div key={event.id} className={styles.timelineEventRow}>
              <div className={styles.timelineEventFields}>
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
                  value={event.kind ?? ''}
                  onChange={changeEvent => updateEvent(event.id, {
                    kind: changeEvent.target.value ? changeEvent.target.value as CharacterKind : undefined,
                  })}
                >
                  <option value="">{s.eventKindNoChange}</option>
                  {(Object.keys(CHARACTER_KIND_LABELS) as CharacterKind[]).map(kind => (
                    <option key={kind} value={kind}>{s.eventBecame(characterKindLabel(kind, language))}</option>
                  ))}
                </select>
                <select
                  value={event.alive === undefined ? '' : String(event.alive)}
                  onChange={changeEvent => updateEvent(event.id, {
                    alive: changeEvent.target.value === '' ? undefined : changeEvent.target.value === 'true',
                  })}
                >
                  <option value="">{s.eventStatusNoChange}</option>
                  <option value="false">{s.eventDied}</option>
                  <option value="true">{s.eventAliveAgain}</option>
                </select>
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => removeEvent(event.id)}
                  aria-label={s.ariaRemoveEvent}
                >
                  ×
                </button>
              </div>
              <textarea
                rows={2}
                placeholder={s.eventDescriptionPlaceholder}
                value={event.description}
                onChange={changeEvent => updateEvent(event.id, { description: changeEvent.target.value })}
              />
              <EventRelationshipsEditor
                event={event}
                targets={relationshipTargets}
                drafts={eventRelationships.filter(draft => draft.eventId === event.id)}
                language={language}
                onAdd={() => addEventRelationship(event.id)}
                onChange={updateEventRelationship}
                onRemove={removeEventRelationship}
              />
            </div>
          ))}
          {!isEditing && sortDated(viewSheet.events).map(event => {
            const eventLines = displayRelationships.filter(relationship => relationship.events.some(
              relationshipEvent => relationshipEvent.sourceEventId === event.id,
            ))
            return (
              <div key={event.id} className={styles.timelineEventRow}>
                <div className={styles.timelineEventView}>
                  <span className={styles.timelineYearBadge}>{formatEventDate(event, language)}</span>
                  <div>
                    <p className={styles.timelineEventTitle}>
                      {event.title || s.eventFallbackTitle}
                      {event.kind && s.eventBecameSuffix(characterKindLabel(event.kind, language))}
                      {event.alive === false && s.eventDiedSuffix}
                      {event.alive === true && s.eventAliveSuffix}
                    </p>
                    {event.description && <p className={styles.timelineEventDescription}>{event.description}</p>}
                    {eventLines.length > 0 && (
                      <p className={styles.eventRelationshipView}>
                        {s.eventRelationshipsViewLabel}{' '}
                        {eventLines.map((relationship, index) => {
                          const other = characters.find(item => item.id === (
                            relationship.fromCharacterId === character.id ? relationship.toCharacterId : relationship.fromCharacterId
                          ))
                          const arrow = relationship.kind === 'mutual'
                            ? '↔'
                            : relationship.fromCharacterId === character.id ? '→' : '←'
                          return (
                            <span key={relationship.id}>
                              {index > 0 && ', '}
                              <button
                                type="button"
                                className={styles.linkButton}
                                onClick={() => onSelectRelationship(relationship.id)}
                              >
                                {arrow} {other?.name ?? '—'} — {relationship.label}
                              </button>
                            </span>
                          )
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {isEditing && (
            <button type="button" className={styles.addButton} onClick={addEvent}>{s.addEventButton}</button>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{s.ambitionDesireHeading}</h3>
          <div className={styles.driveGrid}>
            <div className={styles.driveRow}>
              <span className={styles.driveLabel}>{s.ambitionLabel}</span>
              {isEditing ? (
                <input type="text" value={sheet.ambition} onChange={event => patchSheet({ ambition: event.target.value })} />
              ) : (
                <span className={styles.driveValue}>{viewSheet.ambition || s.dash}</span>
              )}
            </div>
            <div className={styles.driveRow}>
              <span className={styles.driveLabel}>{s.desireLabel}</span>
              {isEditing ? (
                <input type="text" value={sheet.desire} onChange={event => patchSheet({ desire: event.target.value })} />
              ) : (
                <span className={styles.driveValue}>{viewSheet.desire || s.dash}</span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{s.attributesHeading}</h3>
          <div className={styles.traitGrid}>
            {ATTRIBUTE_GROUPS.map(group => (
              <div key={group.title}>
                <p className={styles.traitGroupTitle}>{groupTitle(group.title, language)}</p>
                {group.keys.map(([key, label]) => (
                  <div key={key} className={styles.traitRow}>
                    <span>{attributeLabel(key, language, label)}</span>
                    <DotRating
                      value={sheet.attributes[key] ?? 0}
                      max={DOT_MAX}
                      onChange={isEditing ? value => patchSheet({ attributes: { ...sheet.attributes, [key]: value } }) : undefined}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{s.skillsHeading}</h3>
          <div className={styles.traitGrid}>
            {SKILL_GROUPS.map(group => (
              <div key={group.title}>
                <p className={styles.traitGroupTitle}>{groupTitle(group.title, language)}</p>
                {group.keys.map(([key, label]) => (
                  <div key={key} className={styles.traitRow}>
                    <span>{skillLabel(key, language, label)}</span>
                    <DotRating
                      value={sheet.skills[key] ?? 0}
                      max={DOT_MAX}
                      size="small"
                      onChange={isEditing ? value => patchSheet({ skills: { ...sheet.skills, [key]: value } }) : undefined}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{s.disciplinesHeading}</h3>
          {sheet.disciplines.length === 0 && !isEditing && <p className={styles.emptyHint}>{s.noDisciplines}</p>}
          {isEditing && sheet.disciplines.map(discipline => (
            <div key={discipline.id} className={styles.disciplineRow}>
              <input
                type="text"
                className={styles.disciplineNameInput}
                placeholder={s.disciplineNamePlaceholder}
                value={discipline.name}
                onChange={event => updateDiscipline(discipline.id, { name: event.target.value })}
              />
              <DotRating
                value={discipline.level}
                max={DOT_MAX}
                onChange={value => updateDiscipline(discipline.id, { level: value })}
              />
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => removeDiscipline(discipline.id)}
                aria-label={s.ariaRemoveDiscipline}
              >
                ×
              </button>
            </div>
          ))}
          {!isEditing && viewSheet.disciplines.map(discipline => (
            <div key={discipline.id} className={styles.disciplineRow}>
              <span className={styles.disciplineName}>{discipline.name || s.dash}</span>
              <DotRating value={discipline.level} max={DOT_MAX} />
            </div>
          ))}
          {isEditing && (
            <button type="button" className={styles.addButton} onClick={addDiscipline}>{s.addDisciplineButton}</button>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{s.trackersHeading}</h3>
          <div className={styles.trackerGrid}>
            <div className={styles.trackerRow}>
              <span className={styles.trackerLabel}>{s.healthLabel}</span>
              <TrackBoxes track={sheet.health} language={language} onChange={isEditing ? value => patchSheet({ health: value }) : undefined} />
            </div>
            <div className={styles.trackerRow}>
              <span className={styles.trackerLabel}>{s.willpowerLabel}</span>
              <TrackBoxes track={sheet.willpower} language={language} onChange={isEditing ? value => patchSheet({ willpower: value }) : undefined} />
            </div>
            <div className={styles.trackerRow}>
              <span className={styles.trackerLabel}>{s.humanityLabel}</span>
              <DotRating
                value={sheet.humanity}
                max={HUMANITY_MAX}
                onChange={isEditing ? value => patchSheet({ humanity: value }) : undefined}
              />
              <div className={styles.stainsRow}>
                {s.stainsLabel}
                <DotRating
                  value={sheet.stains}
                  max={STAINS_MAX}
                  size="small"
                  onChange={isEditing ? value => patchSheet({ stains: value }) : undefined}
                />
              </div>
            </div>
            <div className={styles.trackerRow}>
              <span className={styles.trackerLabel}>{s.bloodPotencyLabel}</span>
              <DotRating
                value={sheet.bloodPotency}
                max={BLOOD_POTENCY_MAX}
                onChange={isEditing ? value => patchSheet({ bloodPotency: value }) : undefined}
              />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{s.touchstonesHeading}</h3>
          {isEditing ? (
            <textarea
              rows={3}
              value={sheet.touchstones}
              onChange={event => patchSheet({ touchstones: event.target.value })}
              className={styles.field}
              style={{ width: '100%' }}
            />
          ) : (
            <p className={styles.longText}>{viewSheet.touchstones || s.dash}</p>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{s.meritsFlawsHeading}</h3>
          {isEditing ? (
            <>
              <div className={styles.field}>
                <label>{s.meritsLabel}</label>
                <textarea rows={3} value={sheet.merits} onChange={event => patchSheet({ merits: event.target.value })} />
              </div>
              <div className={styles.field}>
                <label>{s.flawsLabel}</label>
                <textarea rows={3} value={sheet.flaws} onChange={event => patchSheet({ flaws: event.target.value })} />
              </div>
            </>
          ) : (
            <>
              <p className={styles.longText}>{viewSheet.merits || s.dash}</p>
              {viewSheet.flaws && <p className={styles.longText}>{viewSheet.flaws}</p>}
            </>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{s.backstoryHeading}</h3>
          {isEditing ? (
            <textarea
              rows={8}
              value={description}
              maxLength={CHARACTER_DESCRIPTION_MAX_LENGTH}
              onChange={event => setDescription(event.target.value)}
              style={{ width: '100%' }}
            />
          ) : (
            <p className={styles.longText}>{displayCharacter.description || s.dash}</p>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{s.galleryHeading}</h3>
          {sheet.gallery.length === 0 && !isEditor && <p className={styles.emptyHint}>{s.noPhotosViewer}</p>}
          {sheet.gallery.length === 0 && isEditor && (
            <p className={styles.emptyHint}>{s.noPhotosEditor}</p>
          )}
          {isEditor && sheet.gallery.length > 0 && (
            <div className={styles.galleryGrid}>
              {sheet.gallery.map(item => (
                <div key={item.id} className={styles.galleryCard}>
                  <button
                    type="button"
                    className={styles.galleryThumb}
                    onClick={() => setLightboxUrl(getGalleryImageUrl(item.imagePath))}
                  >
                    <img src={getGalleryImageUrl(item.imagePath)} alt={item.caption || s.fallbackAlt} />
                  </button>
                  <div className={styles.galleryCardRow}>
                    <select
                      className={styles.galleryCategorySelect}
                      value={item.category}
                      onChange={event => handleGalleryCategoryChange(item, event.target.value as GalleryCategory)}
                    >
                      {(Object.keys(GALLERY_CATEGORY_LABELS) as GalleryCategory[]).map(category => (
                        <option key={category} value={category}>{galleryCategoryLabel(category, language)}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => handleRemoveGalleryItem(item.id)}
                      aria-label={s.ariaRemovePhoto}
                      disabled={isBusy}
                    >
                      ×
                    </button>
                  </div>
                  <input
                    type="text"
                    className={styles.galleryCaptionInput}
                    placeholder={s.captionPlaceholder}
                    value={item.caption}
                    onChange={event => updateGalleryDraft(item.id, { caption: event.target.value })}
                    onBlur={() => commitGalleryCaption(item)}
                  />
                </div>
              ))}
            </div>
          )}
          {!isEditor && viewSheet.gallery.length > 0 && (
            <div className={styles.galleryGrid}>
              {viewSheet.gallery.map(item => (
                <div key={item.id} className={styles.galleryCard}>
                  <button
                    type="button"
                    className={styles.galleryThumb}
                    onClick={() => setLightboxUrl(getGalleryImageUrl(item.imagePath))}
                  >
                    <img src={getGalleryImageUrl(item.imagePath)} alt={item.caption || s.fallbackAlt} />
                  </button>
                  <span className={styles.galleryCategoryBadge}>{galleryCategoryLabel(item.category, language)}</span>
                  {item.caption && <p className={styles.galleryCaption}>{item.caption}</p>}
                </div>
              ))}
            </div>
          )}
          {isEditor && (
            <>
              <input
                ref={galleryFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={handleGalleryFileChange}
              />
              <button
                type="button"
                className={styles.addButton}
                onClick={() => galleryFileInputRef.current?.click()}
                disabled={isBusy}
              >
                {s.addGalleryPhoto}
              </button>
            </>
          )}
        </div>

        <div className={styles.section}>
          {error && <p className={styles.errorText}>{error}</p>}
          {isEditor && (
            <div className={styles.actions}>
              {isEditing ? (
                <>
                  <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={isBusy}>
                    {t(language).common.save}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setName(character.name)
                      setDescription(character.description)
                      setSheet(withSheetDefaults(character.sheet))
                      setIsEditing(false)
                    }}
                    disabled={isBusy}
                  >
                    {t(language).common.cancel}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={styles.secondaryButton} onClick={() => setIsEditing(true)}>
                    {t(language).common.edit}
                  </button>
                  <button type="button" className={styles.dangerButton} onClick={handleDelete} disabled={isBusy}>
                    {t(language).common.delete}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {lightboxUrl && (
        <div
          className={styles.lightboxOverlay}
          onClick={event => {
            event.stopPropagation()
            setLightboxUrl(null)
          }}
        >
          <img src={lightboxUrl} alt="" className={styles.lightboxImage} />
        </div>
      )}
    </div>
  )
}
