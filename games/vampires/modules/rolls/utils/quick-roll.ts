import type { CharacterOption, Die, RollMessage, RollMeta } from '@/games/vampires/modules/table/types'
import type { BuildQuickRollDeps, QuickRollOptions } from '../types'
import {
  getActivePenaltyDelta,
  getActiveRollModifierWarnings,
  getBloodSurgeBonus,
  getRouseWarning,
} from './roll-helpers'

export async function buildQuickRoll(
  deps: BuildQuickRollDeps,
  diceCount: number,
  poolName: string,
  character: CharacterOption,
  poolType: string,
  options: QuickRollOptions = {},
): Promise<RollMessage> {
  const usesVampireResources = ['vampire', 'thinblood'].includes(character.characterType)
  const useBloodSurge = usesVampireResources && Boolean(options.useBloodSurge)
  const hungerBefore = options.rouseChecks?.[0]?.hungerBefore
    ?? deps.getCharacterHunger(character)
  const willpowerBefore = deps.getCharacterWillpower(character)
  let currentHunger = hungerBefore
  const rouseChecks = [...(options.rouseChecks || [])]
  if (rouseChecks.length) {
    currentHunger = rouseChecks[rouseChecks.length - 1]?.hungerAfter ?? currentHunger
  }

  const bloodPotency = deps.getCharacterBloodPotency(character)
  const bloodSurgeBonus = useBloodSurge ? getBloodSurgeBonus(bloodPotency) : 0
  if (useBloodSurge) {
    const result = await deps.performRouseCheck(character, 'Прилив Крови', currentHunger)
    rouseChecks.push(result)
    currentHunger = result.hungerAfter
  }

  const rollSource = useBloodSurge
    ? 'blood_surge'
    : options.source === 'blood_surge'
      ? 'manual'
      : options.source || 'manual'

  const rollEffectResult = deps.applyDisciplineEffectsToRoll({
    characterData: character,
    rulesJson: deps.disciplineRules,
    baseDiceCount: Math.floor(Number(diceCount) || 0),
    poolType,
    kind: options.rollKind || 'roll',
    action: options.rollAction || poolType,
    source: rollSource,
    traits: options.rollTraits || [],
    penalties: options.rollPenalties || [],
    disabledModifierIds: options.disabledRollModifierIds,
  }, character.derivedStats)

  const activeRollModifiers = rollEffectResult.modifiers.filter(modifier => (
    modifier.active
    && (
      modifier.diceDelta !== 0
      || modifier.difficultyDelta !== 0
      || modifier.operation === 'ignore_penalty'
      || modifier.operation === 'auto_success'
    )
  ))

  const willpowerPenaltyApplied = getActivePenaltyDelta(rollEffectResult, 'willpower_impairment')
  const healthPenaltyApplied = getActivePenaltyDelta(rollEffectResult, 'health_impairment')
  const finalDiceCount = Math.max(1, Math.min(20, rollEffectResult.finalDiceCount + bloodSurgeBonus))
  const hungerDice = options.skipHungerDice ? 0 : Math.min(currentHunger, finalDiceCount)
  const dice = deps.rollsDice.rollD10Pool(finalDiceCount, hungerDice) as Die[]
  const successes = deps.rollsDice.countD10Successes(dice)
  const outcomeMeta = deps.rollsDice.getRollOutcomeMeta(dice, successes)
  const willpowerAfter = deps.getCharacterWillpower(character)
  const warnings = [
    ...(options.warnings || []),
    ...getActiveRollModifierWarnings(rollEffectResult),
    ...rouseChecks.map(getRouseWarning).filter(Boolean),
  ]

  const meta: RollMeta = {
    characterId: character.id,
    rollMode: 'normal',
    source: rollSource,
    hungerBefore,
    hungerAfter: currentHunger,
    hungerDice,
    bloodPotency,
    willpowerBefore: options.willpowerBefore || deps.getWillpowerMetaState(willpowerBefore),
    willpowerAfter: options.willpowerAfter || deps.getWillpowerMetaState(willpowerAfter),
    spentWillpower: options.spentWillpower,
    recoveredWillpower: options.recoveredWillpower,
    willpowerImpaired: willpowerAfter.impaired,
    impairmentPenaltyApplied: (options.impairmentPenaltyApplied ?? willpowerPenaltyApplied) || undefined,
    healthImpaired: deps.getCharacterHealth(character).impaired,
    healthImpairmentPenaltyApplied: (options.healthImpairmentPenaltyApplied ?? healthPenaltyApplied) || undefined,
    physicalState: deps.getCharacterHealth(character).physicalState,
    rollModifiers: activeRollModifiers.length ? activeRollModifiers : undefined,
    rollDifficultyModifier: rollEffectResult.difficultyDelta || undefined,
    rouseChecks,
    bloodSurge: useBloodSurge ? {
      enabled: true,
      bonusDice: bloodSurgeBonus,
    } : undefined,
    discipline: options.disciplineContext,
    warnings,
    ...outcomeMeta,
  }

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    room: deps.room,
    characterName: character.name,
    poolName,
    poolType,
    diceCount: dice.length,
    dice,
    successes,
    createdAt: new Date().toISOString(),
    hidden: options.hidden && deps.isMaster ? true : undefined,
    meta,
  }
}