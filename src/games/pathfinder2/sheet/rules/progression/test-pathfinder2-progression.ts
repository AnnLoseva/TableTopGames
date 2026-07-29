import assert from 'node:assert/strict'
import { createDefaultPathfinder2DraftV4 } from '../../data/v4'
import type {
  Pathfinder2ClassRule,
  Pathfinder2LevelChoices,
  Pathfinder2RulesCatalog,
} from '../../types'
import { buildCharacterState } from '../creation/build-character-state'
import {
  applyLevelUp,
  buildLevelUpPlan,
  validateLevelUp,
} from './build-level-up-plan'

const characterClass: Pathfinder2ClassRule = {
  id: 'test-class',
  name: 'Тестовый класс',
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
  skillRules: {
    grantedSkills: [],
    grantedSkillChoices: [],
    baseFreeTrainedSkills: 0,
    addIntelligenceModifier: false,
    skillIncreaseLevels: [2, 7, 15],
  },
  attacks: '',
  defenses: '',
  classDc: 'trained',
  proficiencyGrants: [],
  choiceDefinitions: [],
  requiresDeity: false,
  spellTradition: 'Мистическая',
  spellSlots: {
    1: [1, 1],
    3: [2, 2, 1],
  },
  keyTerms: [],
  roleplaying: {
    combat: '',
    social: '',
    exploration: '',
    downtime: '',
    youMight: [],
    othersProbably: [],
  },
  features: [
    { id: 'level-2-feature', name: 'Особенность 2', description: '', level: 2 },
  ],
  specializations: [],
  sourceBook: 'test',
}

const catalog: Pathfinder2RulesCatalog = {
  ancestries: [],
  versatileHeritages: [],
  backgrounds: [],
  classes: [characterClass],
  generalFeats: [],
  skillFeats: [],
  mythicFeats: [],
  ancestryFeats: [],
  classFeats: [],
  classProgression: [{
    id: 'global',
    name: 'Глобальная прогрессия',
    classId: null,
    levels: Array.from({ length: 20 }, (_, index) => {
      const level = index + 1
      return {
        level,
        automaticFeatureIds: [],
        proficiencyGrants: [],
        featSlots: [],
        skillIncreaseCount: [2, 7, 15].includes(level) ? 1 : 0,
        attributeBoostCount: [5, 10, 15, 20].includes(level) ? 4 : 0,
      }
    }),
  }, {
    id: 'class:test-class',
    name: 'Тестовая прогрессия класса',
    classId: 'test-class',
    levels: [],
  }],
  equipment: [],
  weapons: [],
  armor: [],
  shields: [],
  spells: [],
  cantrips: [],
  focusSpells: [],
  languages: [],
  deities: [],
  traits: [],
  sources: [],
  dataAvailability: [],
  validationWarnings: [],
}

function draftAt(level: number) {
  const draft = createDefaultPathfinder2DraftV4()
  draft.progression.level = level
  draft.progression.targetLevel = Math.max(level, 20)
  draft.class.classId = characterClass.id
  draft.class.keyAbility = 'intelligence'
  draft.progression.experience = 5_000
  return draft
}

function choices(level: number): Pathfinder2LevelChoices {
  return {
    level,
    attributeBoosts: [5, 10, 15, 20].includes(level)
      ? ['strength', 'dexterity', 'constitution', 'intelligence']
      : [],
    skillIncreases: [],
    featSelections: {},
    classFeatureChoices: {},
    learnedSpellIds: [],
    removedSpellIds: [],
    languageChoices: [],
  }
}

