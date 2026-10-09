import { NextRequest, NextResponse } from 'next/server'
import { ESP32_ASSET_BUCKET } from '@/features/esp32-oled/constants'
import { jsonError, toHttpError } from '@/features/esp32-oled/server/http'
import { authenticateEsp32 } from '@/features/esp32-oled/server/security'
import { getEsp32ServiceClient } from '@/features/esp32-oled/server/supabase'
import { SUPABASE_URL } from '@/platform/account/config'

type Context = { params: Promise<{ commandId: string }> }

function encodeStoragePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const device = await authenticateEsp32(request)
    const { commandId } = await context.params
    const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset') || 0))
    const length = Math.max(1, Math.min(16_384, Number(request.nextUrl.searchParams.get('length') || 4096)))
    if (!Number.isInteger(offset) || !Number.isInteger(length)) return jsonError('Некорректный диапазон.', 416)
    const client = getEsp32ServiceClient()
    const { data: command, error } = await client
      .from('esp32_device_commands')
      .select('command_type, payload, status')
      .eq('id', commandId)
      .eq('device_id', device.id)
      .maybeSingle()
    if (error) throw error
    if (!command || command.command_type !== 'upload_asset' || !['queued', 'in_progress'].includes(command.status)) {
      return jsonError('Файл команды недоступен.', 404)
    }
    const payload = command.payload as Record<string, unknown>
    const objectPath = typeof payload.objectPath === 'string' ? payload.objectPath : ''
    const totalSize = Number(payload.size || 0)
    if (!objectPath || offset >= totalSize) return jsonError('Диапазон вне файла.', 416)
    const end = Math.min(totalSize - 1, offset + length - 1)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.')
    const upstream = await fetch(
      `${SUPABASE_URL}/storage/v1/object/authenticated/${ESP32_ASSET_BUCKET}/${encodeStoragePath(objectPath)}`,
      { headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey, range: `bytes=${offset}-${end}` }, cache: 'no-store' },
    )
    if (!upstream.ok || !upstream.body) throw new Error(`Storage range failed: ${upstream.status}`)
    return new NextResponse(upstream.body, {
      status: 206,
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': String(end - offset + 1),
        'content-range': `bytes ${offset}-${end}/${totalSize}`,
        'accept-ranges': 'bytes',
        'cache-control': 'private, no-store',
      },
    })
  } catch (error) {
    return toHttpError(error)
  }
}

