import { NextRequest, NextResponse } from 'next/server'
import { ESP32_PAIRING_TTL_SECONDS } from '@/features/esp32-oled/constants'
import { isFourDigitPin } from '@/features/esp32-oled/lib/validation'
import { jsonError, readJson, toHttpError } from '@/features/esp32-oled/server/http'
import { authenticateEsp32, hashEsp32Secret } from '@/features/esp32-oled/server/security'
import { getEsp32ServiceClient } from '@/features/esp32-oled/server/supabase'

export async function POST(request: NextRequest) {
  try {
    const device = await authenticateEsp32(request)
    const body = await readJson(request)
    if (!isFourDigitPin(body.pin)) return jsonError('The PIN must contain four digits.', 422, 'INVALID_PIN')
    const client = getEsp32ServiceClient()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ESP32_PAIRING_TTL_SECONDS * 1000)
    await client.from('esp32_pairing_challenges').update({ consumed_at: now.toISOString() }).eq('device_id', device.id).is('consumed_at', null)
    const { error } = await client.from('esp32_pairing_challenges').insert({
      device_id: device.id,
      pin_hash: hashEsp32Secret('pairing-pin', body.pin),
      expires_at: expiresAt.toISOString(),
    })
    if (error) throw error
    await client.from('esp32_devices').update({ last_seen_at: now.toISOString() }).eq('id', device.id)
    return NextResponse.json({ expiresAt: expiresAt.toISOString() }, { status: 201 })
  } catch (error) {
    return toHttpError(error)
  }
}

