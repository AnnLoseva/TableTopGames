import { createClient } from '@/games/vampires/lib/supabase'
import {
  CHRONICLE_ENTITY_LINKS,
  CHRONICLE_MEMBERS,
  CHRONICLES,
  CHRONICLE_SESSIONS,
  MASTER_ACTION_LOG,
  MASTER_LAYOUTS,
  MASTER_MACROS,
} from '../persistence/constants'
import {
  mapChronicleSessionRow,
  mapMasterActionLogRow,
  mapMasterLayoutRow,
  mapMasterMacroRow,
  toChronicleEntityLinkRow,
  toMasterLayoutRow,
} from '../persistence/mappers'
import type {
  ChronicleEntityLink,
  ChronicleSessionRow,
  ChronicleMembership,
  ChronicleSession,
  MasterActionLogEntry,
  MasterActionLogRow,
  MasterLayout,
  MasterLayoutRow,
  MasterMacro,
  MasterMacroRow,
} from '../persistence/types'
import { validateEntityLink } from '../persistence/validation'
import { resolveMasterConsoleAccess, type MasterConsoleAccess } from '../access'

type MasterConsoleClient = ReturnType<typeof createClient>

async function fetchMasterMembershipForUser(
  client: MasterConsoleClient,
  room: string,
  userId: string,
): Promise<ChronicleMembership | null> {
  const { data: chronicle, error: chronicleError } = await client
    .from(CHRONICLES)
    .select('id')
    .eq('room', room)
    .maybeSingle()
  if (chronicleError) throw chronicleError
  if (!chronicle) return null

  const { data, error } = await client
    .from(CHRONICLE_MEMBERS)
    .select('chronicle_id, user_id, role, created_at')
    .eq('chronicle_id', chronicle.id)
    .eq('user_id', userId)
    .eq('role', 'master')
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  return {
    chronicleId: data.chronicle_id,
    userId: data.user_id,
    role: data.role,
    createdAt: data.created_at,
  }
}

export async function getMasterMembership(room: string): Promise<ChronicleMembership | null> {
  const client = createClient()
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) return null

  return fetchMasterMembershipForUser(client, room, authData.user.id)
}

export async function getMasterConsoleAccess(room: string): Promise<MasterConsoleAccess> {
  const client = createClient()
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError?.name !== 'AuthSessionMissingError') {
    if (authError) throw authError
  }
  if (!authData.user) return resolveMasterConsoleAccess(null, null)

  const membership = await fetchMasterMembershipForUser(client, room, authData.user.id)
  return resolveMasterConsoleAccess(authData.user.id, membership)
}

export async function fetchMasterLayouts(room: string): Promise<MasterLayout[]> {
  const { data, error } = await createClient()
    .from(MASTER_LAYOUTS)
    .select('id, chronicle_id, room, owner_id, name, layout_version, layout_json, is_default, created_at, updated_at')
    .eq('room', room)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data || []).map(row => mapMasterLayoutRow(row as MasterLayoutRow))
}

export async function saveMasterLayout(layout: MasterLayout): Promise<void> {
  const { error } = await createClient()
    .from(MASTER_LAYOUTS)
    .upsert(toMasterLayoutRow(layout), { onConflict: 'id' })
  if (error) throw error
}

export async function deleteMasterLayout(layoutId: string): Promise<void> {
  const { error } = await createClient().from(MASTER_LAYOUTS).delete().eq('id', layoutId)
  if (error) throw error
}

export async function fetchMasterActionLog(room: string, limit = 100): Promise<MasterActionLogEntry[]> {
  const { data, error } = await createClient()
    .from(MASTER_ACTION_LOG)
    .select('id, chronicle_id, room, session_id, action_type, actor_type, actor_id, summary, payload, inverse_payload, visibility, created_by, reverted_at, created_at')
    .eq('room', room)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 250))
  if (error) throw error
  return (data || []).map(row => mapMasterActionLogRow(row as MasterActionLogRow))
}

export async function appendMasterActionLog(
  entry: Omit<MasterActionLogEntry, 'id' | 'createdBy' | 'revertedAt' | 'createdAt'>,
): Promise<void> {
  const { error } = await createClient().from(MASTER_ACTION_LOG).insert({
    chronicle_id: entry.chronicleId,
    room: entry.room,
    session_id: entry.sessionId,
    action_type: entry.actionType,
    actor_type: entry.actorType,
    actor_id: entry.actorId,
    summary: entry.summary,
    payload: entry.payload,
    inverse_payload: entry.inversePayload,
    visibility: entry.visibility,
  })
  if (error) throw error
}

export async function insertEntityLink(
  link: Omit<ChronicleEntityLink, 'id' | 'createdAt'>,
): Promise<void> {
  const validationError = validateEntityLink(link)
  if (validationError) throw new Error(validationError)

  const { error } = await createClient().from(CHRONICLE_ENTITY_LINKS).insert(toChronicleEntityLinkRow(link))
  if (error) throw error
}

export async function fetchChronicleSessions(room: string): Promise<ChronicleSession[]> {
  const { data, error } = await createClient()
    .from(CHRONICLE_SESSIONS)
    .select('*')
    .eq('room', room)
    .order('sequence_number', { ascending: false })
  if (error) throw error
  return (data || []).map(row => mapChronicleSessionRow(row as ChronicleSessionRow))
}

export async function fetchMasterMacros(room: string): Promise<MasterMacro[]> {
  const { data, error } = await createClient()
    .from(MASTER_MACROS)
    .select('*')
    .eq('room', room)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data || []).map(row => mapMasterMacroRow(row as MasterMacroRow))
}
