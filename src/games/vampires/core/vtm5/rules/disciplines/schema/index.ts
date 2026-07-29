export type FormulaValue =
  | number
  | {
      type: 'trait'
      trait: string
      multiplier?: number
      offset?: number
      min?: number
      max?: number
    }
  | {
      type: 'formula'
      expression: string
    }
  | {
      formula: 'discipline_rating' | string
      discipline?: string
      multiplier?: number
      offset?: number
      min?: number
      max?: number
    }

export type DerivedStats = {
  healthMax?: number
  willpowerMax?: number
  defenseDice?: number
  armor?: number
  movementSpeed?: number
  unarmedDamage?: number
  weaponDamageBonus?: number
  initiative?: number
  [stat: string]: number | undefined
}

export type RollMatcher = {
  kinds?: string[]
  poolTypes?: string[]
  traits?: string[]
  actions?: string[]
  sources?: string[]
  weaponTags?: string[]
  conditions?: string[]
}

export type DamageMatcher = {
  owners?: Array<'source' | 'target'>
  targets?: Array<'health' | 'willpower'>
  severities?: Array<'superficial' | 'aggravated'>
  sources?: string[]
  attackTypes?: string[]
  weaponTags?: string[]
  creatureTypes?: string[]
  conditions?: string[]
}

export type FeedingMatcher = {
  sources?: string[]
  conditions?: string[]
}

type BaseDisciplineEffect = {
  id?: string
  label?: string
  description?: string
  payload?: Record<string, unknown>
}

export type TrackerModifierEffect = BaseDisciplineEffect & {
  type: 'tracker_modifier'
  tracker: 'health' | 'willpower' | 'humanity' | 'hunger' | string
  field?: 'current' | 'max' | 'superficial' | 'aggravated' | string
  operation: 'add' | 'add_max' | 'subtract' | 'set' | 'min' | 'max'
  value: FormulaValue
}

export type RollModifierEffect = BaseDisciplineEffect & {
  type: 'roll_modifier'
  matcher?: RollMatcher
  operation?:
    | 'add'
    | 'subtract'
    | 'set'
    | 'multiply'
    | 'add_dice'
    | 'remove_dice'
    | 'difficulty_modifier'
    | 'ignore_penalty'
    | 'auto_success'
  value?: FormulaValue
  amount?: FormulaValue
  penalty?: string
  penalties?: string[]
}

export type DamageModifierEffect = BaseDisciplineEffect & {
  type: 'damage_modifier'
  matcher?: DamageMatcher
  operation?:
    | 'add'
    | 'subtract'
    | 'set'
    | 'multiply'
    | 'add_damage'
    | 'set_damage'
    | 'subtract_before_halving'
    | 'subtract_after_halving'
    | 'convert_damage_type'
    | 'ignore_armor'
    | 'ignore_halving'
    | 'prevent_damage'
    | 'prevent_first_attack'
  value?: FormulaValue
  amount?: FormulaValue
  timing?: 'before_halving' | 'after_halving' | string
  stage?: 'before_halving' | 'after_halving' | string
  setSeverity?: 'superficial' | 'aggravated'
  severity?: 'superficial' | 'aggravated'
  ignoreHalving?: boolean
  ignoreArmor?: boolean
  preventFirstAttack?: boolean
}

export type WeaponEffect = BaseDisciplineEffect & {
  type: 'weapon_effect'
  weaponTags?: string[]
  damageBonus?: FormulaValue
  damageSeverity?: 'superficial' | 'aggravated'
  grantedTags?: string[]
  properties?: Record<string, string | number | boolean>
}

export type ConditionEffect = BaseDisciplineEffect & {
  type: 'condition'
  condition: string
  action?: 'apply' | 'remove'
  stacks?: FormulaValue
}

export type EntityEffect = BaseDisciplineEffect & {
  type: 'entity'
  entityType: 'famulus' | 'animal' | 'swarm' | string
  status?: string
  traits?: Record<string, FormulaValue>
  properties?: Record<string, string | number | boolean>
}

export type FeedingModifierEffect = BaseDisciplineEffect & {
  type: 'feeding_modifier'
  matcher?: FeedingMatcher
  operation?: 'add_satiation' | 'set_satiation'
  value?: FormulaValue
  amount?: FormulaValue
  minimumHunger?: number
}

export type DisciplinePowerInputField = {
  id: string
  label?: string
  type?: 'text' | 'textarea' | 'number' | 'checkbox' | 'select'
  placeholder?: string
  required?: boolean
  description?: string
  options?: Array<{
    label: string
    value: string
    description?: string
  }>
}

export type TransformationEffect = BaseDisciplineEffect & {
  type: 'transformation'
  form: string
  derivedStats?: Partial<DerivedStats>
  grantedTraits?: string[]
  suppressedTraits?: string[]
}

export type MovementEffect = BaseDisciplineEffect & {
  type: 'movement'
  mode: 'walk' | 'climb' | 'swim' | 'fly' | 'burrow' | 'teleport' | string
  speed?: FormulaValue
  multiplier?: FormulaValue
  ignoreTerrain?: boolean
}

export type SenseEffect = BaseDisciplineEffect & {
  type: 'sense'
  sense: string
  range?: FormulaValue
  rollModifier?: FormulaValue
  tags?: string[]
}

export type ManualPromptEffect = BaseDisciplineEffect & {
  type: 'manual_prompt'
  message: string
  choices?: Array<{
    id: string
    label: string
    value?: string | number | boolean
  }>
  requiresStoryteller?: boolean
}

export type DisciplineEffect =
  | TrackerModifierEffect
  | RollModifierEffect
  | DamageModifierEffect
  | WeaponEffect
  | ConditionEffect
  | EntityEffect
  | FeedingModifierEffect
  | TransformationEffect
  | MovementEffect
  | SenseEffect
  | ManualPromptEffect

export type DisciplinePowerMechanics = {
  version?: 1
  automation?: {
    status?: 'auto' | 'partial' | 'manual'
  }
  identity?: {
    discipline?: string
    power?: string
    path?: string
    level?: number
    tags?: string[]
  }
  activation?: {
    kind?: 'active' | 'passive' | 'reaction' | 'ritual' | string
    action?: string
  }
  cost?: {
    rouseChecks?: number
    bloodPoints?: number
    willpowerSpend?: number
    willpowerRatingReduction?: number
    variableRouseChecks?: boolean
    variableBloodPoints?: boolean
    manualBlood?: boolean
    manualWillpower?: boolean
  }
  duration?: {
    type?: 'scene' | 'night' | 'turn' | 'permanent' | string
    turns?: number
  }
  effects?: DisciplineEffect[]
  deactivateEffects?: DisciplineEffect[]
  input?: {
    fields?: DisciplinePowerInputField[]
  }
  ui?: {
    showOnFullSheet?: boolean
    showOnQuickSheet?: boolean
    activeLabel?: string
  }
  notes?: string[]
  [key: string]: unknown
}

export type ActiveEffect = {
  id: string
  source: {
    discipline: string
    power: string
    path?: string
    level?: number
  }
  effect: DisciplineEffect
  targetCharacterId?: string
  startedAt: string
  expiresAt?: string | null
  remainingUses?: number | null
  duration?: {
    type: 'scene' | 'night' | 'turn' | 'permanent'
    turns?: number
    startedAt: string
  }
  active: boolean
}
