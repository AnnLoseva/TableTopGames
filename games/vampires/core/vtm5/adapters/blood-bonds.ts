import {
  applyDrinkToBond,
  clampBloodBondLevel,
  computeBondWarnings,
  drinksTowardNextLevel,
  getAllBloodBondLevelEffects,
  getBloodBondLevelEffects,
  nextRiskSummary,
  validateBondPair,
  VTM5_BLOOD_BOND_MAX_LEVEL,
  VTM5_BLOOD_BOND_MIN_LEVEL,
  VTM5_DRINKS_PER_LEVEL,
  type BloodBondLevel,
  type BloodBondLevelEffects,
  type BloodBondWarning,
} from '../rules/blood-bonds'

export type Vtm5BloodBondAdapter = {
  minLevel: typeof VTM5_BLOOD_BOND_MIN_LEVEL
  maxLevel: typeof VTM5_BLOOD_BOND_MAX_LEVEL
  drinksPerLevel: typeof VTM5_DRINKS_PER_LEVEL
  clampLevel: (level: number) => BloodBondLevel
  getLevelEffects: (level: number) => BloodBondLevelEffects
  getAllLevelEffects: () => readonly BloodBondLevelEffects[]
  validatePair: (thrallActorId: string, regnantActorId: string) => string | null
  applyDrink: (input: { level: number; drinksCount: number }) => {
    level: BloodBondLevel
    drinksCount: number
    levelIncreased: boolean
  }
  computeWarnings: (input: {
    level: number
    drinksCount: number
    status: string
    expiresAt?: string | null
  }) => BloodBondWarning[]
  nextRisk: (level: number, drinksCount: number) => string
  drinksProgress: (drinksCount: number, level: number) => ReturnType<typeof drinksTowardNextLevel>
}

export function createVtm5BloodBondAdapter(): Vtm5BloodBondAdapter {
  return {
    minLevel: VTM5_BLOOD_BOND_MIN_LEVEL,
    maxLevel: VTM5_BLOOD_BOND_MAX_LEVEL,
    drinksPerLevel: VTM5_DRINKS_PER_LEVEL,
    clampLevel: clampBloodBondLevel,
    getLevelEffects: getBloodBondLevelEffects,
    getAllLevelEffects: getAllBloodBondLevelEffects,
    validatePair: validateBondPair,
    applyDrink: applyDrinkToBond,
    computeWarnings: computeBondWarnings,
    nextRisk: nextRiskSummary,
    drinksProgress: drinksTowardNextLevel,
  }
}
