#include "DeviceIdentity.hpp"
#include <Preferences.h>
#include <esp_system.h>
#include <mbedtls/sha256.h>

static String randomHex(size_t bytes) {
  static const char hex[] = "0123456789abcdef";
  String value;
  value.reserve(bytes * 2);
  for (size_t index = 0; index < bytes; ++index) {
    uint8_t byte = static_cast<uint8_t>(esp_random());
    value += hex[byte >> 4];
    value += hex[byte & 0x0f];
  }
  return value;
}

void DeviceIdentity::begin() {
  uint64_t mac = ESP.getEfuseMac();
  char id[32];
  snprintf(id, sizeof(id), "esp32c3-%04X%08X", static_cast<uint16_t>(mac >> 32), static_cast<uint32_t>(mac));
  deviceId_ = id;
  char setupSsid[24];
  snprintf(setupSsid, sizeof(setupSsid), "OLED-Setup-%04X", static_cast<uint16_t>(mac));
  setupSsid_ = setupSsid;
  Preferences preferences;
  preferences.begin("oled-id", false);
  token_ = preferences.getString("token", "");
  if (token_.length() < 64) {
    token_ = randomHex(32);
    preferences.putString("token", token_);
  }
  preferences.end();

  uint8_t digest[32];
  mbedtls_sha256(reinterpret_cast<const unsigned char*>(token_.c_str()), token_.length(), digest, 0);
  uint32_t seed = (static_cast<uint32_t>(digest[0]) << 24)
    | (static_cast<uint32_t>(digest[1]) << 16)
    | (static_cast<uint32_t>(digest[2]) << 8)
    | static_cast<uint32_t>(digest[3]);
  uint32_t numericPassword = 10000000UL + (seed % 90000000UL);
  char setupPassword[9];
  snprintf(setupPassword, sizeof(setupPassword), "%08lu", static_cast<unsigned long>(numericPassword));
  setupPassword_ = setupPassword;
}

