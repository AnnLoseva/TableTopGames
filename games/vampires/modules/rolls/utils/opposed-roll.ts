import type { OpposedRollResult, OpposedRollSide } from '@/games/vampires/modules/table/types'
import type { BuildOpposedAnswerRollInput, BuildOpposedAnswerRollResult } from '../types'

export function buildOpposedRollResult(
  left: OpposedRollSide,
  right: OpposedRollSide,
  t: (ru: string) => string,
  tf: (ru: string, vars: Record<string, string | number>) => string,
): OpposedRollResult {
  const winnerSideId: OpposedRollSide['id'] | null = left.successes === right.successes
    ? null
    : left.successes > right.successes
      ? 'left'
      : 'right'
  const outcome: OpposedRollResult['outcome'] = winnerSideId ?? 'tie'
  const summary = winnerSideId === 'left'
    ? tf('Победа: {name}', { name: left.actorName })
    : winnerSideId === 'right'
      ? tf('Победа: {name}', { name: right.actorName })
      : t('Ничья')

  return { sides: [left, right], winnerSideId, outcome, summary }
}

export function buildAnsweredOpposedRoll(
  input: BuildOpposedAnswerRollInput,
): BuildOpposedAnswerRollResult {
  const opposed = buildOpposedRollResult(input.leftSide, input.rightSide, input.t, input.tf)
  const winnerSideId = opposed.winnerSideId

  const roll = {
    id: input.proposalId,
    room: input.room,
    characterName: input.t('Встречная проверка'),
    poolName: input.tf('{left} против {right}', {
      left: input.leftSide.actorName,
      right: input.rightSide.actorName,
    }),
    poolType: 'opposed',
    diceCount: input.leftSide.diceCount + input.rightSide.diceCount,
    dice: [],
    successes: Math.max(input.leftSide.successes, input.rightSide.successes),
    createdAt: new Date().toISOString(),
    opposed,
    meta: {
      rollMode: 'contested' as const,
      contested: {
        requestId: input.proposalId,
        initiatorCharacterName: input.leftSide.actorName,
        initiatorPoolName: input.leftSide.poolName,
        initiatorDiceCount: input.leftSide.diceCount,
        opponentUserId: input.opponentUserId,
        opponentCharacterId: input.opponentCharacterId,
        opponentName: input.rightSide.actorName,
        status: 'resolved' as const,
        initiatorSuccesses: input.leftSide.successes,
        opponentSuccesses: input.rightSide.successes,
        margin: Math.abs(input.leftSide.successes - input.rightSide.successes),
        winner: winnerSideId === 'left'
          ? 'initiator' as const
          : winnerSideId === 'right'
            ? 'opponent' as const
            : 'tie' as const,
      },
      rollModifiers: input.responseRollModifiers?.length ? input.responseRollModifiers : undefined,
      rollDifficultyModifier: input.rollDifficultyModifier || undefined,
      warnings: input.warnings,
    },
  }

  return { roll, opposed }
}