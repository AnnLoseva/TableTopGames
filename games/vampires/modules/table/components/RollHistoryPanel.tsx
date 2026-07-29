'use client'

import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import { getDieImage } from '../utils/dice-display'
import { formatTime } from '../utils/display'
import type { CharacterOption, RollMessage, WillpowerRerollDraft } from '../types'
import RollMetaDetails from './RollMeta'
import { WillpowerRerollControls } from './WillpowerRerollControls'

export type RollHistoryPanelProps = {
  rolls: RollMessage[]
  willpowerRerollDraft: WillpowerRerollDraft | null
  chatCharacters: CharacterOption[]
  canUseWillpowerReroll: (roll: RollMessage) => boolean
  onToggleWillpowerRerollDie: (roll: RollMessage, dieId: string) => void
  onSetWillpowerRerollDraft: (draft: WillpowerRerollDraft | null) => void
  onConfirmWillpowerReroll: (roll: RollMessage) => void
  onApplyRollDamage: (roll: RollMessage) => void
}

export default function RollHistoryPanel({
  rolls,
  willpowerRerollDraft,
  chatCharacters,
  canUseWillpowerReroll,
  onToggleWillpowerRerollDie,
  onSetWillpowerRerollDraft,
  onConfirmWillpowerReroll,
  onApplyRollDamage,
}: RollHistoryPanelProps) {
  const { t, tf, lang } = useLang()
  const d10 = (n: number) => (lang === 'en' ? `${n}d10` : `${n}к10`)

  return (
    <section className="roll-list">
      {rolls.length === 0 ? (
        <p className="panel-empty">{t('Бросков пока нет.')}</p>
      ) : (
        rolls.map(roll => {
          const rerollDraftForRoll = willpowerRerollDraft?.rollId === roll.id ? willpowerRerollDraft : null
          const canRerollWithWillpower = canUseWillpowerReroll(roll)
          const contestedRequest = roll.meta?.rollMode === 'contested' && roll.meta.contested?.status === 'requested'
          return (
            <article className={`roll-card ${roll.hidden ? 'hidden-roll' : ''}`} key={roll.id}>
              <div className="roll-meta">
                <strong>{roll.characterName}</strong>
                {roll.hidden ? <span className="roll-hidden-badge">{t('скрытый')}</span> : null}
                <time dateTime={roll.createdAt}>{formatTime(roll.createdAt)}</time>
              </div>
              <span className="roll-pool">{t(roll.poolName)}</span>

              {contestedRequest ? (
                <div className="contested-request-result">
                  <strong>{t('Запрошен встречный бросок')}</strong>
                  <span>{tf('Пул инициатора: {pool}, {count}.', { pool: roll.meta?.contested?.initiatorPoolName || d10(roll.diceCount), count: d10(roll.meta?.contested?.initiatorDiceCount || roll.diceCount) })}</span>
                  <span>{tf('Оппонент: {name}.', { name: roll.meta?.contested?.opponentName || t('не выбран') })}</span>
                  <small>{t('Ожидается ответный бросок.')}</small>
                </div>
              ) : roll.poolType === 'humanity-event' ? (
                <div className="humanity-history-event">{t('Событие Человечности')}</div>
              ) : roll.opposed ? (
                <div className="opposed-roll-result">
                  <strong className={`opposed-result-badge outcome-${roll.opposed.outcome}`}>{roll.opposed.summary}</strong>
                  {roll.opposed.sides.map(side => {
                    const sideOutcome = roll.opposed?.winnerSideId === side.id ? 'winner' : roll.opposed?.winnerSideId ? 'loser' : 'tie'
                    return (
                      <section className={`opposed-result-side ${sideOutcome}`} key={`${roll.id}-${side.id}`}>
                        <div>
                          <strong>{side.actorName}</strong>
                          <span>{t(side.poolName)}</span>
                        </div>
                        <div className="dice-row" aria-label={tf('Результаты кубиков {actor}: {values}', { actor: side.actorName, values: side.dice.map(die => die.value).join(', ') })}>
                          {side.dice.map((die, index) => {
                            const dieImage = getDieImage(die)
                            const dieLabel = t(dieImage.label)
                            return (
                              <span
                                className={`die die-${die.kind}`}
                                key={`${roll.id}-${side.id}-${index}`}
                                aria-label={`${dieLabel}: ${die.value}`}
                                title={`${die.value} - ${dieLabel}`}
                              >
                                <img src={dieImage.src} alt="" draggable={false} />
                              </span>
                            )
                          })}
                        </div>
                        <footer>
                          <span>{d10(side.diceCount)}</span>
                          <strong>{side.successes}</strong>
                        </footer>
                      </section>
                    )
                  })}
                </div>
              ) : (
                <>
                  <WillpowerRerollControls
                    roll={roll}
                    canReroll={canRerollWithWillpower}
                    draft={rerollDraftForRoll}
                    onToggleDie={dieId => onToggleWillpowerRerollDie(roll, dieId)}
                    onStartReroll={() => onSetWillpowerRerollDraft({ rollId: roll.id, selectedDieIds: [] })}
                    onCancelReroll={() => onSetWillpowerRerollDraft(null)}
                    onConfirmReroll={() => onConfirmWillpowerReroll(roll)}
                  />
                  {!['health', 'rouse-check', 'remorse-check', 'humanity-event'].includes(roll.poolType) && !contestedRequest && chatCharacters.length ? (
                    <div className="roll-health-actions">
                      <button type="button" onClick={() => onApplyRollDamage(roll)}>
                        {t('Применить урон к цели')}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
              {roll.opposed && chatCharacters.length ? (
                <div className="roll-health-actions">
                  <button type="button" onClick={() => onApplyRollDamage(roll)}>
                    {t('Применить урон к цели')}
                  </button>
                </div>
              ) : null}
              <RollMetaDetails roll={roll} />
            </article>
          )
        })
      )}
    </section>
  )
}