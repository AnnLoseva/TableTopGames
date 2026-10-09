import { NextResponse } from 'next/server'
import { toHttpError } from '@/features/esp32-oled/server/http'
import { mapDevice } from '@/features/esp32-oled/server/mappers'
import { getEsp32ServiceClient, requireEsp32User } from '@/features/esp32-oled/server/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireEsp32User()
    const { data, error } = await getEsp32ServiceClient()
      .from('esp32_devices')
      .select('*')
      .eq('owner_auth_user_id', user.id)
      .is('revoked_at', null)
      .order('created_at')
    if (error) throw error
    return NextResponse.json({ devices: (data || []).map(mapDevice) })
  } catch (error) {
    return toHttpError(error)
  }
}

