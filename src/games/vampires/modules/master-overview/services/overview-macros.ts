import { appendMasterActionLog } from '@/games/vampires/modules/master-console/api'
import { readActorHunger, setActorHunger } from '@/games/vampires/modules/actors/services/actor-actions'
import type { MasterActor } from '@/games/vampires/modules/actors/types'
import { rollMasterFrenzy, rollMasterPool, rollMasterRouse } from '@/games/vampires/modules/master-rolls/services'
import type { MasterRollBuilderState } from '@/games/vampires/modules/master-rolls/types'
import type { OverviewMacro, OverviewMacroId } from '../types'
import { pickRandomComplication } from '../utils/random-complications'
import { selectCoterieActors } from '../selectors'

export const OVERVIEW_MACROS: readonly OverviewMacro[] = [
  { id: 'rouse_selected', title: 'Пробуждение крови', shortcut: '1', dangerous: false },
  { id: 'frenzy_selected', title: 'Проверка френзи', shortcut: '2', dangerous: false },
  { id: 'coterie_hunger_plus', title: '+1 Голод котерии', shortcut: '3', dangerous: true },
  { id: 'random_complication', title: 'Случайное осложнение', shortcut: '4', dangerous: false },
  { id: 'blood_surge', title: 'Прилив крови', shortcut: '5', dangerous: false },
  { id: 'downtime', title: 'Даунтайм', shortcut: '6', dangerous: true },
]

async function logMacro(input: {
  chronicleId: string
  room: string
  macroId: OverviewMacroId
  summary: string
  payload?: Record<string, unknown>
}) {
  try {
    await appendMasterActionLog({
      chronicleId: input.chronicleId,
      room: input.room,
      sessionId: null,
      actionType: `overview.macro.${input.macroId}`,
      actorType: 'master',
      actorId: 'self',
      summary: input.summary,
      payload: input.payload || {},
      inversePayload: null,
      visibility: 'master',
    })
  } catch (error) {
    console.warn('macro action log failed', error)
  }
}

export async function runOverviewMacro(input: {
  macroId: OverviewMacroId
  room: string
  chronicleId: string
  actors: readonly MasterActor[]
  selectedActorId: string | null
}): Promise<{ message: string }> {
  const selected = input.actors.find(actor => actor.id === input.selectedActorId) || null
  const coterie = selectCoterieActors(input.actors)

  switch (input.macroId) {
    case 'rouse_selected': {
      if (!selected) throw new Error('Выберите актёра для Rouse')
      await rollMasterRouse({
        room: input.room,
        chronicleId: input.chronicleId,
        actor: selected,
        hidden: true,
        reason: 'Макрос: Пробуждение крови',
      })
      await logMacro({
        chronicleId: input.chronicleId,
        room: input.room,
        macroId: input.macroId,
        summary: `Макрос Rouse: ${selected.name}`,
      })
      return { message: `Rouse для ${selected.name}` }
    }
    case 'frenzy_selected': {
      if (!selected) throw new Error('Выберите актёра для френзи')
      await rollMasterFrenzy({
        room: input.room,
        chronicleId: input.chronicleId,
        actor: selected,
        hidden: true,
        difficulty: 3,
      })
      await logMacro({
        chronicleId: input.chronicleId,
        room: input.room,
        macroId: input.macroId,
        summary: `Макрос френзи: ${selected.name}`,
      })
      return { message: `Френзи-бросок для ${selected.name}` }
    }
    case 'coterie_hunger_plus': {
      if (!coterie.length) throw new Error('В котерии нет PC')
      for (const actor of coterie) {
        await setActorHunger(actor, readActorHunger(actor) + 1)
      }
      await logMacro({
        chronicleId: input.chronicleId,
        room: input.room,
        macroId: input.macroId,
        summary: `+1 Голод котерии (${coterie.length})`,
        payload: { actorIds: coterie.map(actor => actor.id), consequence: 'Голод котерии вырос' },
      })
      return { message: `+1 Голод для ${coterie.length} PC` }
    }
    case 'blood_surge': {
      if (!selected) throw new Error('Выберите актёра для Прилива Крови')
      const state: MasterRollBuilderState = {
        actorId: selected.id,
        attribute: '',
        attributeTwo: '',
        skill: '',
        discipline: '',
        modifier: 0,
        difficulty: 0,
        mode: 'normal',
        opponentActorId: null,
        hidden: true,
        useBloodSurge: true,
      }
      // Minimal pool: blood surge alone still needs dice — use Resolve as base if empty.
      await rollMasterPool({
        room: input.room,
        chronicleId: input.chronicleId,
        actor: selected,
        state: { ...state, attribute: 'Упорство', modifier: 0 },
      })
      await logMacro({
        chronicleId: input.chronicleId,
        room: input.room,
        macroId: input.macroId,
        summary: `Макрос Прилив Крови: ${selected.name}`,
      })
      return { message: `Прилив Крови: ${selected.name}` }
    }
    case 'downtime': {
      if (!coterie.length) throw new Error('В котерии нет PC')
      for (const actor of coterie) {
        await setActorHunger(actor, readActorHunger(actor) + 1)
      }
      await logMacro({
        chronicleId: input.chronicleId,
        room: input.room,
        macroId: input.macroId,
        summary: `Даунтайм: Голод +1 у ${coterie.length} (не кормились)`,
        payload: {
          actorIds: coterie.map(actor => actor.id),
          consequence: 'Даунтайм рассчитан: Голод +1 у всех, кто не кормился',
        },
      })
      return { message: `Даунтайм: +1 Голод × ${coterie.length}` }
    }
    case 'random_complication': {
      const text = pickRandomComplication()
      await logMacro({
        chronicleId: input.chronicleId,
        room: input.room,
        macroId: input.macroId,
        summary: `Случайное осложнение: ${text}`,
        payload: { consequence: text, table: 'random_complications' },
      })
      return { message: text }
    }
    default: {
      const _exhaustive: never = input.macroId
      throw new Error(`Unknown macro ${_exhaustive}`)
    }
  }
}
