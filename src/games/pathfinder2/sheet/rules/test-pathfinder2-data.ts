import assert from 'node:assert/strict'
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

const tests: Array<[string, () => void]> = [
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
      67,
    )
    assert.equal(
      availability.find(entry => entry.id === 'backgrounds')?.entryCount,
      240,
    )
    assert.equal(
      availability.find(entry => entry.id === 'classes')?.entryCount,
      27,
    )
    assert.equal(
      availability.find(entry => entry.id === 'general-feats')?.entryCount,
      115,
    )
    assert.equal(
      availability.find(entry => entry.id === 'archetypes')?.entryCount,
      43,
    )
    assert.equal(
      availability.find(entry => entry.id === 'spells')?.entryCount,
      1167,
    )
    assert.equal(availability.find(entry => entry.id === 'ancestry-feats')?.entryCount, 702)
    assert.equal(availability.find(entry => entry.id === 'class-feats')?.entryCount, 1309)
    assert.equal(availability.find(entry => entry.id === 'class-progression')?.entryCount, 21)
    assert.equal(availability.find(entry => entry.id === 'deities')?.entryCount, 361)
    assert.equal(availability.find(entry => entry.id === 'languages')?.entryCount, 23)
    assert.equal(availability.find(entry => entry.id === 'traits')?.entryCount, 212)
    assert.equal(availability.find(entry => entry.id === 'armor')?.entryCount, 123)
    assert.equal(availability.find(entry => entry.id === 'weapons')?.entryCount, 400)
    assert.equal(availability.find(entry => entry.id === 'shields')?.entryCount, 92)
    assert.equal(availability.find(entry => entry.id === 'equipment')?.entryCount, 1823)
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
