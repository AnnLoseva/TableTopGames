/**
 * Pure VTM5 Blood Bond rules — framework-independent.
 * Direction: thrall drank from regnant → thrall is bound to regnant.
 */

export const VTM5_BLOOD_BOND_MIN_LEVEL = 1
export const VTM5_BLOOD_BOND_MAX_LEVEL = 3
/**
 * Classic V5: each successive drink of the *same* regnant's Vitae raises the bond
 * by one step (1st→2nd→3rd drink). Cap is max level.
 */
export const VTM5_DRINKS_PER_LEVEL = 1

export type BloodBondLevel = 1 | 2 | 3

export type BloodBondLevelEffects = {
  level: BloodBondLevel
  title: string
  titleEn: string
  summary: string
  opposePoolModifier: number
  resistCommandDifficulty: number | null
  commandsRequireRoll: boolean
  breakHints: readonly string[]
}

export type BloodBondWarning =
  | { code: 'next_drink_raises'; severity: 'info' | 'warn' | 'critical'; message: string }
  | { code: 'max_level'; severity: 'critical'; message: string }
  | { code: 'level_3_slave'; severity: 'critical'; message: string }
  | { code: 'expired'; severity: 'warn'; message: string }
  | { code: 'inactive'; severity: 'info'; message: string }

const LEVEL_EFFECTS: Record<BloodBondLevel, BloodBondLevelEffects> = {
  1: {
    level: 1,
    title: 'Симпатия',
    titleEn: 'Bonded',
    summary: '−1 к пулам против регнанта; thrall ощущает влечение и доверие.',
    opposePoolModifier: -1,
    resistCommandDifficulty: null,
    commandsRequireRoll: true,
    breakHints: ['Время и отсутствие крови ослабляют уз; конфликт ценностей thrall.'],
  },
  2: {
    level: 2,
    title: 'Преданность',
    titleEn: 'Bound',
    summary: 'Сопротивление приказу — Воля, сложность 2 + уровень уз.',
    opposePoolModifier: -2,
    resistCommandDifficulty: 4,
    commandsRequireRoll: true,
    breakHints: ['Длительное отсутствие крови регнанта; вмешательство сильнейших уз.'],
  },
  3: {
    level: 3,
    title: 'Рабство',
    titleEn: 'Blood Bound',
    summary: 'Приказы регнанта не требуют броска; thrall — раб воли.',
    opposePoolModifier: -3,
    resistCommandDifficulty: 6,
    commandsRequireRoll: false,
    breakHints: [
      'Классический разрыв: около года без крови регнанта (по решению хроники).',
      'Смерть регнанта разрывает узы.',
    ],
  },
}

export function clampBloodBondLevel(level: number): BloodBondLevel {
  const n = Math.round(Number(level) || 0)
  if (n <= 1) return 1
  if (n >= VTM5_BLOOD_BOND_MAX_LEVEL) return 3
  return n as BloodBondLevel
}

export function getBloodBondLevelEffects(level: number): BloodBondLevelEffects {
  return LEVEL_EFFECTS[clampBloodBondLevel(level)]
}

export function getAllBloodBondLevelEffects(): readonly BloodBondLevelEffects[] {
  return [LEVEL_EFFECTS[1], LEVEL_EFFECTS[2], LEVEL_EFFECTS[3]]
}

/** Progress toward next level from successive drinks of the same blood. */
export function drinksTowardNextLevel(drinksCount: number, level: number): {
  drinksInStep: number
  drinksNeeded: number
  willRaiseOnNext: boolean
  atMax: boolean
} {
  const lvl = clampBloodBondLevel(level)
  const drinks = Math.max(0, Math.floor(Number(drinksCount) || 0))
  if (lvl >= VTM5_BLOOD_BOND_MAX_LEVEL) {
    return {
      drinksInStep: drinks,
      drinksNeeded: 0,
      willRaiseOnNext: false,
      atMax: true,
    }
  }
  // Each drink raises one level while below max.
  return {
    drinksInStep: drinks,
    drinksNeeded: 1,
    willRaiseOnNext: true,
    atMax: false,
  }
}

/**
 * Apply one drink of the same regnant's blood.
 * Raises bond level by 1 until max (V5 successive-drink model).
 */
export function applyDrinkToBond(input: {
  level: number
  drinksCount: number
}): { level: BloodBondLevel; drinksCount: number; levelIncreased: boolean } {
  const prevLevel = clampBloodBondLevel(input.level)
  const drinksCount = Math.max(0, Math.floor(Number(input.drinksCount) || 0)) + 1
  if (prevLevel >= VTM5_BLOOD_BOND_MAX_LEVEL) {
    return { level: prevLevel, drinksCount, levelIncreased: false }
  }
  const level = clampBloodBondLevel(prevLevel + 1)
  return { level, drinksCount, levelIncreased: level > prevLevel }
}

export function validateBondPair(thrallActorId: string, regnantActorId: string): string | null {
  const thrall = thrallActorId.trim()
  const regnant = regnantActorId.trim()
  if (!thrall || !regnant) return 'Нужны thrall и regnant'
  if (thrall === regnant) return 'Self-bond запрещён: thrall и regnant не могут совпадать'
  return null
}

export function computeBondWarnings(input: {
  level: number
  drinksCount: number
  status: string
  expiresAt?: string | null
  now?: Date
}): BloodBondWarning[] {
  const warnings: BloodBondWarning[] = []
  if (input.status !== 'active') {
    warnings.push({ code: 'inactive', severity: 'info', message: `Статус: ${input.status}` })
  }
  const lvl = clampBloodBondLevel(input.level)
  const progress = drinksTowardNextLevel(input.drinksCount, lvl)
  if (progress.atMax || lvl >= VTM5_BLOOD_BOND_MAX_LEVEL) {
    warnings.push({
      code: 'max_level',
      severity: 'critical',
      message: 'Уровень 3: thrall в полном рабстве воли.',
    })
    warnings.push({
      code: 'level_3_slave',
      severity: 'critical',
      message: getBloodBondLevelEffects(3).summary,
    })
  } else if (progress.willRaiseOnNext) {
    warnings.push({
      code: 'next_drink_raises',
      severity: 'critical',
      message: `Ещё один глоток той же крови → уровень ${lvl + 1}.`,
    })
  }
  if (input.expiresAt) {
    const exp = new Date(input.expiresAt)
    const now = input.now || new Date()
    if (!Number.isNaN(exp.getTime()) && exp.getTime() <= now.getTime()) {
      warnings.push({ code: 'expired', severity: 'warn', message: 'Срок уз истёк (по полю expires_at).' })
    }
  }
  return warnings
}

export function nextRiskSummary(level: number, drinksCount: number): string {
  const progress = drinksTowardNextLevel(drinksCount, level)
  if (progress.atMax) return 'Максимум: разрыв только временем без крови / смертью регнанта / сюжетным решением.'
  if (progress.willRaiseOnNext) return `Риск: следующий глоток поднимет узы до ${clampBloodBondLevel(level) + 1}.`
  return `До повышения: ${progress.drinksNeeded} глот. той же крови.`
}
