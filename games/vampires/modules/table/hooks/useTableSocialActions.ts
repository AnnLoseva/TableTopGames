'use client'

import {
  createTableSocialActions,
  type TableSocialActionsDeps,
} from '../services/table-social-actions'

export type { TableSocialActionsDeps }

/** Master whispers and player hand-raise signaling. */
export function useTableSocialActions(deps: TableSocialActionsDeps) {
  return createTableSocialActions(deps)
}