'use client'

import { useState } from 'react'
import { CHARACTER_DESCRIPTION_MAX_LENGTH, CHARACTER_NAME_MAX_LENGTH } from '../constants'
import styles from './Modal.module.css'

type Props = {
  onClose: () => void
  onCreate: (input: { name: string; description: string; file: File | null }) => Promise<void>
}

export default function AddCharacterModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Введите имя персонажа.')
      return
    }
    setIsBusy(true)
    setError('')
    try {
      await onCreate({ name: name.trim(), description, file })
      onClose()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Не удалось создать персонажа.')
      setIsBusy(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <form className={styles.modal} onClick={event => event.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.title}>Новый персонаж</h2>

        <div className={styles.field}>
          <label htmlFor="new-character-name">Имя</label>
          <input
            id="new-character-name"
            type="text"
            autoFocus
            value={name}
            maxLength={CHARACTER_NAME_MAX_LENGTH}
            onChange={event => setName(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="new-character-description">Описание</label>
          <textarea
            id="new-character-description"
            rows={5}
            value={description}
            maxLength={CHARACTER_DESCRIPTION_MAX_LENGTH}
            onChange={event => setDescription(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="new-character-image">Фото (необязательно)</label>
          <input
            id="new-character-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={event => setFile(event.target.files?.[0] ?? null)}
          />
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.actions}>
          <button type="submit" className={styles.primaryButton} disabled={isBusy}>
            {isBusy ? 'Создаю…' : 'Создать'}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isBusy}>
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}
