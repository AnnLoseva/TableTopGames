import { getAttributeDots, resolveSkillValue } from '@/games/vampires/lib/i18n/ruleNames'
import type { ContestedOpponentOption } from '@/games/vampires/modules/rolls/types'
import { ATTRIBUTE_GROUPS, SKILL_GROUPS } from '../constants'
import { tableApplyDisciplineEffectsToRoll, tableHealth } from '../system-runtime'
import type { ActiveParticipant, CharacterOption, RollPoolBuilder } from '../types'
import {
  getCharacterHealth,
  getWillpowerImpairmentPenalty,
} from './character-state'
import { getSkillDotValue, type DisciplineRule } from './discipline-ui'
import { getRollPenalties, getRollTraits } from './roll-pool-helpers'
import { getExtraTraitNames } from './roll-utils'

export type ContestedOpponentOptionsContext = {
  isMaster: boolean
  chatUserId?: string
  roomParticipants: ActiveParticipant[]
  chatCharacters: CharacterOption[]
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
}

export function getContestedOpponentOptions(
  context: ContestedOpponentOptionsContext,
  initiator: CharacterOption | null,
): ContestedOpponentOption[] {
  const options: ContestedOpponentOption[] = []
  const seen = new Set<string>()
  const addOption = (option: ContestedOpponentOption) => {
    if (seen.has(option.id)) return
    seen.add(option.id)
    options.push(option)
  }

  context.roomParticipants
    .filter(participant => participant.userId !== context.chatUserId && participant.characterId !== initiator?.id)
    .forEach(participant => {
      const characterName = participant.characterId && participant.characterName !== 'без персонажа'
        ? `${participant.characterName} · `
        : ''
      addOption({
        id: `player:${participant.userId}`,
        label: `${characterName}${participant.username}`,
        actorKind: 'player',
        characterId: participant.characterId,
        userId: participant.userId,
      })
    })

  if (context.isMaster) {
    context.chatCharacters.forEach(character => {
      if (character.id === initiator?.id) return
      addOption({
        id: `npc:${character.id}`,
        label: context.tf('{name} · НПС', { name: character.name }),
        actorKind: 'npc',
        characterId: character.id,
      })
    })
  }

  return options
}

function getDisciplineDots(sources: Record<string, number>) {
  return Object.values(sources || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)
}

export type OpposedCharacterPoolContext = {
  t: (ru: string) => string
  d10: (count: number) => string
  disciplineRules: Record<string, DisciplineRule> | null
}

export function getOpposedCharacterPool(
  context: OpposedCharacterPoolContext,
  character: CharacterOption | null,
  sideState: RollPoolBuilder,
) {
  const attributeDots = character ? getAttributeDots(character.attributes, sideState.attribute) : 0
  const attributeTwoDots = character ? getAttributeDots(character.attributes, sideState.attributeTwo) : 0
  const skillDots = character ? getSkillDotValue(resolveSkillValue(character.skills, sideState.skill)) : 0
  const disciplineDots = character ? getDisciplineDots(character.disciplines[sideState.discipline] || {}) : 0
  const willpowerPenalty = getWillpowerImpairmentPenalty([sideState.attribute, sideState.attributeTwo], character)
  const healthPenalty = tableHealth().getHealthImpairmentPenalty(
    [sideState.attribute, sideState.attributeTwo],
    getCharacterHealth(character),
  )
  const baseDiceCount = attributeDots + attributeTwoDots + skillDots + disciplineDots + sideState.modifier
  const rollEffectResult = character
    ? tableApplyDisciplineEffectsToRoll({
        characterData: character,
        rulesJson: context.disciplineRules,
        baseDiceCount,
        poolType: 'opposed-response',
        kind: 'roll',
        action: 'contested',
        source: 'manual',
        traits: getRollTraits(sideState.attribute, sideState.attributeTwo, sideState.skill, sideState.discipline),
        penalties: getRollPenalties(context.t, willpowerPenalty, healthPenalty),
      }, character.derivedStats)
    : null
  const diceCount = rollEffectResult?.finalDiceCount || 0
  const poolParts = [
    sideState.attribute ? `${context.t(sideState.attribute)} ${attributeDots}` : '',
    sideState.attributeTwo ? `${context.t(sideState.attributeTwo)} ${attributeTwoDots}` : '',
    sideState.skill ? `${context.t(sideState.skill)} ${skillDots}` : '',
    sideState.discipline ? `${sideState.discipline} ${disciplineDots}` : '',
    sideState.modifier ? `${context.t('модификатор')} ${sideState.modifier > 0 ? '+' : ''}${sideState.modifier}` : '',
    willpowerPenalty ? context.t('Истощение Воли -2') : '',
    healthPenalty ? context.t('Изнурение по здоровью -2') : '',
  ].filter(Boolean)

  return {
    diceCount,
    poolName: poolParts.join(' + ') || context.d10(diceCount || 0),
    poolParts,
    rollEffectResult,
    extraAttributes: character ? getExtraTraitNames(character.attributes, ATTRIBUTE_GROUPS) : [],
    extraSkills: character ? getExtraTraitNames(character.skills, SKILL_GROUPS) : [],
    disciplineNames: character
      ? Array.from(new Set([
          ...Object.keys(character.disciplines),
          ...Object.keys(character.selectedPowers),
          ...Object.keys(character.selectedPathPowers),
        ])).sort((a, b) => a.localeCompare(b, 'ru'))
      : [],
  }
}