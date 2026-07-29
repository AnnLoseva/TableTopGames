import { createVtm5BloodBondAdapter } from '@/games/vampires/core/vtm5/adapters/blood-bonds'
import { appendMasterActionLog } from '@/games/vampires/modules/master-console/api'
import {
  fetchBondEvents,
  findActiveBondPair,
  insertBondEvent,
  upsertBloodBond,
} from '../api'
import type { BloodBond, BloodBondEvent, BloodBondEventType } from '../types'

const adapter = createVtm5BloodBondAdapter()

export function getBondAdapter() {
  return adapter
}

async function logBondAction(input: {
  chronicleId: string
  room: string
  bondId: string
  actionType: string
  summary: string
  payload?: Record<string, unknown>
}) {
  try {
    await appendMasterActionLog({
      chronicleId: input.chronicleId,
      room: input.room,
      sessionId: null,
      actionType: input.actionType,
      actorType: 'master',
      actorId: 'self',
      summary: input.summary,
      payload: { bondId: input.bondId, ...(input.payload || {}) },
      inversePayload: null,
      visibility: 'master',
    })
  } catch (error) {
    console.warn('bond action log failed', error)
  }
}

async function appendEvent(input: {
  bond: BloodBond
  eventType: BloodBondEventType
  previousLevel: number | null
  newLevel: number | null
  note?: string
}): Promise<BloodBondEvent> {
  const event: BloodBondEvent = {
    id: crypto.randomUUID(),
    bondId: input.bond.id,
    chronicleId: input.bond.chronicleId,
    room: input.bond.room,
    eventType: input.eventType,
    previousLevel: input.previousLevel,
    newLevel: input.newLevel,
    occurredAt: new Date().toISOString(),
    sessionId: null,
    note: input.note || '',
    createdBy: 'local',
    createdAt: new Date().toISOString(),
  }
  await insertBondEvent(event)
  return event
}

/**
 * Create or normalize into the single active thrall→regnant bond.
 */
export async function createOrGetActiveBond(input: {
  chronicleId: string
  room: string
  thrallActorId: string
  regnantActorId: string
  level?: number
  notes?: string
}): Promise<BloodBond> {
  const pairError = adapter.validatePair(input.thrallActorId, input.regnantActorId)
  if (pairError) throw new Error(pairError)

  const existing = await findActiveBondPair(input.room, input.thrallActorId, input.regnantActorId)
  if (existing) return existing

  const now = new Date().toISOString()
  const level = adapter.clampLevel(input.level ?? 1)
  const bond: BloodBond = {
    id: crypto.randomUUID(),
    chronicleId: input.chronicleId,
    room: input.room,
    thrallActorId: input.thrallActorId,
    regnantActorId: input.regnantActorId,
    level,
    drinksCount: 0,
    firstDrinkAt: now,
    lastDrinkAt: now,
    expiresAt: null,
    status: 'active',
    visibility: 'master',
    notes: input.notes || '',
    createdAt: now,
    updatedAt: now,
  }
  await upsertBloodBond(bond)
  await appendEvent({
    bond,
    eventType: 'created',
    previousLevel: null,
    newLevel: level,
    note: 'Узы созданы',
  })
  await logBondAction({
    chronicleId: input.chronicleId,
    room: input.room,
    bondId: bond.id,
    actionType: 'blood_bonds.created',
    summary: `Узы thrall→regnant lvl ${level}`,
    payload: {
      thrallActorId: bond.thrallActorId,
      regnantActorId: bond.regnantActorId,
      level,
    },
  })
  return bond
}

