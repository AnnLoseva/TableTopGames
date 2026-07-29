import type {
  CreatureType,
  DamageSeverity,
  DamageTarget,
} from '../health'

export type DisciplineDamageStage =
  | 'before_halving'
  | 'after_halving'

export type DisciplineDamageModifierOperation =
  | 'add_damage'
  | 'set_damage'
  | 'subtract_before_halving'
  | 'subtract_after_halving'
  | 'convert_damage_type'
  | 'ignore_armor'
  | 'ignore_halving'
  | 'prevent_damage'
  | 'prevent_first_attack'

export type DisciplineDamageSourceKind = 'active' | 'passive' | 'armor'

export type DisciplineDamageOwner = 'source' | 'target'

export type DisciplineDamageContext = {
  sourceCharacterData?: unknown
  targetCharacterData?: unknown
  characterData?: unknown
  rulesJson?: unknown
  baseAmount: number
  severity: DamageSeverity
  target?: DamageTarget
  source?: string
  attackType?: string
  attackTypes?: string[]
  weaponTags?: string[]
  creatureType?: CreatureType | string
  conditions?: string[]
  armor?: number
  halveSuperficial?: boolean
  disabledModifierIds?: string[]
}

export type AppliedDisciplineDamageModifier = {
  id: string
  sourceKind: DisciplineDamageSourceKind
  owner?: DisciplineDamageOwner
  operation: DisciplineDamageModifierOperation
  label: string
  sourceLabel: string
  discipline?: string
  power?: string
  path?: string
  level?: number
  amountDelta: number
  beforeAmount: number
  afterAmount: number
  beforeSeverity: DamageSeverity
  afterSeverity: DamageSeverity
  active: boolean
  canDisable: boolean
}

export type DisciplineDamageResult = {
  originalAmount: number
  originalSeverity: DamageSeverity
  amountBeforeHalving: number
  finalAmount: number
  severity: DamageSeverity
  halved: boolean
  prevented: boolean
  armorIgnored: boolean
  armorValue: number
  modifiers: AppliedDisciplineDamageModifier[]
  chain: string[]
}

export function normalizeDamageAmount(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

export function getDamageSeverityLabel(severity: DamageSeverity) {
  return severity === 'aggravated' ? 'тяжёлый' : 'лёгкий'
}
