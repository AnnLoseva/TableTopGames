export type Vtm5RollDie = {
  id?: string
  value: number
  kind: string
  rerolled?: boolean
}

export type Vtm5RollOutcomeMeta = {
  messyCritical: boolean
  bestialFailure: boolean
}

const DEFAULT_DIE_KINDS = {
  hunger: {
    1: 'hunger-critical-fail',
    10: 'hunger-critical-success',
    defaultHigh: 'hunger-success',
    defaultLow: 'hunger-fail',
  },
  normal: {
    10: 'critical',
    defaultHigh: 'success',
    defaultLow: 'fail',
  },
} as const

function defaultDieId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getDieKind(value: number, isHunger: boolean): string {
  if (isHunger) {
    if (value === 1) return DEFAULT_DIE_KINDS.hunger[1]
    if (value === 10) return DEFAULT_DIE_KINDS.hunger[10]
    return value >= 6 ? DEFAULT_DIE_KINDS.hunger.defaultHigh : DEFAULT_DIE_KINDS.hunger.defaultLow
  }
  if (value === 10) return DEFAULT_DIE_KINDS.normal[10]
  return value >= 6 ? DEFAULT_DIE_KINDS.normal.defaultHigh : DEFAULT_DIE_KINDS.normal.defaultLow
}

export function rollD10Pool(
  diceCount: number,
  hungerDiceCount = 0,
  createDieId: () => string = defaultDieId,
): Vtm5RollDie[] {
  const safeDiceCount = Math.max(1, Math.min(20, diceCount))
  const safeHungerDiceCount = Math.max(0, Math.min(5, safeDiceCount, hungerDiceCount))
  return Array.from({ length: safeDiceCount }, (_, index) => {
    const value = Math.floor(Math.random() * 10) + 1
    const isHunger = index < safeHungerDiceCount
    return {
      id: createDieId(),
      value,
      kind: getDieKind(value, isHunger),
    }
  })
}

export function countD10Successes(dice: ReadonlyArray<Pick<Vtm5RollDie, 'value'>>) {
  const criticals = dice.filter(die => die.value === 10).length
  return dice.filter(die => die.value >= 6).length + Math.floor(criticals / 2) * 2
}

export function getRollOutcomeMeta(
  dice: ReadonlyArray<Pick<Vtm5RollDie, 'value' | 'kind'>>,
  successes: number,
): Vtm5RollOutcomeMeta {
  const criticals = dice.filter(die => die.value === 10).length
  const hungerCriticals = dice.filter(die => die.value === 10 && die.kind.startsWith('hunger')).length
  const hungerOnes = dice.filter(die => die.value === 1 && die.kind.startsWith('hunger')).length
  return {
    messyCritical: successes > 0 && criticals >= 2 && hungerCriticals > 0,
    bestialFailure: successes <= 0 && hungerOnes > 0,
  }
}