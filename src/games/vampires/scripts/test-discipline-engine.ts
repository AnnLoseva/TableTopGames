import assert from 'node:assert/strict'
import rules from '../../../../public/vampires/rules.json'
import { mapCharacterRowToOption } from '../modules/table/mappers'
import { getDerivedStats } from '../core/vtm5/rules/derived-stats'
import {
  expireActiveEffects,
  getActiveEffects,
} from '../core/vtm5/rules/disciplines/active-effects'
import { activateDisciplinePower } from '../core/vtm5/rules/disciplines/engine'
import {
  applyDisciplineEffectsToDamage,
  applyDisciplineEffectsToRoll,
} from '../core/vtm5/rules/disciplines/effects'
import {
  loadDisciplineRules,
  type LoadedDisciplinePower,
} from '../core/vtm5/rules/disciplines/rules-loader'

type JsonObject = Record<string, unknown>

const disciplineRules = loadDisciplineRules(rules)
const passed: string[] = []

function test(name: string, fn: () => void) {
  fn()
  passed.push(name)
  console.log(`✓ ${name}`)
}

function power(discipline: string, powerName: string): LoadedDisciplinePower {
  const found = disciplineRules[discipline]?.powers.find(item => item.name === powerName)
  assert.ok(found, `Power not found: ${discipline} / ${powerName}`)
  assert.ok(found.mechanics, `Power has no mechanics: ${discipline} / ${powerName}`)
  return found
}

function character(
  disciplines: JsonObject,
  overrides: JsonObject = {},
): JsonObject {
  const base: JsonObject = {
    id: 'test-character',
    name: 'Test Character',
    characterType: 'vampire',
    attributes: {
      'Выносливость': 3,
      'Самообладание': 3,
      'Упорство': 3,
    },
    disciplines,
    selectedPowers: {},
    activeEffects: [],
    vitalTrackers: {
      hunger: 1,
      health: { superficial: 0, aggravated: 0 },
      willpower: { superficial: 0, aggravated: 0 },
    },
    willpower: {
      max: 6,
      superficial: 0,
      aggravated: 0,
      current: 6,
      impaired: false,
    },
  }
  return {
    ...base,
    ...overrides,
    vitalTrackers: {
      ...(base.vitalTrackers as JsonObject),
      ...((overrides.vitalTrackers as JsonObject | undefined) || {}),
    },
  }
}

function activate(
  discipline: string,
  powerName: string,
  sourceCharacter: JsonObject,
  inputValues: Record<string, string> = {},
): JsonObject {
  const selectedPower = power(discipline, powerName)
  const result = activateDisciplinePower(sourceCharacter, selectedPower.mechanics || {}, {
    identity: {
      discipline,
      path: selectedPower.path,
      power: powerName,
      level: selectedPower.level,
    },
    legacyCost: selectedPower.cost,
    legacyDuration: selectedPower.duration,
    targetCharacterId: String(sourceCharacter.id || 'test-character'),
    inputValues,
    random: () => 0.9,
    makeId: () => `${discipline}-${powerName}-rouse`,
  })
  assert.equal(result.success, true, result.warnings.join('; '))
  assert.ok(result.createdEffects.length > 0, `${discipline} / ${powerName} did not create active effects`)
  return result.character as JsonObject
}

test('Стойкость / Сила жизни добавляет здоровье', () => {
  const stats = getDerivedStats(character({ Стойкость: { clan: 3 } }), rules)
  assert.equal(stats.health.baseMax, 6)
  assert.equal(stats.health.passiveBonus, 3)
  assert.equal(stats.health.totalMax, 9)
})

test('Непрошибаемость уменьшает урон до деления', () => {
  const target = activate('Стойкость', 'Непрошибаемость', character({ Стойкость: { clan: 3 } }))
  const damage = applyDisciplineEffectsToDamage({
    targetCharacterData: target,
    rulesJson: rules,
    baseAmount: 5,
    severity: 'superficial',
    target: 'health',
    source: 'weapon',
    attackType: 'weapon',
  })
  assert.equal(damage.amountBeforeHalving, 2)
  assert.equal(damage.finalAmount, 1)
  assert.ok(damage.modifiers.some(modifier =>
    modifier.power === 'Непрошибаемость'
    && modifier.operation === 'subtract_before_halving'
    && modifier.amountDelta === -3,
  ))
})

test('Горнило боли игнорирует штраф здоровья', () => {
  const source = activate('Стойкость', 'Горнило боли', character({ Стойкость: { clan: 5 } }))
  const roll = applyDisciplineEffectsToRoll({
    characterData: source,
    rulesJson: rules,
    baseDiceCount: 5,
    penalties: [{
      id: 'health_impairment',
      label: 'Штраф здоровья',
      diceDelta: -2,
      kind: 'health_impairment',
    }],
  })
  assert.deepEqual(roll.ignoredPenaltyIds, ['health_impairment'])
  assert.equal(roll.finalDiceCount, 5)
})

test('Сокрушение добавляет урон', () => {
  const source = activate('Мощь', 'Сокрушение', character({ Мощь: { clan: 3 } }))
  const damage = applyDisciplineEffectsToDamage({
    sourceCharacterData: source,
    targetCharacterData: character({}),
    rulesJson: rules,
    baseAmount: 2,
    severity: 'superficial',
    target: 'health',
    attackType: 'unarmed',
  })
  assert.equal(damage.amountBeforeHalving, 5)
  assert.equal(damage.finalAmount, 3)
  assert.ok(damage.modifiers.some(modifier =>
    modifier.power === 'Сокрушение'
    && modifier.operation === 'add_damage'
    && modifier.amountDelta === 3,
  ))
})

