import { getAttributeDots, resolveSkillValue } from '@/games/vampires/lib/i18n/ruleNames'

export function getDotDisplay(value: number) {
  const dots = Math.max(0, Math.min(5, Math.floor(Number(value) || 0)))
  return `${'●'.repeat(dots)}${'○'.repeat(5 - dots)}`
}

export function getSkillDots(value: unknown) {
  if (typeof value === 'number') return value
  if (!value || typeof value !== 'object') return 0
  return Number((value as { dots?: number }).dots || 0)
}

export function getSkillSpecs(value: unknown) {
  if (!value || typeof value !== 'object') return []
  const specs = (value as { specs?: unknown }).specs
  return Array.isArray(specs) ? specs.filter((spec): spec is string => typeof spec === 'string') : []
}

export function getDisciplineDots(sources: Record<string, number>) {
  return Object.values(sources || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)
}

export function formatGenerationLabel(generation: string | null | undefined, tf: (ru: string, vars: Record<string, string | number>) => string) {
  if (!generation) return ''
  const numeric = Number.parseInt(generation, 10)
  if (!Number.isNaN(numeric)) return tf('{n}-е поколение', { n: numeric })
  return generation
}

export function buildCharacterSubtitle(
  parts: {
    clan?: string | null
    generation?: string | null
    predator?: string | null
  },
  t: (ru: string) => string,
  tf: (ru: string, vars: Record<string, string | number>) => string,
) {
  return [
    parts.clan || t('Клан не указан'),
    formatGenerationLabel(parts.generation, tf),
    parts.predator ? tf('охота: {style}', { style: parts.predator }) : '',
  ].filter(Boolean).join(' · ')
}

export function getAttributePoolSlot(
  name: string,
  attribute: string,
  attributeTwo: string,
) {
  if (attribute === name) return 1
  if (attributeTwo === name) return 2
  return 0
}

export function getPoolPartDots(
  name: string,
  character: {
    attributes: Record<string, unknown>
    skills: Record<string, unknown>
    disciplines: Record<string, Record<string, number>>
  },
) {
  if (character.disciplines[name]) {
    return getDisciplineDots(character.disciplines[name] || {})
  }
  const skillValue = resolveSkillValue(character.skills, name)
  const skillDots = getSkillDots(skillValue)
  if (skillDots > 0) return skillDots
  return getAttributeDots(character.attributes, name)
}