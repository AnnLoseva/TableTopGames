'use client'

import type { ReactNode } from 'react'
import type { DisciplineRollEffectResult } from '@/games/vampires/core/vtm5/rules/disciplines/effects'
import { getActivePenaltyDelta } from '../utils/roll-utils'
import type { RollMode } from '../types'
import { getPoolPartDots } from './character-preview-helpers'
import type { CharacterOption } from '../types'

type PoolChip = {
  key: string
  label: string
  dots: number
  onRemove: () => void
}

type CharacterPreviewRollDockProps = {
  character: CharacterOption
  roll: {
    attribute: string
    attributeTwo: string
    skill: string
    discipline: string
    modifier: number
    mode: RollMode
    contestedOpponentId: string
    useBloodSurge: boolean
  }
  usesVampireResources: boolean
  canRoll: boolean
  diceCount: number
  poolBeforeLimit: number
  bloodSurgeBonus: number
  bloodSurgeEnabled: boolean
  hunger: number
  rollEffectResult: DisciplineRollEffectResult | null
  contestedOpponentOptions: Array<{ id: string; label: string }>
  selectedContestedOpponent: { id: string; label: string } | null
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  setRollModifier: (value: number) => void
  setRollMode: (mode: RollMode) => void
  setContestedOpponentId: (id: string) => void
  setUseBloodSurge: (enabled: boolean) => void
  setRollAttribute: (value: string) => void
  setRollAttributeTwo: (value: string) => void
  setRollSkill: (value: string) => void
  setRollDiscipline: (value: string) => void
  rollPool: () => void
  rollQuickDice: (count: number, label: string) => void
  renderRollModifierControls: (result: DisciplineRollEffectResult | null | undefined) => ReactNode
  showAdvancedControls?: boolean
}

