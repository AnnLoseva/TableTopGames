'use client'

import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import type { AppliedDisciplineRollModifier, DisciplineRollEffectResult } from '@/games/vampires/core/vtm5/rules/disciplines/effects'

export function summarizeRollModifier(
  modifier: AppliedDisciplineRollModifier,
  tf: (ru: string, vars: Record<string, string | number>) => string,
  d10: (n: number) => string,
) {
  if (modifier.operation === 'ignore_penalty') {
    return tf('игнорирует штраф · от {source}', { source: modifier.sourceLabel })
  }
  if (modifier.operation === 'auto_success') {
    return tf('бросок не нужен · от {source}', { source: modifier.sourceLabel })
  }
  if (modifier.difficultyDelta) {
    return tf('Сложность {delta} · от {source}', {
      delta: `${modifier.difficultyDelta > 0 ? '+' : ''}${modifier.difficultyDelta}`,
      source: modifier.sourceLabel,
    })
  }
  if (modifier.diceDelta) {
    return tf('{delta} от {source}', {
      delta: `${modifier.diceDelta > 0 ? '+' : ''}${d10(Math.abs(modifier.diceDelta))}`,
      source: modifier.sourceLabel,
    })
  }
  return modifier.sourceLabel
}

export type RollModifierControlsProps = {
  result: DisciplineRollEffectResult | null | undefined
  isMaster: boolean
  setDisabledIds?: Dispatch<SetStateAction<string[]>>
}

export function RollModifierControls({ result, isMaster, setDisabledIds }: RollModifierControlsProps) {
  const { t, tf } = useLang()
  const d10 = (n: number) => tf('{n}к10', { n })

  const getRollModifierSummary = (modifier: AppliedDisciplineRollModifier) => summarizeRollModifier(modifier, tf, d10)

  const visibleModifiers = (result?.modifiers || []).filter(modifier => (
    (modifier.sourceKind !== 'penalty' || modifier.active)
    && (
      modifier.diceDelta !== 0
      || modifier.difficultyDelta !== 0
      || modifier.operation === 'ignore_penalty'
      || modifier.operation === 'auto_success'
    )
  ))
  if (!visibleModifiers.length) return null

  const toggleDisabledRollModifier = (modifierId: string) => {
    if (!setDisabledIds) return
    setDisabledIds(current => current.includes(modifierId)
      ? current.filter(id => id !== modifierId)
      : [...current, modifierId])
  }

  return (
    <div className="preview-roll-modifier-list">
      <strong>{t('Модификаторы')}:</strong>
      {visibleModifiers.map(modifier => {
        const summary = getRollModifierSummary(modifier)
        const canToggle = isMaster && modifier.canDisable && setDisabledIds
        return canToggle ? (
          <label key={modifier.id} className="preview-blood-surge-toggle">
            <span>{modifier.active ? summary : `${t('отключено')}: ${summary}`}</span>
            <input
              type="checkbox"
              checked={modifier.active}
              onChange={() => toggleDisabledRollModifier(modifier.id)}
            />
          </label>
        ) : (
          <span className="preview-roll-notice" key={modifier.id}>
            {modifier.active ? summary : `${t('отключено')}: ${summary}`}
          </span>
        )
      })}
    </div>
  )
}

export function renderRollModifierControlsNode(props: RollModifierControlsProps): ReactNode {
  return <RollModifierControls {...props} />
}