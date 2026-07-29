'use client'

import { PATHFINDER2_SKILLS } from '../../data'
import {
  ATTRIBUTE_LABELS,
  PROFICIENCY_LABELS,
  getBackgroundById,
  getClassById,
} from '../../data/selectors'
import {
  getSkillRuleBlocks,
} from '../../rules/skills/calculate-skills'
import {
  getSkillChoiceOptions,
  toggleSkillChoice,
} from '../../rules/skills/skill-choice-options'
import { signedModifier } from '../../rules/derived-character-values'
import type {
  Pathfinder2CalculatedSkills,
  Pathfinder2CharacterBuild,
  Pathfinder2CharacterDraft,
  Pathfinder2RulesCatalog,
  Pathfinder2SkillId,
} from '../../types'
import type { UpdatePathfinder2Character } from '../component-types'
import styles from '../Pathfinder2SheetPage.module.css'

type SkillRulesEditorProps = {
  draft: Pathfinder2CharacterDraft
  catalog: Pathfinder2RulesCatalog
  build: Pathfinder2CharacterBuild
  updateCharacter: UpdatePathfinder2Character
}

function skillLabel(skillId: Pathfinder2SkillId) {
  return PATHFINDER2_SKILLS.find(skill => skill.id === skillId)?.label ?? skillId
}

