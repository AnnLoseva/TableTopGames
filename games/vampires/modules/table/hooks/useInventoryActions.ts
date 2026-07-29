'use client'

import { createInventoryActions, type InventoryActionsDeps } from '../services/inventory-actions'

export type { InventoryActionsDeps }

/** Quick inventory add + master reveal for character preview. */
export function useInventoryActions(deps: InventoryActionsDeps) {
  return createInventoryActions(deps)
}