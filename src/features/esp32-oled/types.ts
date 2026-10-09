import type { Esp32CommandType } from './constants'

export type ButtonActionType =
  | 'next'
  | 'restart'
  | 'alternate'
  | 'toggle_pause'
  | 'custom'

export type ButtonAction = {
  type: ButtonActionType
  alternateSlot?: number
  eventName?: string
}

export type DeviceSlot = {
  slot: number
  name: string
  size: number
  sha256: string
  frameCount: number
  durationMs: number
  loop: boolean
  previewBase64?: string
  buttonAction: ButtonAction
}

export type Esp32Device = {
  id: string
  deviceUid: string
  name: string
  firmwareVersion: string | null
  lastSeenAt: string | null
  online: boolean
  activeSlot: number | null
  flashSize: number
  fsTotal: number
  fsUsed: number
  brightness: number
  speedMultiplier: number
  manifest: DeviceSlot[]
  createdAt: string
}

export type CommandStatus = 'queued' | 'in_progress' | 'succeeded' | 'failed' | 'cancelled'

export type Esp32Command = {
  id: string
  deviceId: string
  type: Esp32CommandType
  payload: Record<string, unknown>
  status: CommandStatus
  attempts: number
  errorMessage: string | null
  createdAt: string
  acknowledgedAt: string | null
}

export type OledFrame = {
  durationMs: number
  pixels: Uint8Array
}

export type OledAsset = {
  width: 128
  height: 64
  loop: boolean
  frames: OledFrame[]
}

export type ConversionOptions = {
  fit: 'contain' | 'cover' | 'stretch'
  brightness: number
  contrast: number
  threshold: number
  invert: boolean
  dither: boolean
  speed: number
  loop: boolean
}