function SkillChoiceBlock({
  title,
  description,
  selected,
  limit,
  allowedSkills,
  draft,
  calculated,
  conflict,
  onToggle,
}: {
  title: string
  description: string
  selected: Pathfinder2SkillId[]
  limit: number
  allowedSkills?: Pathfinder2SkillId[]
  draft: Pathfinder2CharacterDraft
  calculated: Pathfinder2CalculatedSkills
  conflict: boolean
  onToggle: (skillId: Pathfinder2SkillId) => void
}) {
  const options = getSkillChoiceOptions(
    draft,
    calculated,
    selected,
    limit,
    allowedSkills,
  )
  return (
    <section className={`${styles.skillRuleBlock} ${conflict ? styles.skillRuleConflict : ''}`}>
      <header>
        <div><h4>{title}</h4><p>{description}</p></div>
        <span>{selected.length} из {limit}</span>
      </header>
      <div className={styles.skillsGrid}>
        {PATHFINDER2_SKILLS.map(skill => {
          const option = options.find(value => value.skillId === skill.id)
          const isSelected = selected.includes(skill.id)
          return (
            <button
              key={skill.id}
              type="button"
              className={[
                styles.skillButton,
                isSelected ? styles.skillButtonSelected : '',
              ].filter(Boolean).join(' ')}
              aria-pressed={isSelected}
              disabled={!isSelected && option?.disabled}
              title={!isSelected ? option?.reason : undefined}
              onClick={() => onToggle(skill.id)}
            >
              <span className={styles.checkMark}>{isSelected ? '✓' : ''}</span>
              <span>
                <strong>{skill.label}</strong>
                <small>{isSelected ? 'выбрано' : option?.reason ?? 'доступно'}</small>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default function SkillRulesEditor({
  draft,
  catalog,
  build,
  updateCharacter,
}: SkillRulesEditorProps) {
  const background = getBackgroundById(catalog, draft.backgroundId)
  const characterClass = getClassById(catalog, draft.classId)
  const { choiceRules } = getSkillRuleBlocks(draft, catalog)
  const errors = build.validationIssues.filter(issue => (
    issue.step === 'features' && issue.severity === 'error'
  ))

  const hasFieldError = (field: string) => errors.some(issue => issue.field === field)

  return (
    <div className={styles.formStack}>
      {draft.needsRulesRebuild ? (
        <div className={styles.rulesWarning} role="status">
          <strong>Старые навыки сохранены как подсказки</strong>
          <p>Подтвердите их в разрешённых блоках. Они не считаются обученными автоматически.</p>
          {draft.skillChoices.suggestedSkills.length ? (
            <div className={styles.selectedChips}>
              {draft.skillChoices.suggestedSkills.map(skillId => (
                <span key={skillId}>{skillLabel(skillId)}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className={styles.rulesSection}>
        <header>
          <div>
            <span className={styles.choiceKicker}>Автоматические владения</span>
            <h3>Выдано источниками</h3>
          </div>
          <span className={styles.rulesStatusAuto}>нельзя снять</span>
        </header>
        <div className={styles.grantedSkillList}>
          {build.skills.grantedSkills.length ? build.skills.grantedSkills.map(skillId => (
            <article key={skillId}>
              <span aria-hidden="true">✓</span>
              <div>
                <strong>{skillLabel(skillId)}</strong>
                <small>{build.skills.skills[skillId].sources
                  .filter(source => source.kind === 'granted')
                  .map(source => source.label)
                  .join(' · ')}</small>
              </div>
              <b>Обучен</b>
            </article>
          )) : (
            <p>Выберите предысторию и класс, чтобы получить обязательные навыки.</p>
          )}
          {background?.trainedLore ? (
            <article>
              <span aria-hidden="true">✓</span>
              <div><strong>{background.trainedLore}</strong><small>Предыстория</small></div>
              <b>Lore</b>
            </article>
          ) : null}
        </div>
      </section>

      {choiceRules.map(rule => {
        const selected = draft.skillChoices.grantedChoiceSelections[rule.id] ?? []
        return (
          <SkillChoiceBlock
            key={rule.id}
            title={rule.label}
            description={`${rule.sourceLabel} · обязательный ограниченный выбор`}
            selected={selected}
            limit={rule.count}
            allowedSkills={rule.allowedSkills}
            draft={draft}
            calculated={build.skills}
            conflict={hasFieldError(`grantedChoiceSelections.${rule.id}`)}
            onToggle={skillId => updateCharacter(current => ({
              ...current,
              skillChoices: {
                ...current.skillChoices,
                grantedChoiceSelections: {
                  ...current.skillChoices.grantedChoiceSelections,
                  [rule.id]: toggleSkillChoice(
                    current.skillChoices.grantedChoiceSelections[rule.id] ?? [],
                    skillId,
                    rule.count,
                  ),
                },
              },
            }), { immediate: true })}
          />
        )
      })}

      {build.skills.replacementChoices.map(replacement => {
        const selectedSkill = draft.skillChoices.replacementSkills[replacement.id]
        const selected = selectedSkill ? [selectedSkill] : []
        return (
          <SkillChoiceBlock
            key={replacement.id}
            title={`Замена: ${skillLabel(replacement.duplicateSkillId)}`}
            description={`${replacement.reason} Выберите другой навык вместо повторного обучения.`}
            selected={selected}
            limit={1}
            draft={draft}
            calculated={build.skills}
            conflict={hasFieldError(`replacementSkills.${replacement.id}`)}
            onToggle={skillId => updateCharacter(current => {
              const replacementSkills = { ...current.skillChoices.replacementSkills }
              if (replacementSkills[replacement.id] === skillId) {
                delete replacementSkills[replacement.id]
              } else {
                replacementSkills[replacement.id] = skillId
              }
              return {
                ...current,
                skillChoices: { ...current.skillChoices, replacementSkills },
              }
            }, { immediate: true })}
          />
        )
      })}

      <SkillChoiceBlock
        title="Дополнительные навыки класса"
        description={characterClass
          ? `${characterClass.name}: базовый лимит задан структурированным правилом класса.`
          : 'Сначала выберите класс.'}
        selected={draft.skillChoices.classFreeSkills}
        limit={build.skills.classFreeLimit}
        draft={draft}
        calculated={build.skills}
        conflict={hasFieldError('classFreeSkills')}
        onToggle={skillId => updateCharacter(current => ({
          ...current,
          skillChoices: {
            ...current.skillChoices,
            classFreeSkills: toggleSkillChoice(
              current.skillChoices.classFreeSkills,
              skillId,
              build.skills.classFreeLimit,
            ),
          },
        }), { immediate: true })}
      />

      <SkillChoiceBlock
        title="Дополнительные навыки от Интеллекта"
        description={`Интеллект ${signedModifier(build.attributes.modifiers.intelligence)}: доступно ${build.skills.intelligenceLimit} дополнительных обученных навыка.`}
        selected={draft.skillChoices.intelligenceSkills}
        limit={build.skills.intelligenceLimit}
        draft={draft}
        calculated={build.skills}
        conflict={hasFieldError('intelligenceSkills')}
        onToggle={skillId => updateCharacter(current => ({
          ...current,
          skillChoices: {
            ...current.skillChoices,
            intelligenceSkills: toggleSkillChoice(
              current.skillChoices.intelligenceSkills,
              skillId,
              build.skills.intelligenceLimit,
            ),
          },
        }), { immediate: true })}
      />

      <section className={styles.rulesSection}>
        <header>
          <div><span className={styles.choiceKicker}>Итог · только чтение</span><h3>Ранги и модификаторы</h3></div>
          <span className={errors.length ? styles.rulesStatusError : styles.rulesStatusOk}>
            {build.skills.trainedCount} обучено
          </span>
        </header>
        <div className={styles.skillAuditGrid}>
          {PATHFINDER2_SKILLS.map(skill => {
            const calculated = build.skills.skills[skill.id]
            return (
              <article key={skill.id}>
                <div>
                  <strong>{skill.label}</strong>
                  <small>
                    {ATTRIBUTE_LABELS[calculated.attribute]} {signedModifier(calculated.attributeModifier)}
                  </small>
                </div>
                <span>
                  {PROFICIENCY_LABELS[calculated.rank]}
                  <small>{signedModifier(calculated.proficiencyBonus)}</small>
                </span>
                <b>= {signedModifier(calculated.modifier)}</b>
              </article>
            )
          })}
        </div>
        {draft.level > 1 ? (
          <p className={styles.ruleChangeNotice}>
            Повышения навыков уровней 2–20 пока не редактируются в интерфейсе; произвольная смена ранга отключена.
          </p>
        ) : null}
      </section>

      {errors.length ? (
        <section className={styles.validationList} aria-label="Ошибки навыков">
          <strong>Нужно исправить</strong>
          <ul>{errors.map(issue => <li key={issue.id}>{issue.message}</li>)}</ul>
        </section>
      ) : null}
    </div>
  )
}
