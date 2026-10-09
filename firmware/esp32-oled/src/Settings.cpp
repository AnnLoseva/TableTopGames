#include "Settings.hpp"
#include <Preferences.h>

void Settings::begin() {
  mutex_ = xSemaphoreCreateRecursiveMutex();
  Preferences p; p.begin("oled", true);
  ssid_ = p.getString("ssid", ""); wifiPassword_ = p.getString("wifi-pass", "");
  brightness_ = p.getUChar("bright", 128); speedMultiplier_ = p.getFloat("speed", 1.0f);
  activeSlot_ = p.getChar("slot", -1); lastCommandId_ = p.getString("last-cmd", ""); pendingEvent_ = p.getString("event", "");
  p.end();
}

bool Settings::lock() const { return mutex_ && xSemaphoreTakeRecursive(mutex_, portMAX_DELAY) == pdTRUE; }
void Settings::unlock() const { if (mutex_) xSemaphoreGiveRecursive(mutex_); }

String Settings::ssid() { if (!lock()) return ""; String value = ssid_; unlock(); return value; }
String Settings::wifiPassword() { if (!lock()) return ""; String value = wifiPassword_; unlock(); return value; }
void Settings::saveWifi(const String& ssidValue, const String& password) {
  if (!lock()) return;
  ssid_ = ssidValue; wifiPassword_ = password;
  Preferences p; p.begin("oled", false); p.putString("ssid", ssidValue); p.putString("wifi-pass", password); p.end();
  unlock();
}
void Settings::clearWifi() {
  if (!lock()) return;
  ssid_ = ""; wifiPassword_ = "";
  Preferences p; p.begin("oled", false); p.remove("ssid"); p.remove("wifi-pass"); p.end();
  unlock();
}
uint8_t Settings::brightness() { if (!lock()) return 128; uint8_t value = brightness_; unlock(); return value; }
void Settings::setBrightness(uint8_t value) { if (!lock()) return; brightness_ = value; Preferences p; p.begin("oled", false); p.putUChar("bright", value); p.end(); unlock(); }
float Settings::speedMultiplier() { if (!lock()) return 1.0f; float value = speedMultiplier_; unlock(); return value; }
void Settings::setSpeedMultiplier(float value) { if (!lock()) return; speedMultiplier_ = value; Preferences p; p.begin("oled", false); p.putFloat("speed", value); p.end(); unlock(); }
int Settings::activeSlot() { if (!lock()) return -1; int value = activeSlot_; unlock(); return value; }
void Settings::setActiveSlot(int slot) { if (!lock()) return; activeSlot_ = slot; Preferences p; p.begin("oled", false); p.putChar("slot", static_cast<int8_t>(slot)); p.end(); unlock(); }
String Settings::lastCommandId() { if (!lock()) return ""; String value = lastCommandId_; unlock(); return value; }
void Settings::setLastCommandId(const String& id) { if (!lock()) return; lastCommandId_ = id; Preferences p; p.begin("oled", false); p.putString("last-cmd", id); p.end(); unlock(); }
String Settings::pendingEvent() { if (!lock()) return ""; String value = pendingEvent_; unlock(); return value; }
void Settings::setPendingEvent(const String& event) { if (!lock()) return; pendingEvent_ = event; Preferences p; p.begin("oled", false); p.putString("event", event); p.end(); unlock(); }

