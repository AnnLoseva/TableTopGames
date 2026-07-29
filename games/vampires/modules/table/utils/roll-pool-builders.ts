import { getAttributeDots, resolveSkillValue } from '@/games/vampires/lib/i18n/ruleNames'
import { ATTRIBUTE_GROUPS, SKILL_GROUPS } from '../constants'
import { tableApplyDisciplineEffectsToRoll, tableHealth } from '../system-runtime'
import type { CharacterOption, RollMode } from '../types'
import {
  getCharacterHealth,
  getWillpowerImpairmentPenalty,
} from './character-state'
import { getSkillDotValue, type DisciplineRule } from './discipline-ui'
import { getRollPenalties, getRollTraits } from './roll-pool-helpers'
import { getExtraTraitNames } from './roll-utils'
import type { DisciplineRollEffectResult } from '@/games/vampires/core/vtm5/rules/disciplines/effects'

function getDisciplineDots(sources: Record<string, number>) {
  return Object.values(sources || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)
}

export type CharacterRollPoolInput = {
  character: CharacterOption | null
  attribute: string
  attributeTwo: string
  skill: string
  discipline: string
  modifier: number
  rollMode: RollMode
  useBloodSurge: boolean
  poolType: 'master-character' | 'character-sheet'
  disciplineRules: Record<string, DisciplineRule> | null
  disabledModifierIds: string[]
  t: (ru: string) => string
  d10: (n: number) => string
}

export type CharacterRollPoolState = {
  attributeDots: number
  attributeTwoDots: number
  skillDots: number
  disciplineDots: number
  poolBeforeLimit: number
  willpowerImpairmentPenalty: number
  healthImpairmentPenalty: number
  rollEffectResult: DisciplineRollEffectResult | null
  diceCount: number
  poolParts: string[]
  poolName: string
  extraAttributes: string[]
  extraSkills: string[]
  disciplineNames: string[]
}

export function buildCharacterRollPool(input: CharacterRollPoolInput): CharacterRollPoolState {
  const { character, t, d10 } = input
  const attributeDots = character ? getAttributeDots(character.attributes, input.attribute) : 0
  const attributeTwoDots = character ? getAttributeDots(character.attributes, input.attributeTwo) : 0
  const skillDots = character ? getSkillDotValue(resolveSkillValue(character.skills, input.skill)) : 0
  const disciplineDots = character ? getDisciplineDots(character.disciplines[input.discipline] || {}) : 0
  const poolBeforeLimit = attributeDots + attributeTwoDots + skillDots + disciplineDots + input.modifier
  const willpowerImpairmentPenalty = getWillpowerImpairmentPenalty([input.attribute, input.attributeTwo], character)
  const healthImpairmentPenalty = tableHealth().getHealthImpairmentPenalty(
    [input.attribute, input.attributeTwo],
    getCharacterHealth(character),
  )
  const rollEffectResult = character
    ? tableApplyDisciplineEffectsToRoll({
        characterData: character,
        rulesJson: input.disciplineRules,
        baseDiceCount: poolBeforeLimit,
        poolType: input.poolType,
        kind: 'roll',
        action: input.rollMode,
        source: input.useBloodSurge ? 'blood_surge' : 'manual',
        traits: getRollTraits(input.attribute, input.attributeTwo, input.skill, input.discipline),
        penalties: getRollPenalties(t, willpowerImpairmentPenalty, healthImpairmentPenalty),
        disabledModifierIds: input.disabledModifierIds,
      }, character.derivedStats)
    : null
  const diceCount = rollEffectResult?.finalDiceCount || 0
  const poolParts = [
    input.attribute ? `${t(input.attribute)} ${attributeDots}` : '',
    input.attributeTwo ? `${t(input.attributeTwo)} ${attributeTwoDots}` : '',
    input.skill ? `${t(input.skill)} ${skillDots}` : '',
    input.discipline ? `${input.discipline} ${disciplineDots}` : '',
    input.modifier ? `${t('модификатор')} ${input.modifier > 0 ? '+' : ''}${input.modifier}` : '',
  ].filter(Boolean)
  const poolName = poolParts.join(' + ') || d10(diceCount || 1)
  const extraAttributes = character ? getExtraTraitNames(character.attributes, ATTRIBUTE_GROUPS) : []
  const extraSkills = character ? getExtraTraitNames(character.skills, SKILL_GROUPS) : []
  const disciplineNames = character
    ? Array.from(new Set([
        ...Object.keys(character.disciplines),
        ...Object.keys(character.selectedPowers),
        ...Object.keys(character.selectedPathPowers),
      ])).sort((a, b) => a.localeCompare(b, 'ru'))
    : []

  return {
    attributeDots,
    attributeTwoDots,
    skillDots,
    disciplineDots,
    poolBeforeLimit,
    willpowerImpairmentPenalty,
    healthImpairmentPenalty,
    rollEffectResult,
    diceCount,
    poolParts,
    poolName,
    extraAttributes,
    extraSkills,
    disciplineNames,
  }
}