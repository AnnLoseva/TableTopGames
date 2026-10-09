import { NextResponse } from 'next/server'
import { jsonError, toHttpError } from '@/features/esp32-oled/server/http'
import { getEsp32ServiceClient, requireEsp32User } from '@/features/esp32-oled/server/supabase'

export async function GET() {
  try {
    await requireEsp32User()
    const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    const hmacConfigured = Boolean(process.env.ESP32_API_HMAC_SECRET && process.env.ESP32_API_HMAC_SECRET.length >= 32)
    if (!serviceRoleConfigured || !hmacConfigured) {
      console.error('ESP32 server configuration error:', { serviceRoleConfigured, hmacConfigured })
      return jsonError('Device service configuration is incomplete. The administrator must check SUPABASE_SERVICE_ROLE_KEY and ESP32_API_HMAC_SECRET.', 503, 'SERVER_CONFIGURATION')
    }
    const { error } = await getEsp32ServiceClient().from('esp32_devices').select('id', { head: true, count: 'exact' })
    if (error) throw error
    return NextResponse.json({ ready: true })
  } catch (error) { return toHttpError(error) }
}
