import type { NormalizedHealth, NormalizedWillpower } from '@/games/vampires/modules/table/types'

type MemberWarningInput = {
  hunger: number
  health: Pick<NormalizedHealth, 'current' | 'max' | 'impaired' | 'defeated' | 'physicalState'>
  willpower: Pick<NormalizedWillpower, 'current' | 'max' | 'impaired'>
  stains: number
  physicalState?: string | null
}

/**
 * Pure warning selectors — no I/O, no demo data.
 * Prefix "!" marks critical warnings used by summary counters.
 */
export function selectMemberWarnings(input: MemberWarningInput): string[] {
  const warnings: string[] = []
  if (input.hunger >= 5) warnings.push('!Голод 5 — макс. риск френзи / Rouse')
  else if (input.hunger >= 4) warnings.push('Голод 4 — риск')
  if (input.stains > 0) {
    warnings.push(input.stains === 1 ? '1 пятно Человечности' : `${input.stains} пятна Человечности`)
  }
  if (input.willpower.impaired || input.willpower.current <= 0) {
    warnings.push('!Воля истощена')
  }
  if (input.health.defeated) warnings.push('!Повержен / торпор')
  else if (input.health.impaired) warnings.push('Здоровье: изнурение')
  else if (input.health.max > 0 && input.health.current / input.health.max <= 0.35) {
    warnings.push('Низкое здоровье')
  }
  if (input.physicalState && input.physicalState !== 'healthy') {
    warnings.push(`Состояние: ${input.physicalState}`)
  }
  return warnings
}

export function selectCoterieWarnings(members: readonly { warnings: readonly string[]; displayName: string; hunger: number }[]) {
  const lines: string[] = []
  const high = members.filter(member => member.hunger >= 4)
  if (high.length) {
    lines.push(`${high.map(member => member.displayName).join(', ')}: Голод 4+`)
  }
  for (const member of members) {
    for (const warning of member.warnings) {
      if (warning.startsWith('!')) lines.push(`${member.displayName}: ${warning.slice(1)}`)
    }
  }
  return [...new Set(lines)]
}
