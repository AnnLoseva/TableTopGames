import assert from 'node:assert/strict'
import { createDefaultPathfinder2Draft } from '../data'
import { migratePathfinder2Draft } from '../data/migration'
import type {
  Pathfinder2AncestryRule,
  Pathfinder2BackgroundRule,
  Pathfinder2CharacterDraft,
  Pathfinder2ClassRule,
  Pathfinder2ProficiencyRank,
  Pathfinder2RulesCatalog,
} from '../types'
import { calculateAttributeModifiers } from './attributes/calculate-attributes'
import { validateAttributeChoices } from './attributes/validate-attribute-choices'
import { buildCharacter } from './creation/build-character'
import { reconcileCharacterDecisions } from './creation/reconcile-character'
import { validateCharacterBuild } from './creation/validate-character'
import {
  getStructuredClassSkillRules,
} from './creation/structured-rules'
import { validateSkillIncreases } from './progression/skill-progression'

const emptyRoleplaying = {
  combat: '',
  social: '',
  exploration: '',
  downtime: '',
  youMight: [],
  othersProbably: [],
}

function ancestry(
  id: string,
  abilityBoosts: string[],
  abilityFlaw: string | null,
): Pathfinder2AncestryRule {
  return {
    id,
    name: id === 'dwarf' ? 'Дварф' : 'Человек',
    tagline: '',
    description: '',
    rarity: 'common',
    traits: [],
    youMight: [],
    othersProbably: [],
    popularEdicts: [],
    popularAnathema: [],
    sampleNames: '',
    hp: 8,
    speed: 25,
    size: 'medium',
    abilityBoosts,
    abilityFlaw,
    languages: [],
    bonusLanguages: '',
    senses: [],
    specialAbilities: [],
    heritages: [{
      id: `${id}-heritage`,
      name: `${id} heritage`,
      description: '',
      traits: [],
      ancestryId: id,
      ancestryName: id,
    }],
    sourceBook: 'test',
  }
}

function background(
  id: string,
  grantedSkill: 'medicine' | 'crafting',
): Pathfinder2BackgroundRule {
  return {
    id,
    name: id,
    description: '',
    rarity: 'common',
    abilityBoosts: 'Телосложение или Мудрость',
    abilityBoostOptions: ['constitution', 'wisdom'],
    trainedSkills: grantedSkill,
    skillRules: {
      grantedSkills: [{ skillId: grantedSkill, sourceLabel: 'Предыстория' }],
      grantedSkillChoices: [],
    },
    trainedLore: 'Test Lore',
    skillFeat: '',
    sourceBook: 'test',
    tab: 'general',
    region: null,
  }
}

function characterClass(id = 'alchemist'): Pathfinder2ClassRule {
  return {
    id,
    name: id,
    description: '',
    rarity: 'common',
    role: '',
    hp: 8,
    keyAbilities: ['intelligence'],
    perception: 'trained',
    fortitude: 'trained',
    reflex: 'trained',
    will: 'trained',
    skills: '',
    skillRules: getStructuredClassSkillRules(id),
    attacks: '',
    defenses: '',
    classDc: 'trained',
    spellTradition: null,
    spellSlots: null,
    keyTerms: [],
    roleplaying: emptyRoleplaying,
    features: [],
    specializations: [],
    sourceBook: 'test',
  }
}

const catalog: Pathfinder2RulesCatalog = {
  ancestries: [
    ancestry('dwarf', ['constitution', 'wisdom', 'free'], 'charisma'),
    ancestry('human', ['free', 'free'], null),
  ],
  versatileHeritages: [{
    id: 'aasimar',
    name: 'Аасимар',
    altName: '',
    tagline: '',
    description: '',
    traits: [],
    senses: [],
    mechanics: '',
    sourceBook: 'test',
    negativeHealing: false,
  }],
  backgrounds: [
    background('field-medic', 'medicine'),
    background('artisan', 'crafting'),
  ],
  classes: [characterClass()],
  generalFeats: [],
  skillFeats: [],
  mythicFeats: [],
  sources: [],
  validationWarnings: [],
}

function validDraft(): Pathfinder2CharacterDraft {
  const draft = createDefaultPathfinder2Draft()
  return {
    ...draft,
    name: 'Тест',
    concept: 'Строго собранный герой',
    ancestryId: 'dwarf',
    heritageId: 'dwarf-heritage',
    backgroundId: 'field-medic',
    classId: 'alchemist',
    attributeChoices: {
      ...draft.attributeChoices,
      ancestryFreeBoosts: ['intelligence'],
      backgroundLimitedBoost: 'constitution',
      backgroundFreeBoost: 'intelligence',
      classKeyBoost: 'intelligence',
      finalFreeBoosts: ['strength', 'dexterity', 'intelligence', 'wisdom'],
    },
    skillChoices: {
      ...draft.skillChoices,
      classFreeSkills: ['acrobatics', 'athletics', 'diplomacy'],
      intelligenceSkills: ['deception', 'intimidation', 'nature', 'society'],
    },
  }
}

