import type {
  Pathfinder2CalculatedInventory,
  Pathfinder2CurrencyAmount,
  Pathfinder2EquipmentItem,
  Pathfinder2InventoryEntry,
  Pathfinder2RulesCatalog,
} from '../../types'
import {
  addCurrency,
  multiplyCurrency,
  normalizeCurrency,
  subtractCurrency,
} from './currency'

function equipmentItems(catalog: Pathfinder2RulesCatalog) {
  return Array.from(new Map([
    ...catalog.equipment,
    ...catalog.weapons,
    ...catalog.armor,
    ...catalog.shields,
  ].map(item => [item.id, item])).values())
}

export function calculateInventory(
  entries: Pathfinder2InventoryEntry[],
  currency: Pathfinder2CurrencyAmount,
  strengthModifier: number,
  catalog: Pathfinder2RulesCatalog,
): Pathfinder2CalculatedInventory {
  const items = new Map(equipmentItems(catalog).map(item => [item.id, item]))
  let spent: Pathfinder2CurrencyAmount = { cp: 0, sp: 0, gp: 0, pp: 0 }
  let numericBulk = 0
  let lightBulkCount = 0
  const missingItemIds = new Set<string>()

  const calculatedEntries = entries.map(entry => {
    const quantity = Math.max(0, Math.round(entry.quantity))
    const item = items.get(entry.itemId) ?? null
    if (!item) missingItemIds.add(entry.itemId)
    const totalPrice = multiplyCurrency(entry.purchasePrice, quantity)
    spent = addCurrency(spent, totalPrice)
    if (entry.carried && item) {
      if (item.bulk === 'light') lightBulkCount += quantity
      else numericBulk += item.bulk * quantity
    }
    return {
      ...entry,
      quantity,
      item,
      totalPrice,
      bulk: entry.carried && item && item.bulk !== 'light'
        ? item.bulk * quantity
        : 0,
      lightBulkCount: entry.carried && item?.bulk === 'light' ? quantity : 0,
    }
  })
  const bulk = numericBulk + Math.floor(lightBulkCount / 10)
  const safeBulk = Math.max(0, 5 + strengthModifier)
  const maximumBulk = Math.max(0, 10 + strengthModifier)

  return {
    entries: calculatedEntries,
    spent,
    remaining: normalizeCurrency(currency),
    bulk,
    lightBulkCount,
    safeBulk,
    maximumBulk,
    encumbered: bulk > safeBulk,
    overloaded: bulk > maximumBulk,
    missingItemIds: [...missingItemIds],
  }
}

export type Pathfinder2PurchaseResult =
  | {
      ok: true
      entries: Pathfinder2InventoryEntry[]
      currency: Pathfinder2CurrencyAmount
    }
  | { ok: false; reason: 'invalid-quantity' | 'insufficient-funds' }

export function purchaseEquipment({
  entries,
  currency,
  item,
  quantity,
  entryId,
}: {
  entries: Pathfinder2InventoryEntry[]
  currency: Pathfinder2CurrencyAmount
  item: Pathfinder2EquipmentItem
  quantity: number
  entryId: string
}): Pathfinder2PurchaseResult {
  const count = Math.round(quantity)
  if (count < 1) return { ok: false, reason: 'invalid-quantity' }
  const total = multiplyCurrency(item.price, count)
  const remaining = subtractCurrency(currency, total)
  if (!remaining) return { ok: false, reason: 'insufficient-funds' }
  return {
    ok: true,
    currency: remaining,
    entries: [...entries, {
      id: entryId,
      itemId: item.id,
      quantity: count,
      purchasePrice: item.price,
      equipped: false,
      invested: false,
      carried: true,
      containerEntryId: null,
      customName: '',
      notes: '',
    }],
  }
}

export function refundEquipment(
  entries: Pathfinder2InventoryEntry[],
  currency: Pathfinder2CurrencyAmount,
  entryId: string,
) {
  const entry = entries.find(candidate => candidate.id === entryId)
  if (!entry) return { entries, currency }
  return {
    entries: entries.filter(candidate => candidate.id !== entryId),
    currency: addCurrency(
      currency,
      multiplyCurrency(entry.purchasePrice, entry.quantity),
    ),
  }
}
