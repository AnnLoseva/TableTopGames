import type { DisciplineRollPenalty } from '@/games/vampires/core/vtm5/rules/disciplines/effects'

export function getRollTraits(...parts: string[]) {
  return parts.map(part => part.trim()).filter(Boolean)
}

export function getRollPenalties(
  t: (ru: string) => string,
  willpowerPenalty: number,
  healthPenalty: number,
): DisciplineRollPenalty[] {
  const penalties: DisciplineRollPenalty[] = []
  if (willpowerPenalty) {
    penalties.push({
      id: 'willpower_impairment',
      kind: 'willpower_impairment',
      label: t('истощения Воли'),
      diceDelta: willpowerPenalty,
    })
  }
  if (healthPenalty) {
    penalties.push({
      id: 'health_impairment',
      kind: 'health_impairment',
      label: t('изнурения'),
      diceDelta: healthPenalty,
    })
  }
  return penalties
}