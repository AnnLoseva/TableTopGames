import { NextRequest, NextResponse } from 'next/server'
import { jsonError, toHttpError } from '@/features/esp32-oled/server/http'
import { mapCommand } from '@/features/esp32-oled/server/mappers'
import { getEsp32ServiceClient, requireEsp32User } from '@/features/esp32-oled/server/supabase'

type Context = { params: Promise<{ commandId: string }> }

export async function GET(_request: NextRequest, context: Context) {
  try {
    const user = await requireEsp32User()
    const { commandId } = await context.params
    const { data, error } = await getEsp32ServiceClient()
      .from('esp32_device_commands')
      .select('*')
      .eq('id', commandId)
      .eq('owner_auth_user_id', user.id)
      .maybeSingle()
    if (error) throw error
    if (!data) return jsonError('Команда не найдена.', 404)
    return NextResponse.json({ command: mapCommand(data) })
  } catch (error) {
    return toHttpError(error)
  }
}

