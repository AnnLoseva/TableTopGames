import {
  getBackgroundById,
  getClassById,
} from '../../data/selectors'
import { v4DraftToRuntime } from '../../data/migration-v4'
import type {
  Pathfinder2CharacterDraftV4,
  Pathfinder2CharacterSource,
  Pathfinder2CharacterState,
  Pathfinder2GrantedFeature,
  Pathfinder2RulesCatalog,
  Pathfinder2ValidationIssue,
} from '../../types'
import { calculateDerivedCharacterValues } from '../derived-character-values'
import {
  calculateArmorClass,
  calculateAttacks,
} from '../combat/calculate-combat'
import { calculateInventory } from '../equipment/calculate-inventory'
import { calculateLanguages } from '../languages/calculate-languages'
import { calculateProficiencies } from '../proficiencies/calculate-proficiencies'
import { calculateReligion } from '../religion/calculate-religion'
import { calculateSpellcasting } from '../spells/calculate-spellcasting'
import { buildCharacter } from './build-character'
import { createDecisionSlot } from './decision-slots'

function uniqueById<T extends { id: string }>(values: T[]) {
  return Array.from(new Map(values.map(value => [value.id, value])).values())
}

function buildClassFeatures(
  draft: Pathfinder2CharacterDraftV4,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2GrantedFeature[] {
  const characterClass = getClassById(catalog, draft.class.classId)
  if (!characterClass) return []

  return characterClass.features
    .filter(feature => (feature.level ?? 1) <= draft.progression.level)
    .map(feature => ({
      ...feature,
      source: {
        type: 'class-feature',
        id: feature.id,
        label: `${characterClass.name} · ${feature.name}`,
        level: feature.level ?? 1,
      },
    }))
}

function buildClassChoiceSlots(
  draft: Pathfinder2CharacterDraftV4,
  catalog: Pathfinder2RulesCatalog,
) {
  const characterClass = getClassById(catalog, draft.class.classId)
  if (!characterClass) return []
  const source: Pathfinder2CharacterSource = {
    type: 'class',
    id: characterClass.id,
    label: `Класс · ${characterClass.name}`,
    level: 1,
  }

  return characterClass.choiceDefinitions
    .filter(definition => definition.level <= draft.progression.level)
    .map(definition => createDecisionSlot({
      source,
      type: 'class-choice' as const,
      level: definition.level,
      required: definition.required,
      count: definition.count,
      selectedIds: draft.class.specializationChoices[definition.id]
        ?? draft.class.specializationChoices['class-specialization']
        ?? [],
    }))
}

function classChoiceIssues(
  draft: Pathfinder2CharacterDraftV4,
  catalog: Pathfinder2RulesCatalog,
  slots: Pathfinder2CharacterState['classChoiceSlots'],
): Pathfinder2ValidationIssue[] {
  const characterClass = getClassById(catalog, draft.class.classId)
  if (!characterClass) return []

  return slots.flatMap((slot, index) => {
    const definition = characterClass.choiceDefinitions[index]
    if (!slot.required || slot.selectedIds.length === slot.count) return []
    return [{
      id: `class.choice.${definition?.id ?? slot.id}`,
      severity: 'error' as const,
      step: 'class' as const,
      section: 'class-choice',
      field: definition?.id ?? slot.id,
      level: slot.level,
      message: `Завершите выбор «${definition?.label ?? 'особенность класса'}».`,
      relatedChoiceId: slot.id,
    }]
  })
}

export function buildCharacterState(
  draft: Pathfinder2CharacterDraftV4,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2CharacterState {
  const runtimeDraft = v4DraftToRuntime(draft)
  const legacyBuild = buildCharacter(runtimeDraft, catalog)
  const background = getBackgroundById(catalog, draft.background.backgroundId)
  const classChoiceSlots = buildClassChoiceSlots(draft, catalog)
  const proficiencies = calculateProficiencies(draft, catalog)
  const inventory = calculateInventory(
    draft.inventory.entries,
    draft.inventory.currency,
    legacyBuild.attributes.modifiers.strength,
    catalog,
  )
  const armorClass = calculateArmorClass({
    dexterityModifier: legacyBuild.attributes.modifiers.dexterity,
    strengthModifier: legacyBuild.attributes.modifiers.strength,
    inventory,
    proficiencies,
    catalog,
  })
  const baseDerived = calculateDerivedCharacterValues(
    runtimeDraft,
    catalog,
    legacyBuild,
  )
  const spellcasting = calculateSpellcasting(
    draft,
    catalog,
    legacyBuild.attributes.modifiers,
  )
  const languages = calculateLanguages(
    draft,
    catalog,
    legacyBuild.attributes.modifiers.intelligence,
  )
  const religion = calculateReligion(draft, catalog)
  const validationIssues = [
    ...legacyBuild.validationIssues,
    ...classChoiceIssues(draft, catalog, classChoiceSlots),
    ...spellcasting.issues,
    ...languages.issues,
    ...religion.issues,
  ]
  const selectedFeatIds = [
    ...Object.values(draft.feats.selectedBySlot),
    ...Object.values(draft.ancestry.featChoicesByLevel).flat(),
    ...Object.values(draft.class.featChoicesByLevel).flat(),
  ].filter(Boolean)

  return {
    draft,
    runtimeDraft,
    legacyBuild,
    derived: {
      ...baseDerived,
      armorClass: armorClass.value,
      speed: baseDerived.speed === null
        ? null
        : Math.max(0, baseDerived.speed + armorClass.speedPenalty),
    },
    proficiencies,
    features: buildClassFeatures(draft, catalog),
    loreEntries: uniqueById([
      ...(background?.grantedLore ? [background.grantedLore] : []),
      ...draft.skills.loreEntries,
    ]),
    grantedFeatIds: Array.from(new Set([
      ...(background?.grantedFeatIds ?? []),
      ...selectedFeatIds,
    ])),
    inventory,
    attacks: calculateAttacks({
      strengthModifier: legacyBuild.attributes.modifiers.strength,
      dexterityModifier: legacyBuild.attributes.modifiers.dexterity,
      inventory,
      proficiencies,
      catalog,
    }),
    spellcasting,
    languages,
    religion,
    classChoiceSlots,
    validationIssues,
    isReady: !validationIssues.some(issue => issue.severity === 'error'),
  }
}
