'use client'

import { useState } from 'react'
import type { MapCharacter, RelationshipKind } from '../types'
import { DEFAULT_RELATIONSHIP_COLOR, RELATIONSHIP_DESCRIPTION_MAX_LENGTH, RELATIONSHIP_LABEL_MAX_LENGTH } from '../constants'
import styles from './Modal.module.css'

type Props = {
  characters: MapCharacter[]
  initialFromId?: string | null
  initialToId?: string | null
  onClose: () => void
  onCreate: (input: {
    fromCharacterId: string
    toCharacterId: string
    kind: RelationshipKind
    label: string
    description: string
    color: string
  }) => Promise<void>
}

export default function AddRelationshipModal({ characters, initialFromId, initialToId, onClose, onCreate }: Props) {
  const [fromId, setFromId] = useState(initialFromId || characters[0]?.id || '')
  const [toId, setToId] = useState(
    initialToId || characters.find(c => c.id !== (initialFromId || characters[0]?.id))?.id || '',
  )
  const [kind, setKind] = useState<RelationshipKind>('directed')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(DEFAULT_RELATIONSHIP_COLOR)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!fromId || !toId) {
      setError('Выберите обоих персонажей.')
      return
    }
    if (fromId === toId) {
      setError('Персонажи должны быть разными.')
      return
    }
    if (!label.trim()) {
      setError('Введите название отношения.')
      return
    }
    setIsBusy(true)
    setError('')
    try {
      await onCreate({
        fromCharacterId: fromId,
        toCharacterId: toId,
        kind,
        label: label.trim(),
        description,
        color,
      })
      onClose()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Не удалось создать связь.')
      setIsBusy(false)
    }
  }

  const fromCharacter = characters.find(c => c.id === fromId)
  const toCharacter = characters.find(c => c.id === toId)

  return (
    <div className={styles.overlay} onClick={onClose}>
      <form className={styles.modal} onClick={event => event.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.title}>Новая связь</h2>

        <div className={styles.field}>
          <label htmlFor="rel-from">От кого</label>
          <select id="rel-from" value={fromId} onChange={event => setFromId(event.target.value)}>
            {characters.map(character => (
              <option key={character.id} value={character.id}>{character.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="rel-to">К кому</label>
          <select id="rel-to" value={toId} onChange={event => setToId(event.target.value)}>
            {characters.map(character => (
              <option key={character.id} value={character.id}>{character.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="rel-kind">Тип связи</label>
          <select id="rel-kind" value={kind} onChange={event => setKind(event.target.value as RelationshipKind)}>
            <option value="directed">
              Направленная{fromCharacter && toCharacter ? ` (${fromCharacter.name} → ${toCharacter.name})` : ''}
            </option>
            <option value="mutual">Взаимная — одинаковая в обе стороны (команда, брак и т.п.)</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="rel-label">Название</label>
          <input
            id="rel-label"
            type="text"
            autoFocus
            placeholder="Например: любит, боится, командир"
            value={label}
            maxLength={RELATIONSHIP_LABEL_MAX_LENGTH}
            onChange={event => setLabel(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="rel-color">Цвет стрелки</label>
          <input id="rel-color" type="color" value={color} onChange={event => setColor(event.target.value)} />
        </div>

        <div className={styles.field}>
          <label htmlFor="rel-description">Описание</label>
          <textarea
            id="rel-description"
            rows={4}
            value={description}
            maxLength={RELATIONSHIP_DESCRIPTION_MAX_LENGTH}
            onChange={event => setDescription(event.target.value)}
          />
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.actions}>
          <button type="submit" className={styles.primaryButton} disabled={isBusy || characters.length < 2}>
            {isBusy ? 'Создаю…' : 'Создать'}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isBusy}>
            Отмена
          </button>
        </div>
        {characters.length < 2 && <p className={styles.errorText}>Сначала добавьте хотя бы двух персонажей.</p>}
      </form>
    </div>
  )
}
