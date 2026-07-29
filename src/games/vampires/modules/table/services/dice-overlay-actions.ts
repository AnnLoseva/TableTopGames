import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { DiceOverlayGroup, DiceOverlayRoll } from '@/games/vampires/modules/rolls/components/DiceRollOverlay'
import type { RollMessage } from '../types'
import { buildDiceOverlaySummary } from '../utils/dice-overlay'

export type DiceOverlayActionsDeps = {
  t: (ru: string) => string
  tf: (ru: string, vars: Record<string, string | number>) => string
  shownDiceOverlayIdsRef: MutableRefObject<Set<string>>
  setDiceOverlayQueue: Dispatch<SetStateAction<DiceOverlayRoll[]>>
}

export function createDiceOverlayActions(deps: DiceOverlayActionsDeps) {
  const queueDiceOverlayRoll = (overlayRoll: DiceOverlayRoll) => {
    deps.setDiceOverlayQueue(prev => [...prev, overlayRoll])
  }

  const triggerDiceOverlay = (roll: RollMessage) => {
    if (deps.shownDiceOverlayIdsRef.current.has(roll.id)) return
    if (roll.meta?.rollMode === 'contested' && roll.meta.contested?.status !== 'resolved' && !roll.opposed) return

    if (roll.opposed) {
      const totalDice = roll.opposed.sides.reduce((sum, side) => sum + side.dice.length, 0)
      if (totalDice === 0) return
      deps.shownDiceOverlayIdsRef.current.add(roll.id)
      const groups: DiceOverlayGroup[] = roll.opposed.sides.map(side => ({
        key: side.id,
        label: `${side.actorName} · ${deps.t(side.poolName)}`,
        dice: side.dice.map(die => ({ value: die.value, kind: die.kind })),
      }))
      queueDiceOverlayRoll({
        id: roll.id,
        title: deps.t(roll.poolName),
        groups,
        summary: roll.opposed.summary,
        summaryTone: roll.opposed.winnerSideId ? 'good' : 'neutral',
      })
      return
    }

    if (!roll.dice.length) return
    deps.shownDiceOverlayIdsRef.current.add(roll.id)
    const summary = buildDiceOverlaySummary(deps.t, deps.tf, roll.successes, roll.meta)
    queueDiceOverlayRoll({
      id: roll.id,
      title: `${roll.characterName} · ${deps.t(roll.poolName)}`,
      groups: [{ key: 'main', label: '', dice: roll.dice.map(die => ({ value: die.value, kind: die.kind })) }],
      summary: summary.text,
      summaryTone: summary.tone,
    })
  }

  return {
    queueDiceOverlayRoll,
    triggerDiceOverlay,
  }
}