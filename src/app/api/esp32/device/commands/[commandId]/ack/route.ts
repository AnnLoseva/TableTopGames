import { NextRequest, NextResponse } from 'next/server'
import { ESP32_ASSET_BUCKET, ESP32_SLOT_COUNT } from '@/features/esp32-oled/constants'
import { jsonError, readJson, toHttpError } from '@/features/esp32-oled/server/http'
import { authenticateEsp32 } from '@/features/esp32-oled/server/security'
import { getEsp32ServiceClient } from '@/features/esp32-oled/server/supabase'

type Context = { params: Promise<{ commandId: string }> }

export async function POST(request: NextRequest, context: Context) {
  try {
    const device = await authenticateEsp32(request)
    const { commandId } = await context.params
    const body = await readJson(request)
    const status = body.status === 'succeeded' ? 'succeeded' : body.status === 'failed' ? 'failed' : null
    if (!status) return jsonError('This acknowledgement status is not supported.', 422, 'INVALID_STATUS')
    const client = getEsp32ServiceClient()
    const { data: command, error: readError } = await client
      .from('esp32_device_commands')
      .select('id, status, command_type, payload')
      .eq('id', commandId)
      .eq('device_id', device.id)
      .maybeSingle()
    if (readError) throw readError
    if (!command) return jsonError('Command not found.', 404)
    if (command.status === 'succeeded' || command.status === 'failed') {
      return NextResponse.json({ acknowledged: true, duplicate: true })
    }

    const { error: updateError } = await client.from('esp32_device_commands').update({
      status,
      acknowledged_at: new Date().toISOString(),
      error_message: status === 'failed' ? String(body.error || 'Device error').slice(0, 500) : null,
    }).eq('id', commandId).eq('device_id', device.id)
    if (updateError) throw updateError

    const state = body.state && typeof body.state === 'object' ? body.state as Record<string, unknown> : null
    if (state) {
      const manifest = Array.isArray(state.manifest) ? state.manifest.slice(0, ESP32_SLOT_COUNT) : undefined
      const fsTotal = Math.max(0, Number(state.fsTotal || 0))
      await client.from('esp32_devices').update({
        last_seen_at: new Date().toISOString(),
        manifest,
        active_slot: Number.isInteger(state.activeSlot) ? state.activeSlot : null,
        fs_total: fsTotal,
        fs_used: Math.max(0, Math.min(fsTotal, Number(state.fsUsed || 0))),
        brightness: Number.isFinite(Number(state.brightness)) ? Math.max(0, Math.min(255, Number(state.brightness))) : undefined,
        speed_multiplier: Number.isFinite(Number(state.speedMultiplier)) ? Math.max(0.25, Math.min(4, Number(state.speedMultiplier))) : undefined,
        hardware: {
          ...(device.hardware || {}),
          performance: {
            actualFps: Number.isFinite(Number(state.actualFps)) ? Math.max(0, Math.min(240, Number(state.actualFps))) : 0,
            maxFrameGapMs: Number.isFinite(Number(state.maxFrameGapMs)) ? Math.max(0, Math.round(Number(state.maxFrameGapMs))) : 0,
          },
        },
      }).eq('id', device.id)
    }

    if (command.command_type === 'upload_asset') {
      const objectPath = command.payload && typeof command.payload === 'object'
        ? (command.payload as Record<string, unknown>).objectPath
        : null
      if (typeof objectPath === 'string') await client.storage.from(ESP32_ASSET_BUCKET).remove([objectPath])
    }
    return NextResponse.json({ acknowledged: true })
  } catch (error) {
    return toHttpError(error)
  }
}

