import { createClient } from '@/games/vampires/lib/supabase'
import { BLOOD_BONDS, BLOOD_BOND_EVENTS, BONDS_LOCAL_KEY, BOND_EVENTS_LOCAL_KEY } from '../constants'
import { mapBloodBondEventRow, mapBloodBondRow, toBloodBondEventRow, toBloodBondRow } from '../mappers'
import type { BloodBond, BloodBondEvent, BloodBondEventRow, BloodBondRow } from '../types'

const BOND_SELECT = 'id, chronicle_id, room, thrall_actor_id, regnant_actor_id, level, drinks_count, first_drink_at, last_drink_at, expires_at, status, visibility, notes, created_at, updated_at'
const EVENT_SELECT = 'id, bond_id, chronicle_id, room, event_type, previous_level, new_level, occurred_at, session_id, note, created_by, created_at'

function readLocalBonds(room: string): BloodBond[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(BONDS_LOCAL_KEY(room))
    if (!raw) return []
    const parsed = JSON.parse(raw) as BloodBond[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalBonds(room: string, bonds: BloodBond[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(BONDS_LOCAL_KEY(room), JSON.stringify(bonds))
}

function readLocalEvents(room: string): BloodBondEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(BOND_EVENTS_LOCAL_KEY(room))
    if (!raw) return []
    const parsed = JSON.parse(raw) as BloodBondEvent[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalEvents(room: string, events: BloodBondEvent[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(BOND_EVENTS_LOCAL_KEY(room), JSON.stringify(events))
}

export async function fetchBloodBonds(room: string): Promise<{ bonds: BloodBond[]; source: 'remote' | 'local' }> {
  try {
    const { data, error } = await createClient()
      .from(BLOOD_BONDS)
      .select(BOND_SELECT)
      .eq('room', room)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return {
      bonds: (data || []).map(row => mapBloodBondRow(row as BloodBondRow)),
      source: 'remote',
    }
  } catch {
    return { bonds: readLocalBonds(room), source: 'local' }
  }
}

export async function fetchBondEvents(room: string, bondId?: string): Promise<BloodBondEvent[]> {
  try {
    let query = createClient()
      .from(BLOOD_BOND_EVENTS)
      .select(EVENT_SELECT)
      .eq('room', room)
      .order('occurred_at', { ascending: false })
      .limit(200)
    if (bondId) query = query.eq('bond_id', bondId)
    const { data, error } = await query
    if (error) throw error
    return (data || []).map(row => mapBloodBondEventRow(row as BloodBondEventRow))
  } catch {
    const all = readLocalEvents(room)
    return bondId ? all.filter(event => event.bondId === bondId) : all
  }
}

export async function upsertBloodBond(bond: BloodBond): Promise<'remote' | 'local'> {
  try {
    const { error } = await createClient()
      .from(BLOOD_BONDS)
      .upsert(toBloodBondRow({ ...bond, updatedAt: new Date().toISOString() }), { onConflict: 'id' })
    if (error) throw error
    return 'remote'
  } catch {
    const all = readLocalBonds(bond.room)
    // Normalize duplicate active pair locally
    const filtered = all.filter(item => {
      if (item.id === bond.id) return false
      if (
        bond.status === 'active'
        && item.status === 'active'
        && item.thrallActorId === bond.thrallActorId
        && item.regnantActorId === bond.regnantActorId
      ) {
        return false
      }
      return true
    })
    writeLocalBonds(bond.room, [{ ...bond, updatedAt: new Date().toISOString() }, ...filtered])
    return 'local'
  }
}

export async function insertBondEvent(event: BloodBondEvent): Promise<'remote' | 'local'> {
  try {
    const { error } = await createClient()
      .from(BLOOD_BOND_EVENTS)
      .insert(toBloodBondEventRow(event))
    if (error) throw error
    return 'remote'
  } catch {
    const all = readLocalEvents(event.room)
    writeLocalEvents(event.room, [event, ...all].slice(0, 500))
    return 'local'
  }
}

/** Find active bond for thrall→regnant pair (for duplicate normalization). */
export async function findActiveBondPair(
  room: string,
  thrallActorId: string,
  regnantActorId: string,
): Promise<BloodBond | null> {
  const { bonds } = await fetchBloodBonds(room)
  return bonds.find(bond => (
    bond.status === 'active'
    && bond.thrallActorId === thrallActorId
    && bond.regnantActorId === regnantActorId
  )) || null
}
