import { getClassById, getFeatById } from '../../data/selectors'
import { v4DraftToRuntime } from '../../data/migration-v4'
import type {
  Pathfinder2CharacterDraftV4,
  Pathfinder2GrantedFeature,
  Pathfinder2LevelChoices,
  Pathfinder2LevelUpPlan,
  Pathfinder2LevelUpResult,
  Pathfinder2RulesCatalog,
  Pathfinder2ValidationIssue,
} from '../../types'
import { getSpellSlotsAtLevel } from '../spells/calculate-spellcasting'
import { buildCharacter } from '../creation/build-character'
import { buildCharacterState } from '../creation/build-character-state'
import { createFeatSlot } from '../creation/decision-slots'
import {
  getFeatAvailability,
  getFeatsForSlot,
} from '../feats/requirements'
import { getNextProficiencyRank } from '../skills/proficiency'
import { canReachSkillRankAtLevel } from './skill-progression'
import {
  getClassProgressionLevel,
  hasClassProgression,
} from './class-progression'

const EXPERIENCE_PER_LEVEL = 1_000

function unavailableIssue(
  catalog: Pathfinder2RulesCatalog,
  id: 'class-progression' | 'ancestry-feats' | 'class-feats',
  targetLevel: number,
) {
  const availability = catalog.dataAvailability.find(entry => entry.id === id)
  if (!availability || availability.status === 'connected') return null
  return {
    id: `level-up.catalog.${id}.${targetLevel}`,
    severity: 'error' as const,
    step: 'features' as const,
    section: 'progression',
    level: targetLevel,
    message: `${availability.label}: обязательный справочник прогрессии не подключён.`,
  }
}

