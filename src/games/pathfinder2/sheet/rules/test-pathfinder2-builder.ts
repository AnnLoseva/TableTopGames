import assert from 'node:assert/strict'
import {
  createDefaultPathfinder2Draft,
  PATHFINDER2_DRAFT_STORAGE_KEY,
  PATHFINDER2_LEGACY_DRAFT_STORAGE_KEYS,
} from '../data'
import { migratePathfinder2Draft } from '../data/migration'
import {
  migratePathfinder2DraftV4,
  runtimeDraftToV4,
  v4DraftToRuntime,
} from '../data/migration-v4'
import { createDefaultPathfinder2DraftV4 } from '../data/v4'
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
import { buildCharacterState } from './creation/build-character-state'
import {
  createDecisionSlot,
  createFeatSlot,
  isDecisionSlotComplete,
} from './creation/decision-slots'
import { reconcileCharacterDecisions } from './creation/reconcile-character'
import { getFeatAvailability } from './feats/requirements'
import { calculateProficiencyGrants } from './proficiencies/calculate-proficiencies'
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
    languageRules: {
      grantedLanguageIds: [],
      bonusChoiceCount: 0,
      bonusLanguageIds: [],
    },
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
    grantedLore: {
      id: `background:${id}:lore`,
      name: 'Test Lore',
      rank: 'trained',
      source: {
        type: 'background',
        id,
        label: 'Предыстория',
        level: 1,
      },
      custom: false,
    },
    grantedFeatIds: [],
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
    proficiencyGrants: [],
    choiceDefinitions: [],
    requiresDeity: false,
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
  equipment: [],
  weapons: [],
  armor: [],
  shields: [],
  spells: [],
  cantrips: [],
  focusSpells: [],
  languages: [],
  deities: [],
  sources: [],
  dataAvailability: [],
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
  ['Добровольное понижение хранится отдельно и не выдаёт повышение', () => {
    const draft = createDefaultPathfinder2Draft()
    draft.ancestryId = 'human'
    draft.attributeChoices.ancestryFreeBoosts = ['strength', 'dexterity']
    draft.attributeChoices.voluntaryFlaws = ['charisma']
    const result = calculateAttributeModifiers(draft, catalog)
    assert.equal(result.modifiers.charisma, -1)
    assert.ok(result.breakdown.charisma.some(entry => (
      entry.source === 'voluntary-flaw' && entry.delta === -1
    )))
  }],
  ['Добровольное понижение не может опустить итог ниже −1', () => {
    const draft = createDefaultPathfinder2Draft()
    draft.ancestryId = 'dwarf'
    draft.attributeChoices.voluntaryFlaws = ['charisma']
    assert.ok(validateAttributeChoices(draft, catalog).some(
      issue => issue.id === 'attributes.minimum.charisma',
    ))
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
  ['Модификатор навыка объясняется характеристикой и владением', () => {
    const crafting = buildCharacter(validDraft(), catalog).skills.skills.crafting
    assert.equal(crafting.attribute, 'intelligence')
    assert.equal(crafting.attributeModifier, 4)
    assert.equal(crafting.proficiencyBonus, 3)
    assert.equal(crafting.modifier, 7)
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
  ['Schema v4 использует новый ключ и сохраняет ключ v3 для чтения', () => {
    assert.equal(PATHFINDER2_DRAFT_STORAGE_KEY, 'pathfinder2-character-draft-v4')
    assert.ok(PATHFINDER2_LEGACY_DRAFT_STORAGE_KEYS.includes(
      'pathfinder2-character-draft-v3',
    ))
  }],
  ['Новый v4-черновик начинает с 15 зм и 1 пункта героизма', () => {
    const draft = createDefaultPathfinder2DraftV4()
    assert.equal(draft.schemaVersion, 4)
    assert.deepEqual(draft.inventory.currency, { cp: 0, sp: 0, gp: 15, pp: 0 })
    assert.equal(draft.progression.heroPoints, 1)
  }],
  ['Миграция v3 → v4 сохраняет решения и свободные строки без угадывания ID', () => {
    const v3 = validDraft()
    v3.player = 'Игрок'
    v3.pronouns = 'они/их'
    v3.lore = 'Знания моря'
    v3.languages = 'Всеобщий, эльфийский'
    v3.equipment = 'Меч и старый набор'
    v3.notes = 'Не потерять'
    v3.currentHp = 11
    v3.tempHp = 2
    v3.generalFeatIds = ['toughness']

    const migrated = migratePathfinder2DraftV4(v3, catalog)
    assert.equal(migrated.draft.schemaVersion, 4)
    assert.equal(migrated.draft.identity.name, 'Тест')
    assert.equal(migrated.draft.identity.player, 'Игрок')
    assert.equal(migrated.draft.background.backgroundId, 'field-medic')
    assert.equal(migrated.draft.class.classId, 'alchemist')
    assert.equal(migrated.draft.vitals.currentHp, 11)
    assert.equal(migrated.draft.vitals.tempHp, 2)
    assert.equal(migrated.draft.migration.legacyNotes.lore, 'Знания моря')
    assert.equal(
      migrated.draft.migration.legacyNotes.languages,
      'Всеобщий, эльфийский',
    )
    assert.equal(
      migrated.draft.migration.legacyNotes.equipment,
      'Меч и старый набор',
    )
    assert.equal(migrated.draft.migration.needsReview, true)
    assert.ok(migrated.draft.migration.legacySnapshot)
    assert.ok(migrated.draft.migration.unresolvedSelections.some(
      entry => entry.kind === 'equipment',
    ))
    assert.ok(migrated.draft.migration.unresolvedSelections.some(
      entry => entry.suggestedId === 'toughness',
    ))
  }],
  ['V4 round-trip сохраняет вложенные данные при работе старого runtime UI', () => {
    const v4 = createDefaultPathfinder2DraftV4()
    v4.identity.backstory = 'История остаётся в v4'
    v4.details.personalEdicts = ['Помогать путникам']
    v4.progression.experience = 750
    v4.ancestry.featChoicesByLevel = {
      1: ['ancestry-feat-1'],
      5: ['ancestry-feat-5'],
    }
    v4.skills.freeSelections['intelligence:level:5'] = ['arcana']
    v4.feats.suggestedSelectionsByType['mythic-feat'] = ['mythic-feat-1']
    const runtime = v4DraftToRuntime(v4)
    runtime.name = 'Новое имя'
    const updated = runtimeDraftToV4(runtime, v4)
    assert.equal(updated.identity.name, 'Новое имя')
    assert.equal(updated.identity.backstory, 'История остаётся в v4')
    assert.deepEqual(updated.details.personalEdicts, ['Помогать путникам'])
    assert.equal(updated.progression.experience, 750)
    assert.deepEqual(updated.ancestry.featChoicesByLevel, {
      1: ['ancestry-feat-1'],
      5: ['ancestry-feat-5'],
    })
    assert.deepEqual(
      updated.skills.freeSelections['intelligence:level:5'],
      ['arcana'],
    )
    assert.deepEqual(
      updated.feats.suggestedSelectionsByType['mythic-feat'],
      ['mythic-feat-1'],
    )
    assert.ok(!updated.feats.suggestedSelectionsByType['general-feat'].includes(
      'mythic-feat-1',
    ))
  }],
  ['Слоты решений имеют стабильный источник и отдельную заполненность', () => {
    const source = {
      type: 'level' as const,
      id: 'level-1',
      label: '1-й уровень',
      level: 1,
    }
    const decision = createDecisionSlot({
      source,
      type: 'language',
      level: 1,
      count: 2,
      selectedIds: ['common'],
    })
    const feat = createFeatSlot({
      source,
      type: 'ancestry-feat',
      level: 1,
    })
    assert.equal(decision.id, 'level:level-1:language:1:0')
    assert.equal(isDecisionSlotComplete(decision), false)
    assert.equal(isDecisionSlotComplete(feat), false)
    assert.equal(isDecisionSlotComplete({ ...feat, selectedFeatId: 'feat-1' }), true)
  }],
  ['Структурированные владения выбирают максимальный ранг и сохраняют источник', () => {
    const source = {
      type: 'class' as const,
      id: 'fighter',
      label: 'Воин',
      level: 1,
    }
    const calculated = calculateProficiencyGrants([
      { category: 'perception', rank: 'trained', level: 1, source },
      { category: 'perception', rank: 'expert', level: 5, source },
    ], 5)
    assert.equal(calculated[0].rank, 'expert')
    assert.equal(calculated[0].bonus, 9)
    assert.equal(calculated[0].sources[0].id, 'fighter')
  }],
  ['Единый v4 state отделяет granted Lore и автоматические черты', () => {
    const v4 = runtimeDraftToV4(validDraft())
    const state = buildCharacterState(v4, catalog)
    assert.equal(state.loreEntries[0].name, 'Test Lore')
    assert.deepEqual(state.grantedFeatIds, [])
    assert.equal(state.runtimeDraft.name, 'Тест')
  }],
  ['Черта проверяется по типу слота, уровню и prerequisites', () => {
    const v4 = runtimeDraftToV4(validDraft())
    const state = buildCharacterState(v4, catalog)
    const slot = createFeatSlot({
      source: {
        type: 'level',
        id: 'level-1',
        label: '1-й уровень',
        level: 1,
      },
      type: 'general-feat',
      level: 1,
    })
    const feat = {
      id: 'test-general',
      name: 'Тестовая черта',
      level: 1,
      description: '',
      prerequisites: null,
      requirements: [{ type: 'attribute' as const, attribute: 'strength' as const, minimum: 1 }],
      category: 'general' as const,
      traits: [],
    }
    assert.equal(getFeatAvailability(feat, slot, state).available, true)
    assert.equal(
      getFeatAvailability({ ...feat, level: 2 }, slot, state).available,
      false,
    )
  }],
  ['Отсутствующий обязательный каталог блокирует готовность', () => {
    const incompleteCatalog: Pathfinder2RulesCatalog = {
      ...catalog,
      dataAvailability: [{
        id: 'equipment',
        label: 'Снаряжение',
        status: 'missing',
        entryCount: 0,
        file: null,
        requiredFor: ['equipment'],
        issues: ['Нет авторизованных данных.'],
      }],
    }
    const build = buildCharacter(validDraft(), incompleteCatalog)
    assert.equal(build.isReady, false)
    assert.ok(build.validationIssues.some(issue => (
      issue.id === 'catalog.equipment' && issue.severity === 'error'
    )))
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
