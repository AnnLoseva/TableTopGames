import assert from 'node:assert/strict'
import ancestries from '../../Rules/ancestries.json'
import archetypes from '../../Rules/archetypes.json'
import backgrounds from '../../Rules/backgrounds.json'
import classes from '../../Rules/classes.json'
import feats from '../../Rules/feats.json'
import spells from '../../Rules/spells.json'
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
    })
    assert.equal(
      availability.find(entry => entry.id === 'ancestries')?.entryCount,
      67,
    )
    assert.equal(
      availability.find(entry => entry.id === 'backgrounds')?.entryCount,
      81,
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
  }],
  ['Неподключённые файлы не выдаются за работающий rules catalog', () => {
    const availability = auditPathfinder2RuleDocuments({
      ancestries,
      archetypes,
      backgrounds,
      classes,
      feats,
      spells,
    })
    assert.equal(
      availability.find(entry => entry.id === 'archetypes')?.status,
      'available-not-connected',
    )
    assert.equal(
      availability.find(entry => entry.id === 'spells')?.status,
      'available-not-connected',
    )
    assert.equal(
      availability.find(entry => entry.id === 'class-progression')?.status,
      'missing',
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
