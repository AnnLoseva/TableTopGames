'use client'

import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import { summarizeRollModifier } from './RollModifierControls'
import type { RollMessage } from '../types'

type RollMetaProps = {
  roll: RollMessage
}

export default function RollMetaDetails({ roll }: RollMetaProps) {
  const { t, tf, lang } = useLang()
  const d10 = (n: number) => (lang === 'en' ? `${n}d10` : `${n}к10`)
  const meta = roll.meta
  if (!meta) return null

  const rouseChecks = meta.rouseChecks || []
  const warnings = meta.warnings || []
  const rollModifiers = meta.rollModifiers || []
  const hungerChange =
    typeof meta.hungerBefore === 'number'
    && typeof meta.hungerAfter === 'number'
    && meta.hungerBefore !== meta.hungerAfter
      ? { before: meta.hungerBefore, after: meta.hungerAfter }
      : null
  const hasHungerChange = hungerChange !== null
  const hasWillpowerChange = Boolean(
    meta.willpowerBefore
    && meta.willpowerAfter
    && meta.willpowerBefore.current !== meta.willpowerAfter.current,
  )
  const hasWillpowerMeta = hasWillpowerChange
    || Boolean(meta.spentWillpower)
    || Boolean(meta.recoveredWillpower)
    || Boolean(meta.willpowerReroll?.used)
    || Boolean(meta.impairmentPenaltyApplied)
  const hasHealthChange = Boolean(meta.healthBefore && meta.healthAfter)
  const hasHealthMeta = hasHealthChange
    || Boolean(meta.damage)
    || Boolean(meta.healing)
    || Boolean(meta.healthImpairmentPenaltyApplied)
  const hasHumanityMeta = meta.rollKind === 'humanity_check'
    || meta.rollKind === 'remorse_check'
    || typeof meta.humanityBefore === 'number'
    || typeof meta.stainsBefore === 'number'

  if (
    !rouseChecks.length
    && !meta.bloodSurge?.enabled
    && !hasHungerChange
    && !hasWillpowerMeta
    && !hasHealthMeta
    && !hasHumanityMeta
    && !meta.messyCritical
    && !meta.bestialFailure
    && !warnings.length
    && !meta.discipline
    && !rollModifiers.length
    && !meta.rollDifficultyModifier
  ) {
    return null
  }

  return (
    <div className="roll-v5-meta">
      {meta.discipline ? (
        <span className="roll-note">
          {tf('Дисциплина: {name} · {power}', { name: meta.discipline.name, power: meta.discipline.power })}
          {meta.discipline.cost && meta.discipline.cost !== '—' ? ` · ${t(meta.discipline.cost)}` : ''}
        </span>
      ) : null}
      {meta.bloodSurge?.enabled ? (
        <span className="roll-note">{tf('Прилив Крови: +{bonus}к10', { bonus: meta.bloodSurge.bonusDice })}</span>
      ) : null}
      {rouseChecks.map(result => (
        <span className="roll-note" key={result.id}>
          {tf('{reason}: {value} · {outcome}', {
            reason: t(result.reason),
            value: result.value,
            outcome: result.success ? t('успех') : t('провал'),
          })}
        </span>
      ))}
      {hungerChange ? <span className="roll-note">{tf('Голод: {before} → {after}', hungerChange)}</span> : null}
      {meta.spentWillpower ? <span className="roll-note">{tf('Воля потрачена: {n}', { n: meta.spentWillpower })}</span> : null}
      {meta.recoveredWillpower ? (
        <span className="roll-note">{tf('Воля восстановлена: {n}', { n: meta.recoveredWillpower })}</span>
      ) : null}
      {hasWillpowerChange && meta.willpowerBefore && meta.willpowerAfter ? (
        <span className="roll-note">
          {tf('Воля: {before} → {after} / {max}', {
            before: meta.willpowerBefore.current,
            after: meta.willpowerAfter.current,
            max: meta.willpowerAfter.max,
          })}
        </span>
      ) : null}
      {meta.willpowerReroll?.used ? (
        <span className="roll-note">
          {tf('Переброс Воли: {before} → {after}', {
            before: meta.willpowerReroll.oldDice.map(die => die.value).join(', '),
            after: meta.willpowerReroll.newDice.map(die => die.value).join(', '),
          })}
        </span>
      ) : null}
      {meta.impairmentPenaltyApplied ? (
        <span className="roll-note">{tf('Истощение Воли: {n}к10', { n: meta.impairmentPenaltyApplied })}</span>
      ) : null}
      {meta.healthImpairmentPenaltyApplied ? (
        <span className="roll-note">{tf('Изнурение по здоровью: {n}к10', { n: meta.healthImpairmentPenaltyApplied })}</span>
      ) : null}
      {rollModifiers.length ? (
        <span className="roll-note">
          {t('Модификаторы')}: {rollModifiers.map(modifier => summarizeRollModifier(modifier, tf, d10)).join(' · ')}
        </span>
      ) : null}
      {meta.damage ? (
        <span className="roll-note">
          {tf('Урон: {amount} {severity}', {
            amount: meta.damage.originalAmount,
            severity: meta.damage.severity === 'aggravated' ? t('тяжёлых') : t('лёгких'),
          })}
          {meta.damage.halved ? tf(' → после деления {final}', { final: meta.damage.finalAmount }) : ''}
          {meta.damage.targetCharacterName ? tf(' · цель: {name}', { name: meta.damage.targetCharacterName }) : ''}
        </span>
      ) : null}
      {meta.damage?.chain?.map((line, index) => (
        <span className="roll-note" key={`${roll.id}-damage-chain-${index}`}>
          {line}
        </span>
      ))}
      {meta.healthBefore && meta.healthAfter ? (
        <span className="roll-note">
          {tf('Здоровье: {before} → {after} / {max} · / {superficial} · X {aggravated}', {
            before: meta.healthBefore.current,
            after: meta.healthAfter.current,
            max: meta.healthAfter.max,
            superficial: meta.healthAfter.superficial,
            aggravated: meta.healthAfter.aggravated,
          })}
        </span>
      ) : null}
      {meta.healing ? (
        <span className="roll-note">
          {tf('Лечение: / {superficial} · X {aggravated}', {
            superficial: meta.healing.amountSuperficial || 0,
            aggravated: meta.healing.amountAggravated || 0,
          })}
        </span>
      ) : null}
      {meta.rollKind === 'remorse_check' ? (
        <span className="roll-note">
          {tf('Проверка мук совести: {result}', {
            result: meta.automaticFailure
              ? t('автоматический провал')
              : tf('{dice}к10 без кубиков Голода', { dice: meta.remorseDice || 0 }),
          })}
        </span>
      ) : null}
      {typeof meta.humanityBefore === 'number' && typeof meta.humanityAfter === 'number' ? (
        <span className="roll-note">
          {tf('Человечность: {before} → {after}', { before: meta.humanityBefore, after: meta.humanityAfter })}
        </span>
      ) : null}
      {typeof meta.stainsBefore === 'number' && typeof meta.stainsAfter === 'number' ? (
        <span className="roll-note">
          {tf('Сомнения: {before} → {after}', { before: meta.stainsBefore, after: meta.stainsAfter })}
        </span>
      ) : null}
      {meta.messyCritical ? <strong className="roll-alert">{t('Кровавый триумф')}</strong> : null}
      {meta.bestialFailure ? <strong className="roll-alert">{t('Кровавый провал')}</strong> : null}
      {warnings.map((warning, index) => (
        <span className="roll-warning" key={`${roll.id}-warning-${index}`}>{t(warning)}</span>
      ))}
    </div>
  )
}