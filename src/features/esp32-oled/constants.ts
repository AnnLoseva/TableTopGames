export const ESP32_ASSET_BUCKET = 'esp32-oled-assets'
export const ESP32_MAX_ASSET_BYTES = 2 * 1024 * 1024
export const ESP32_SLOT_COUNT = 10
export const ESP32_ONLINE_WINDOW_MS = 45_000
export const ESP32_PAIRING_TTL_SECONDS = 120
export const ESP32_POLL_INTERVAL_MS = 5_000

export const ESP32_COMMAND_TYPES = [
  'upload_asset',
  'delete_asset',
  'rename_asset',
  'set_active',
  'set_settings',
  'request_manifest',
  'reboot',
  'reset_wifi',
] as const

export type Esp32CommandType = typeof ESP32_COMMAND_TYPES[number]

