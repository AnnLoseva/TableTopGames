import { NextRequest, NextResponse } from 'next/server'
import { cleanName, isCommandType, isSlot, safeNumber } from '@/features/esp32-oled/lib/validation'
import { queueCommand } from '@/features/esp32-oled/server/devices'
import { jsonError, readJson, toHttpError } from '@/features/esp32-oled/server/http'
import { requireEsp32User } from '@/features/esp32-oled/server/supabase'

type Context = { params: Promise<{ deviceId: string }> }

function validatePayload(type: string, value: unknown) {
  const payload = value && typeof value === 'object' ? { ...value as Record<string, unknown> } : {}
  if (['delete_asset', 'rename_asset', 'set_active'].includes(type) && !isSlot(payload.slot)) {
    throw new Error('INVALID_SLOT')
  }
  if (type === 'rename_asset') payload.name = cleanName(payload.name, `Slot ${payload.slot}`)
  if (type === 'set_settings') {
    if (Object.hasOwn(payload, 'brightness')) payload.brightness = Math.round(safeNumber(payload.brightness, 0, 255, 128))
    if (Object.hasOwn(payload, 'speedMultiplier')) payload.speedMultiplier = safeNumber(payload.speedMultiplier, 0.25, 4, 1)
    if (Object.hasOwn(payload, 'slot') && !isSlot(payload.slot)) throw new Error('INVALID_SLOT')
    if (payload.buttonAction && typeof payload.buttonAction === 'object') {
      const action = { ...payload.buttonAction as Record<string, unknown> }
      if (!['next', 'restart', 'alternate', 'toggle_pause', 'custom'].includes(String(action.type))) throw new Error('INVALID_ACTION')
      if (action.type === 'alternate' && !isSlot(action.alternateSlot)) throw new Error('INVALID_ACTION')
      if (action.type === 'custom' && (typeof action.eventName !== 'string' || !/^[a-zA-Z0-9_.:-]{1,64}$/.test(action.eventName))) throw new Error('INVALID_ACTION')
      payload.buttonAction = action
    }
  }
  return payload
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireEsp32User()
    const { deviceId } = await context.params
    const body = await readJson(request)
    if (!isCommandType(body.type) || body.type === 'upload_asset') {
      return jsonError('This command is not supported.', 422, 'INVALID_COMMAND')
    }
    const command = await queueCommand(user.id, deviceId, body.type, validatePayload(body.type, body.payload))
    return NextResponse.json({ command }, { status: 202 })
  } catch (error) {
    if (error instanceof Error && error.message === 'DEVICE_NOT_FOUND') return jsonError('Device not found.', 404)
    if (error instanceof Error && error.message === 'INVALID_SLOT') return jsonError('Invalid slot.', 422)
    if (error instanceof Error && error.message === 'INVALID_ACTION') return jsonError('Invalid button action.', 422)
    return toHttpError(error)
  }
}
