#include "Settings.hpp"
#include <Preferences.h>

void Settings::begin() {}

static String getString(const char* key) {
  Preferences p; p.begin("oled", true); String value = p.getString(key, ""); p.end(); return value;
}
static void putString(const char* key, const String& value) {
  Preferences p; p.begin("oled", false); p.putString(key, value); p.end();
}

String Settings::ssid() { return getString("ssid"); }
String Settings::wifiPassword() { return getString("wifi-pass"); }
void Settings::saveWifi(const String& ssidValue, const String& password) {
  Preferences p; p.begin("oled", false); p.putString("ssid", ssidValue); p.putString("wifi-pass", password); p.end();
}
void Settings::clearWifi() {
  Preferences p; p.begin("oled", false); p.remove("ssid"); p.remove("wifi-pass"); p.end();
}
uint8_t Settings::brightness() { Preferences p; p.begin("oled", true); uint8_t value = p.getUChar("bright", 128); p.end(); return value; }
void Settings::setBrightness(uint8_t value) { Preferences p; p.begin("oled", false); p.putUChar("bright", value); p.end(); }
float Settings::speedMultiplier() { Preferences p; p.begin("oled", true); float value = p.getFloat("speed", 1.0f); p.end(); return value; }
void Settings::setSpeedMultiplier(float value) { Preferences p; p.begin("oled", false); p.putFloat("speed", value); p.end(); }
int Settings::activeSlot() { Preferences p; p.begin("oled", true); int value = p.getChar("slot", -1); p.end(); return value; }
void Settings::setActiveSlot(int slot) { Preferences p; p.begin("oled", false); p.putChar("slot", static_cast<int8_t>(slot)); p.end(); }
String Settings::lastCommandId() { return getString("last-cmd"); }
void Settings::setLastCommandId(const String& id) { putString("last-cmd", id); }
String Settings::pendingEvent() { return getString("event"); }
void Settings::setPendingEvent(const String& event) { putString("event", event); }