test('Оружие зверя добавляет оружие', () => {
  const source = activate('Метаморфозы', 'Оружие зверя', character({ Метаморфозы: { clan: 2 } }))
  const weaponEffect = getActiveEffects(source).find(activeEffect =>
    activeEffect.effect.type === 'weapon_effect'
  )
  assert.ok(weaponEffect, 'Weapon effect was not created')
  assert.deepEqual((weaponEffect.effect as JsonObject).weaponTags, [
    'natural_weapon',
    'claws',
    'bite',
    'piercing',
    'light',
  ])
  assert.equal((weaponEffect.effect as JsonObject).damageBonus, 2)
})

test('Быстрая реакция убирает штраф защиты', () => {
  const roll = applyDisciplineEffectsToRoll({
    characterData: character({ Стремительность: { clan: 1 } }),
    rulesJson: rules,
    baseDiceCount: 4,
    conditions: ['no_cover_defense'],
    penalties: [{
      id: 'no_cover_defense_penalty',
      label: 'Нет укрытия',
      diceDelta: -2,
      kind: 'defense',
    }],
  })
  assert.deepEqual(roll.ignoredPenaltyIds, ['no_cover_defense_penalty'])
  assert.equal(roll.finalDiceCount, 4)
})

test('Величие добавляет бонусы к социальным броскам', () => {
  const source = activate('Величие', 'Благоговение', character({ Величие: { clan: 3 } }))
  const roll = applyDisciplineEffectsToRoll({
    characterData: source,
    rulesJson: rules,
    baseDiceCount: 4,
    traits: ['Убеждение'],
  })
  assert.equal(roll.diceDelta, 3)
  assert.equal(roll.finalDiceCount, 7)
})

test('Доминирование создаёт condition', () => {
  const source = activate(
    'Доминирование',
    'Принуждение',
    character({ Доминирование: { clan: 1 } }),
    { commandText: 'Стой' },
  )
  const condition = getActiveEffects(source).find(activeEffect =>
    activeEffect.effect.type === 'condition'
  )
  assert.ok(condition, 'Condition was not created')
  assert.equal((condition.effect as JsonObject).condition, 'compelled')
  assert.equal(((condition.effect as JsonObject).payload as JsonObject).commandText, 'Стой')
})

test('Сокрытие создаёт hidden/invisible', () => {
  const hidden = activate('Сокрытие', 'Плащ теней', character({ Сокрытие: { clan: 2 } }))
  const invisible = activate('Сокрытие', 'Незримая поступь', character({ Сокрытие: { clan: 2 } }))
  assert.ok(getActiveEffects(hidden).some(activeEffect =>
    activeEffect.effect.type === 'condition'
    && (activeEffect.effect as JsonObject).condition === 'hidden'
  ))
  assert.ok(getActiveEffects(invisible).some(activeEffect =>
    activeEffect.effect.type === 'condition'
    && (activeEffect.effect as JsonObject).condition === 'invisible'
  ))
})

test('Активные эффекты истекают', () => {
  const source = activate('Мощь', 'Сокрушение', character({ Мощь: { clan: 3 } }))
  const before = getActiveEffects(source)
  assert.ok(before.length > 0)
  assert.ok(before.every(activeEffect => activeEffect.duration?.type === 'scene'))
  const expired = expireActiveEffects(source, { scope: 'scene' })
  assert.equal(expired.activeEffects.length, 0)
  assert.equal(expired.expiredEffects.length, before.length)
  assert.equal(getActiveEffects(expired.character).length, 0)
})

test('Голод/Воля/Здоровье сохраняются', () => {
  const option = mapCharacterRowToOption({
    id: 'saved-vitals',
    user_id: 'user',
    name: 'Saved Vitals',
    clan: 'Вентру',
    data: {
      characterType: 'vampire',
      attributes: {
        'Выносливость': 3,
        'Самообладание': 3,
        'Упорство': 3,
      },
      vitalTrackers: {
        hunger: 4,
        health: { superficial: 1, aggravated: 2, bonusMax: 1 },
        willpower: { superficial: 2, aggravated: 1 },
      },
    },
  }, rules)

  assert.ok(option.vitalTrackers)
  const vitalTrackers = option.vitalTrackers
  assert.equal(vitalTrackers.hunger, 4)
  assert.deepEqual(vitalTrackers.willpower, { superficial: 2, aggravated: 1 })
  assert.deepEqual(vitalTrackers.health, {
    superficial: 1,
    aggravated: 2,
    bonusMax: 1,
    maxOverride: null,
  })
})

test('Старые персонажи открываются', () => {
  const option = mapCharacterRowToOption({
    id: 'legacy-character',
    user_id: 'user',
    name: 'Legacy Character',
    clan: 'Бруха',
    data: {
      attributes: {
        'Выносливость': 2,
        'Самообладание': 2,
        'Упорство': 2,
      },
      disciplines: {
        Стойкость: 1,
      },
      vitalTrackers: {
        health: 4,
        willpower: 3,
        hunger: 2,
      },
    },
  }, rules)

  assert.equal(option.name, 'Legacy Character')
  assert.equal(option.activeEffects.length, 0)
  assert.ok(option.vitalTrackers)
  assert.equal(option.vitalTrackers.hunger, 2)
  assert.ok(option.health)
  assert.ok(option.willpower)
  assert.ok(option.health.max >= 6)
  assert.ok(option.willpower.max >= 4)
})

test('Нет сил без mechanics', () => {
  const missing = Object.values(disciplineRules)
    .flatMap(discipline => discipline.powers)
    .filter(item => !item.mechanics)
  assert.equal(missing.length, 0)
})

console.log(`\nDiscipline engine tests passed: ${passed.length}`)
