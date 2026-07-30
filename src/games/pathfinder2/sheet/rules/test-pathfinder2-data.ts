import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import adventuringGear from '../../Rules/adventuring-gear.json'
import ancestries from '../../Rules/ancestries.json'
import alchemicalItems from '../../Rules/alchemical-items.json'
import archetypes from '../../Rules/archetypes.json'
import armor from '../../Rules/armor.json'
import artifacts from '../../Rules/artifacts.json'
import assistiveItems from '../../Rules/assistive-items.json'
import backgrounds from '../../Rules/backgrounds.json'
import classes from '../../Rules/classes.json'
import contracts from '../../Rules/contracts.json'
import consumables from '../../Rules/consumables.json'
import customizations from '../../Rules/customizations.json'
import feats from '../../Rules/feats.json'
import grafts from '../../Rules/grafts.json'
import heldItems from '../../Rules/held-items.json'
import materials from '../../Rules/materials.json'
import relics from '../../Rules/relics.json'
import runes from '../../Rules/runes.json'
import shields from '../../Rules/shields.json'
import siegeWeapons from '../../Rules/siege-weapons.json'
import snares from '../../Rules/snares.json'
import spellhearts from '../../Rules/spellhearts.json'
import spells from '../../Rules/spells.json'
import staves from '../../Rules/staves.json'
import structures from '../../Rules/structures.json'
import tattoos from '../../Rules/tattoos.json'
import vehicles from '../../Rules/vehicles.json'
import wands from '../../Rules/wands.json'
import weapons from '../../Rules/weapons.json'
import wornItems from '../../Rules/worn-items.json'
import ancestryFeatsCatalog from '../../Rules/catalogs/ancestry-feats.json'
import armorCatalog from '../../Rules/catalogs/armor.json'
import classFeatsCatalog from '../../Rules/catalogs/class-feats.json'
import classProgressionCatalog from '../../Rules/catalogs/class-progression.json'
import deitiesCatalog from '../../Rules/catalogs/deities.json'
import equipmentCatalog from '../../Rules/catalogs/equipment.json'
import languagesCatalog from '../../Rules/catalogs/languages.json'
import shieldsCatalog from '../../Rules/catalogs/shields.json'
import traitsCatalog from '../../Rules/catalogs/traits.json'
import weaponsCatalog from '../../Rules/catalogs/weapons.json'
import {
  auditPathfinder2RuleDocuments,
  getUnavailablePathfinder2Catalogs,
} from '../data/catalog-audit'
import { adaptPathfinder2CatalogDocument } from '../data/catalog-document'
import { matchesAttributeFilter } from '../data/selectors'
import { getPathfinder2RulesCatalog } from '../rules-data-source'
import {
  getStructuredBackgroundAbilityText,
  getStructuredBackgroundAbilityOptions,
  getStructuredBackgroundLore,
  getStructuredBackgroundSkillRules,
  hasStructuredBackgroundAbilityOptions,
} from './creation/structured-rules'

type RawBackgroundFixture = {
  id: string
  name: string
  description?: string
  abilityBoosts?: string
  trainedSkills?: string
}

const backgroundFixtures = backgrounds.backgrounds as RawBackgroundFixture[]

function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0
}

function entriesLength(value: unknown) {
  if (!value || typeof value !== 'object' || !('entries' in value)) return 0
  return arrayLength(value.entries)
}

