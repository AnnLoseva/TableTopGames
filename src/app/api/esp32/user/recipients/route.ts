import { NextRequest, NextResponse } from 'next/server'
import { jsonError, toHttpError } from '@/features/esp32-oled/server/http'
import { getEsp32ServiceClient, requireEsp32User } from '@/features/esp32-oled/server/supabase'

export async function GET(request: NextRequest) {
  try {
    const user = await requireEsp32User()
    const username = request.nextUrl.searchParams.get('username')?.trim() || ''
    if (!/^[A-Za-z0-9_.-]{3,64}$/.test(username)) return jsonError('Enter a valid username.', 422, 'INVALID_RECIPIENT')
    const { data, error } = await getEsp32ServiceClient().from('users').select('username, auth_user_id').eq('username', username).maybeSingle()
    if (error) throw error
    if (!data?.auth_user_id) return jsonError('No active account with that username was found.', 404, 'GIFT_RECIPIENT_NOT_FOUND')
    if (data.auth_user_id === user.id) return jsonError('Choose someone other than yourself.', 422, 'GIFT_RECIPIENT_IS_SENDER')
    return NextResponse.json({ recipient: { username: data.username } })
  } catch (error) { return toHttpError(error) }
}
