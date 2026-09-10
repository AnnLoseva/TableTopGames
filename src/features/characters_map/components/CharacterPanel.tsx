'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ATTRIBUTE_GROUPS,
  BLOOD_POTENCY_MAX,
  CHARACTER_DESCRIPTION_MAX_LENGTH,
  CHARACTER_KIND_LABELS,
  CHARACTER_NAME_MAX_LENGTH,
  DOT_MAX,
  GALLERY_CATEGORY_LABELS,
  HUMANITY_MAX,
  SKILL_GROUPS,
  STAINS_MAX,
  withSheetDefaults,
} from '../constants'
import type { CharacterEvent, CharacterKind, CharacterSheet, Discipline, GalleryCategory, GalleryItem, MapCharacter } from '../types'
import DotRating from './DotRating'
import TrackBoxes from './TrackBoxes'
import styles from './CharacterSheetView.module.css'

type SavePatch = { name: string; description: string; sheet: CharacterSheet }

type Props = {
  character: MapCharacter
  imageUrl: string | null
  isEditor: boolean
  onClose: () => void
  onSave: (patch: SavePatch) => Promise<void>
  onUploadImage: (file: File) => Promise<void>
  onDelete: () => Promise<void>
  getGalleryImageUrl: (imagePath: string) => string
  onAddGalleryItem: (file: File) => Promise<void>
  onUpdateGalleryItem: (itemId: string, patch: Partial<Pick<GalleryItem, 'caption' | 'category'>>) => Promise<void>
  onRemoveGalleryItem: (itemId: string) => Promise<void>
}

const META_FIELDS: { key: keyof CharacterSheet; label: string }[] = [
  { key: 'clan', label: 'Клан' },
  { key: 'generation', label: 'Поколение' },
  { key: 'predatorType', label: 'Хищник' },
  { key: 'sire', label: 'Сир' },
]

