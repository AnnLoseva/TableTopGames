'use client'

import { createDisciplineActions, type DisciplineActionsDeps } from '../services/discipline-actions'

export type { DisciplineActionsDeps, RollPreviewPowerParams, DeactivatePreviewPowerParams, RemovePreviewActiveEffectParams } from '../services/discipline-actions'

/** Discipline power activation, deactivation, and preview rolls. */
export function useDisciplineActions(deps: DisciplineActionsDeps) {
  return createDisciplineActions(deps)
}