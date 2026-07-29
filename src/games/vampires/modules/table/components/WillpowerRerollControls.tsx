'use client'

import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import { getDieImage } from '../utils/dice-display'
import { getRollDieId } from '../utils/roll-utils'
import type { RollMessage, WillpowerRerollDraft } from '../types'

export type WillpowerRerollControlsProps = {
  roll: RollMessage
  canReroll: boolean
  draft: WillpowerRerollDraft | null
  onToggleDie: (dieId: string) => void
  onStartReroll: () => void
  onCancelReroll: () => void
  onConfirmReroll: () => void
}

export function WillpowerRerollControls({
  roll,
  canReroll,
  draft,
  onToggleDie,
  onStartReroll,
  onCancelReroll,
  onConfirmReroll,
}: WillpowerRerollControlsProps) {
  const { t, tf } = useLang()
  const d10 = (n: number) => tf('{n}к10', { n })

  return (
    <>
      <div className="dice-row" aria-label={tf('Результаты кубиков: {values}', { values: roll.dice.map(die => die.value).join(', ') })}>
        {roll.dice.map((die, index) => {
          const dieImage = getDieImage(die)
          const dieLabel = t(dieImage.label)
          const dieId = getRollDieId(roll, index)
          const rerollSelectable = canReroll && !String(die.kind).startsWith('hunger')
          const rerollSelected = Boolean(draft?.selectedDieIds.includes(dieId))
          return (
            <span
              className={`die die-${die.kind}${die.rerolled ? ' die-rerolled' : ''}${rerollSelectable ? ' reroll-selectable' : ''}${rerollSelected ? ' reroll-selected' : ''}`}
              key={`${roll.id}-${index}`}
              aria-label={`${dieLabel}: ${die.value}`}
              title={rerollSelectable ? tf('{value} - {label}. Выбрать для переброса Воли', { value: die.value, label: dieLabel }) : `${die.value} - ${dieLabel}`}
              onClick={rerollSelectable ? () => onToggleDie(dieId) : undefined}
            >
              <img src={dieImage.src} alt="" draggable={false} />
            </span>
          )
        })}
      </div>

      <footer>
        <span>{d10(roll.diceCount)}</span>
        <strong>{roll.successes}</strong>
      </footer>

      {canReroll ? (
        <div className="roll-reroll-actions">
          {draft ? (
            <>
              <button type="button" onClick={onCancelReroll}>
                {t('Отмена')}
              </button>
              <span>{tf('Выбрано {n} / 3', { n: draft.selectedDieIds.length })}</span>
              <button type="button" onClick={onConfirmReroll} disabled={draft.selectedDieIds.length < 1}>
                {t('Перебросить за Волю')}
              </button>
            </>
          ) : (
            <button type="button" onClick={onStartReroll}>
              {t('Переброс Воли')}
            </button>
          )}
        </div>
      ) : null}
    </>
  )
}