const tests: Array<[string, () => void]> = [
  ['Все характеристики начинают с +0', () => {
    const result = calculateAttributeModifiers(createDefaultPathfinder2Draft(), catalog)
    assert.deepEqual(Object.values(result.modifiers), [0, 0, 0, 0, 0, 0])
  }],
  ['Стандартные повышения дварфа применяются корректно', () => {
    const draft = createDefaultPathfinder2Draft()
    draft.ancestryId = 'dwarf'
    const result = calculateAttributeModifiers(draft, catalog)
    assert.equal(result.modifiers.constitution, 1)
    assert.equal(result.modifiers.wisdom, 1)
    assert.equal(result.modifiers.charisma, -1)
  }],
  ['Альтернативные повышения заменяют стандартные', () => {
    const draft = createDefaultPathfinder2Draft()
    draft.ancestryId = 'dwarf'
    draft.attributeChoices.ancestryMode = 'alternate'
    draft.attributeChoices.ancestryFreeBoosts = ['strength', 'dexterity']
    const result = calculateAttributeModifiers(draft, catalog)
    assert.equal(result.modifiers.strength, 1)
    assert.equal(result.modifiers.dexterity, 1)
    assert.equal(result.modifiers.constitution, 0)
    assert.equal(result.modifiers.charisma, 0)
  }],
  ['Одну характеристику нельзя повысить дважды на этапе народа', () => {
    const draft = validDraft()
    draft.attributeChoices.ancestryFreeBoosts = ['constitution']
    assert.ok(validateAttributeChoices(draft, catalog).some(issue => (
      issue.id === 'attributes.ancestry-duplicate'
    )))
  }],
  ['Повышения предыстории должны быть разными', () => {
    const draft = validDraft()
    draft.attributeChoices.backgroundLimitedBoost = 'wisdom'
    draft.attributeChoices.backgroundFreeBoost = 'wisdom'
    assert.ok(validateAttributeChoices(draft, catalog).some(issue => (
      issue.id === 'attributes.background-duplicate'
    )))
  }],
  ['Четыре финальных повышения должны быть разными', () => {
    const draft = validDraft()
    draft.attributeChoices.finalFreeBoosts = ['strength', 'strength', 'wisdom', 'dexterity']
    assert.ok(validateAttributeChoices(draft, catalog).some(issue => (
      issue.id === 'attributes.final-free-count'
    )))
  }],
  ['Класс принимает только разрешённую ключевую характеристику', () => {
    const draft = validDraft()
    draft.attributeChoices.classKeyBoost = 'strength'
    assert.ok(validateAttributeChoices(draft, catalog).some(issue => (
      issue.id === 'attributes.class-key'
    )))
  }],
  ['На первом уровне нельзя получить значение выше +4', () => {
    const draft = validDraft()
    draft.attributeChoices.ancestryFreeBoosts = ['intelligence', 'intelligence']
    assert.ok(validateAttributeChoices(draft, catalog).some(issue => (
      issue.id === 'attributes.maximum.intelligence'
    )))
  }],
  ['Смена народа очищает несовместимое наследие', () => {
    const current = validDraft()
    const result = reconcileCharacterDecisions(current, {
      ...current,
      ancestryId: 'human',
    }, catalog)
    assert.equal(result.draft.heritageId, '')
  }],
  ['Обычное и универсальное наследие взаимоисключающие', () => {
    const draft = validDraft()
    draft.versatileHeritageId = 'aasimar'
    assert.ok(validateCharacterBuild(draft, catalog).some(issue => (
      issue.id === 'heritage.mutually-exclusive'
    )))
  }],
  ['Предыстория автоматически выдаёт навык', () => {
    assert.equal(buildCharacter(validDraft(), catalog).skills.skills.medicine.rank, 'trained')
  }],
  ['Класс автоматически выдаёт обязательный навык', () => {
    assert.equal(buildCharacter(validDraft(), catalog).skills.skills.crafting.rank, 'trained')
  }],
  ['Лимиты навыков зависят от класса и Интеллекта', () => {
    const skills = buildCharacter(validDraft(), catalog).skills
    assert.equal(skills.classFreeLimit, 3)
    assert.equal(skills.intelligenceLimit, 4)
  }],
  ['Нельзя выбрать больше навыков, чем доступно', () => {
    const draft = validDraft()
    draft.skillChoices.classFreeSkills.push('survival')
    assert.ok(buildCharacter(draft, catalog).validationIssues.some(issue => (
      issue.id === 'skills.class-free.too-many'
    )))
  }],
  ['Дублирующее обучение создаёт replacement choice', () => {
    const draft = validDraft()
    draft.backgroundId = 'artisan'
    assert.equal(buildCharacter(draft, catalog).skills.replacementChoices.length, 1)
  }],
  ['Повторное обучение не повышает навык до эксперта', () => {
    const draft = validDraft()
    draft.backgroundId = 'artisan'
    assert.equal(buildCharacter(draft, catalog).skills.skills.crafting.rank, 'trained')
  }],
  ['Нельзя перейти trained → master', () => {
    const draft = validDraft()
    draft.level = 7
    draft.skillChoices.skillIncreases = [{
      level: 3,
      skillId: 'crafting',
      fromRank: 'trained',
      toRank: 'master',
    }]
    const ranks = { crafting: 'trained' } as Record<string, Pathfinder2ProficiencyRank>
    assert.ok(validateSkillIncreases(draft, catalog, ranks).some(issue => (
      issue.id.startsWith('skills.increase.sequence')
    )))
  }],
  ['Master недоступен раньше 7-го уровня', () => {
    const draft = validDraft()
    draft.level = 5
    draft.skillChoices.skillIncreases = [
      { level: 3, skillId: 'crafting', fromRank: 'trained', toRank: 'expert' },
      { level: 5, skillId: 'crafting', fromRank: 'expert', toRank: 'master' },
    ]
    const ranks = { crafting: 'trained' } as Record<string, Pathfinder2ProficiencyRank>
    assert.ok(validateSkillIncreases(draft, catalog, ranks).some(issue => (
      issue.id.startsWith('skills.increase.minimum-level')
    )))
  }],
  ['Legendary недоступен раньше 15-го уровня', () => {
    const draft = validDraft()
    draft.level = 13
    draft.skillChoices.skillIncreases = [
      { level: 3, skillId: 'crafting', fromRank: 'trained', toRank: 'expert' },
      { level: 7, skillId: 'crafting', fromRank: 'expert', toRank: 'master' },
      { level: 13, skillId: 'crafting', fromRank: 'master', toRank: 'legendary' },
    ]
    const ranks = { crafting: 'trained' } as Record<string, Pathfinder2ProficiencyRank>
    assert.ok(validateSkillIncreases(draft, catalog, ranks).some(issue => (
      issue.id.startsWith('skills.increase.minimum-level')
    )))
  }],
  ['Изменение Интеллекта пересчитывает лимит', () => {
    const draft = validDraft()
    const before = buildCharacter(draft, catalog).skills.intelligenceLimit
    draft.attributeChoices.ancestryFreeBoosts = ['dexterity']
    const after = buildCharacter(draft, catalog).skills.intelligenceLimit
    assert.equal(before - after, 1)
  }],
  ['Невалидный билд блокирует завершение', () => {
    assert.equal(buildCharacter(createDefaultPathfinder2Draft(), catalog).isReady, false)
  }],
  ['Валидный билд проходит без errors', () => {
    const build = buildCharacter(validDraft(), catalog)
    assert.deepEqual(build.validationIssues.filter(issue => issue.severity === 'error'), [])
    assert.equal(build.isReady, true)
  }],
  ['Старый localStorage помечается needsRulesRebuild', () => {
    const migrated = migratePathfinder2Draft({
      schemaVersion: 2,
      name: 'Старый',
      attributes: { strength: 3 },
      trainedSkills: ['Медицина'],
    }, catalog)
    assert.equal(migrated.draft.needsRulesRebuild, true)
    assert.equal(migrated.draft.skillChoices.suggestedSkills[0], 'medicine')
    assert.equal(migrated.draft.legacySnapshot?.attributes?.strength, 3)
  }],
  ['Миграция сохраняет имя, концепцию и заметки', () => {
    const migrated = migratePathfinder2Draft({
      schemaVersion: 2,
      name: 'Старый',
      concept: 'Концепция',
      notes: 'Заметки',
    }, catalog)
    assert.equal(migrated.draft.name, 'Старый')
    assert.equal(migrated.draft.concept, 'Концепция')
    assert.equal(migrated.draft.notes, 'Заметки')
  }],
]

for (const [name, test] of tests) {
  try {
    test()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

console.log(`Pathfinder 2 builder: ${tests.length} сценария пройдено.`)
