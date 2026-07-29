'use client'

import { useState } from 'react'
import { PATHFINDER2_ATTRIBUTES } from '../../data'
import {
  ATTRIBUTE_LABELS,
  displayAttribute,
  getAncestryById,
  getBackgroundById,
  getClassById,
} from '../../data/selectors'
import {
  getAttributeChoiceOptions,
  toggleAttributeChoice,
} from '../../rules/attributes/attribute-choice-options'
import {
  calculateAttributeModifiers,
  getAncestryAttributeRules,
} from '../../rules/attributes/calculate-attributes'
import { signedModifier } from '../../rules/derived-character-values'
import type {
  Pathfinder2AttributeKey,
  Pathfinder2AttributeMode,
  Pathfinder2CharacterBuild,
  Pathfinder2CharacterDraft,
  Pathfinder2RulesCatalog,
} from '../../types'
import type { UpdatePathfinder2Character } from '../component-types'
import styles from '../Pathfinder2SheetPage.module.css'

type AttributeRulesEditorProps = {
  draft: Pathfinder2CharacterDraft
  catalog: Pathfinder2RulesCatalog
  build: Pathfinder2CharacterBuild
  updateCharacter: UpdatePathfinder2Character
}

function AttributeChoiceButtons({
  selected,
  options,
  onToggle,
}: {
  selected: Pathfinder2AttributeKey[]
  options: ReturnType<typeof getAttributeChoiceOptions>
  onToggle: (key: Pathfinder2AttributeKey) => void
}) {
  return (
    <div className={styles.ruleChoiceGrid}>
      {PATHFINDER2_ATTRIBUTES.map(attribute => {
        const option = options.find(value => value.key === attribute.key)
        const isSelected = selected.includes(attribute.key)
        return (
          <button
            key={attribute.key}
            type="button"
            className={isSelected ? styles.ruleChoiceSelected : undefined}
            aria-pressed={isSelected}
            disabled={!isSelected && option?.disabled}
            title={!isSelected ? option?.reason : undefined}
            onClick={() => onToggle(attribute.key)}
          >
            <strong>{attribute.shortLabel}</strong>
            <span>{attribute.label}</span>
            {isSelected ? <small>выбрано</small> : option?.disabled ? <small>{option.reason}</small> : null}
          </button>
        )
      })}
    </div>
  )
}

