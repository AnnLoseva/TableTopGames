import type { BloodBond, BloodBondEvent, BloodBondEventRow, BloodBondRow } from './types'

export function mapBloodBondRow(row: BloodBondRow): BloodBond {
  return {
    id: row.id,
    chronicleId: row.chronicle_id,
    room: row.room,
    thrallActorId: row.thrall_actor_id,
    regnantActorId: row.regnant_actor_id,
    level: row.level,
    drinksCount: row.drinks_count,
    firstDrinkAt: row.first_drink_at,
    lastDrinkAt: row.last_drink_at,
    expiresAt: row.expires_at,
    status: row.status,
    visibility: row.visibility,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toBloodBondRow(bond: BloodBond): BloodBondRow {
  return {
    id: bond.id,
    chronicle_id: bond.chronicleId,
    room: bond.room,
    thrall_actor_id: bond.thrallActorId,
    regnant_actor_id: bond.regnantActorId,
    level: bond.level,
    drinks_count: bond.drinksCount,
    first_drink_at: bond.firstDrinkAt,
    last_drink_at: bond.lastDrinkAt,
    expires_at: bond.expiresAt,
    status: bond.status,
    visibility: bond.visibility,
    notes: bond.notes,
    created_at: bond.createdAt,
    updated_at: bond.updatedAt,
  }
}

export function mapBloodBondEventRow(row: BloodBondEventRow): BloodBondEvent {
  return {
    id: row.id,
    bondId: row.bond_id,
    chronicleId: row.chronicle_id,
    room: row.room,
    eventType: row.event_type,
    previousLevel: row.previous_level,
    newLevel: row.new_level,
    occurredAt: row.occurred_at,
    sessionId: row.session_id,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export function toBloodBondEventRow(event: BloodBondEvent): BloodBondEventRow {
  return {
    id: event.id,
    bond_id: event.bondId,
    chronicle_id: event.chronicleId,
    room: event.room,
    event_type: event.eventType,
    previous_level: event.previousLevel,
    new_level: event.newLevel,
    occurred_at: event.occurredAt,
    session_id: event.sessionId,
    note: event.note,
    created_by: event.createdBy,
    created_at: event.createdAt,
  }
}
