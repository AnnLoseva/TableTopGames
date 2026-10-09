import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, toHttpError } from '@/features/esp32-oled/server/http'
import { hashEsp32Secret } from '@/features/esp32-oled/server/security'
import { getEsp32ServiceClient } from '@/features/esp32-oled/server/supabase'

function validDeviceUid(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9:_-]{8,80}$/.test(value)
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request)
    if (!validDeviceUid(body.deviceId) || typeof body.token !== 'string' || body.token.length < 32) {
      return jsonError('Некорректные данные устройства.', 422, 'INVALID_DEVICE')
    }
    const client = getEsp32ServiceClient()
    const tokenHash = hashEsp32Secret('device-token', body.token)
    const { data: existing, error: readError } = await client
      .from('esp32_devices')
      .select('id, token_hash, revoked_at')
      .eq('device_uid', body.deviceId)
      .maybeSingle()
    if (readError) throw readError
    if (existing && existing.token_hash !== tokenHash) return jsonError('Устройство не авторизовано.', 401, 'DEVICE_UNAUTHORIZED')
    if (existing?.revoked_at) return jsonError('Токен устройства отозван.', 401, 'DEVICE_REVOKED')

    const patch = {
      device_uid: body.deviceId,
      token_hash: tokenHash,
      firmware_version: typeof body.firmwareVersion === 'string' ? body.firmwareVersion.slice(0, 32) : null,
      hardware: body.hardware && typeof body.hardware === 'object' ? body.hardware : {},
      flash_size: Math.max(0, Number(body.flashSize || 0)),
      fs_total: Math.max(0, Number(body.fsTotal || 0)),
      fs_used: Math.max(0, Number(body.fsUsed || 0)),
      last_seen_at: new Date().toISOString(),
    }
    const query = existing
      ? client.from('esp32_devices').update(patch).eq('id', existing.id)
      : client.from('esp32_devices').insert(patch)
    const { data, error } = await query.select('id, owner_auth_user_id').single()
    if (error) throw error
    return NextResponse.json({ registered: true, deviceRecordId: data.id, paired: Boolean(data.owner_auth_user_id) })
  } catch (error) {
    return toHttpError(error)
  }
}

