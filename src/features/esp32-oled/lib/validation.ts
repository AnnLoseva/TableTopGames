import { ESP32_COMMAND_TYPES, ESP32_SLOT_COUNT, type Esp32CommandType } from '../constants'

export function isSlot(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < ESP32_SLOT_COUNT
}

export function isCommandType(value: unknown): value is Esp32CommandType {
  return typeof value === 'string' && ESP32_COMMAND_TYPES.includes(value as Esp32CommandType)
}

export function cleanName(value: unknown, fallback = 'Мой OLED') {
  if (typeof value !== 'string') return fallback
  const result = value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 48)
  return result || fallback
}

export function isFourDigitPin(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}$/.test(value)
}

export function safeNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback
}

