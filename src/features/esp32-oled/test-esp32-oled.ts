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
assert.equal(cleanName('  Desk display\u0000  '), 'Desk display')

const sql = readFileSync(resolve(process.cwd(), 'src/features/esp32-oled/supabase/esp32_oled.sql'), 'utf8')
for (const table of ['esp32_devices', 'esp32_pairing_challenges', 'esp32_pairing_attempts', 'esp32_device_commands', 'esp32_device_events', 'esp32_gift_invites']) {
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  assert.match(sql, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`, 'i'))
}
assert.match(sql, /PAIRING_AMBIGUOUS/)
assert.match(sql, /attempts \+ 1 > 5/)
assert.match(sql, /esp32_create_gift_invite/)
assert.match(sql, /esp32_accept_gift/)
assert.match(sql, /esp32_queue_owned_command/)
assert.match(sql, /where id = p_device_id and owner_auth_user_id = p_owner[\s\S]*for update/)
assert.match(sql, /where id = p_device_id for share/)
assert.match(sql, /GIFT_DEVICE_BUSY/)
assert.match(sql, /owner_auth_user_id = p_recipient/)
assert.match(sql, /command_type, payload, idempotency_key[\s\S]*'reset_wifi'/)
assert.match(sql, /status in \('queued', 'in_progress'\)/)
assert.match(sql, /grant execute on function public\.esp32_accept_gift\(uuid, uuid\) to service_role/i)
const apiClient = readFileSync(resolve(process.cwd(), 'firmware/esp32-oled/src/ApiClient.cpp'), 'utf8')
const firmwareMain = readFileSync(resolve(process.cwd(), 'firmware/esp32-oled/src/main.cpp'), 'utf8')
const commandProcessor = readFileSync(resolve(process.cwd(), 'firmware/esp32-oled/src/CommandProcessor.cpp'), 'utf8')
const animationEngine = readFileSync(resolve(process.cwd(), 'firmware/esp32-oled/src/AnimationEngine.cpp'), 'utf8')
const wifiProvisioning = readFileSync(resolve(process.cwd(), 'firmware/esp32-oled/src/WifiProvisioning.cpp'), 'utf8')
const buttonHandler = readFileSync(resolve(process.cwd(), 'firmware/esp32-oled/src/ButtonHandler.cpp'), 'utf8')
const identity = readFileSync(resolve(process.cwd(), 'firmware/esp32-oled/src/DeviceIdentity.cpp'), 'utf8')
assert.doesNotMatch(apiClient, /setInsecure\s*\(/)
assert.match(firmwareMain, /xTaskCreatePinnedToCore\(networkTask/)
assert.doesNotMatch(firmwareMain, /void loop\(\)[\s\S]*api\.(?:registerDevice|createPairing|poll|acknowledge|sendEvent|downloadChunk)\s*\(/)
assert.match(commandProcessor, /xQueueCreate/)
assert.match(animationEngine, /followingFrameAt = nextFrameAt_ \+ duration/)
assert.match(wifiProvisioning, /OLED-Setup-%04X|setupSsid/)
assert.match(wifiProvisioning, /WiFi\.softAP\(portalSsid_\.c_str\(\), portalPassword_\.c_str\(\)\)/)
assert.match(wifiProvisioning, /hotspot-detect\.html/)
assert.match(wifiProvisioning, /generate_204/)
assert.match(wifiProvisioning, /WiFi\.scanNetworks\(true, true\)/)
assert.match(wifiProvisioning, /Could not connect\. Check the Wi-Fi password and try again\./)
assert.match(wifiProvisioning, /settings_->saveWifi\(candidateSsid_, candidatePassword_\)/)
assert.match(wifiProvisioning, /backendConfirmedAt_/)
assert.match(identity, /setupPassword/)
assert.match(buttonHandler, /else if \(holdReleased_\) holdReleased_\(duration\)/)
assert.doesNotMatch(buttonHandler, /longPress_\(\)/)
assert.match(firmwareMain, /durationMs >= AppConfig::WifiResetHoldMs/)
assert.match(firmwareMain, /pairingActive && commands\.pairingPublished\(\)/)
assert.match(commandProcessor, /ResultType::Acknowledge/)
assert.match(commandProcessor, /pendingRebootCommandId_ == result\.value/)

const giftRoute = readFileSync(resolve(process.cwd(), 'src/app/api/esp32/user/gifts/route.ts'), 'utf8')
const recipientRoute = readFileSync(resolve(process.cwd(), 'src/app/api/esp32/user/recipients/route.ts'), 'utf8')
assert.match(giftRoute, /requireEsp32User/)
assert.match(giftRoute, /esp32_accept_gift/)
assert.match(recipientRoute, /\.eq\('username', username\)/)
assert.doesNotMatch(giftRoute + recipientRoute, /user_metadata/)

console.log('ESP32 OLED format, onboarding, gift transfer, button release, network isolation, scheduling, rate-limit and security checks passed.')

