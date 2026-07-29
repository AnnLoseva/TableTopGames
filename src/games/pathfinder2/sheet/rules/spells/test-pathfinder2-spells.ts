import assert from 'node:assert/strict'
import { createDefaultPathfinder2DraftV4 } from '../../data/v4'
import type {
  Pathfinder2ClassRule,
  Pathfinder2RulesCatalog,
  Pathfinder2SpellRule,
} from '../../types'
import {
  calculateSpellcasting,
  createClassSpellcastingEntry,
  getSpellSlotsAtLevel,
  isSpellAvailable,
  normalizeSpellTradition,
} from './calculate-spellcasting'

function characterClass(
  id: string,
  tradition: string,
): Pathfinder2ClassRule {
  return {
    id,
    name: id,
    description: '',
    rarity: 'common',
    role: '',
    hp: 8,
    keyAbilities: ['wisdom'],
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
      skillIncreaseLevels: [],
    },
    attacks: '',
    defenses: '',
    classDc: 'trained',
    proficiencyGrants: [],
    choiceDefinitions: [],
    requiresDeity: false,
    spellTradition: tradition,
    spellSlots: {
      1: [1, 1, 0],
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
    features: [],
    specializations: [],
    sourceBook: 'test',
  }
}

function spell(
  id: string,
  level: number,
  type: Pathfinder2SpellRule['type'],
  traditions: Pathfinder2SpellRule['traditions'],
): Pathfinder2SpellRule {
  return {
    id,
    name: id,
    nameEn: '',
    level,
    actions: '2',
    rarity: 'common',
    traits: [],
    traditions,
    rawTraditions: [],
    sourceBook: 'test',
    type,
    description: '',
  }
}

const catalog: Pathfinder2RulesCatalog = {
  ancestries: [],
  versatileHeritages: [],
  backgrounds: [],
  classes: [
    characterClass('cleric', 'Божественная'),
    characterClass('sorcerer', 'Зависит от Кровавой Линии'),
  ],
  generalFeats: [],
  skillFeats: [],
  mythicFeats: [],
  ancestryFeats: [],
  classFeats: [],
  classProgression: [],
  equipment: [],
  weapons: [],
  armor: [],
  shields: [],
  spells: [
    spell('heal', 1, 'spell', ['divine', 'primal']),
    spell('force-barrage', 1, 'spell', ['arcane']),
  ],
  cantrips: [spell('divine-lance', 1, 'cantrip', ['divine'])],
  focusSpells: [spell('domain-focus', 1, 'focus', [])],
  languages: [],
  deities: [],
  traits: [],
  sources: [],
  dataAvailability: [],
  validationWarnings: [],
}

function clericDraft() {
  const draft = createDefaultPathfinder2DraftV4()
  draft.class.classId = 'cleric'
  draft.class.keyAbility = 'wisdom'
  return draft
}

const attributes = {
  strength: 0,
  dexterity: 0,
  constitution: 0,
  intelligence: 0,
  wisdom: 4,
  charisma: 0,
}

const tests: Array<[string, () => void]> = [
  ['Традиции нормализуются из владельческих данных', () => {
    assert.equal(normalizeSpellTradition('Мистическая'), 'arcane')
    assert.equal(normalizeSpellTradition('Божественная'), 'divine')
    assert.equal(normalizeSpellTradition('Оккультная'), 'occult')
    assert.equal(normalizeSpellTradition('Первородная'), 'primal')
  }],
  ['Расписание ячеек выбирает последнюю доступную строку уровня', () => {
    const schedule = {
      1: [5, 2, 0],
      3: [5, 3, 2],
    }
    assert.deepEqual(getSpellSlotsAtLevel(schedule, 2), {
      cantripSlots: 5,
      spellSlots: { 1: 2 },
    })
    assert.deepEqual(getSpellSlotsAtLevel(schedule, 3), {
      cantripSlots: 5,
      spellSlots: { 1: 3, 2: 2 },
    })
  }],
  ['Класс создаёт подготовленное заклинательство с источником', () => {
    const entry = createClassSpellcastingEntry(clericDraft(), catalog)
    assert.equal(entry?.mode, 'prepared')
    assert.equal(entry?.tradition, 'divine')
    assert.equal(entry?.cantripSlots, 1)
    assert.deepEqual(entry?.spellSlots, { 1: 1 })
  }],
  ['Динамическая традиция не угадывается без структурированного выбора', () => {
    const draft = createDefaultPathfinder2DraftV4()
    draft.class.classId = 'sorcerer'
    draft.class.keyAbility = 'wisdom'
    assert.equal(createClassSpellcastingEntry(draft, catalog), null)
    const result = calculateSpellcasting(draft, catalog, attributes)
    assert.ok(result.issues.some(issue => issue.id.includes('tradition-choice')))
  }],
  ['Заклинатель обязан заполнить ровно доступные слоты', () => {
    const draft = clericDraft()
    const entry = createClassSpellcastingEntry(draft, catalog)
    assert.ok(entry)
    if (!entry) return
    draft.spellcasting.entries = [entry]
    const incomplete = calculateSpellcasting(draft, catalog, attributes)
    assert.equal(incomplete.issues.length, 2)

    entry.preparedSpellIds = {
      0: ['divine-lance'],
      1: ['heal'],
    }
    const complete = calculateSpellcasting(draft, catalog, attributes)
    assert.equal(complete.issues.length, 0)
    assert.equal(complete.entries[0].spellAttack, 7)
    assert.equal(complete.entries[0].spellDc, 17)
  }],
  ['Заклинание чужой традиции блокируется', () => {
    const draft = clericDraft()
    const entry = createClassSpellcastingEntry(draft, catalog)
    assert.ok(entry)
    if (!entry) return
    entry.preparedSpellIds = {
      0: ['divine-lance'],
      1: ['force-barrage'],
    }
    draft.spellcasting.entries = [entry]
    const result = calculateSpellcasting(draft, catalog, attributes)
    assert.ok(result.issues.some(issue => issue.id.includes('.illegal.')))
  }],
  ['Заклинание без указанной традиции не становится универсальным', () => {
    assert.equal(
      isSpellAvailable(spell('unknown-source', 1, 'spell', []), 'divine', 1),
      false,
    )
  }],
]

for (const [name, run] of tests) {
  run()
  console.log(`✓ ${name}`)
}

console.log(`Pathfinder 2 spells: ${tests.length} сценариев пройдено.`)
