/**
 * Unit tests for master-console foundations (PROMPT 15).
 * Run: npm run test:master-console
 */
import assert from 'node:assert/strict'
import { migrateLayoutJson, defaultLayoutState, secondScreenLayoutState } from '../modules/master-console/layouts/layout-schema'
import { parseMasterDeepLink, resolveEntityNavigation } from '../modules/master-console/search/deep-link'
import { MASTER_CONSOLE_CONTRIBUTIONS, getMasterContribution } from '../modules/master-console/contributions'
import { collectSearchProviders } from '../modules/master-console/search/collect-providers'
import { toPublishedProjection } from '../modules/session-log/mappers'
import { rollWeightedRow } from '../modules/lore/utils/random-table-roll'
import { isDangerousBulkAction, describeBulkAction } from '../modules/actors/services/actor-actions'
import { resolveMasterConsoleAccess } from '../modules/master-console/access'
import type { ChronicleMembership } from '../modules/master-console/persistence/types'
import type { SessionLogEntry } from '../modules/session-log/types'

let passed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (err) {
    console.error(`  ✗ ${name}`)
    throw err
  }
}

console.log('layout migration')
test('default layout has schemaVersion 1', () => {
  const d = defaultLayoutState('actors')
  assert.equal(d.schemaVersion, 1)
  assert.equal(d.activeModuleId, 'actors')
})

test('migrate empty → default', () => {
  const m = migrateLayoutJson(null)
  assert.equal(m.schemaVersion, 1)
  assert.ok(m.activeModuleId)
})

test('migrate pre-schema object', () => {
  const m = migrateLayoutJson({ activeModuleId: 'lore', modules: ['actors', 'scenes'] })
  assert.equal(m.activeModuleId, 'lore')
  assert.ok(m.secondaryModuleIds.includes('actors'))
})

test('second-screen preset', () => {
  const s = secondScreenLayoutState('overview')
  assert.equal(s.label, 'second-screen')
})

console.log('deep-link parser')
test('parses room module entity display layout', () => {
  const p = parseMasterDeepLink('room=campaign-666&module=actors&entity=abc&display=detached&layout=second-screen')
  assert.equal(p.room, 'campaign-666')
  assert.equal(p.moduleId, 'actors')
  assert.equal(p.entityId, 'abc')
  assert.equal(p.display, 'detached')
  assert.equal(p.layoutId, 'second-screen')
  assert.equal(p.moduleParams.actor, 'abc')
})

test('drops unknown keys', () => {
  const p = parseMasterDeepLink('room=r&module=overview&evil=1&foo=bar')
  assert.ok(p.droppedKeys.includes('evil'))
  assert.ok(p.droppedKeys.includes('foo'))
})

test('legacy actor param maps to entity', () => {
  const p = parseMasterDeepLink('room=r&module=actors&actor=id-1')
  assert.equal(p.entityId, 'id-1')
})

test('resolveEntityNavigation', () => {
  assert.deepEqual(resolveEntityNavigation('blood_bond'), { moduleId: 'blood-bonds', param: 'bond' })
  assert.deepEqual(resolveEntityNavigation('session_log_entry'), { moduleId: 'session-log', param: 'entry' })
})

console.log('registry')
test('six master modules registered', () => {
  const ids = MASTER_CONSOLE_CONTRIBUTIONS.map(item => item.id).sort()
  assert.deepEqual(ids, ['actors', 'blood-bonds', 'lore', 'overview', 'scenes', 'session-log'].sort())
})

test('getMasterContribution allow-list', () => {
  assert.ok(getMasterContribution('actors'))
  assert.equal(getMasterContribution('../evil'), undefined)
})

test('search providers collected without shell hardcoding all tables', () => {
  const providers = collectSearchProviders()
  assert.ok(providers.length >= 6)
  assert.ok(providers.every(p => typeof p.search === 'function'))
  assert.ok(providers.some(p => p.id === 'actors'))
  assert.ok(providers.some(p => p.id === 'session-log'))
})

console.log('auth gate')
const masterMembership: ChronicleMembership = {
  chronicleId: 'chronicle-1',
  userId: 'auth-user-1',
  role: 'master',
  createdAt: '2026-07-13T00:00:00.000Z',
}

test('signed-out users cannot enter master console', () => {
  assert.deepEqual(resolveMasterConsoleAccess(null, null), { status: 'signed-out' })
})

test('authenticated non-members cannot enter master console', () => {
  assert.deepEqual(resolveMasterConsoleAccess('auth-user-1', null), { status: 'forbidden' })
})

test('membership must belong to the authenticated user', () => {
  assert.deepEqual(resolveMasterConsoleAccess('auth-user-2', masterMembership), { status: 'forbidden' })
})

test('authenticated masters can enter their chronicle', () => {
  assert.deepEqual(resolveMasterConsoleAccess('auth-user-1', masterMembership), {
    status: 'allowed',
    membership: masterMembership,
  })
})

console.log('privacy mappers')
test('private draft does not publish', () => {
  const entry: SessionLogEntry = {
    id: '1',
    chronicleId: 'c',
    room: 'r',
    sessionId: null,
    title: 'secret',
    bodyHtml: '<p>private body</p>',
    tags: [],
    visibility: 'private',
    status: 'draft',
    sharedPlayerIds: [],
    attachments: [],
    version: 1,
    createdBy: 'x',
    createdAt: '',
    updatedAt: '',
  }
  assert.equal(toPublishedProjection(entry), null)
})

test('published shared projects body', () => {
  const entry: SessionLogEntry = {
    id: '1',
    chronicleId: 'c',
    room: 'r',
    sessionId: null,
    title: 'night 1',
    bodyHtml: '<p>ok</p>',
    tags: [],
    visibility: 'shared_all',
    status: 'published',
    sharedPlayerIds: [],
    attachments: [],
    version: 2,
    createdBy: 'x',
    createdAt: '',
    updatedAt: '',
  }
  const pub = toPublishedProjection(entry)
  assert.ok(pub)
  assert.equal(pub!.bodyHtml, '<p>ok</p>')
  assert.equal(pub!.visibility, 'shared_all')
})

console.log('weighted random tables')
test('weighted pick respects weights', () => {
  const rows = [
    { id: 'a', text: 'A', weight: 0 },
    { id: 'b', text: 'B', weight: 10 },
    { id: 'c', text: 'C', weight: 0 },
  ]
  const result = rollWeightedRow(rows, () => 0)
  assert.ok(result)
  assert.equal(result!.row.id, 'b')
})

test('empty table returns null', () => {
  assert.equal(rollWeightedRow([]), null)
})

console.log('bulk action validation')
test('dangerous bulk actions flagged', () => {
  assert.equal(isDangerousBulkAction({ type: 'archive' }), true)
  assert.equal(isDangerousBulkAction({ type: 'set_faction', faction: 'x' }), false)
  assert.ok(describeBulkAction({ type: 'archive' }, 3).includes('3'))
})

console.log(`\n${passed} tests passed`)
