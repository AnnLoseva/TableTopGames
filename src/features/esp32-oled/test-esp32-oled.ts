import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { decodeOledAsset, encodeOledAsset, OLED_FRAME_BYTES, rleDecode } from './lib/format'
import { cleanName, isCommandType, isFourDigitPin, isSlot } from './lib/validation'

const blank = new Uint8Array(OLED_FRAME_BYTES)
const checker = Uint8Array.from({ length: OLED_FRAME_BYTES }, (_, index) => index % 2 ? 0xaa : 0x55)
const encoded = encodeOledAsset({
  width: 128,
  height: 64,
  loop: true,
  frames: [{ durationMs: 80, pixels: blank }, { durationMs: 125, pixels: checker }],
})
const decoded = decodeOledAsset(encoded)
assert.equal(decoded.frames.length, 2)
assert.equal(decoded.loop, true)
assert.equal(decoded.frames[0].durationMs, 80)
assert.deepEqual(decoded.frames[1].pixels, checker)
assert.throws(() => rleDecode(Uint8Array.from([0, 1])))
assert.throws(() => decodeOledAsset(Uint8Array.from([1, 2, 3])))

assert.equal(isSlot(0), true)
assert.equal(isSlot(9), true)
assert.equal(isSlot(10), false)
assert.equal(isSlot(1.5), false)
assert.equal(isFourDigitPin('0042'), true)
assert.equal(isFourDigitPin('42'), false)
assert.equal(isCommandType('set_active'), true)
assert.equal(isCommandType('drop_database'), false)
assert.equal(cleanName('  Жабка\u0000  '), 'Жабка')

const sql = readFileSync(resolve(process.cwd(), 'src/features/esp32-oled/supabase/esp32_oled.sql'), 'utf8')
for (const table of ['esp32_devices', 'esp32_pairing_challenges', 'esp32_pairing_attempts', 'esp32_device_commands', 'esp32_device_events']) {
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  assert.match(sql, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`, 'i'))
}
assert.match(sql, /PAIRING_AMBIGUOUS/)
assert.match(sql, /attempts \+ 1 > 5/)
assert.doesNotMatch(readFileSync(resolve(process.cwd(), 'firmware/esp32-oled/src/ApiClient.cpp'), 'utf8'), /setInsecure\s*\(/)

console.log('ESP32 OLED format, validation, rate-limit and security checks passed.')

