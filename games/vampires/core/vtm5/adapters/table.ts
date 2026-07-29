import type { TableSystemAdapter } from '@/games/vampires/modules/table/system-adapter'
import { removeActiveEffect } from '../rules/disciplines/active-effects'
import { payDisciplineCost, resolveDisciplineCost } from '../rules/disciplines/costs'
import { getDisciplineDurationLabel } from '../rules/disciplines/durations'
import {
  activateDisciplinePower,
  deactivateDisciplinePower,
  isDisciplinePowerActive,
} from '../rules/disciplines/engine'
import {
  applyDisciplineEffectsToDamage,
  applyDisciplineEffectsToRoll,
} from '../rules/disciplines/effects'
import { getDerivedStats } from '../rules/derived-stats'
import {
  applyHealthDamage,
  calculateConflictDamage,
  getHealthImpairmentPenalty,
  getHealthMetaState,
  getHealthWarning,
  getSuperficialMendAmount,
  normalizeDamageProfile,
  normalizeHealthTracker,
  recoverHealthDamage,
  toHealthTracker,
} from '../rules/health'
import {
  addHumanityStains,
  getHumanityState,
  getHumanityStatus,
  getHumanityWarning,
  getRemorseDice,
} from '../rules/humanity'

export function createVtm5TableAdapter(): TableSystemAdapter {
  return {
    systemId: 'vtm5',
    rulesNamespace: 'vtm5',
    health: {
      getHealthImpairmentPenalty,
      normalizeHealthTracker,
      applyHealthDamage,
      recoverHealthDamage,
      calculateConflictDamage,
      getHealthMetaState,
      getHealthWarning,
      getSuperficialMendAmount,
      normalizeDamageProfile,
      toHealthTracker,
    },
    disciplines: {
      applyDisciplineEffectsToDamage,
      resolveDisciplineCost,
      payDisciplineCost,
      activateDisciplinePower,
      deactivateDisciplinePower,
      isDisciplinePowerActive,
      removeActiveEffect,
      getDisciplineDurationLabel,
    },
    humanity: {
      getHumanityState,
      getHumanityStatus,
      getHumanityWarning,
      getRemorseDice,
      addHumanityStains,
    },
    getDerivedStats,
    applyDisciplineEffectsToRoll,
  }
}