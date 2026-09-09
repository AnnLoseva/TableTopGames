'use client'

import { useEffect, useState } from 'react'
import type { MapCharacter, MapRelationship, RelationshipKind } from '../types'
import { DEFAULT_RELATIONSHIP_COLOR, RELATIONSHIP_DESCRIPTION_MAX_LENGTH, RELATIONSHIP_LABEL_MAX_LENGTH } from '../constants'
import styles from './SidePanel.module.css'

type Props = {
  relationship: MapRelationship
  from: MapCharacter
  to: MapCharacter
  isEditor: boolean
  onClose: () => void
  onSave: (patch: { label: string; description: string; color: string; kind: RelationshipKind }) => Promise<void>
  onDelete: () => Promise<void>
  onSelectCharacter: (id: string) => void
}

export default function RelationshipPanel({
  relationship,
  from,
  to,
  isEditor,
  onClose,
  onSave,
  onDelete,
  onSelectCharacter,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [label, setLabel] = useState(relationship.label)
  const [description, setDescription] = useState(relationship.description)
  const [color, setColor] = useState(relationship.color || DEFAULT_RELATIONSHIP_COLOR)
  const [kind, setKind] = useState<RelationshipKind>(relationship.kind)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLabel(relationship.label)
    setDescription(relationship.description)
    setColor(relationship.color || DEFAULT_RELATIONSHIP_COLOR)
    setKind(relationship.kind)
    setIsEditing(false)
    setError('')
  }, [relationship.id, relationship.label, relationship.description, relationship.color, relationship.kind])

  useEffect(() => {
    if (!isEditor) setIsEditing(false)
  }, [isEditor])

  const handleSave = async () => {
    if (!label.trim()) {
      setError('Введите название отношения.')
      return
    }
    setIsBusy(true)
    setError('')
    try {
      await onSave({ label: label.trim(), description, color, kind })
      setIsEditing(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить.')
    } finally {
      setIsBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Удалить связь «${relationship.label}»?`)) return
    setIsBusy(true)
    try {
      await onDelete()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить.')
      setIsBusy(false)
    }
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span />
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрыть">×</button>
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
              {relationship.label}
            </h2>
            <p className={styles.description} style={{ textAlign: 'center' }}>
              {relationship.kind === 'mutual' ? 'Взаимное отношение (в обе стороны)' : `${from.name} → ${to.name}`}
            </p>
            {relationship.description && <p className={styles.description}>{relationship.description}</p>}
            {isEditor && (
              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setIsEditing(true)}>
                  Редактировать
                </button>
                <button type="button" className={styles.dangerButton} onClick={handleDelete} disabled={isBusy}>
                  Удалить
                </button>
              </div>
            )}
          </>
        )}

        {isEditing && (
          <>
            <div className={styles.field}>
              <label htmlFor="rel-kind">Тип связи</label>
              <select id="rel-kind" value={kind} onChange={event => setKind(event.target.value as RelationshipKind)}>
                <option value="directed">Направленная ({from.name} → {to.name})</option>
                <option value="mutual">Взаимная (в обе стороны)</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="rel-label">Название</label>
              <input
                id="rel-label"
                type="text"
                value={label}
                maxLength={RELATIONSHIP_LABEL_MAX_LENGTH}
                onChange={event => setLabel(event.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="rel-color">Цвет</label>
              <input id="rel-color" type="color" value={color} onChange={event => setColor(event.target.value)} />
            </div>
            <div className={styles.field}>
              <label htmlFor="rel-description">Описание</label>
              <textarea
                id="rel-description"
                rows={6}
                value={description}
                maxLength={RELATIONSHIP_DESCRIPTION_MAX_LENGTH}
                onChange={event => setDescription(event.target.value)}
              />
            </div>
            {error && <p className={styles.errorText}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={isBusy}>
                Сохранить
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => setIsEditing(false)} disabled={isBusy}>
                Отмена
              </button>
            </div>
          </>
        )}

        {!isEditing && error && <p className={styles.errorText}>{error}</p>}
      </div>
    </aside>
  )
}
