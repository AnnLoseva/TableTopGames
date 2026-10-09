import { ESP32_ONLINE_WINDOW_MS } from '../constants'
import type { DeviceSlot, Esp32Command, Esp32Device } from '../types'

export function mapDevice(row: Record<string, unknown>): Esp32Device {
  const lastSeenAt = typeof row.last_seen_at === 'string' ? row.last_seen_at : null
  const hardware = row.hardware && typeof row.hardware === 'object' ? row.hardware as Record<string, unknown> : {}
  const performance = hardware.performance && typeof hardware.performance === 'object' ? hardware.performance as Record<string, unknown> : {}
  return {
    id: String(row.id),
    deviceUid: String(row.device_uid),
    name: String(row.name || 'My OLED'),
    firmwareVersion: typeof row.firmware_version === 'string' ? row.firmware_version : null,
    lastSeenAt,
    online: Boolean(lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() <= ESP32_ONLINE_WINDOW_MS),
    activeSlot: typeof row.active_slot === 'number' ? row.active_slot : null,
    flashSize: Number(row.flash_size || 0),
    fsTotal: Number(row.fs_total || 0),
    fsUsed: Number(row.fs_used || 0),
    brightness: Number(row.brightness ?? 128),
    speedMultiplier: Number(row.speed_multiplier ?? 1),
    actualFps: Number(performance.actualFps || 0),
    maxFrameGapMs: Number(performance.maxFrameGapMs || 0),
    manifest: Array.isArray(row.manifest) ? row.manifest as DeviceSlot[] : [],
    createdAt: String(row.created_at),
  }
}

export function mapCommand(row: Record<string, unknown>): Esp32Command {
  return {
    id: String(row.id),
    deviceId: String(row.device_id),
    type: row.command_type as Esp32Command['type'],
    payload: row.payload && typeof row.payload === 'object' ? row.payload as Record<string, unknown> : {},
    status: row.status as Esp32Command['status'],
    attempts: Number(row.attempts || 0),
    errorMessage: typeof row.error_message === 'string' ? row.error_message : null,
    createdAt: String(row.created_at),
    acknowledgedAt: typeof row.acknowledged_at === 'string' ? row.acknowledged_at : null,
  }
}