export default function AttributeRulesEditor({
  draft,
  catalog,
  build,
  updateCharacter,
}: AttributeRulesEditorProps) {
  const [modeNotice, setModeNotice] = useState('')
  const ancestry = getAncestryById(catalog, draft.ancestryId)
  const background = getBackgroundById(catalog, draft.backgroundId)
  const characterClass = getClassById(catalog, draft.classId)
  const ancestryRules = getAncestryAttributeRules(draft, catalog)
  const errors = build.validationIssues.filter(issue => (
    issue.step === 'attributes' && issue.severity === 'error'
  ))

  const updateMode = (mode: Pathfinder2AttributeMode) => {
    if (mode === draft.attributeChoices.ancestryMode) return
    const before = build.attributes.modifiers
    updateCharacter(current => {
      const candidate: Pathfinder2CharacterDraft = {
        ...current,
        attributeChoices: {
          ...current.attributeChoices,
          ancestryMode: mode,
        },
      }
      const rules = getAncestryAttributeRules(candidate, catalog)
      const ancestryFreeBoosts = Array.from(
        new Set(candidate.attributeChoices.ancestryFreeBoosts),
      ).filter(key => !rules.fixedBoosts.includes(key)).slice(0, rules.freeBoostCount)
      const next = {
        ...candidate,
        attributeChoices: {
          ...candidate.attributeChoices,
          ancestryFreeBoosts,
        },
      }
      const after = calculateAttributeModifiers(next, catalog).modifiers
      const changed = PATHFINDER2_ATTRIBUTES
        .filter(attribute => before[attribute.key] !== after[attribute.key])
        .map(attribute => (
          `${attribute.shortLabel} ${signedModifier(before[attribute.key])} → ${signedModifier(after[attribute.key])}`
        ))
      setModeNotice(changed.length
        ? `Режим народа изменён: ${changed.join(', ')}.`
        : 'Режим народа изменён; совместимые решения сохранены.')
      return next
    }, { immediate: true })
  }

  const setSingleChoice = (
    field: 'backgroundLimitedBoost' | 'backgroundFreeBoost' | 'classKeyBoost',
    key: Pathfinder2AttributeKey,
  ) => {
    updateCharacter(current => ({
      ...current,
      attributeChoices: {
        ...current.attributeChoices,
        [field]: current.attributeChoices[field] === key ? null : key,
      },
    }), { immediate: true })
  }

  return (
    <div className={styles.formStack}>
      {draft.needsRulesRebuild ? (
        <div className={styles.rulesWarning} role="status">
          <strong>Нужно подтвердить старый черновик</strong>
          <p>Итоговые значения сохранены снимком, но не используются как законные источники повышений.</p>
        </div>
      ) : null}

      <section className={styles.rulesSection}>
        <header>
          <div>
            <span className={styles.choiceKicker}>Итог · вычисляется автоматически</span>
            <h3>Характеристики героя</h3>
          </div>
          <span className={errors.length ? styles.rulesStatusError : styles.rulesStatusOk}>
            {errors.length ? `${errors.length} ошибок` : 'Все повышения распределены'}
          </span>
        </header>
        <div className={styles.attributeGrid}>
          {PATHFINDER2_ATTRIBUTES.map(attribute => {
            const entries = build.attributes.breakdown[attribute.key]
            return (
              <article
                key={attribute.key}
                className={[
                  styles.attributeCard,
                  draft.attributeChoices.classKeyBoost === attribute.key
                    ? styles.attributeCardKey
                    : '',
                ].filter(Boolean).join(' ')}
              >
                <div className={styles.attributeCardTop}>
                  <span className={styles.attributeShort}>{attribute.shortLabel}</span>
                  {draft.attributeChoices.classKeyBoost === attribute.key ? <small>Ключ</small> : null}
                </div>
                <strong>{signedModifier(build.attributes.modifiers[attribute.key])}</strong>
                <small>{attribute.label}</small>
                <ul className={styles.attributeBreakdown}>
                  {entries.length ? entries.map((entry, index) => (
                    <li key={`${entry.sourceLabel}-${index}`}>
                      <span>{entry.sourceLabel}</span>
                      <b>{entry.partial ? '½' : signedModifier(entry.delta)}</b>
                    </li>
                  )) : <li><span>Базовое значение</span><b>+0</b></li>}
                </ul>
              </article>
            )
          })}
        </div>
      </section>

      <section className={styles.rulesSection}>
        <header>
          <div><span className={styles.choiceKicker}>Источник 1</span><h3>Народ</h3></div>
          <span className={ancestry ? styles.rulesStatusAuto : styles.rulesStatusError}>
            {ancestry ? 'частично автоматически' : 'нужен народ'}
          </span>
        </header>
        <div className={styles.modeSwitch} aria-label="Режим повышений народа">
          <button
            type="button"
            aria-pressed={draft.attributeChoices.ancestryMode === 'standard'}
            onClick={() => updateMode('standard')}
          >
            Стандартные повышения
          </button>
          <button
            type="button"
            aria-pressed={draft.attributeChoices.ancestryMode === 'alternate'}
            onClick={() => updateMode('alternate')}
          >
            Два свободных повышения
          </button>
        </div>
        {modeNotice ? <p className={styles.ruleChangeNotice}>{modeNotice}</p> : null}
        {draft.attributeChoices.ancestryMode === 'standard' && ancestry ? (
          <div className={styles.automaticRules}>
            {ancestryRules.fixedBoosts.map(key => (
              <span key={key}>✓ {ATTRIBUTE_LABELS[key]} +1 · автоматически</span>
            ))}
            {ancestryRules.flaw ? (
              <span>− {ATTRIBUTE_LABELS[ancestryRules.flaw]} −1 · автоматически</span>
            ) : null}
          </div>
        ) : null}
        <p className={styles.rulesCounter}>
          Свободные повышения народа: {draft.attributeChoices.ancestryFreeBoosts.length} из {ancestryRules.freeBoostCount}
        </p>
        <AttributeChoiceButtons
          selected={draft.attributeChoices.ancestryFreeBoosts}
          options={getAttributeChoiceOptions(draft, catalog, 'ancestry')}
          onToggle={key => updateCharacter(current => ({
            ...current,
            attributeChoices: {
              ...current.attributeChoices,
              ancestryFreeBoosts: toggleAttributeChoice(
                current.attributeChoices.ancestryFreeBoosts,
                key,
                ancestryRules.freeBoostCount,
              ),
            },
          }), { immediate: true })}
        />
      </section>

      <section className={styles.rulesSection}>
        <header>
          <div><span className={styles.choiceKicker}>Источник 2</span><h3>Предыстория</h3></div>
          <span className={background ? styles.rulesStatusRequired : styles.rulesStatusError}>
            {background ? '2 обязательных выбора' : 'нужна предыстория'}
          </span>
        </header>
        <p>{background?.name ?? 'Выберите предысторию на предыдущем шаге.'}</p>
        <p className={styles.rulesCounter}>
          Ограниченное повышение: {background?.abilityBoostOptions.map(displayAttribute).join(' или ') || '—'}
        </p>
        <AttributeChoiceButtons
          selected={draft.attributeChoices.backgroundLimitedBoost
            ? [draft.attributeChoices.backgroundLimitedBoost]
            : []}
          options={getAttributeChoiceOptions(draft, catalog, 'background-limited')}
          onToggle={key => setSingleChoice('backgroundLimitedBoost', key)}
        />
        <p className={styles.rulesCounter}>Свободное повышение · должно отличаться от первого</p>
        <AttributeChoiceButtons
          selected={draft.attributeChoices.backgroundFreeBoost
            ? [draft.attributeChoices.backgroundFreeBoost]
            : []}
          options={getAttributeChoiceOptions(draft, catalog, 'background-free')}
          onToggle={key => setSingleChoice('backgroundFreeBoost', key)}
        />
      </section>

      <section className={styles.rulesSection}>
        <header>
          <div><span className={styles.choiceKicker}>Источник 3</span><h3>Ключевая характеристика класса</h3></div>
          <span className={characterClass ? styles.rulesStatusRequired : styles.rulesStatusError}>
            обязательно
          </span>
        </header>
        <p>{characterClass
          ? `${characterClass.name}: ${characterClass.keyAbilities.map(displayAttribute).join(' или ')}`
          : 'Выберите класс на предыдущем шаге.'}</p>
        <AttributeChoiceButtons
          selected={draft.attributeChoices.classKeyBoost
            ? [draft.attributeChoices.classKeyBoost]
            : []}
          options={getAttributeChoiceOptions(draft, catalog, 'class')}
          onToggle={key => setSingleChoice('classKeyBoost', key)}
        />
      </section>

      <section className={styles.rulesSection}>
        <header>
          <div><span className={styles.choiceKicker}>Источник 4</span><h3>Четыре свободных повышения</h3></div>
          <span className={draft.attributeChoices.finalFreeBoosts.length === 4
            ? styles.rulesStatusOk
            : styles.rulesStatusRequired}>
            {draft.attributeChoices.finalFreeBoosts.length} из 4
          </span>
        </header>
        <p>Каждую характеристику можно выбрать в этом блоке только один раз.</p>
        <AttributeChoiceButtons
          selected={draft.attributeChoices.finalFreeBoosts}
          options={getAttributeChoiceOptions(draft, catalog, 'final')}
          onToggle={key => updateCharacter(current => ({
            ...current,
            attributeChoices: {
              ...current.attributeChoices,
              finalFreeBoosts: toggleAttributeChoice(
                current.attributeChoices.finalFreeBoosts,
                key,
                4,
              ),
            },
          }), { immediate: true })}
        />
      </section>

      {errors.length ? (
        <section className={styles.validationList} aria-label="Ошибки характеристик">
          <strong>Нужно исправить</strong>
          <ul>{errors.map(issue => <li key={issue.id}>{issue.message}</li>)}</ul>
        </section>
      ) : null}
    </div>
  )
}
