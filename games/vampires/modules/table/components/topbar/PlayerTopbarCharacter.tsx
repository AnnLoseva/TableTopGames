'use client'

import type { ChangeEvent } from 'react'
import type { CharacterOption } from '@/games/vampires/modules/table/types'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'

type PlayerTopbarCharacterProps = {
  selectedActiveCharacter: CharacterOption | null
  chatCharacters: CharacterOption[]
  selectedChatCharacterId: string
  chatUser: { id: string } | null
  chooseActiveCharacter: (characterId: string) => void
  openCharacterPreview: (character: CharacterOption) => void | Promise<void>
  characterSheetHref: (characterId?: string | null) => string
  onNeedCharacter: () => void
}

export default function PlayerTopbarCharacter({
  selectedActiveCharacter,
  chatCharacters,
  selectedChatCharacterId,
  chatUser,
  chooseActiveCharacter,
  openCharacterPreview,
  characterSheetHref,
  onNeedCharacter,
}: PlayerTopbarCharacterProps) {
  const { t } = useLang()

  const onSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    chooseActiveCharacter(event.target.value)
  }

  return (
    <div className="tbl-char player-topbar-char" aria-label={t('Активный персонаж')}>
      <span className="tbl-char-sigil" aria-hidden="true">
        {selectedActiveCharacter?.image ? (
          <img src={selectedActiveCharacter.image} alt="" />
        ) : (
          <span>{(selectedActiveCharacter?.name || '?').slice(0, 1).toUpperCase()}</span>
        )}
      </span>
      <span className="tbl-char-body">
        <strong>{selectedActiveCharacter?.name || t('Персонаж не выбран')}</strong>
        <span>{selectedActiveCharacter?.clan || (chatUser ? t('без клана') : t('войдите в аккаунт'))}</span>
      </span>
      <label className="tbl-char-select-wrap">
        <span className="sr-only">{t('Смена персонажа')}</span>
        <select
          className="tbl-char-select"
          value={selectedChatCharacterId}
          onChange={onSelectChange}
          disabled={!chatUser || chatCharacters.length === 0}
          title={t('Смена персонажа')}
        >
          {!selectedChatCharacterId && chatCharacters.length > 0 ? <option value="">{t('Выбери персонажа')}</option> : null}
          {chatCharacters.length === 0 ? <option value="">{t('Нет сохранённых персонажей')}</option> : null}
          {chatCharacters.map(character => (
            <option value={character.id} key={character.id}>
              {character.name}{character.clan ? ` · ${character.clan}` : ''}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="tbl-char-action"
        onClick={() => (selectedActiveCharacter ? void openCharacterPreview(selectedActiveCharacter) : onNeedCharacter())}
        disabled={!selectedActiveCharacter}
        title={t('Быстрый просмотр')}
      >
        {t('Быстрый')}
      </button>
      <a
        className="tbl-char-action"
        href={characterSheetHref(selectedActiveCharacter?.id)}
        title={t('Открыть полный лист')}
      >
        {t('Лист')} ↗
      </a>
    </div>
  )
}
