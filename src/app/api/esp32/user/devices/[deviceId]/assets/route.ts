import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ESP32_ASSET_BUCKET, ESP32_MAX_ASSET_BYTES } from '@/features/esp32-oled/constants'
import { inspectOledAsset } from '@/features/esp32-oled/lib/format'
import { cleanName, isSlot } from '@/features/esp32-oled/lib/validation'
import { findOwnedDevice, queueCommand } from '@/features/esp32-oled/server/devices'
import { jsonError, toHttpError } from '@/features/esp32-oled/server/http'
import { getEsp32ServiceClient, requireEsp32User } from '@/features/esp32-oled/server/supabase'

type Context = { params: Promise<{ deviceId: string }> }

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireEsp32User()
    const { deviceId } = await context.params
    const { device } = await findOwnedDevice(user.id, deviceId)
    const form = await request.formData()
    const file = form.get('file')
    const slotValue = Number(form.get('slot'))
    if (!(file instanceof File)) return jsonError('Выберите подготовленный OLED-файл.', 422, 'FILE_REQUIRED')
    if (!isSlot(slotValue)) return jsonError('Выберите слот от 0 до 9.', 422, 'INVALID_SLOT')
    if (file.size < 16 || file.size > ESP32_MAX_ASSET_BYTES) {
      return jsonError('Файл превышает лимит 2 МБ.', 413, 'FILE_TOO_LARGE')
    }
    if (device.fsTotal > 0 && device.fsTotal - device.fsUsed < file.size + 4096) {
      return jsonError('На устройстве недостаточно свободного места для безопасной замены.', 409, 'NOT_ENOUGH_SPACE')
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    let metadata: ReturnType<typeof inspectOledAsset>
    try {
      metadata = inspectOledAsset(bytes)
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : 'OLED-файл повреждён.', 422, 'INVALID_OLED_FILE')
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const previewCandidate = form.get('previewBase64')
    const previewBase64 = typeof previewCandidate === 'string' && /^[A-Za-z0-9+/]{1366}==$/.test(previewCandidate)
      ? previewCandidate
      : undefined
    const objectPath = `${user.id}/${deviceId}/${randomUUID()}.oled`
    const client = getEsp32ServiceClient()
    const { error: uploadError } = await client.storage
      .from(ESP32_ASSET_BUCKET)
      .upload(objectPath, bytes, { contentType: 'application/octet-stream', upsert: false })
    if (uploadError) throw uploadError

    try {
      const command = await queueCommand(user.id, deviceId, 'upload_asset', {
        slot: slotValue,
        name: cleanName(form.get('name'), `Слот ${slotValue}`),
        objectPath,
        size: bytes.byteLength,
        sha256,
        previewBase64,
        ...metadata,
      })
      return NextResponse.json({ command }, { status: 202 })
    } catch (error) {
      await client.storage.from(ESP32_ASSET_BUCKET).remove([objectPath])
      throw error
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'DEVICE_NOT_FOUND') return jsonError('Устройство не найдено.', 404)
    return toHttpError(error)
  }
}
