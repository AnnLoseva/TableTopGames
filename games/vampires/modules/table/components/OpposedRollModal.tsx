'use client'

import { getAttributeDots, resolveSkillValue } from '@/games/vampires/lib/i18n/ruleNames'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'
import { ATTRIBUTE_GROUPS, SKILL_GROUPS } from '../constants/roll-traits'
import { getExtraTraitNames } from '../utils/roll-utils'
import type {
  CharacterOption,
  OpposedResponsePoolView,
  OpposedRollProposal,
  RollPoolBuilder,
} from '../types'

function getSkillDots(value: unknown) {
  if (typeof value === 'number') return value
  if (!value || typeof value !== 'object') return 0
  return Number((value as { dots?: number }).dots || 0)
}

function getDisciplineDots(sources: Record<string, number>) {
  return Object.values(sources || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)
}

type OpposedResponseBuilderProps = {
  character: CharacterOption | null
  responseSide: RollPoolBuilder
  pool: OpposedResponsePoolView
  onResponseSideChange: (patch: Partial<RollPoolBuilder>) => void
}

function OpposedResponseBuilder({
  character,
  responseSide,
  pool,
  onResponseSideChange,
}: OpposedResponseBuilderProps) {
  const { t, tf } = useLang()
  const d10 = (n: number) => tf('{n}к10', { n })

  const resolvedPool = character
    ? {
        ...pool,
        extraAttributes: pool.extraAttributes.length
          ? pool.extraAttributes
          : getExtraTraitNames(character.attributes, ATTRIBUTE_GROUPS),
        extraSkills: pool.extraSkills.length
          ? pool.extraSkills
          : getExtraTraitNames(character.skills, SKILL_GROUPS),
      }
    : pool

  return (
    <section className="opposed-side-builder opposed-response-builder">
      <div className="opposed-side-heading">
        <span>{t('Твой ответ')}</span>
        <strong>{d10(resolvedPool.diceCount || 0)}</strong>
      </div>

      {!character ? (
        <p className="opposed-side-status">{t('Выбери активного персонажа.')}</p>
      ) : (
        <div className="opposed-trait-controls">
          <label>
            <span>{t('Характеристика 1')}</span>
            <select
              value={responseSide.attribute}
              onChange={event => onResponseSideChange({ attribute: event.target.value })}
            >
              <option value="">{t('Без характеристики')}</option>
              {ATTRIBUTE_GROUPS.map(group => (
                <optgroup key={group.name} label={t(group.name)}>
                  {group.traits.map(name => (
                    <option
                      key={name}
                      value={name}
                      disabled={responseSide.attributeTwo === name}
                    >
                      {t(name)} · {getAttributeDots(character.attributes, name)}
                    </option>
                  ))}
                </optgroup>
              ))}
              {resolvedPool.extraAttributes.length ? (
                <optgroup label={t('Другие')}>
                  {resolvedPool.extraAttributes.map(name => (
                    <option
                      key={name}
                      value={name}
                      disabled={responseSide.attributeTwo === name}
                    >
                      {name} · {getAttributeDots(character.attributes, name)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          <label>
            <span>{t('Характеристика 2')}</span>
            <select
              value={responseSide.attributeTwo}
              onChange={event => onResponseSideChange({ attributeTwo: event.target.value })}
            >
              <option value="">{t('Без второй характеристики')}</option>
              {ATTRIBUTE_GROUPS.map(group => (
                <optgroup key={group.name} label={t(group.name)}>
                  {group.traits.map(name => (
                    <option
                      key={name}
                      value={name}
                      disabled={responseSide.attribute === name}
                    >
                      {t(name)} · {getAttributeDots(character.attributes, name)}
                    </option>
                  ))}
                </optgroup>
              ))}
              {resolvedPool.extraAttributes.length ? (
                <optgroup label={t('Другие')}>
                  {resolvedPool.extraAttributes.map(name => (
                    <option
                      key={name}
                      value={name}
                      disabled={responseSide.attribute === name}
                    >
                      {name} · {getAttributeDots(character.attributes, name)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          <label>
            <span>{t('Навык')}</span>
            <select
              value={responseSide.skill}
              onChange={event => onResponseSideChange({ skill: event.target.value })}
            >
              <option value="">{t('Без навыка')}</option>
              {SKILL_GROUPS.map(group => (
                <optgroup key={group.name} label={t(group.name)}>
                  {group.traits.map(name => (
                    <option key={name} value={name}>
                      {t(name)} · {getSkillDots(resolveSkillValue(character.skills, name))}
                    </option>
                  ))}
                </optgroup>
              ))}
              {resolvedPool.extraSkills.length ? (
                <optgroup label={t('Другие')}>
                  {resolvedPool.extraSkills.map(name => (
                    <option key={name} value={name}>
                      {name} · {getSkillDots(resolveSkillValue(character.skills, name))}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          <label>
            <span>{t('Дисциплина')}</span>
            <select
              value={responseSide.discipline}
              onChange={event => onResponseSideChange({ discipline: event.target.value })}
            >
              <option value="">{t('Без дисциплины')}</option>
              {resolvedPool.disciplineNames.map(name => (
                <option key={name} value={name}>
                  {name} · {getDisciplineDots(character.disciplines[name] || {})}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('Модификатор')}</span>
            <input
              type="number"
              min="-20"
              max="20"
              value={responseSide.modifier}
              onChange={event => onResponseSideChange({
                modifier: Math.max(-20, Math.min(20, Number(event.target.value) || 0)),
              })}
            />
          </label>
        </div>
      )}
    </section>
  )
}

export type OpposedRollModalProps = {
  open: boolean
  proposal: OpposedRollProposal | null
  activeCharacter: CharacterOption | null
  responseSide: RollPoolBuilder
  responsePool: OpposedResponsePoolView
  canAnswer: boolean
  onDismiss: () => void
  onAnswer: () => void
  onResponseSideChange: (patch: Partial<RollPoolBuilder>) => void
}

export function OpposedRollModal({
  open,
  proposal,
  activeCharacter,
  responseSide,
  responsePool,
  canAnswer,
  onDismiss,
  onAnswer,
  onResponseSideChange,
}: OpposedRollModalProps) {
  const { t, tf } = useLang()
  const d10 = (n: number) => tf('{n}к10', { n })

  if (!open || !proposal) return null

  return (
    <div className="opposed-proposal-backdrop" role="dialog" aria-modal="true" aria-label={t('Встречная проверка')}>
      <section className="opposed-proposal-modal">
        <header>
          <div>
            <span>{t('Встречная проверка')}</span>
            <strong>{proposal.fromUsername || t('Игрок')}</strong>
          </div>
          <button type="button" onClick={onDismiss} aria-label={t('Закрыть предложение')}>×</button>
        </header>

        <div className="opposed-proposal-body">
          <section className="opposed-proposal-summary">
            <div>
              <span>{t('Заявленный бросок')}</span>
              <strong>{proposal.initiator.actorName}</strong>
            </div>
            <p>{t(proposal.initiator.poolName)}</p>
            <b>{d10(proposal.initiator.diceCount)}</b>
          </section>

          <section className="opposed-proposal-active">
            <span>{t('Отвечает')}</span>
            <strong>{activeCharacter?.name || t('Активный персонаж не выбран')}</strong>
          </section>

          <OpposedResponseBuilder
            character={activeCharacter}
            responseSide={responseSide}
            pool={responsePool}
            onResponseSideChange={onResponseSideChange}
          />
        </div>

        <footer className="opposed-proposal-actions">
          <button type="button" onClick={onDismiss}>{t('Отклонить')}</button>
          <button type="button" className="primary" onClick={onAnswer} disabled={!canAnswer}>
            {tf('Бросить ответ {count}к10', { count: responsePool.diceCount || 0 })}
          </button>
        </footer>
      </section>
    </div>
  )
}