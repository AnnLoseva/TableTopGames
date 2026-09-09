'use client'

import { useEffect, useRef, useState } from 'react'
import type { MapCharacter } from '../types'
import { CHARACTER_DESCRIPTION_MAX_LENGTH, CHARACTER_NAME_MAX_LENGTH } from '../constants'
import styles from './SidePanel.module.css'

type Props = {
  character: MapCharacter
  imageUrl: string | null
  isEditor: boolean
  onClose: () => void
  onSave: (patch: { name: string; description: string }) => Promise<void>
  onUploadImage: (file: File) => Promise<void>
  onDelete: () => Promise<void>
}

export default function CharacterPanel({
  character,
  imageUrl,
  isEditor,
  onClose,
  onSave,
  onUploadImage,
  onDelete,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(character.name)
  const [description, setDescription] = useState(character.description)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(character.name)
    setDescription(character.description)
    setIsEditing(false)
    setError('')
  }, [character.id, character.name, character.description])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Введите имя персонажа.')
      return
    }
    setIsBusy(true)
    setError('')
    try {
      await onSave({ name: name.trim(), description })
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

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span />
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <div className={styles.body}>
        <div className={styles.portraitWrap}>
          {imageUrl ? <img src={imageUrl} alt={character.name} /> : (character.name.trim().slice(0, 1).toUpperCase() || '?')}
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
            <button
              type="button"
              className={styles.fileButton}
              onClick={() => fileInputRef.current?.click()}
            >
              {imageUrl ? 'Заменить фото' : 'Загрузить фото'}
            </button>
          </>
        )}

        {!isEditing && (
          <>
            <h2 className={styles.name}>{character.name}</h2>
            {character.description && <p className={styles.description}>{character.description}</p>}
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
              <label htmlFor="character-name">Имя</label>
              <input
                id="character-name"
                type="text"
                value={name}
                maxLength={CHARACTER_NAME_MAX_LENGTH}
                onChange={event => setName(event.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="character-description">Описание</label>
              <textarea
                id="character-description"
                rows={8}
                value={description}
                maxLength={CHARACTER_DESCRIPTION_MAX_LENGTH}
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
