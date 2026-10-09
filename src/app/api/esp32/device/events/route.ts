import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, toHttpError } from '@/features/esp32-oled/server/http'
import { authenticateEsp32 } from '@/features/esp32-oled/server/security'
import { getEsp32ServiceClient } from '@/features/esp32-oled/server/supabase'

export async function POST(request: NextRequest) {
  try {
    const device = await authenticateEsp32(request)
    const body = await readJson(request)
    if (typeof body.type !== 'string' || !/^[a-zA-Z0-9_.:-]{1,64}$/.test(body.type)) {
      return jsonError('Некорректный тип события.', 422)
    }
    const { error } = await getEsp32ServiceClient().from('esp32_device_events').insert({
      device_id: device.id,
      event_type: body.type,
      payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
    })
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return toHttpError(error)
  }
}

