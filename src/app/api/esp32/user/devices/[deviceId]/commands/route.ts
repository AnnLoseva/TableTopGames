import { NextRequest, NextResponse } from 'next/server'
import { isCommandType, isSlot, safeNumber } from '@/features/esp32-oled/lib/validation'
import { queueCommand } from '@/features/esp32-oled/server/devices'
import { jsonError, readJson, toHttpError } from '@/features/esp32-oled/server/http'
import { requireEsp32User } from '@/features/esp32-oled/server/supabase'

type Context = { params: Promise<{ deviceId: string }> }

function validatePayload(type: string, value: unknown) {
  const payload = value && typeof value === 'object' ? { ...value as Record<string, unknown> } : {}
  if (['delete_asset', 'rename_asset', 'set_active'].includes(type) && !isSlot(payload.slot)) {
    throw new Error('INVALID_SLOT')
  }
  if (type === 'rename_asset') payload.name = String(payload.name || '').trim().slice(0, 48)
  if (type === 'set_settings') {
    if (Object.hasOwn(payload, 'brightness')) payload.brightness = Math.round(safeNumber(payload.brightness, 0, 255, 128))
    if (Object.hasOwn(payload, 'speedMultiplier')) payload.speedMultiplier = safeNumber(payload.speedMultiplier, 0.25, 4, 1)
    if (Object.hasOwn(payload, 'slot') && !isSlot(payload.slot)) throw new Error('INVALID_SLOT')
  }
  return payload
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireEsp32User()
    const { deviceId } = await context.params
    const body = await readJson(request)
    if (!isCommandType(body.type) || body.type === 'upload_asset') {
      return jsonError('Команда не поддерживается.', 422, 'INVALID_COMMAND')
    }
    const command = await queueCommand(user.id, deviceId, body.type, validatePayload(body.type, body.payload))
    return NextResponse.json({ command }, { status: 202 })
  } catch (error) {
    if (error instanceof Error && error.message === 'DEVICE_NOT_FOUND') return jsonError('Устройство не найдено.', 404)
    if (error instanceof Error && error.message === 'INVALID_SLOT') return jsonError('Выбран неверный слот.', 422)
    return toHttpError(error)
  }
}

