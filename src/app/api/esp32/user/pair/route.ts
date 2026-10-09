import { NextRequest, NextResponse } from 'next/server'
import { cleanName, isFourDigitPin } from '@/features/esp32-oled/lib/validation'
import { jsonError, readJson, toHttpError } from '@/features/esp32-oled/server/http'
import { mapDevice } from '@/features/esp32-oled/server/mappers'
import { hashEsp32Secret, requestIp } from '@/features/esp32-oled/server/security'
import { getEsp32ServiceClient, requireEsp32User } from '@/features/esp32-oled/server/supabase'

export async function POST(request: NextRequest) {
  try {
    const user = await requireEsp32User()
    const body = await readJson(request)
    if (!isFourDigitPin(body.pin)) return jsonError('Enter the four-digit PIN.', 422, 'INVALID_PIN')
    const client = getEsp32ServiceClient()
    const { data: deviceId, error } = await client.rpc('esp32_claim_device', {
      p_pin_hash: hashEsp32Secret('pairing-pin', body.pin),
      p_owner: user.id,
      p_rate_key_hash: hashEsp32Secret('pairing-rate', `${user.id}:${requestIp(request)}`),
      p_name: cleanName(body.name),
    })
    if (error) {
      if (error.message.includes('RATE_LIMITED')) return jsonError('Too many attempts. Wait 15 minutes.', 429, 'RATE_LIMITED')
      if (error.message.includes('PAIRING_AMBIGUOUS')) return jsonError('Several devices showed this PIN. Generate a new PIN on just one device.', 409, 'PAIRING_AMBIGUOUS')
      if (error.message.includes('PAIRING_NOT_FOUND')) return jsonError('The PIN expired, the device is offline, or the code is incorrect.', 404, 'PAIRING_NOT_FOUND')
      throw error
    }
    const { data, error: readError } = await client.from('esp32_devices').select('*').eq('id', deviceId).single()
    if (readError) throw readError
    return NextResponse.json({ device: mapDevice(data) }, { status: 201 })
  } catch (error) {
    return toHttpError(error)
  }
}

