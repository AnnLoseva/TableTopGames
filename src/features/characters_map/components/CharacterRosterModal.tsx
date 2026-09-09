'use client'

import { isCharacterBornAt } from '../timeline'
import type { MapCharacter } from '../types'
import modalStyles from './Modal.module.css'
import styles from './CharacterRosterModal.module.css'

type Props = {
  characters: MapCharacter[]
  timelineYear: number | null
  onSelect: (id: string) => void
  onClose: () => void
}

export default function CharacterRosterModal({ characters, timelineYear, onSelect, onClose }: Props) {
  const sorted = [...characters].sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.modal} onClick={event => event.stopPropagation()}>
        <h2 className={modalStyles.title}>Все персонажи</h2>
        <p className={styles.hint}>
          Персонажи, ещё не рождённые на текущий год шкалы времени, не видны на карте —
          откройте их отсюда, например, чтобы задать дату рождения.
        </p>
        <div className={styles.list}>
          {sorted.map(character => {
            const visible = isCharacterBornAt(character, timelineYear)
            return (
              <button
                key={character.id}
                type="button"
                className={styles.row}
                onClick={() => { onSelect(character.id); onClose() }}
              >
                <span>{character.name}</span>
                {!visible && <span className={styles.hiddenTag}>не рождён(а) ещё</span>}
              </button>
            )
          })}
        </div>
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondaryButton} onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}