export default function CharacterPanel({
  character,
  imageUrl,
  isEditor,
  onClose,
  onSave,
  onUploadImage,
  onDelete,
  getGalleryImageUrl,
  onAddGalleryItem,
  onUpdateGalleryItem,
  onRemoveGalleryItem,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(character.name)
  const [description, setDescription] = useState(character.description)
  const [sheet, setSheet] = useState<CharacterSheet>(() => withSheetDefaults(character.sheet))
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const galleryFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(character.name)
    setDescription(character.description)
    setSheet(withSheetDefaults(character.sheet))
    setIsEditing(false)
    setError('')
    setLightboxUrl(null)
  }, [character.id, character.name, character.description, character.sheet])

  useEffect(() => {
    if (!isEditor) setIsEditing(false)
  }, [isEditor])

  const patchSheet = (patch: Partial<CharacterSheet>) => setSheet(previous => ({ ...previous, ...patch }))

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Введите имя персонажа.')
      return
    }
    setIsBusy(true)
    setError('')
    try {
      await onSave({ name: name.trim(), description, sheet })
      setIsEditing(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить.')
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
      setError(uploadError instanceof Error ? uploadError.message : 'Не удалось загрузить изображение.')
    } finally {
      setIsBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Удалить персонажа «${character.name}»? Все связанные отношения тоже удалятся.`)) return
    setIsBusy(true)
    try {
      await onDelete()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить.')
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
      setError(uploadError instanceof Error ? uploadError.message : 'Не удалось загрузить фото.')
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
      setError(removeError instanceof Error ? removeError.message : 'Не удалось удалить фото.')
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
    const event: CharacterEvent = { id: crypto.randomUUID(), year: new Date().getFullYear(), dateLabel: '', title: '', description: '' }
    patchSheet({ events: [...sheet.events, event] })
  }

  const updateEvent = (id: string, patch: Partial<CharacterEvent>) => {
    patchSheet({ events: sheet.events.map(event => (event.id === id ? { ...event, ...patch } : event)) })
  }

  const removeEvent = (id: string) => {
    patchSheet({ events: sheet.events.filter(event => event.id !== id) })
  }

  const updateGalleryDraft = (id: string, patch: Partial<Pick<GalleryItem, 'caption' | 'category'>>) => {
    patchSheet({ gallery: sheet.gallery.map(item => (item.id === id ? { ...item, ...patch } : item)) })
  }

  const commitGalleryCaption = async (item: GalleryItem) => {
    try {
      await onUpdateGalleryItem(item.id, { caption: item.caption })
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Не удалось сохранить подпись.')
    }
  }

  const handleGalleryCategoryChange = async (item: GalleryItem, category: GalleryCategory) => {
    updateGalleryDraft(item.id, { category })
    try {
      await onUpdateGalleryItem(item.id, { category })
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Не удалось сохранить категорию.')
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={event => event.stopPropagation()}>
        <div className={styles.topBar}>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        <div className={styles.header}>
          <div className={styles.portraitWrap}>
            {imageUrl ? <img src={imageUrl} alt={character.name} /> : (character.name.trim().slice(0, 1).toUpperCase() || '?')}
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
              <h2 className={styles.name}>{character.name}</h2>
            )}

            {isEditing ? (
              <input
                type="text"
                placeholder="Концепция"
                value={sheet.concept}
                onChange={event => patchSheet({ concept: event.target.value })}
                className={styles.nameInput}
                style={{ fontSize: 14, fontWeight: 400, fontStyle: 'italic' }}
              />
            ) : (
              sheet.concept && <p className={styles.concept}>{sheet.concept}</p>
            )}

            <div className={styles.metaGrid}>
              {META_FIELDS.map(field => (
                <div key={field.key} className={styles.metaItem}>
                  <span className={styles.metaLabel}>{field.label}</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={sheet[field.key] as string}
                      onChange={event => patchSheet({ [field.key]: event.target.value } as Partial<CharacterSheet>)}
                    />
                  ) : (
                    <span className={styles.metaValue}>{sheet[field.key] as string}</span>
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
                  {imageUrl ? 'Заменить фото' : 'Загрузить фото'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Линия времени</h3>
          <div className={styles.driveGrid}>
            <div className={styles.driveRow}>
              <span className={styles.driveLabel}>Год рождения</span>
              {isEditing ? (
                <input
                  type="number"
                  value={sheet.birthYear ?? ''}
                  placeholder="не указан"
                  onChange={event => patchSheet({ birthYear: event.target.value === '' ? null : Number(event.target.value) })}
                />
              ) : (
                <span className={styles.driveValue}>{sheet.birthYear ?? 'не указан'}</span>
              )}
            </div>
            <div className={styles.driveRow}>
              <span className={styles.driveLabel}>Дата рождения (текстом)</span>
              {isEditing ? (
                <input
                  type="text"
                  placeholder="например: 12 апреля 1993"
                  value={sheet.birthDateLabel}
                  onChange={event => patchSheet({ birthDateLabel: event.target.value })}
                />
              ) : (
                <span className={styles.driveValue}>{sheet.birthDateLabel || '—'}</span>
              )}
            </div>
            <div className={styles.driveRow}>
              <span className={styles.driveLabel}>Кем родился(-ась)</span>
              {isEditing ? (
                <select value={sheet.baseKind} onChange={event => patchSheet({ baseKind: event.target.value as CharacterKind })}>
                  {(Object.keys(CHARACTER_KIND_LABELS) as CharacterKind[]).map(kind => (
                    <option key={kind} value={kind}>{CHARACTER_KIND_LABELS[kind]}</option>
                  ))}
                </select>
              ) : (
                <span className={styles.driveValue}>{CHARACTER_KIND_LABELS[sheet.baseKind]}</span>
              )}
            </div>
          </div>

          {sheet.events.length === 0 && !isEditing && <p className={styles.emptyHint}>Событий не добавлено.</p>}
          {sheet.events.map(event => (
            <div key={event.id} className={styles.timelineEventRow}>
              {isEditing ? (
                <>
                  <div className={styles.timelineEventFields}>
                    <input
                      type="number"
                      className={styles.timelineYearInput}
                      value={event.year}
                      onChange={changeEvent => updateEvent(event.id, { year: Number(changeEvent.target.value) })}
                    />
                    <input
                      type="text"
                      placeholder="Что случилось"
                      value={event.title}
                      onChange={changeEvent => updateEvent(event.id, { title: changeEvent.target.value })}
                    />
                    <select
                      value={event.kind ?? ''}
                      onChange={changeEvent => updateEvent(event.id, {
                        kind: changeEvent.target.value ? changeEvent.target.value as CharacterKind : undefined,
                      })}
                    >
                      <option value="">Вид: не менять</option>
                      {(Object.keys(CHARACTER_KIND_LABELS) as CharacterKind[]).map(kind => (
                        <option key={kind} value={kind}>Стал(а): {CHARACTER_KIND_LABELS[kind]}</option>
                      ))}
                    </select>
                    <select
                      value={event.alive === undefined ? '' : String(event.alive)}
                      onChange={changeEvent => updateEvent(event.id, {
                        alive: changeEvent.target.value === '' ? undefined : changeEvent.target.value === 'true',
                      })}
                    >
                      <option value="">Статус: не менять</option>
                      <option value="false">Погиб(ла)</option>
                      <option value="true">Жив(а) / воскрес(ла)</option>
                    </select>
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => removeEvent(event.id)}
                      aria-label="Удалить событие"
                    >
                      ×
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Описание события"
                    value={event.description}
                    onChange={changeEvent => updateEvent(event.id, { description: changeEvent.target.value })}
                  />
                </>
              ) : (
                <div className={styles.timelineEventView}>
                  <span className={styles.timelineYearBadge}>{event.year}</span>
                  <div>
                    <p className={styles.timelineEventTitle}>
                      {event.title || 'Событие'}
                      {event.kind && ` — стал(а) ${CHARACTER_KIND_LABELS[event.kind].toLowerCase()}`}
                      {event.alive === false && ' — погиб(ла)'}
                      {event.alive === true && ' — жив(а)'}
                    </p>
                    {event.description && <p className={styles.timelineEventDescription}>{event.description}</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
          {isEditing && (
            <button type="button" className={styles.addButton} onClick={addEvent}>+ Событие</button>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Амбиция и Желание</h3>
          <div className={styles.driveGrid}>
            <div className={styles.driveRow}>
              <span className={styles.driveLabel}>Амбиция</span>
              {isEditing ? (
                <input type="text" value={sheet.ambition} onChange={event => patchSheet({ ambition: event.target.value })} />
              ) : (
                <span className={styles.driveValue}>{sheet.ambition || '—'}</span>
              )}
            </div>
            <div className={styles.driveRow}>
              <span className={styles.driveLabel}>Желание</span>
              {isEditing ? (
                <input type="text" value={sheet.desire} onChange={event => patchSheet({ desire: event.target.value })} />
              ) : (
                <span className={styles.driveValue}>{sheet.desire || '—'}</span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Атрибуты</h3>
          <div className={styles.traitGrid}>
            {ATTRIBUTE_GROUPS.map(group => (
              <div key={group.title}>
                <p className={styles.traitGroupTitle}>{group.title}</p>
                {group.keys.map(([key, label]) => (
                  <div key={key} className={styles.traitRow}>
                    <span>{label}</span>
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
          <h3 className={styles.sectionTitle}>Навыки</h3>
          <div className={styles.traitGrid}>
            {SKILL_GROUPS.map(group => (
              <div key={group.title}>
                <p className={styles.traitGroupTitle}>{group.title}</p>
                {group.keys.map(([key, label]) => (
                  <div key={key} className={styles.traitRow}>
                    <span>{label}</span>
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
          <h3 className={styles.sectionTitle}>Дисциплины</h3>
          {sheet.disciplines.length === 0 && !isEditing && <p className={styles.emptyHint}>Дисциплины не указаны.</p>}
          {sheet.disciplines.map(discipline => (
            <div key={discipline.id} className={styles.disciplineRow}>
              {isEditing ? (
                <input
                  type="text"
                  className={styles.disciplineNameInput}
                  placeholder="Название дисциплины"
                  value={discipline.name}
                  onChange={event => updateDiscipline(discipline.id, { name: event.target.value })}
                />
              ) : (
                <span className={styles.disciplineName}>{discipline.name || '—'}</span>
              )}
              <DotRating
                value={discipline.level}
                max={DOT_MAX}
                onChange={isEditing ? value => updateDiscipline(discipline.id, { level: value }) : undefined}
              />
              {isEditing && (
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => removeDiscipline(discipline.id)}
                  aria-label="Удалить дисциплину"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {isEditing && (
            <button type="button" className={styles.addButton} onClick={addDiscipline}>+ Дисциплина</button>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Трекеры</h3>
          <div className={styles.trackerGrid}>
            <div className={styles.trackerRow}>
              <span className={styles.trackerLabel}>Здоровье</span>
              <TrackBoxes track={sheet.health} onChange={isEditing ? value => patchSheet({ health: value }) : undefined} />
            </div>
            <div className={styles.trackerRow}>
              <span className={styles.trackerLabel}>Сила воли</span>
              <TrackBoxes track={sheet.willpower} onChange={isEditing ? value => patchSheet({ willpower: value }) : undefined} />
            </div>
            <div className={styles.trackerRow}>
              <span className={styles.trackerLabel}>Человечность</span>
              <DotRating
                value={sheet.humanity}
                max={HUMANITY_MAX}
                onChange={isEditing ? value => patchSheet({ humanity: value }) : undefined}
              />
              <div className={styles.stainsRow}>
                Пятна:
                <DotRating
                  value={sheet.stains}
                  max={STAINS_MAX}
                  size="small"
                  onChange={isEditing ? value => patchSheet({ stains: value }) : undefined}
                />
              </div>
            </div>
            <div className={styles.trackerRow}>
              <span className={styles.trackerLabel}>Потенция крови</span>
              <DotRating
                value={sheet.bloodPotency}
                max={BLOOD_POTENCY_MAX}
                onChange={isEditing ? value => patchSheet({ bloodPotency: value }) : undefined}
              />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Точки опоры и убеждения</h3>
          {isEditing ? (
            <textarea
              rows={3}
              value={sheet.touchstones}
              onChange={event => patchSheet({ touchstones: event.target.value })}
              className={styles.field}
              style={{ width: '100%' }}
            />
          ) : (
            <p className={styles.longText}>{sheet.touchstones || '—'}</p>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Достоинства и недостатки</h3>
          {isEditing ? (
            <>
              <div className={styles.field}>
                <label>Достоинства</label>
                <textarea rows={3} value={sheet.merits} onChange={event => patchSheet({ merits: event.target.value })} />
              </div>
              <div className={styles.field}>
                <label>Недостатки</label>
                <textarea rows={3} value={sheet.flaws} onChange={event => patchSheet({ flaws: event.target.value })} />
              </div>
            </>
          ) : (
            <>
              <p className={styles.longText}>{sheet.merits || '—'}</p>
              {sheet.flaws && <p className={styles.longText}>{sheet.flaws}</p>}
            </>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Предыстория</h3>
          {isEditing ? (
            <textarea
              rows={8}
              value={description}
              maxLength={CHARACTER_DESCRIPTION_MAX_LENGTH}
              onChange={event => setDescription(event.target.value)}
              style={{ width: '100%' }}
            />
          ) : (
            <p className={styles.longText}>{description || '—'}</p>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Галерея</h3>
          {sheet.gallery.length === 0 && !isEditor && <p className={styles.emptyHint}>Фото не добавлены.</p>}
          {sheet.gallery.length === 0 && isEditor && (
            <p className={styles.emptyHint}>Дом, питомцы, интересные события — добавьте первое фото.</p>
          )}
          {sheet.gallery.length > 0 && (
            <div className={styles.galleryGrid}>
              {sheet.gallery.map(item => (
                <div key={item.id} className={styles.galleryCard}>
                  <button
                    type="button"
                    className={styles.galleryThumb}
                    onClick={() => setLightboxUrl(getGalleryImageUrl(item.imagePath))}
                  >
                    <img src={getGalleryImageUrl(item.imagePath)} alt={item.caption || 'Фото из галереи'} />
                  </button>
                  {isEditor ? (
                    <>
                      <div className={styles.galleryCardRow}>
                        <select
                          className={styles.galleryCategorySelect}
                          value={item.category}
                          onChange={event => handleGalleryCategoryChange(item, event.target.value as GalleryCategory)}
                        >
                          {(Object.keys(GALLERY_CATEGORY_LABELS) as GalleryCategory[]).map(category => (
                            <option key={category} value={category}>{GALLERY_CATEGORY_LABELS[category]}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={styles.removeButton}
                          onClick={() => handleRemoveGalleryItem(item.id)}
                          aria-label="Удалить фото"
                          disabled={isBusy}
                        >
                          ×
                        </button>
                      </div>
                      <input
                        type="text"
                        className={styles.galleryCaptionInput}
                        placeholder="Подпись"
                        value={item.caption}
                        onChange={event => updateGalleryDraft(item.id, { caption: event.target.value })}
                        onBlur={() => commitGalleryCaption(item)}
                      />
                    </>
                  ) : (
                    <>
                      <span className={styles.galleryCategoryBadge}>{GALLERY_CATEGORY_LABELS[item.category]}</span>
                      {item.caption && <p className={styles.galleryCaption}>{item.caption}</p>}
                    </>
                  )}
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
                + Фото в галерею
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
                    Сохранить
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
                    Отмена
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={styles.secondaryButton} onClick={() => setIsEditing(true)}>
                    Редактировать
                  </button>
                  <button type="button" className={styles.dangerButton} onClick={handleDelete} disabled={isBusy}>
                    Удалить
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
