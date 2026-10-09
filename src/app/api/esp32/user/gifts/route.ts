import { NextRequest, NextResponse } from 'next/server'
import { findOwnedDevice } from '@/features/esp32-oled/server/devices'
import { giftError, mapGift } from '@/features/esp32-oled/server/gifts'
import { jsonError, readJson, toHttpError } from '@/features/esp32-oled/server/http'
import { getEsp32ServiceClient, requireEsp32User } from '@/features/esp32-oled/server/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireEsp32User()
    const client = getEsp32ServiceClient()
    const { data: rows, error } = await client.from('esp32_gift_invites').select('*')
      .or(`sender_auth_user_id.eq.${user.id},recipient_auth_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    if (error) throw error
    const deviceIds = [...new Set((rows || []).map(row => row.device_id as string))]
    const { data: devices, error: deviceError } = deviceIds.length
      ? await client.from('esp32_devices').select('id, name, owner_auth_user_id, setup_ap_ssid, setup_ap_password').in('id', deviceIds)
      : { data: [], error: null }
    if (deviceError) throw deviceError
    const byId = new Map((devices || []).map(device => [device.id, device as Record<string, unknown>]))
    const gifts = (rows || []).map(row => mapGift(row, byId.get(row.device_id), user.id))
    return NextResponse.json({
      incoming: gifts.filter(gift => gift.recipientUserId === user.id),
      outgoing: gifts.filter(gift => gift.senderUserId === user.id),
    })
  } catch (error) { return toHttpError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireEsp32User()
    const body = await readJson(request)
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId : ''
    const recipientUsername = typeof body.recipientUsername === 'string' ? body.recipientUsername.trim() : ''
    if (!deviceId || !/^[A-Za-z0-9_.-]{3,64}$/.test(recipientUsername)) return jsonError('Enter a valid existing username.', 422, 'INVALID_RECIPIENT')
    await findOwnedDevice(user.id, deviceId)
    const client = getEsp32ServiceClient()
    const { data: inviteId, error } = await client.rpc('esp32_create_gift_invite', {
      p_device_id: deviceId,
      p_sender: user.id,
      p_recipient_username: recipientUsername,
    })
    if (error) throw error
    const { data: row, error: readError } = await client.from('esp32_gift_invites').select('*').eq('id', inviteId).single()
    const { data: device, error: deviceError } = await client.from('esp32_devices').select('id, name, owner_auth_user_id, setup_ap_ssid, setup_ap_password').eq('id', deviceId).single()
    if (readError || deviceError) throw readError || deviceError
    return NextResponse.json({ gift: mapGift(row, device, user.id) }, { status: 201 })
  } catch (error) {
    const known = giftError(error); if (known) return jsonError(known.message, known.status, known.code)
    if (error instanceof Error && error.message === 'DEVICE_NOT_FOUND') return jsonError('Device not found.', 404)
    return toHttpError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireEsp32User()
    const body = await readJson(request)
    const inviteId = typeof body.inviteId === 'string' ? body.inviteId : ''
    const action = body.action
    if (!inviteId || (action !== 'accept' && action !== 'cancel')) return jsonError('This gift action is not supported.', 422, 'INVALID_GIFT_ACTION')
    const client = getEsp32ServiceClient()
    if (action === 'cancel') {
      const { data, error } = await client.rpc('esp32_cancel_gift', { p_invite_id: inviteId, p_sender: user.id })
      if (error) throw error
      if (!data) return jsonError('This pending invitation was not found.', 404, 'GIFT_INVITE_NOT_FOUND')
      return NextResponse.json({ cancelled: true })
    }
    const { data, error } = await client.rpc('esp32_accept_gift', { p_invite_id: inviteId, p_recipient: user.id })
    if (error) throw error
    return NextResponse.json({ accepted: true, transfer: data })
  } catch (error) {
    const known = giftError(error); if (known) return jsonError(known.message, known.status, known.code)
    return toHttpError(error)
  }
}
