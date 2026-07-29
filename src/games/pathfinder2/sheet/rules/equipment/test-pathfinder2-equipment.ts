import assert from 'node:assert/strict'
import type {
  Pathfinder2CalculatedProficiency,
  Pathfinder2InventoryEntry,
  Pathfinder2RulesCatalog,
} from '../../types'
import {
  calculateArmorClass,
  calculateAttacks,
} from '../combat/calculate-combat'
import {
  calculateInventory,
  purchaseEquipment,
  refundEquipment,
} from './calculate-inventory'
import {
  addCurrency,
  compareCurrency,
  formatCurrency,
  normalizeCurrency,
  subtractCurrency,
} from './currency'

const source = {
  type: 'class' as const,
  id: 'fighter',
  label: 'Класс · Воин',
  level: 1,
}

const weapon = {
  id: 'longsword',
  name: 'Длинный меч',
  level: 0,
  rarity: 'common' as const,
  price: { cp: 0, sp: 0, gp: 1, pp: 0 },
  bulk: 1 as const,
  traits: [],
  category: 'weapon' as const,
  sourceBook: 'test',
  proficiencyCategory: 'martial' as const,
  group: 'sword',
  damageDice: { count: 1, size: 8 },
  damageType: 'slashing',
  range: null,
  reload: null,
  hands: 1,
  usage: 'melee' as const,
}

const armor = {
  id: 'leather',
  name: 'Кожаный доспех',
  level: 0,
  rarity: 'common' as const,
  price: { cp: 0, sp: 0, gp: 2, pp: 0 },
  bulk: 1 as const,
  traits: [],
  category: 'armor' as const,
  sourceBook: 'test',
  armorCategory: 'light' as const,
  armorBonus: 1,
  dexterityCap: 4,
  checkPenalty: 0,
  speedPenalty: 0,
  strengthRequirement: 0,
  group: 'leather',
}

const lightItem = {
  id: 'torch',
  name: 'Факел',
  level: 0,
  rarity: 'common' as const,
  price: { cp: 1, sp: 0, gp: 0, pp: 0 },
  bulk: 'light' as const,
  traits: [],
  category: 'adventuring-gear' as const,
  sourceBook: 'test',
}

const catalog: Pathfinder2RulesCatalog = {
  ancestries: [],
  versatileHeritages: [],
  backgrounds: [],
  classes: [],
  generalFeats: [],
  skillFeats: [],
  mythicFeats: [],
  equipment: [lightItem],
  weapons: [weapon],
  armor: [armor],
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

function entry(
  id: string,
  itemId: string,
  quantity: number,
  equipped = false,
): Pathfinder2InventoryEntry {
  const item = [weapon, armor, lightItem].find(candidate => candidate.id === itemId)
  return {
    id,
    itemId,
    quantity,
    purchasePrice: item?.price ?? { cp: 0, sp: 0, gp: 0, pp: 0 },
    equipped,
    invested: false,
    carried: true,
    containerEntryId: null,
    customName: '',
    notes: '',
  }
}

const proficiencies: Pathfinder2CalculatedProficiency[] = [
  {
    category: 'weapon',
    targetId: 'martial',
    rank: 'trained',
    bonus: 3,
    sources: [source],
  },
  {
    category: 'armor',
    targetId: 'light',
    rank: 'trained',
    bonus: 3,
    sources: [source],
  },
]

const tests: Array<[string, () => void]> = [
  ['Валюта нормализуется без floating point', () => {
    assert.deepEqual(normalizeCurrency({ cp: 25, sp: 9, gp: 14, pp: 0 }), {
      cp: 5,
      sp: 1,
      gp: 5,
      pp: 1,
    })
    assert.equal(formatCurrency({ cp: 0, sp: 0, gp: 15, pp: 0 }), '1 пм 5 зм')
  }],
  ['Сложение, вычитание и сравнение используют медные монеты', () => {
    assert.deepEqual(
      addCurrency({ cp: 5, sp: 0, gp: 0, pp: 0 }, { cp: 5, sp: 0, gp: 0, pp: 0 }),
      { cp: 0, sp: 1, gp: 0, pp: 0 },
    )
    assert.equal(
      compareCurrency({ cp: 0, sp: 0, gp: 1, pp: 0 }, { cp: 99, sp: 0, gp: 0, pp: 0 }),
      1,
    )
    assert.equal(
      subtractCurrency({ cp: 0, sp: 0, gp: 1, pp: 0 }, { cp: 1, sp: 0, gp: 1, pp: 0 }),
      null,
    )
  }],
  ['Персонаж начинает с 15 зм и не может купить дороже остатка', () => {
    const purchase = purchaseEquipment({
      entries: [],
      currency: { cp: 0, sp: 0, gp: 15, pp: 0 },
      item: weapon,
      quantity: 2,
      entryId: 'purchase-1',
    })
    assert.equal(purchase.ok, true)
    if (!purchase.ok) return
    assert.deepEqual(purchase.currency, { cp: 0, sp: 0, gp: 3, pp: 1 })
    const impossible = purchaseEquipment({
      entries: purchase.entries,
      currency: purchase.currency,
      item: { ...weapon, price: { cp: 0, sp: 0, gp: 14, pp: 0 } },
      quantity: 1,
      entryId: 'purchase-2',
    })
    assert.deepEqual(impossible, { ok: false, reason: 'insufficient-funds' })
  }],
  ['Возврат до завершения возвращает полную цену покупки', () => {
    const refunded = refundEquipment(
      [entry('purchase-1', 'longsword', 2)],
      { cp: 0, sp: 0, gp: 13, pp: 0 },
      'purchase-1',
    )
    assert.deepEqual(refunded.currency, { cp: 0, sp: 0, gp: 5, pp: 1 })
    assert.equal(refunded.entries.length, 0)
  }],
  ['Каждые десять лёгких предметов дают один Bulk', () => {
    const inventory = calculateInventory(
      [entry('torches', 'torch', 21)],
      { cp: 0, sp: 0, gp: 15, pp: 0 },
      0,
      catalog,
    )
    assert.equal(inventory.bulk, 2)
    assert.equal(inventory.lightBulkCount, 21)
    assert.equal(inventory.safeBulk, 5)
    assert.equal(inventory.maximumBulk, 10)
  }],
  ['Броня ограничивает Ловкость и использует владение своей категорией', () => {
    const inventory = calculateInventory(
      [entry('armor', 'leather', 1, true)],
      { cp: 0, sp: 0, gp: 13, pp: 0 },
      0,
      catalog,
    )
    const result = calculateArmorClass({
      dexterityModifier: 5,
      strengthModifier: 0,
      inventory,
      proficiencies,
      catalog,
    })
    assert.equal(result.value, 18)
  }],
  ['Экипированное оружие создаёт рассчитанную атаку и урон', () => {
    const inventory = calculateInventory(
      [entry('weapon', 'longsword', 1, true)],
      { cp: 0, sp: 0, gp: 14, pp: 0 },
      3,
      catalog,
    )
    const [attack] = calculateAttacks({
      strengthModifier: 3,
      dexterityModifier: 1,
      inventory,
      proficiencies,
      catalog,
    })
    assert.equal(attack.attackModifier, 6)
    assert.equal(attack.damage, '1d8+3')
    assert.equal(attack.proficiencyRank, 'trained')
  }],
]

for (const [name, run] of tests) {
  run()
  console.log(`✓ ${name}`)
}

console.log(`Pathfinder 2 equipment: ${tests.length} сценариев пройдено.`)
