import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { getEsp32ServiceClient } from './supabase'

function hmacSecret() {
  const secret = process.env.ESP32_API_HMAC_SECRET
  if (!secret || secret.length < 32) throw new Error('ESP32_API_HMAC_SECRET must contain at least 32 characters.')
  return secret
}

export function hashEsp32Secret(purpose: string, value: string) {
  return createHmac('sha256', hmacSecret()).update(`${purpose}\0${value}`).digest('hex')
}

export function constantTimeHexEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
}

export function requestIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

export type AuthenticatedEsp32 = {
  id: string
  device_uid: string
  owner_auth_user_id: string | null
  revoked_at: string | null
  hardware: Record<string, unknown>
}

export async function authenticateEsp32(request: NextRequest): Promise<AuthenticatedEsp32> {
  const deviceUid = request.headers.get('x-device-id')?.trim()
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!deviceUid || !token || token.length < 32) throw new Error('DEVICE_UNAUTHORIZED')

  const client = getEsp32ServiceClient()
  const { data, error } = await client
    .from('esp32_devices')
    .select('id, device_uid, token_hash, owner_auth_user_id, revoked_at, hardware')
    .eq('device_uid', deviceUid)
    .maybeSingle()
  if (error || !data || data.revoked_at) throw new Error('DEVICE_UNAUTHORIZED')
  const candidate = hashEsp32Secret('device-token', token)
  if (!constantTimeHexEqual(candidate, data.token_hash)) throw new Error('DEVICE_UNAUTHORIZED')
  return data
}

