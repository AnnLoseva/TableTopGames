import 'server-only'
import type { Esp32GiftInvite } from '../types'

type GiftRow = Record<string, unknown>
type DeviceRow = Record<string, unknown>

export function mapGift(row: GiftRow, device: DeviceRow | undefined, viewerId: string): Esp32GiftInvite {
  const viewerOwnsDevice = device?.owner_auth_user_id === viewerId
  const viewerPreparedGift = row.sender_auth_user_id === viewerId
  return {
    id: String(row.id),
    deviceId: String(row.device_id),
    deviceName: typeof device?.name === 'string' ? device.name : 'OLED gift',
    senderUserId: String(row.sender_auth_user_id),
    recipientUserId: String(row.recipient_auth_user_id),
    recipientUsername: String(row.recipient_username),
    status: row.status as Esp32GiftInvite['status'],
    expiresAt: String(row.expires_at),
    acceptedAt: typeof row.accepted_at === 'string' ? row.accepted_at : null,
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
    createdAt: String(row.created_at),
    setupApSsid: (viewerOwnsDevice || viewerPreparedGift) && typeof device?.setup_ap_ssid === 'string' ? device.setup_ap_ssid : null,
    setupApPassword: (viewerOwnsDevice || viewerPreparedGift) && typeof device?.setup_ap_password === 'string' ? device.setup_ap_password : null,
  }
}

export function giftError(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
  if (message.includes('GIFT_RECIPIENT_NOT_FOUND')) return { message: 'No active account with that username was found.', status: 404, code: 'GIFT_RECIPIENT_NOT_FOUND' }
  if (message.includes('GIFT_RECIPIENT_IS_SENDER')) return { message: 'Choose someone other than yourself.', status: 422, code: 'GIFT_RECIPIENT_IS_SENDER' }
  if (message.includes('GIFT_INVITE_NOT_FOUND')) return { message: 'This gift invitation is not available to this account.', status: 404, code: 'GIFT_INVITE_NOT_FOUND' }
  if (message.includes('GIFT_INVITE_EXPIRED')) return { message: 'This gift invitation has expired or was already used.', status: 409, code: 'GIFT_INVITE_EXPIRED' }
  if (message.includes('GIFT_DEVICE_CHANGED')) return { message: 'The device owner changed before this invitation was accepted.', status: 409, code: 'GIFT_DEVICE_CHANGED' }
  if (message.includes('GIFT_DEVICE_BUSY')) return { message: 'The device is finishing another command. Wait a moment and accept the gift again.', status: 409, code: 'GIFT_DEVICE_BUSY' }
  return null
}
