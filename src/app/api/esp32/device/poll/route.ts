import { NextRequest, NextResponse } from 'next/server'
import { ESP32_SLOT_COUNT } from '@/features/esp32-oled/constants'
import { safeNumber } from '@/features/esp32-oled/lib/validation'
import { readJson, toHttpError } from '@/features/esp32-oled/server/http'
import { mapCommand } from '@/features/esp32-oled/server/mappers'
import { authenticateEsp32 } from '@/features/esp32-oled/server/security'
import { getEsp32ServiceClient } from '@/features/esp32-oled/server/supabase'

export async function POST(request: NextRequest) {
  try {
    const device = await authenticateEsp32(request)
    const body = await readJson(request)
    const manifest = Array.isArray(body.manifest) ? body.manifest.slice(0, ESP32_SLOT_COUNT) : []
    const fsTotal = Math.max(0, Math.round(safeNumber(body.fsTotal, 0, Number.MAX_SAFE_INTEGER, 0)))
    const fsUsed = Math.max(0, Math.min(fsTotal, Math.round(safeNumber(body.fsUsed, 0, Number.MAX_SAFE_INTEGER, 0))))
    const activeSlot = Number.isInteger(body.activeSlot) && Number(body.activeSlot) >= 0 && Number(body.activeSlot) < ESP32_SLOT_COUNT
      ? Number(body.activeSlot)
      : null
    const client = getEsp32ServiceClient()
    const { error: updateError } = await client.from('esp32_devices').update({
      last_seen_at: new Date().toISOString(),
      firmware_version: typeof body.firmwareVersion === 'string' ? body.firmwareVersion.slice(0, 32) : undefined,
      manifest,
      active_slot: activeSlot,
      flash_size: Math.max(0, Math.round(safeNumber(body.flashSize, 0, Number.MAX_SAFE_INTEGER, 0))),
      fs_total: fsTotal,
      fs_used: fsUsed,
      brightness: Math.round(safeNumber(body.brightness, 0, 255, 128)),
      speed_multiplier: safeNumber(body.speedMultiplier, 0.25, 4, 1),
      hardware: {
        ...(device.hardware || {}),
        connectivity: {
          state: typeof body.connectionState === 'string' ? body.connectionState.slice(0, 40) : 'registered',
          lastHttpStatus: Number.isInteger(body.lastHttpStatus) ? Number(body.lastHttpStatus) : null,
        },
        performance: {
          actualFps: safeNumber(body.actualFps, 0, 240, 0),
          maxFrameGapMs: Math.round(safeNumber(body.maxFrameGapMs, 0, Number.MAX_SAFE_INTEGER, 0)),
        },
      },
    }).eq('id', device.id)
    if (updateError) throw updateError

    const { data, error } = await client.rpc('esp32_claim_next_command', { p_device_id: device.id })
    if (error) throw error
    const { data: gift } = await client.from('esp32_gift_invites').select('status').eq('device_id', device.id).in('status', ['pending', 'wifi_reset_sent']).maybeSingle()
    return NextResponse.json({ paired: Boolean(device.owner_auth_user_id), giftStatus: gift?.status || null, command: data ? mapCommand(data) : null })
  } catch (error) {
    return toHttpError(error)
  }
}

