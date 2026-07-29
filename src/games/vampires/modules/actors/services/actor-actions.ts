import { appendMasterActionLog } from '@/games/vampires/modules/master-console/api'
import {
  bulkUpdateActors,
  cloneActor,
  createCompactActor,
  updateActorMeta,
} from '../api'
import { getActorTemplate } from '../utils/actor-templates'
import { normalizeActor } from './actor-service'
import type {
  ActorBulkAction,
  ActorPrivateFields,
  ActorTemplateId,
  MasterActor,
} from '../types'

export type ActorActionLogContext = {
  chronicleId: string
  room: string
  sessionId?: string | null
}

function emptyPrivate(): ActorPrivateFields {
  return { secrets: '', motivation: '', plans: '', notes: '', privateData: {} }
}

function overrideStats(actor: MasterActor): Record<string, unknown> {
  const stats = actor.manualOverrides.stats
  return typeof stats === 'object' && stats && !Array.isArray(stats)
    ? { ...stats as Record<string, unknown> }
    : {}
}

export function readActorHunger(actor: MasterActor): number {
  const normalized = normalizeActor(actor)
  return normalized.vitals.hunger
}

/**
 * Master-side hunger change.
 * Compact actors write compact_stats; linked sheets use manual_overrides.stats
 * so player character ownership is not rewritten from the master client.
 */
export async function setActorHunger(actor: MasterActor, hunger: number): Promise<void> {
  const next = Math.max(0, Math.min(5, Math.round(hunger)))
  if (!actor.characterId) {
    await updateActorMeta(actor.id, {
      compactStats: { ...actor.compactStats, hunger: next },
    })
    return
  }
  await updateActorMeta(actor.id, {
    manualOverrides: {
      ...actor.manualOverrides,
      stats: { ...overrideStats(actor), hunger: next },
    },
  })
}

export async function createActorFromTemplate(input: {
  chronicleId: string
  room: string
  templateId: ActorTemplateId
  name?: string
}): Promise<ReturnType<typeof createCompactActor>> {
  const template = getActorTemplate(input.templateId)
  if (!template) throw new Error(`Unknown actor template: ${input.templateId}`)

  const privatePartial = template.privateFields || {}
  return createCompactActor({
    chronicleId: input.chronicleId,
    room: input.room,
    kind: template.kind,
    name: (input.name || template.label).trim() || template.label,
    faction: template.faction,
    actorRole: template.actorRole,
    status: template.status,
    tags: [...template.tags],
    currentSceneId: null,
    compactStats: { ...template.compactStats },
    imageUrl: '',
    manualOverrides: {},
    privateFields: {
      ...emptyPrivate(),
      ...privatePartial,
      privateData: { ...(privatePartial.privateData || {}) },
    },
  })
}

export function isDangerousBulkAction(action: ActorBulkAction): boolean {
  return action.type === 'archive'
    || action.type === 'clone'
    || action.type === 'increment_hunger'
    || action.type === 'set_status'
    || action.type === 'add_to_scene'
    || action.type === 'remove_from_scene'
}

export function describeBulkAction(action: ActorBulkAction, count: number): string {
  const n = `${count} акт.`
  switch (action.type) {
    case 'add_to_scene':
      return `Добавить ${n} в сцену`
    case 'remove_from_scene':
      return `Убрать ${n} из сцены`
    case 'increment_hunger':
      return `${action.delta > 0 ? '+' : ''}${action.delta} Голод для ${n}`
    case 'set_faction':
      return `Фракция «${action.faction}» для ${n}`
    case 'set_status':
      return `Статус «${action.status}» для ${n}`
    case 'add_tag':
      return `Тег «${action.tag}» для ${n}`
    case 'clone':
      return `Клонировать ${n}`
    case 'archive':
      return `Архивировать ${n}`
    default:
      return `Действие для ${n}`
  }
}

export async function executeBulkActorAction(
  actors: readonly MasterActor[],
  action: ActorBulkAction,
  logContext: ActorActionLogContext,
): Promise<{ affected: number }> {
  if (actors.length === 0) return { affected: 0 }
  const ids = actors.map(actor => actor.id)
  const room = logContext.room

  switch (action.type) {
    case 'add_to_scene': {
      await bulkUpdateActors(room, ids, { currentSceneId: action.sceneId })
      break
    }
    case 'remove_from_scene': {
      await bulkUpdateActors(room, ids, { currentSceneId: null })
      break
    }
    case 'set_faction': {
      await bulkUpdateActors(room, ids, { faction: action.faction })
      break
    }
    case 'set_status': {
      await bulkUpdateActors(room, ids, { status: action.status })
      break
    }
    case 'add_tag': {
      for (const actor of actors) {
        if (actor.tags.includes(action.tag)) continue
        const tags = [...actor.tags, action.tag].slice(0, 32)
        await updateActorMeta(actor.id, { tags })
      }
      break
    }
    case 'archive': {
      await bulkUpdateActors(room, ids, { status: 'archived' })
      break
    }
    case 'increment_hunger': {
      for (const actor of actors) {
        await setActorHunger(actor, readActorHunger(actor) + action.delta)
      }
      break
    }
    case 'clone': {
      for (const actor of actors) {
        await cloneActor(actor)
      }
      break
    }
    default: {
      const _exhaustive: never = action
      throw new Error(`Unsupported bulk action: ${JSON.stringify(_exhaustive)}`)
    }
  }

  try {
    await appendMasterActionLog({
      chronicleId: logContext.chronicleId,
      room: logContext.room,
      sessionId: logContext.sessionId ?? null,
      actionType: `actors.bulk.${action.type}`,
      actorType: 'master',
      actorId: 'self',
      summary: describeBulkAction(action, actors.length),
      payload: {
        action,
        actorIds: ids,
        names: actors.map(actor => actor.name),
      },
      inversePayload: null,
      visibility: 'master',
    })
  } catch (logError) {
    // Action already applied; logging may fail before Auth/schema deploy.
    console.warn('master action log append failed', logError)
  }

  return { affected: actors.length }
}

export async function executeSingleActorAction(
  actor: MasterActor,
  action: ActorBulkAction,
  logContext: ActorActionLogContext,
): Promise<void> {
  await executeBulkActorAction([actor], action, logContext)
}