function automaticFeatures(
  draft: Pathfinder2CharacterDraftV4,
  targetLevel: number,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2GrantedFeature[] {
  const characterClass = getClassById(catalog, draft.class.classId)
  if (!characterClass) return []
  return characterClass.features
    .filter(feature => (feature.level ?? 1) === targetLevel)
    .map(feature => ({
      ...feature,
      source: {
        type: 'class-feature',
        id: feature.id,
        label: `${characterClass.name} · ${feature.name}`,
        level: targetLevel,
      },
    }))
}

export function buildLevelUpPlan(
  draft: Pathfinder2CharacterDraftV4,
  targetLevel: number,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2LevelUpPlan {
  const expectedTarget = draft.progression.level + 1
  const characterClass = getClassById(catalog, draft.class.classId)
  const issues: Pathfinder2ValidationIssue[] = []
  if (targetLevel !== expectedTarget || targetLevel > 20) {
    issues.push({
      id: `level-up.sequence.${targetLevel}`,
      severity: 'error',
      step: 'features',
      section: 'progression',
      level: targetLevel,
      message: `Повышение выполняется только на один уровень: ожидается ${expectedTarget}.`,
    })
  }
  if (!characterClass) {
    issues.push({
      id: `level-up.class.${targetLevel}`,
      severity: 'error',
      step: 'class',
      section: 'progression',
      level: targetLevel,
      message: 'Для повышения нужен проверенный класс.',
    })
  }
  for (const id of ['class-progression', 'ancestry-feats', 'class-feats'] as const) {
    const issue = unavailableIssue(catalog, id, targetLevel)
    if (issue) issues.push(issue)
  }
  if (
    characterClass
    && !hasClassProgression(catalog, characterClass.id)
  ) {
    issues.push({
      id: `level-up.class-progression.${characterClass.id}.${targetLevel}`,
      severity: 'error',
      step: 'features',
      section: 'progression',
      level: targetLevel,
      message: `Для класса «${characterClass.name}» нет подключённой прогрессии 1–20.`,
    })
  }
  const progression = characterClass
    ? getClassProgressionLevel(catalog, characterClass.id, targetLevel)
    : null
  const spellSlots = getSpellSlotsAtLevel(
    characterClass?.spellSlots ?? null,
    targetLevel,
  )
  return {
    fromLevel: draft.progression.level,
    targetLevel,
    experienceCost: EXPERIENCE_PER_LEVEL,
    automaticFeatures: automaticFeatures(draft, targetLevel, catalog),
    attributeBoostCount: progression?.attributeBoostCount ?? 0,
    skillIncreaseCount: progression?.skillIncreaseCount ?? 0,
    featSlots: (progression?.featSlots ?? []).map((definition, index) => ({
      ...createFeatSlot({
        source: {
          type: 'level',
          id: `level-${targetLevel}`,
          label: `${targetLevel}-й уровень`,
          level: targetLevel,
        },
        type: definition.type,
        level: targetLevel,
        required: definition.required,
        selectedFeatId: draft.feats.selectedBySlot[definition.id] ?? null,
        index,
      }),
      id: definition.id,
    })),
    spellSlots: spellSlots.spellSlots,
    cantripSlots: spellSlots.cantripSlots,
    issues,
  }
}

function duplicateCount(values: string[]) {
  return values.length - new Set(values).size
}

function validateFeatSelections(
  choices: Pathfinder2LevelChoices,
  draft: Pathfinder2CharacterDraftV4,
  catalog: Pathfinder2RulesCatalog,
  plan: Pathfinder2LevelUpPlan,
) {
  const issues: Pathfinder2ValidationIssue[] = []
  const previewState = buildCharacterState({
    ...draft,
    progression: {
      ...draft.progression,
      level: choices.level,
    },
  }, catalog)
  const selectedIds = Object.values(choices.featSelections).filter(Boolean)

  plan.featSlots.forEach(slot => {
    const selectedId = choices.featSelections[slot.id] ?? ''
    if (!selectedId) {
      if (slot.required) {
        issues.push({
          id: `level-up.feat.required.${choices.level}.${slot.id}`,
          severity: 'error',
          step: 'features',
          section: 'progression',
          field: slot.id,
          level: choices.level,
          relatedChoiceId: slot.id,
          message: `Выберите черту для слота «${slot.type}».`,
        })
      }
      return
    }
    const feat = getFeatById(catalog, selectedId)
    if (!feat || !getFeatsForSlot(slot, catalog).some(entry => entry.id === selectedId)) {
      issues.push({
        id: `level-up.feat.missing.${choices.level}.${slot.id}`,
        severity: 'error',
        step: 'features',
        section: 'progression',
        field: slot.id,
        level: choices.level,
        relatedChoiceId: slot.id,
        message: 'Выбранная черта не соответствует типу слота.',
      })
      return
    }
    const availability = getFeatAvailability(feat, slot, previewState)
    if (!availability.available) {
      issues.push({
        id: `level-up.feat.invalid.${choices.level}.${slot.id}`,
        severity: 'error',
        step: 'features',
        section: 'progression',
        field: slot.id,
        level: choices.level,
        relatedChoiceId: slot.id,
        message: `${feat.name}: ${availability.reasons.join(' ')}`,
      })
    } else if (availability.needsManualReview) {
      issues.push({
        id: `level-up.feat.manual.${choices.level}.${slot.id}`,
        severity: 'warning',
        step: 'features',
        section: 'progression',
        field: slot.id,
        level: choices.level,
        relatedChoiceId: slot.id,
        message: `${feat.name}: ${availability.reasons.join(' ')}`,
      })
    }
  })

  if (duplicateCount(selectedIds) > 0) {
    issues.push({
      id: `level-up.feat.duplicates.${choices.level}`,
      severity: 'error',
      step: 'features',
      section: 'progression',
      level: choices.level,
      message: 'Одну и ту же черту нельзя выбрать в нескольких слотах уровня.',
    })
  }
  return issues
}

export function validateLevelUp(
  choices: Pathfinder2LevelChoices,
  draft: Pathfinder2CharacterDraftV4,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2ValidationIssue[] {
  const plan = buildLevelUpPlan(draft, choices.level, catalog)
  const issues = [
    ...plan.issues,
    ...validateFeatSelections(choices, draft, catalog, plan),
  ]
  if (
    choices.attributeBoosts.length !== plan.attributeBoostCount
    || duplicateCount(choices.attributeBoosts) > 0
  ) {
    issues.push({
      id: `level-up.attributes.${choices.level}`,
      severity: 'error',
      step: 'final-attributes',
      section: 'progression',
      level: choices.level,
      message: plan.attributeBoostCount
        ? `На ${choices.level}-м уровне выберите четыре разные характеристики.`
        : `На ${choices.level}-м уровне пакет повышений характеристик не выдаётся.`,
    })
  }
  if (choices.skillIncreases.length !== plan.skillIncreaseCount) {
    issues.push({
      id: `level-up.skills.${choices.level}`,
      severity: 'error',
      step: 'features',
      section: 'progression',
      level: choices.level,
      message: `Повышения навыков: выбрано ${choices.skillIncreases.length} из ${plan.skillIncreaseCount}.`,
    })
  }
  const currentBuild = buildCharacter(v4DraftToRuntime(draft), catalog)
  choices.skillIncreases.forEach((increase, index) => {
    const currentRank = currentBuild.skills.skills[increase.skillId].rank
    const nextRank = getNextProficiencyRank(currentRank)
    if (
      increase.level !== choices.level
      || increase.fromRank !== currentRank
      || increase.toRank !== nextRank
    ) {
      issues.push({
        id: `level-up.skill-sequence.${choices.level}.${index}`,
        severity: 'error',
        step: 'features',
        section: 'progression',
        level: choices.level,
        message: 'Ранг навыка можно повысить только на одну ступень от текущего ранга.',
      })
    } else if (!canReachSkillRankAtLevel(increase.toRank, choices.level)) {
      issues.push({
        id: `level-up.skill-minimum.${choices.level}.${index}`,
        severity: 'error',
        step: 'features',
        section: 'progression',
        level: choices.level,
        message: increase.toRank === 'master'
          ? 'Ранг мастера недоступен раньше 7-го уровня.'
          : 'Легендарный ранг недоступен раньше 15-го уровня.',
      })
    }
  })
  return Array.from(new Map(issues.map(issue => [issue.id, issue])).values())
}

function updateSpellcastingForLevel(
  draft: Pathfinder2CharacterDraftV4,
  plan: Pathfinder2LevelUpPlan,
) {
  return draft.spellcasting.entries.map(entry => ({
    ...entry,
    cantripSlots: plan.cantripSlots || entry.cantripSlots,
    spellSlots: Object.keys(plan.spellSlots).length
      ? plan.spellSlots
      : entry.spellSlots,
  }))
}

export function applyLevelUp(
  draft: Pathfinder2CharacterDraftV4,
  choices: Pathfinder2LevelChoices,
  catalog: Pathfinder2RulesCatalog,
  useExperience = false,
): Pathfinder2LevelUpResult {
  const plan = buildLevelUpPlan(draft, choices.level, catalog)
  const issues = validateLevelUp(choices, draft, catalog)
  if (useExperience && draft.progression.experience < plan.experienceCost) {
    issues.push({
      id: `level-up.experience.${choices.level}`,
      severity: 'error',
      step: 'details',
      section: 'progression',
      level: choices.level,
      message: `Для повышения нужно ${plan.experienceCost} XP.`,
    })
  }
  if (issues.some(issue => issue.severity === 'error')) {
    return { ok: false, plan, issues }
  }
  const level = choices.level
  const ancestryFeatIds = plan.featSlots
    .filter(slot => slot.type === 'ancestry-feat')
    .map(slot => choices.featSelections[slot.id])
    .filter(Boolean)
  const classFeatIds = plan.featSlots
    .filter(slot => slot.type === 'class-feat')
    .map(slot => choices.featSelections[slot.id])
    .filter(Boolean)
  return {
    ok: true,
    plan,
    draft: {
      ...draft,
      progression: {
        ...draft.progression,
        level,
        experience: useExperience
          ? draft.progression.experience - plan.experienceCost
          : draft.progression.experience,
        completedLevels: Array.from(new Set([
          ...draft.progression.completedLevels,
          level,
        ])).sort((left, right) => left - right),
        choicesByLevel: {
          ...draft.progression.choicesByLevel,
          [level]: choices,
        },
      },
      attributes: {
        ...draft.attributes,
        levelBoosts: {
          ...draft.attributes.levelBoosts,
          ...(choices.attributeBoosts.length
            ? { [level]: [...choices.attributeBoosts] }
            : {}),
        },
      },
      skills: {
        ...draft.skills,
        increasesByLevel: {
          ...draft.skills.increasesByLevel,
          ...(choices.skillIncreases.length
            ? { [level]: [...choices.skillIncreases] }
            : {}),
        },
      },
      feats: {
        ...draft.feats,
        selectedBySlot: {
          ...draft.feats.selectedBySlot,
          ...Object.fromEntries(
            Object.entries(choices.featSelections).filter(([, featId]) => Boolean(featId)),
          ),
        },
      },
      ancestry: {
        ...draft.ancestry,
        featChoicesByLevel: {
          ...draft.ancestry.featChoicesByLevel,
          ...(ancestryFeatIds.length ? { [level]: ancestryFeatIds } : {}),
        },
      },
      class: {
        ...draft.class,
        featChoicesByLevel: {
          ...draft.class.featChoicesByLevel,
          ...(classFeatIds.length ? { [level]: classFeatIds } : {}),
        },
      },
      spellcasting: {
        entries: updateSpellcastingForLevel(draft, plan),
      },
    },
  }
}
