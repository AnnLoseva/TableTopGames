/**
 * Verifies public/vampires/vtm-health.js and public/vampires/vtm-humanity.js
 * stay aligned with src/games/vampires/core/vtm5/rules/{health,humanity}/index.ts.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {
  applyHealthDamage,
  getHealthWarning,
  getSuperficialMendAmount,
  normalizeDamageProfile,
  normalizeHealthTracker,
  recoverHealthDamage,
} from '../core/vtm5/rules/health'
import {
  addHumanityStains,
  applyRemorseCheckResult,
  clampHumanityStains,
  clampHumanityValue,
  getHumanityState,
  getHumanityStatus,
  getHumanityWarning,
  getRemorseDice,
  normalizeMoralityState,
} from '../core/vtm5/rules/humanity'

type LegacyHealthApi = {
  normalizeDamageProfile: (value: unknown, clan?: string, type?: string) => string
  normalizeHealthTracker: (value: unknown, stamina: number, profile?: string) => Record<string, unknown>
  applyHealthDamage: (
    health: Record<string, unknown>,
    amount: number,
    severity: string,
    options?: Record<string, unknown>,
    profile?: string,
  ) => Record<string, unknown>
  recoverHealthDamage: (
    health: Record<string, unknown>,
    amount: number,
    severity: string,
    profile?: string,
  ) => Record<string, unknown>
  getSuperficialMendAmount: (bloodPotency: number) => number
  warningFor: (health: Record<string, unknown>, profile: string) => string
}

type LegacyHumanityState = {
  value: number
  stains: number
  stainEvents?: unknown[]
}

type LegacyAddStainsResult = {
  applied: number
  overflow: number
  warning: string
  humanity: LegacyHumanityState
}

type LegacyHumanityApi = {
  clampValue: (value: unknown, fallback?: number) => number
  clampStains: (value: unknown, humanityValue: number) => number
  getHumanityState: (characterData: Record<string, unknown> | null | undefined) => LegacyHumanityState
  getStatus: (state: LegacyHumanityState) => string
  getHumanityWarning: (state: LegacyHumanityState) => string
  getRemorseDice: (state: LegacyHumanityState) => number
  applyRemorseCheckResult: (
    before: LegacyHumanityState,
    params: { remorseDice: number; diceValues: number[]; checkedAt?: string },
  ) => {
    automaticFailure: boolean
    successes: number
    success: boolean
    humanityAfter: number
    nextState: LegacyHumanityState
  }
  addStains: (
    characterData: Record<string, unknown> | null | undefined,
    amount: number,
    reason: string,
    options?: Record<string, unknown>,
  ) => LegacyAddStainsResult
  normalizeMorality: (value: unknown) => Record<string, unknown>
}

const root = path.resolve(import.meta.dirname, '../../../..')
const passed: string[] = []

function loadLegacyScript(relativePath: string, globalKey: string) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8')
  const globalTarget = {} as Record<string, unknown>
  const sandbox = {
    window: globalTarget,
    globalThis: globalTarget,
    module: { exports: {} as unknown },
  }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox, { filename: relativePath })
  const api = globalTarget[globalKey] ?? (sandbox.module.exports as Record<string, unknown>)[globalKey]
  assert.ok(api, `${globalKey} was not exposed from ${relativePath}`)
  return api
}

function test(name: string, fn: () => void) {
  fn()
  passed.push(name)
  console.log(`✓ ${name}`)
}

function expectEqual<T>(actual: T, expected: T, label: string) {
  // VM-hosted legacy objects can differ by prototype; compare plain data.
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), label)
}

const legacyHealth = loadLegacyScript('public/vampires/vtm-health.js', 'VTMHealth') as LegacyHealthApi
const legacyHumanity = loadLegacyScript('public/vampires/vtm-humanity.js', 'VTMHumanity') as LegacyHumanityApi

test('health: normalizeDamageProfile matches core', () => {
  const cases: Array<[unknown, string | undefined, string | undefined]> = [
    ['vampire', undefined, undefined],
    ['mortal', undefined, undefined],
    ['thinblood', 'Слабокровный', 'vampire'],
    ['ghoul', 'Гуль', ''],
    ['mortal', '', 'npc-mortal'],
    ['vampire', 'Бруха', 'vampire'],
  ]
  for (const [value, clan, type] of cases) {
    expectEqual(
      legacyHealth.normalizeDamageProfile(value, clan, type),
      normalizeDamageProfile(value, clan, type),
      `normalizeDamageProfile(${String(value)}, ${clan}, ${type})`,
    )
  }
})

test('health: normalizeHealthTracker matches core', () => {
  const cases: Array<[unknown, number, string]> = [
    [5, 2, 'vampire'],
    [{ superficial: 2, aggravated: 1, bonusMax: 1 }, 3, 'mortal'],
    [{ superficial: 4, aggravated: 2, maxOverride: 7 }, 2, 'ghoul'],
  ]
  for (const [value, stamina, profile] of cases) {
    const legacy = legacyHealth.normalizeHealthTracker(value, stamina, profile)
    const core = normalizeHealthTracker(value, stamina, profile as 'vampire')
    expectEqual(legacy, core, `normalizeHealthTracker stamina=${stamina}`)
  }
})

test('health: applyHealthDamage matches core', () => {
  const before = normalizeHealthTracker({ superficial: 1, aggravated: 0 }, 3, 'vampire')
  const legacyBefore = legacyHealth.normalizeHealthTracker({ superficial: 1, aggravated: 0 }, 3, 'vampire')
  const coreResult = applyHealthDamage(before, 3, 'superficial', {}, 'vampire')
  const legacyResult = legacyHealth.applyHealthDamage(legacyBefore, 3, 'superficial', {}, 'vampire')
  expectEqual(legacyResult.tracker, coreResult.tracker, 'applyHealthDamage tracker')
  expectEqual(legacyResult.applied, coreResult.applied, 'applyHealthDamage applied')
  expectEqual(legacyResult.converted, coreResult.converted, 'applyHealthDamage converted')
  expectEqual(legacyResult.halved, coreResult.halved, 'applyHealthDamage halved')
})

test('health: recoverHealthDamage matches core', () => {
  const before = normalizeHealthTracker({ superficial: 3, aggravated: 1 }, 3, 'vampire')
  const legacyBefore = legacyHealth.normalizeHealthTracker({ superficial: 3, aggravated: 1 }, 3, 'vampire')
  const coreResult = recoverHealthDamage(before, 2, 'superficial', 'vampire')
  const legacyResult = legacyHealth.recoverHealthDamage(legacyBefore, 2, 'superficial', 'vampire')
  expectEqual(legacyResult.tracker, coreResult.tracker, 'recoverHealthDamage tracker')
  expectEqual(legacyResult.recovered, coreResult.recovered, 'recoverHealthDamage recovered')
})

test('health: getSuperficialMendAmount matches core', () => {
  for (const potency of [0, 1, 4, 7, 10, 99]) {
    expectEqual(
      legacyHealth.getSuperficialMendAmount(potency),
      getSuperficialMendAmount(potency),
      `getSuperficialMendAmount(${potency})`,
    )
  }
})

test('health: warningFor matches getHealthWarning', () => {
  const identity = (value: string) => value
  const health = normalizeHealthTracker({ superficial: 6, aggravated: 0 }, 3, 'vampire')
  expectEqual(
    legacyHealth.warningFor(health, 'vampire'),
    getHealthWarning(health, 'vampire', identity),
    'warningFor impaired vampire',
  )
})

test('humanity: clamp helpers match core', () => {
  for (const value of [-1, 0, 7, 10, 12, '8', null]) {
    expectEqual(legacyHumanity.clampValue(value), clampHumanityValue(value), `clampValue(${String(value)})`)
  }
  expectEqual(legacyHumanity.clampStains(5, 7), clampHumanityStains(5, 7), 'clampStains')
})

test('humanity: getHumanityState matches core', () => {
  const cases = [
    { humanity: 7 },
    { humanity: { value: 6, stains: 2, stainEvents: [{ amount: 1, source: 'manual', reason: 'test' }] } },
    { baseHumanity: 5, humanity: null },
  ]
  for (const data of cases) {
    const legacy = legacyHumanity.getHumanityState(data)
    const core = getHumanityState(data)
    expectEqual(legacy.value, core.value, 'humanity value')
    expectEqual(legacy.stains, core.stains, 'humanity stains')
    expectEqual((legacy.stainEvents || []).length, (core.stainEvents || []).length, 'stainEvents length')
  }
})

test('humanity: getStatus matches getHumanityStatus', () => {
  const states = [
    { value: 7, stains: 0 },
    { value: 6, stains: 2 },
    { value: 5, stains: 5 },
    { value: 0, stains: 0 },
  ]
  for (const state of states) {
    expectEqual(legacyHumanity.getStatus(state), getHumanityStatus(state), `status value=${state.value} stains=${state.stains}`)
  }
})

test('humanity: getHumanityWarning matches core', () => {
  const identity = (value: string) => value
  const cases = [
    { value: 7, stains: 0 },
    { value: 6, stains: 2 },
    { value: 5, stains: 5 },
    { value: 0, stains: 0 },
  ]
  for (const state of cases) {
    expectEqual(
      legacyHumanity.getHumanityWarning(state),
      getHumanityWarning(state, identity),
      `warning value=${state.value} stains=${state.stains}`,
    )
  }
})

test('humanity: getRemorseDice matches core', () => {
  const state = getHumanityState({ humanity: { value: 6, stains: 3 } })
  expectEqual(legacyHumanity.getRemorseDice(state), getRemorseDice(state), 'getRemorseDice')
})

test('humanity: applyRemorseCheckResult matches core', () => {
  const before = getHumanityState({ humanity: { value: 6, stains: 3, stainEvents: [] } })
  const cases = [
    { remorseDice: 0, diceValues: [] as number[] },
    { remorseDice: 2, diceValues: [3, 8] },
    { remorseDice: 3, diceValues: [2, 4, 5] },
  ]
  const checkedAt = '2026-07-02T12:00:00.000Z'
  for (const params of cases) {
    const withTime = { ...params, checkedAt }
    const legacy = legacyHumanity.applyRemorseCheckResult(before, withTime)
    const core = applyRemorseCheckResult(before, withTime)
    expectEqual(legacy.automaticFailure, core.automaticFailure, 'automaticFailure')
    expectEqual(legacy.successes, core.successes, 'successes')
    expectEqual(legacy.success, core.success, 'success')
    expectEqual(legacy.humanityAfter, core.humanityAfter, 'humanityAfter')
    expectEqual(legacy.nextState, core.nextState, 'nextState')
  }
})

test('humanity: addStains matches addHumanityStains', () => {
  const character = { humanity: { value: 7, stains: 1, stainEvents: [] } }
  const legacy = legacyHumanity.addStains(character, 2, 'test reason', { source: 'manual' })
  const core = addHumanityStains(character, 2, 'test reason', { source: 'manual' })
  expectEqual(legacy.applied, core.applied, 'addStains applied')
  expectEqual(legacy.overflow, core.overflow, 'addStains overflow')
  expectEqual(legacy.humanity.stains, core.humanity.stains, 'addStains stains')
  expectEqual(legacy.warning, core.warning, 'addStains warning')
})

test('humanity: normalizeMorality matches normalizeMoralityState', () => {
  const input = {
    chronicleTenets: ['tenet'],
    convictions: [{ text: 'conviction' }, 'legacy-string'],
    touchstones: [{ name: 'stone', status: 'harmed' }, 'legacy-touchstone'],
  }
  expectEqual(legacyHumanity.normalizeMorality(input), normalizeMoralityState(input), 'normalizeMorality')
})

console.log(`\n${passed.length} parity checks passed.`)