export function CharacterPreviewRollDock({
  character,
  roll,
  usesVampireResources,
  canRoll,
  diceCount,
  poolBeforeLimit,
  bloodSurgeBonus,
  bloodSurgeEnabled,
  hunger,
  rollEffectResult,
  contestedOpponentOptions,
  selectedContestedOpponent,
  t,
  tf,
  setRollModifier,
  setRollMode,
  setContestedOpponentId,
  setUseBloodSurge,
  setRollAttribute,
  setRollAttributeTwo,
  setRollSkill,
  setRollDiscipline,
  rollPool,
  rollQuickDice,
  renderRollModifierControls,
  showAdvancedControls = false,
}: CharacterPreviewRollDockProps) {
  const d10 = (n: number) => tf('{n}к10', { n })
  const finalDice = Math.min(20, diceCount + (bloodSurgeEnabled ? bloodSurgeBonus : 0)) || 0

  const chips: PoolChip[] = [
    roll.attribute ? {
      key: `attr-${roll.attribute}`,
      label: roll.attribute,
      dots: getPoolPartDots(roll.attribute, character),
      onRemove: () => setRollAttribute(''),
    } : null,
    roll.attributeTwo ? {
      key: `attr2-${roll.attributeTwo}`,
      label: roll.attributeTwo,
      dots: getPoolPartDots(roll.attributeTwo, character),
      onRemove: () => setRollAttributeTwo(''),
    } : null,
    roll.skill ? {
      key: `skill-${roll.skill}`,
      label: roll.skill,
      dots: getPoolPartDots(roll.skill, character),
      onRemove: () => setRollSkill(''),
    } : null,
    roll.discipline ? {
      key: `disc-${roll.discipline}`,
      label: roll.discipline,
      dots: getPoolPartDots(roll.discipline, character),
      onRemove: () => setRollDiscipline(''),
    } : null,
  ].filter((chip): chip is PoolChip => Boolean(chip))

  return (
    <footer className="character-preview-roll-dock" aria-label={t('Панель пула')}>
      <div className="preview-roll-dock-pool">
        <span>{t('Пул')}</span>
        {chips.length === 0 ? (
          <em className="preview-roll-dock-empty">{t('Выбери характеристики и навык')}</em>
        ) : (
          chips.map(chip => (
            <button
              type="button"
              key={chip.key}
              className="preview-roll-chip"
              title={t('Убрать из пула')}
              onClick={chip.onRemove}
            >
              {chip.label} {chip.dots}
            </button>
          ))
        )}
      </div>

      <div className="preview-roll-dock-summary">
        <b>{d10(finalDice)}</b>
        {usesVampireResources && hunger > 0 ? (
          <span>{tf('{n} — Голод', { n: hunger })}</span>
        ) : null}
      </div>

      <div className="preview-roll-dock-modifier" title={t('Модификатор пула')}>
        <button
          type="button"
          aria-label={t('Уменьшить модификатор')}
          onClick={() => setRollModifier(Math.max(-20, roll.modifier - 1))}
        >
          −
        </button>
        <b>{roll.modifier}</b>
        <button
          type="button"
          aria-label={t('Увеличить модификатор')}
          onClick={() => setRollModifier(Math.min(20, roll.modifier + 1))}
        >
          +
        </button>
      </div>

      {usesVampireResources ? (
        <button
          type="button"
          className={`preview-roll-surge${bloodSurgeEnabled ? ' active' : ''}`}
          onClick={() => setUseBloodSurge(!bloodSurgeEnabled)}
          disabled={!canRoll}
        >
          {tf('Прилив Крови +{bonus}к10', { bonus: bloodSurgeBonus })}
        </button>
      ) : null}

      <div className="preview-roll-dock-contested">
        <label>
          <span>{t('Тип броска')}</span>
          <select
            value={roll.mode}
            onChange={event => {
              const nextMode = event.target.value as RollMode
              setRollMode(nextMode)
              if (nextMode === 'normal') setContestedOpponentId('')
            }}
          >
            <option value="normal">{t('Обычный бросок')}</option>
            <option value="contested">{t('Встречный бросок')}</option>
          </select>
        </label>
        {roll.mode === 'contested' ? (
          <label>
            <span>{t('Оппонент')}</span>
            <select
              value={roll.contestedOpponentId}
              onChange={event => setContestedOpponentId(event.target.value)}
              disabled={contestedOpponentOptions.length === 0}
            >
              <option value="">
                {contestedOpponentOptions.length ? t('Выбрать оппонента') : t('Нет доступных оппонентов')}
              </option>
              {contestedOpponentOptions.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {showAdvancedControls ? (
        <div className="preview-roll-dock-advanced">
          <div className="quick-roll-grid compact" aria-label={t('Быстрые броски')}>
            {[1, 3, 5, 7].map(count => (
              <button
                type="button"
                key={count}
                disabled={!canRoll}
                onClick={() => rollQuickDice(count, d10(count))}
              >
                {d10(count)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="preview-roll-submit dock"
        onClick={rollPool}
        disabled={!canRoll || diceCount < 1 || (roll.mode === 'contested' && !selectedContestedOpponent)}
      >
        {roll.mode === 'contested' ? t('Запросить встречный') : t('Бросить')} {finalDice}к10
      </button>

      <div className="preview-roll-dock-notices">
        {!canRoll ? <p>{t('Бросать может мастер или владелец активного персонажа.')}</p> : null}
        {poolBeforeLimit > 20 ? <p>{t('Пул ограничен двадцатью костями.')}</p> : null}
        {getActivePenaltyDelta(rollEffectResult, 'willpower_impairment') ? (
          <p>{t('Истощение Воли: -2к10 к этому пулу.')}</p>
        ) : null}
        {getActivePenaltyDelta(rollEffectResult, 'health_impairment') ? (
          <p>{t('Изнурение по здоровью: -2к10 к этому пулу.')}</p>
        ) : null}
        {renderRollModifierControls(rollEffectResult)}
      </div>
    </footer>
  )
}