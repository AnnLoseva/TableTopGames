import 'server-only'
import { randomUUID } from 'node:crypto'
import { getEsp32ServiceClient } from './supabase'
import { mapCommand, mapDevice } from './mappers'
import type { Esp32CommandType } from '../constants'

export async function findOwnedDevice(userId: string, deviceId: string) {
  const client = getEsp32ServiceClient()
  const { data, error } = await client
    .from('esp32_devices')
    .select('*')
    .eq('id', deviceId)
    .eq('owner_auth_user_id', userId)
    .is('revoked_at', null)
    .maybeSingle()
  if (error) {
    if (error.message.includes('DEVICE_NOT_FOUND')) throw new Error('DEVICE_NOT_FOUND')
    throw error
  }
  if (!data) throw new Error('DEVICE_NOT_FOUND')
  return { row: data, device: mapDevice(data) }
}

export async function queueCommand(
  userId: string,
  deviceId: string,
  type: Esp32CommandType,
  payload: Record<string, unknown>,
) {
  const client = getEsp32ServiceClient()
  const { data, error } = await client.rpc('esp32_queue_owned_command', {
    p_owner: userId,
    p_device_id: deviceId,
    p_command_type: type,
    p_payload: payload,
    p_idempotency_key: randomUUID(),
  })
  if (error) {
    if (error.message.includes('DEVICE_NOT_FOUND')) throw new Error('DEVICE_NOT_FOUND')
    throw error
  }
  return mapCommand(data as Record<string, unknown>)
}

