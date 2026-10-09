'use client'

import type { Esp32CommandType } from '../constants'
import type { Esp32Command, Esp32Device, Esp32GiftInvite } from '../types'

async function parse(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(body.error || `HTTP error ${response.status}`)
  return body as Record<string, unknown>
}

export async function fetchDevices() {
  const body = await parse(await fetch('/api/esp32/user/devices', { cache: 'no-store' }))
  return body.devices as Esp32Device[]
}

export async function fetchServiceDiagnostics() {
  return await parse(await fetch('/api/esp32/user/diagnostics', { cache: 'no-store' })) as unknown as { ready: boolean }
}

export async function fetchGifts() {
  const body = await parse(await fetch('/api/esp32/user/gifts', { cache: 'no-store' }))
  return { incoming: body.incoming as Esp32GiftInvite[], outgoing: body.outgoing as Esp32GiftInvite[] }
}

export async function findGiftRecipient(username: string) {
  const body = await parse(await fetch(`/api/esp32/user/recipients?username=${encodeURIComponent(username)}`, { cache: 'no-store' }))
  return body.recipient as { username: string }
}

export async function createGift(deviceId: string, recipientUsername: string) {
  const body = await parse(await fetch('/api/esp32/user/gifts', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId, recipientUsername }),
  }))
  return body.gift as Esp32GiftInvite
}

export async function updateGift(inviteId: string, action: 'accept' | 'cancel') {
  return parse(await fetch('/api/esp32/user/gifts', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inviteId, action }),
  }))
}

export async function pairDevice(pin: string, name: string) {
  const body = await parse(await fetch('/api/esp32/user/pair', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin, name }),
  }))
  return body.device as Esp32Device
}

export async function renameDevice(deviceId: string, name: string) {
  const body = await parse(await fetch(`/api/esp32/user/devices/${deviceId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  }))
  return body.device as Esp32Device
}

export async function unpairDevice(deviceId: string) {
  const response = await fetch(`/api/esp32/user/devices/${deviceId}`, { method: 'DELETE' })
  if (!response.ok) await parse(response)
}

export async function sendCommand(deviceId: string, type: Exclude<Esp32CommandType, 'upload_asset'>, payload: Record<string, unknown> = {}) {
  const body = await parse(await fetch(`/api/esp32/user/devices/${deviceId}/commands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type, payload }),
  }))
  return body.command as Esp32Command
}

export function uploadAsset(
  deviceId: string,
  input: { bytes: Uint8Array; slot: number; name: string; previewBase64: string },
  onProgress: (percent: number) => void,
) {
  return new Promise<Esp32Command>((resolve, reject) => {
    const form = new FormData()
    form.append('file', new Blob([input.bytes as BlobPart], { type: 'application/octet-stream' }), `${input.name}.oled`)
    form.append('slot', String(input.slot))
    form.append('name', input.name)
    form.append('previewBase64', input.previewBase64)
    const request = new XMLHttpRequest()
    request.open('POST', `/api/esp32/user/devices/${deviceId}/assets`)
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100))
    }
    request.onerror = () => reject(new Error('The connection was interrupted during upload.'))
    request.onload = () => {
      const body = JSON.parse(request.responseText || '{}') as { command?: Esp32Command; error?: string }
      if (request.status < 200 || request.status >= 300 || !body.command) {
        reject(new Error(body.error || `HTTP error ${request.status}`))
        return
      }
      resolve(body.command)
    }
    request.send(form)
  })
}

export async function waitForCommand(commandId: string, timeoutMs = 180_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const body = await parse(await fetch(`/api/esp32/user/commands/${commandId}`, { cache: 'no-store' }))
    const command = body.command as Esp32Command
    if (command.status === 'succeeded') return command
    if (command.status === 'failed' || command.status === 'cancelled') {
      throw new Error(command.errorMessage || 'The ESP32 did not complete the command.')
    }
    await new Promise(resolve => window.setTimeout(resolve, 1500))
  }
  throw new Error('The ESP32 did not confirm the command within 3 minutes. It will run after the connection is restored.')
}
