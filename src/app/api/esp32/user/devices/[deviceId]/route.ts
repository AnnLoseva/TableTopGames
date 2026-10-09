import { NextRequest, NextResponse } from 'next/server'
import { cleanName } from '@/features/esp32-oled/lib/validation'
import { findOwnedDevice } from '@/features/esp32-oled/server/devices'
import { jsonError, readJson, toHttpError } from '@/features/esp32-oled/server/http'
import { mapDevice } from '@/features/esp32-oled/server/mappers'
import { getEsp32ServiceClient, requireEsp32User } from '@/features/esp32-oled/server/supabase'
import { ESP32_ASSET_BUCKET } from '@/features/esp32-oled/constants'

type Context = { params: Promise<{ deviceId: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const user = await requireEsp32User()
    const { deviceId } = await context.params
    await findOwnedDevice(user.id, deviceId)
    const body = await readJson(request)
    if (!Object.hasOwn(body, 'name')) return jsonError('Нет данных для изменения.', 422)
    const { data, error } = await getEsp32ServiceClient()
      .from('esp32_devices')
      .update({ name: cleanName(body.name) })
      .eq('id', deviceId)
      .eq('owner_auth_user_id', user.id)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ device: mapDevice(data) })
  } catch (error) {
    if (error instanceof Error && error.message === 'DEVICE_NOT_FOUND') return jsonError('Устройство не найдено.', 404)
    return toHttpError(error)
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const user = await requireEsp32User()
    const { deviceId } = await context.params
    await findOwnedDevice(user.id, deviceId)
    const client = getEsp32ServiceClient()

    const { error: revokeError } = await client
      .from('esp32_devices')
      .update({ owner_auth_user_id: null, name: 'Мой OLED' })
      .eq('id', deviceId)
      .eq('owner_auth_user_id', user.id)
    if (revokeError) throw revokeError
    await client.from('esp32_device_commands').delete().eq('device_id', deviceId)
    await client.from('esp32_pairing_challenges').update({ consumed_at: new Date().toISOString() }).eq('device_id', deviceId).is('consumed_at', null)

    const prefix = `${user.id}/${deviceId}`
    const { data: objects } = await client.storage.from(ESP32_ASSET_BUCKET).list(prefix, { limit: 1000 })
    if (objects?.length) {
      await client.storage.from(ESP32_ASSET_BUCKET).remove(objects.map(object => `${prefix}/${object.name}`))
    }
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (error instanceof Error && error.message === 'DEVICE_NOT_FOUND') return jsonError('Устройство не найдено.', 404)
    return toHttpError(error)
  }
}

