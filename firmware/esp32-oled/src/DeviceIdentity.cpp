#include "DeviceIdentity.hpp"
#include <Preferences.h>
#include <esp_system.h>

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
  Preferences preferences;
  preferences.begin("oled-id", false);
  token_ = preferences.getString("token", "");
  if (token_.length() < 64) {
    token_ = randomHex(32);
    preferences.putString("token", token_);
  }
  preferences.end();
}

