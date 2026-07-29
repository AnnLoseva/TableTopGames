'use client'

import {
  createJournalActions,
  type JournalActionsDeps,
} from '../services/journal-actions'

export type { JournalActionsDeps }

/** Local journal entry CRUD and persistence for the table diary panel. */
export function useJournalActions(deps: JournalActionsDeps) {
  return createJournalActions(deps)
}