export async function registerDrink(bond: BloodBond): Promise<BloodBond> {
  if (bond.status !== 'active') throw new Error('Питьё учитывается только для active уз')
  const prev = bond.level
  const applied = adapter.applyDrink({ level: bond.level, drinksCount: bond.drinksCount })
  const now = new Date().toISOString()
  const next: BloodBond = {
    ...bond,
    level: applied.level,
    drinksCount: applied.drinksCount,
    lastDrinkAt: now,
    firstDrinkAt: bond.firstDrinkAt || now,
    updatedAt: now,
  }
  await upsertBloodBond(next)
  await appendEvent({
    bond: next,
    eventType: 'drink',
    previousLevel: prev,
    newLevel: next.level,
    note: 'Глоток крови регнанта',
  })
  if (applied.levelIncreased) {
    await appendEvent({
      bond: next,
      eventType: 'level_up',
      previousLevel: prev,
      newLevel: next.level,
      note: `Уровень ${prev} → ${next.level}`,
    })
  }
  await logBondAction({
    chronicleId: bond.chronicleId,
    room: bond.room,
    bondId: bond.id,
    actionType: applied.levelIncreased ? 'blood_bonds.level_up' : 'blood_bonds.drink',
    summary: applied.levelIncreased
      ? `Узы +уровень → ${next.level}`
      : `Узы: глоток (всего ${next.drinksCount})`,
    payload: { previousLevel: prev, newLevel: next.level, drinksCount: next.drinksCount },
  })
  return next
}

export async function setBondLevel(bond: BloodBond, level: number, note = ''): Promise<BloodBond> {
  const prev = bond.level
  const nextLevel = adapter.clampLevel(level)
  if (nextLevel === prev) return bond
  const next: BloodBond = {
    ...bond,
    level: nextLevel,
    updatedAt: new Date().toISOString(),
  }
  await upsertBloodBond(next)
  await appendEvent({
    bond: next,
    eventType: nextLevel > prev ? 'level_up' : 'level_down',
    previousLevel: prev,
    newLevel: nextLevel,
    note: note || `Уровень ${prev} → ${nextLevel}`,
  })
  await logBondAction({
    chronicleId: bond.chronicleId,
    room: bond.room,
    bondId: bond.id,
    actionType: nextLevel > prev ? 'blood_bonds.level_up' : 'blood_bonds.level_down',
    summary: `Узы уровень ${prev} → ${nextLevel}`,
    payload: { previousLevel: prev, newLevel: nextLevel },
  })
  return next
}

/** Break bond without deleting history — status=broken + event. */
export async function breakBond(bond: BloodBond, note = ''): Promise<BloodBond> {
  if (bond.status === 'broken') return bond
  const prev = bond.level
  const next: BloodBond = {
    ...bond,
    status: 'broken',
    updatedAt: new Date().toISOString(),
  }
  await upsertBloodBond(next)
  await appendEvent({
    bond: next,
    eventType: 'break',
    previousLevel: prev,
    newLevel: prev,
    note: note || 'Узы разорваны (история сохранена)',
  })
  await logBondAction({
    chronicleId: bond.chronicleId,
    room: bond.room,
    bondId: bond.id,
    actionType: 'blood_bonds.break',
    summary: 'Узы разорваны',
    payload: { previousLevel: prev },
  })
  return next
}

export async function setBondStatus(
  bond: BloodBond,
  status: BloodBond['status'],
  note = '',
): Promise<BloodBond> {
  if (status === 'broken') return breakBond(bond, note)
  const next: BloodBond = {
    ...bond,
    status,
    updatedAt: new Date().toISOString(),
  }
  await upsertBloodBond(next)
  await appendEvent({
    bond: next,
    eventType: status === 'active' ? 'reactivate' : 'deactivate',
    previousLevel: bond.level,
    newLevel: bond.level,
    note: note || `Статус → ${status}`,
  })
  await logBondAction({
    chronicleId: bond.chronicleId,
    room: bond.room,
    bondId: bond.id,
    actionType: `blood_bonds.${status}`,
    summary: `Узы: ${status}`,
  })
  return next
}

export async function updateBondNotes(bond: BloodBond, notes: string): Promise<BloodBond> {
  const next = { ...bond, notes, updatedAt: new Date().toISOString() }
  await upsertBloodBond(next)
  await appendEvent({
    bond: next,
    eventType: 'note',
    previousLevel: bond.level,
    newLevel: bond.level,
    note: 'Заметки обновлены',
  })
  return next
}

export { fetchBondEvents }