const tests: Array<[string, () => void]> = [
  ['Все народы и подключённые классы имеют локальные изображения', () => {
    for (const ancestry of ancestries.ancestries) {
      assert.ok(
        existsSync(`public/pathfinder2/ancestries/${ancestry.id}.png`),
        `${ancestry.name}: отсутствует изображение ${ancestry.id}.png`,
      )
    }
    for (const classId of [
      'alchemist',
      'animist',
      'barbarian',
      'bard',
      'champion',
      'cleric',
      'druid',
      'exemplar',
      'fighter',
      'gunslinger',
      'investigator',
      'inventor',
      'kineticist',
      'monk',
      'oracle',
      'ranger',
      'rogue',
      'sorcerer',
      'swashbuckler',
      'witch',
      'wizard',
    ]) {
      assert.ok(
        existsSync(`public/pathfinder2/classes/${classId}.png`),
        `${classId}: отсутствует изображение класса`,
      )
    }
  }],
  ['Повышения характеристик предысторий нормализуются из каталога', () => {
    const scholar = backgroundFixtures.find(background => background.id === 'scholar')
    assert.ok(scholar)
    const scholarAbilitySource = scholar.abilityBoosts ?? scholar.description ?? ''
    assert.deepEqual(
      getStructuredBackgroundAbilityOptions(scholarAbilitySource),
      ['intelligence', 'wisdom'],
    )

    let structuredBackgroundCount = 0
    for (const background of backgroundFixtures) {
      const abilitySource = background.abilityBoosts ?? background.description ?? ''
      if (!hasStructuredBackgroundAbilityOptions(abilitySource)) continue
      structuredBackgroundCount += 1
      assert.ok(
        getStructuredBackgroundAbilityOptions(abilitySource).length >= 1,
        `${background.name}: не распознано "${getStructuredBackgroundAbilityText(abilitySource)}"`,
      )
    }
    assert.ok(structuredBackgroundCount > 0)
  }],
  ['Фильтр характеристик работает для народа, предыстории и класса', () => {
    const catalog = getPathfinder2RulesCatalog()
    const elf = catalog.ancestries.find(ancestry => ancestry.id === 'elf')
    const scholar = catalog.backgrounds.find(background => background.id === 'scholar')
    const wizard = catalog.classes.find(characterClass => characterClass.id === 'wizard')
    assert.ok(elf)
    assert.ok(scholar)
    assert.ok(wizard)
    assert.equal(matchesAttributeFilter(elf, 'intelligence'), true)
    assert.equal(matchesAttributeFilter(elf, 'strength'), false)
    assert.equal(matchesAttributeFilter(scholar, 'intelligence'), true)
    assert.equal(matchesAttributeFilter(scholar, 'dexterity'), false)
    assert.equal(matchesAttributeFilter(wizard, 'intelligence'), true)
    assert.equal(matchesAttributeFilter(wizard, 'charisma'), false)
  }],
  ['Навык предыстории отделяется от Lore и сохраняет альтернативы', () => {
    assert.deepEqual(
      getStructuredBackgroundSkillRules(
        'barrister',
        'Дипломатия, Знание (закон)',
      ).grantedSkills.map(rule => rule.skillId),
      ['diplomacy'],
    )
    assert.deepEqual(
      getStructuredBackgroundSkillRules(
        'martial-disciple',
        'Акробатика или Атлетика, Знание (военное дело)',
      ).grantedSkillChoices[0]?.allowedSkills,
      ['acrobatics', 'athletics'],
    )
    assert.deepEqual(
      getStructuredBackgroundSkillRules(
        'teacher',
        'Исполнение или Общество, Знание (академические науки)',
      ).grantedSkillChoices[0]?.allowedSkills,
      ['performance', 'society'],
    )
    assert.deepEqual(
      getStructuredBackgroundSkillRules(
        'feral-child',
        'Выживание и Природа',
      ).grantedSkills.map(rule => rule.skillId),
      ['survival', 'nature'],
    )
  }],
  ['Аудит считает фактически предоставленные записи', () => {
    const availability = auditPathfinder2RuleDocuments({
      ancestries,
      archetypes,
      backgrounds,
      classes,
      feats,
      spells,
      armor,
      weapons,
      shields,
      ancestryFeats: ancestryFeatsCatalog,
      classFeats: classFeatsCatalog,
      classProgression: classProgressionCatalog,
      normalizedEquipment: equipmentCatalog,
      normalizedWeapons: weaponsCatalog,
      normalizedArmor: armorCatalog,
      normalizedShields: shieldsCatalog,
      deities: deitiesCatalog,
      languages: languagesCatalog,
      traits: traitsCatalog,
      equipment: [
        adventuringGear,
        alchemicalItems,
        artifacts,
        assistiveItems,
        contracts,
        consumables,
        customizations,
        grafts,
        heldItems,
        materials,
        relics,
        runes,
        siegeWeapons,
        snares,
        spellhearts,
        staves,
        structures,
        tattoos,
        vehicles,
        wands,
        wornItems,
      ],
    })
    assert.equal(
      availability.find(entry => entry.id === 'ancestries')?.entryCount,
      ancestries.ancestries.length + ancestries.versatileHeritages.length,
    )
    assert.equal(
      availability.find(entry => entry.id === 'backgrounds')?.entryCount,
      backgrounds.backgrounds.length,
    )
    assert.equal(
      availability.find(entry => entry.id === 'classes')?.entryCount,
      classes.classes.length,
    )
    assert.equal(
      availability.find(entry => entry.id === 'general-feats')?.entryCount,
      feats.feats.general.length + feats.feats.skill.length + feats.feats.mythic.length,
    )
    assert.equal(
      availability.find(entry => entry.id === 'archetypes')?.entryCount,
      archetypes.archetypes.length,
    )
    assert.equal(
      availability.find(entry => entry.id === 'spells')?.entryCount,
      spells.spells.length + spells.cantrips.length,
    )
    assert.equal(
      availability.find(entry => entry.id === 'ancestry-feats')?.entryCount,
      entriesLength(ancestryFeatsCatalog),
    )
    assert.equal(
      availability.find(entry => entry.id === 'class-feats')?.entryCount,
      entriesLength(classFeatsCatalog),
    )
    assert.equal(
      availability.find(entry => entry.id === 'class-progression')?.entryCount,
      classProgressionCatalog.entries.filter(entry => typeof entry.classId === 'string').length,
    )
    assert.equal(
      availability.find(entry => entry.id === 'deities')?.entryCount,
      entriesLength(deitiesCatalog),
    )
    assert.equal(
      availability.find(entry => entry.id === 'languages')?.entryCount,
      entriesLength(languagesCatalog),
    )
    assert.equal(
      availability.find(entry => entry.id === 'traits')?.entryCount,
      entriesLength(traitsCatalog),
    )
    assert.equal(
      availability.find(entry => entry.id === 'armor')?.entryCount,
      entriesLength(armorCatalog),
    )
    assert.equal(
      availability.find(entry => entry.id === 'weapons')?.entryCount,
      entriesLength(weaponsCatalog),
    )
    assert.equal(
      availability.find(entry => entry.id === 'shields')?.entryCount,
      entriesLength(shieldsCatalog),
    )
    assert.equal(
      availability.find(entry => entry.id === 'equipment')?.entryCount,
      entriesLength(equipmentCatalog),
    )
  }],
  ['Подключённые и неподключённые файлы имеют честные статусы', () => {
    const availability = auditPathfinder2RuleDocuments({
      ancestries,
      archetypes,
      backgrounds,
      classes,
      feats,
      spells,
      armor,
      weapons,
      shields,
      ancestryFeats: ancestryFeatsCatalog,
      classFeats: classFeatsCatalog,
      classProgression: classProgressionCatalog,
      normalizedEquipment: equipmentCatalog,
      normalizedWeapons: weaponsCatalog,
      normalizedArmor: armorCatalog,
      normalizedShields: shieldsCatalog,
      deities: deitiesCatalog,
      languages: languagesCatalog,
      traits: traitsCatalog,
      equipment: [
        adventuringGear,
        alchemicalItems,
        artifacts,
        assistiveItems,
        contracts,
        consumables,
        customizations,
        grafts,
        heldItems,
        materials,
        relics,
        runes,
        siegeWeapons,
        snares,
        spellhearts,
        staves,
        structures,
        tattoos,
        vehicles,
        wands,
        wornItems,
      ],
    })
    assert.equal(
      availability.find(entry => entry.id === 'archetypes')?.status,
      'connected',
    )
    assert.equal(
      availability.find(entry => entry.id === 'spells')?.status,
      'connected',
    )
    assert.equal(
      availability.find(entry => entry.id === 'class-progression')?.status,
      'connected',
    )
    assert.equal(
      availability.find(entry => entry.id === 'deities')?.status,
      'connected',
    )
    assert.equal(
      availability.find(entry => entry.id === 'languages')?.status,
      'connected',
    )
    assert.equal(
      availability.find(entry => entry.id === 'ancestry-feats')?.status,
      'connected',
    )
    assert.equal(
      availability.find(entry => entry.id === 'class-feats')?.status,
      'connected',
    )
    assert.equal(
      availability.find(entry => entry.id === 'armor')?.status,
      'connected',
    )
    assert.equal(
      availability.find(entry => entry.id === 'weapons')?.status,
      'connected',
    )
    assert.equal(
      availability.find(entry => entry.id === 'shields')?.status,
      'connected',
    )
    assert.equal(
      availability.find(entry => entry.id === 'equipment')?.status,
      'connected',
    )
    assert.ok(getUnavailablePathfinder2Catalogs(availability).length > 0)
  }],
  ['Универсальный адаптер принимает типизированный документ', () => {
    const result = adaptPathfinder2CatalogDocument<{
      id: string
      name: string
      rarity: string
    }>({
      schemaVersion: 1,
      id: 'languages',
      title: 'Языки',
      version: 'owner-1',
      source: 'Owner-provided fixture',
      license: null,
      entries: [{ id: 'common', name: 'Всеобщий', rarity: 'common' }],
    }, 'languages')
    assert.equal(result.status, 'connected')
    assert.equal(result.document?.entries[0].id, 'common')
  }],
  ['Универсальный адаптер блокирует неверный формат и повторные ID', () => {
    const result = adaptPathfinder2CatalogDocument({
      schemaVersion: 1,
      id: 'languages',
      title: 'Языки',
      version: 'owner-1',
      source: 'Owner-provided fixture',
      entries: [
        { id: 'common', name: 'Всеобщий' },
        { id: 'common', name: 'Другой' },
      ],
    }, 'languages')
    assert.equal(result.status, 'invalid')
    assert.ok(result.issues.some(issue => issue.message.includes('повторяется')))
  }],
  ['Отсутствующий документ имеет явный статус missing', () => {
    const result = adaptPathfinder2CatalogDocument(
      null,
      'equipment',
    )
    assert.equal(result.status, 'missing')
    assert.equal(result.document, null)
  }],
  ['Знание предыстории вытаскивается из структурированной строки навыков', () => {
    assert.equal(
      getStructuredBackgroundLore('Дипломатия, Знание (закон)').name,
      'Знание (закон)',
    )
    assert.equal(
      getStructuredBackgroundLore('Дипломатия, Знание, связанное с вашим божеством.').custom,
      true,
    )
  }],
  ['Предыстория без указанных повышений даёт два универсальных', () => {
    assert.equal(hasStructuredBackgroundAbilityOptions('-'), false)
    assert.equal(getStructuredBackgroundAbilityOptions('-').length, 6)
    assert.deepEqual(
      getStructuredBackgroundAbilityOptions('Интеллект, Харизма'),
      ['intelligence', 'charisma'],
    )
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

console.log(`Pathfinder 2 data audit: ${tests.length} сценариев пройдено.`)
