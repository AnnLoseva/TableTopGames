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
  if (error) throw error
  if (!data) throw new Error('DEVICE_NOT_FOUND')
  return { row: data, device: mapDevice(data) }
}

export async function queueCommand(
  userId: string,
  deviceId: string,
  type: Esp32CommandType,
  payload: Record<string, unknown>,
) {
  await findOwnedDevice(userId, deviceId)
  const client = getEsp32ServiceClient()
  const { data, error } = await client
    .from('esp32_device_commands')
    .insert({
      device_id: deviceId,
      owner_auth_user_id: userId,
      command_type: type,
      payload,
      idempotency_key: randomUUID(),
    })
    .select('*')
    .single()
  if (error) throw error
  return mapCommand(data)
}

