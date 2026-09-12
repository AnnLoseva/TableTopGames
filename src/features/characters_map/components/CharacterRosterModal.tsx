'use client'

import { isCharacterBornAt, type TimelineMoment } from '../timeline'
import { t, type MapLanguage } from '../i18n'
import type { MapCharacter } from '../types'
import modalStyles from './Modal.module.css'
import styles from './CharacterRosterModal.module.css'

type Props = {
  characters: MapCharacter[]
  language: MapLanguage
  timelineMoment: TimelineMoment | null
  onSelect: (id: string) => void
  onClose: () => void
}

export default function CharacterRosterModal({ characters, language, timelineMoment, onSelect, onClose }: Props) {
  const s = t(language).characterRosterModal
  const sorted = [...characters].sort((a, b) => a.name.localeCompare(b.name, language === 'en' ? 'en' : 'ru'))

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.modal} onClick={event => event.stopPropagation()}>
        <h2 className={modalStyles.title}>{s.title}</h2>
        <p className={styles.hint}>{s.hint}</p>
        <div className={styles.list}>
          {sorted.map(character => {
            const visible = isCharacterBornAt(character, timelineMoment)
            return (
              <button
                key={character.id}
                type="button"
                className={styles.row}
                onClick={() => { onSelect(character.id); onClose() }}
              >
                <span>{character.name}</span>
                {!visible && <span className={styles.hiddenTag}>{s.notBornYetTag}</span>}
              </button>
            )
          })}
        </div>
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondaryButton} onClick={onClose}>{s.close}</button>
        </div>
      </div>
    </div>
  )
}
