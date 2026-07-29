import type { RollMeta } from '../types'

export type DiceOverlaySummary = {
  text: string
  tone: 'good' | 'bad' | 'neutral'
}

export function buildDiceOverlaySummary(
  t: (ru: string) => string,
  tf: (ru: string, vars: Record<string, string | number>) => string,
  successes: number,
  meta?: RollMeta,
): DiceOverlaySummary {
  if (meta?.bestialFailure) return { text: t('Звериный провал'), tone: 'bad' }
  if (meta?.messyCritical) return { text: tf('Грязный критический успех · {n}', { n: successes }), tone: 'good' }
  if (successes > 0) return { text: tf('Успехов: {n}', { n: successes }), tone: 'good' }
  return { text: t('Провал'), tone: 'bad' }
}