const tests: Array<[string, () => void]> = [
  ['Повышение доступно только на один уровень', () => {
    const plan = buildLevelUpPlan(draftAt(1), 3, catalog)
    assert.ok(plan.issues.some(issue => issue.id.includes('sequence')))
  }],
  ['План показывает автоматические особенности, навыки и магию уровня', () => {
    const plan = buildLevelUpPlan(draftAt(1), 2, catalog)
    assert.equal(plan.automaticFeatures[0].id, 'level-2-feature')
    assert.equal(plan.skillIncreaseCount, 1)
    assert.equal(plan.attributeBoostCount, 0)
    assert.deepEqual(plan.spellSlots, { 1: 1 })
  }],
  ['Повышение навыка следует одной ступени', () => {
    const draft = draftAt(1)
    const invalid = choices(2)
    invalid.skillIncreases = [{
      level: 2,
      skillId: 'arcana',
      fromRank: 'untrained',
      toRank: 'expert',
    }]
    assert.ok(validateLevelUp(invalid, draft, catalog).some(
      issue => issue.id.includes('skill-sequence'),
    ))
    invalid.skillIncreases[0].toRank = 'trained'
    assert.equal(validateLevelUp(invalid, draft, catalog).length, 0)
  }],
  ['При использовании опыта списывается ровно 1000 XP', () => {
    const levelChoices = choices(2)
    levelChoices.skillIncreases = [{
      level: 2,
      skillId: 'arcana',
      fromRank: 'untrained',
      toRank: 'trained',
    }]
    const result = applyLevelUp(draftAt(1), levelChoices, catalog, true)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.draft.progression.level, 2)
    assert.equal(result.draft.progression.experience, 4_000)
    assert.deepEqual(result.draft.progression.completedLevels, [2])
  }],
  ['На уровнях 5/10/15/20 нужны четыре разные характеристики', () => {
    const draft = draftAt(4)
    const invalid = choices(5)
    invalid.attributeBoosts = ['strength', 'strength']
    assert.ok(validateLevelUp(invalid, draft, catalog).some(
      issue => issue.id.includes('attributes'),
    ))
    assert.equal(validateLevelUp(choices(5), draft, catalog).length, 0)
  }],
  ['Слот прогрессии принимает классовую черту и сохраняет её по ID', () => {
    const classProgression = catalog.classProgression[1]
    classProgression.levels = [{
      level: 2,
      automaticFeatureIds: [],
      proficiencyGrants: [],
      featSlots: [{
        id: 'class-feat-test-2',
        type: 'class-feat',
        count: 1,
        required: true,
      }],
      skillIncreaseCount: 1,
      attributeBoostCount: 0,
    }]
    catalog.classFeats = [{
      id: 'test-class-feat',
      name: 'Тестовая классовая черта',
      level: 1,
      description: '',
      prerequisites: null,
      requirements: [],
      category: 'class',
      classIds: ['test-class'],
      traits: [],
    }]
    const levelChoices = choices(2)
    levelChoices.skillIncreases = [{
      level: 2,
      skillId: 'arcana',
      fromRank: 'untrained',
      toRank: 'trained',
    }]
    levelChoices.featSelections['class-feat-test-2'] = 'test-class-feat'
    const result = applyLevelUp(draftAt(1), levelChoices, catalog)
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(
        result.draft.feats.selectedBySlot['class-feat-test-2'],
        'test-class-feat',
      )
      assert.deepEqual(result.draft.class.featChoicesByLevel[2], ['test-class-feat'])
    }
    classProgression.levels = []
    catalog.classFeats = []
  }],
  ['Ранги испытаний растут по прогрессии класса, а не по строке 1-го уровня', () => {
    const classProgression = catalog.classProgression[1]
    classProgression.levels = [{
      level: 3,
      automaticFeatureIds: [],
      proficiencyGrants: [{ category: 'will', rank: 'expert', level: 3 }],
      featSlots: [],
      skillIncreaseCount: 0,
      attributeBoostCount: 0,
    }]
    const draft = draftAt(5)
    const before = buildCharacterState(draftAt(2), catalog).derived.will
    const after = buildCharacterState(draft, catalog).derived.will
    assert.equal(before, 2 + 2, 'на 2-м уровне воля обучена: уровень + 2')
    assert.equal(after, 5 + 4, 'с 3-го уровня воля экспертная: уровень + 4')
    classProgression.levels = []
  }],
  ['Высокоуровневая история воспроизводится последовательно до 20-го', () => {
    let draft = draftAt(1)
    const progressionLevels = catalog.classProgression[0].levels
    catalog.classProgression[0].levels = progressionLevels.map(level => ({
      ...level,
      skillIncreaseCount: 0,
    }))
    for (let level = 2; level <= 20; level += 1) {
      const result = applyLevelUp(draft, choices(level), catalog)
      assert.equal(result.ok, true, `уровень ${level}`)
      if (!result.ok) return
      draft = result.draft
    }
    assert.equal(draft.progression.level, 20)
    assert.equal(draft.progression.completedLevels.length, 19)
    assert.deepEqual(Object.keys(draft.attributes.levelBoosts).map(Number), [5, 10, 15, 20])
    catalog.classProgression[0].levels = progressionLevels
  }],
]

for (const [name, run] of tests) {
  run()
  console.log(`✓ ${name}`)
}

console.log(`Pathfinder 2 progression: ${tests.length} сценариев пройдено.`)
