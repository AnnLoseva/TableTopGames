'use client'

import { useMemo, useState } from 'react'
import { PATHFINDER2_ATTRIBUTES, PATHFINDER2_SKILLS } from '../../data'
import {
  applyLevelUp,
  buildLevelUpPlan,
} from '../../rules/progression/build-level-up-plan'
import { canReachSkillRankAtLevel } from '../../rules/progression/skill-progression'
import { getNextProficiencyRank } from '../../rules/skills/proficiency'
import type {
  Pathfinder2CharacterDraftV4,
  Pathfinder2CharacterState,
  Pathfinder2LevelChoices,
  Pathfinder2RulesCatalog,
  Pathfinder2SkillId,
} from '../../types'
import type { UpdatePathfinder2V4 } from '../component-types'
import styles from '../Pathfinder2SheetPage.module.css'

function initialChoices(level: number): Pathfinder2LevelChoices {
  return {
    level,
    attributeBoosts: [],
    skillIncreases: [],
    featSelections: {},
    classFeatureChoices: {},
    learnedSpellIds: [],
    removedSpellIds: [],
    languageChoices: [],
  }
}

export default function LevelUpPanel({
  draft,
  catalog,
  state,
  updateV4,
  onClose,
}: {
  draft: Pathfinder2CharacterDraftV4
  catalog: Pathfinder2RulesCatalog
  state: Pathfinder2CharacterState
  updateV4: UpdatePathfinder2V4
  onClose: () => void
}) {
  const targetLevel = draft.progression.level + 1
  const [choices, setChoices] = useState(() => initialChoices(targetLevel))
  const [useExperience, setUseExperience] = useState(false)
  const [submitIssues, setSubmitIssues] = useState<string[]>([])
  const plan = useMemo(
    () => buildLevelUpPlan(draft, targetLevel, catalog),
    [catalog, draft, targetLevel],
  )
  const skillOptions = PATHFINDER2_SKILLS.flatMap(skill => {
    const current = state.legacyBuild.skills.skills[skill.id].rank
    const next = getNextProficiencyRank(current)
    return next && canReachSkillRankAtLevel(next, targetLevel)
      ? [{ ...skill, current, next }]
      : []
  })

  const toggleAttribute = (attribute: typeof PATHFINDER2_ATTRIBUTES[number]['key']) => {
    setChoices(current => ({
      ...current,
      attributeBoosts: current.attributeBoosts.includes(attribute)
        ? current.attributeBoosts.filter(value => value !== attribute)
        : current.attributeBoosts.length < plan.attributeBoostCount
          ? [...current.attributeBoosts, attribute]
          : current.attributeBoosts,
    }))
  }

  const selectSkill = (skillId: Pathfinder2SkillId | '') => {
    const option = skillOptions.find(skill => skill.id === skillId)
    setChoices(current => ({
      ...current,
      skillIncreases: option
        ? [{
            level: targetLevel,
            skillId: option.id,
            fromRank: option.current,
            toRank: option.next,
          }]
        : [],
    }))
  }

  const apply = () => {
    const result = applyLevelUp(draft, choices, catalog, useExperience)
    if (!result.ok) {
      setSubmitIssues(result.issues.map(issue => issue.message))
      return
    }
    updateV4(() => result.draft, { immediate: true })
    onClose()
  }

  return (
    <section className={styles.rulesSection} aria-labelledby="level-up-title">
      <header>
        <div>
          <span className={styles.choiceKicker}>Последовательная прогрессия</span>
          <h2 id="level-up-title">Уровень {draft.progression.level} → {targetLevel}</h2>
        </div>
        <button type="button" className={styles.textButton} onClick={onClose}>Закрыть</button>
      </header>

      {plan.automaticFeatures.length ? (
        <div className={styles.selectedChips}>
          {plan.automaticFeatures.map(feature => (
            <span key={feature.id}>Автоматически: {feature.name}</span>
          ))}
        </div>
      ) : null}

      {plan.attributeBoostCount ? (
        <>
          <p>Повышения характеристик: {choices.attributeBoosts.length} из {plan.attributeBoostCount}</p>
          <div className={styles.ruleChoiceGrid}>
            {PATHFINDER2_ATTRIBUTES.map(attribute => (
              <button
                key={attribute.key}
                type="button"
                aria-pressed={choices.attributeBoosts.includes(attribute.key)}
                className={choices.attributeBoosts.includes(attribute.key)
                  ? styles.ruleChoiceSelected
                  : undefined}
                onClick={() => toggleAttribute(attribute.key)}
              >
                <strong>{attribute.shortLabel}</strong>
                <span>{attribute.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {plan.skillIncreaseCount ? (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Повышение навыка</span>
          <select
            value={choices.skillIncreases[0]?.skillId ?? ''}
            onChange={event => selectSkill(event.target.value as Pathfinder2SkillId | '')}
          >
            <option value="">Выберите навык</option>
            {skillOptions.map(skill => (
              <option key={skill.id} value={skill.id}>
                {skill.label} · {skill.current} → {skill.next}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <p>
        Ячейки после повышения: фокусы {plan.cantripSlots}; {
          Object.entries(plan.spellSlots).map(([rank, count]) => (
            `${rank}-й круг: ${count}`
          )).join(' · ') || 'без изменений'
        }.
      </p>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Опыт</span>
        <span>
          <input
            type="checkbox"
            checked={useExperience}
            disabled={draft.progression.experience < plan.experienceCost}
            onChange={event => setUseExperience(event.target.checked)}
          />
          {' '}Списать {plan.experienceCost} XP (доступно {draft.progression.experience})
        </span>
      </label>

      {plan.issues.length || submitIssues.length ? (
        <div className={styles.validationList} role="alert">
          <strong>Повышение заблокировано</strong>
          <ul>
            {plan.issues.map(issue => <li key={issue.id}>{issue.message}</li>)}
            {submitIssues.map((message, index) => <li key={`${message}:${index}`}>{message}</li>)}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        className={styles.nextButton}
        disabled={plan.issues.some(issue => issue.severity === 'error')}
        onClick={apply}
      >
        Подтвердить {targetLevel}-й уровень
      </button>
    </section>
  )
}
