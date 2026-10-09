#pragma once
#include <Arduino.h>

class Settings {
 public:
  void begin();
  String ssid();
  String wifiPassword();
  void saveWifi(const String& ssid, const String& password);
  void clearWifi();
  uint8_t brightness();
  void setBrightness(uint8_t value);
  float speedMultiplier();
  void setSpeedMultiplier(float value);
  int activeSlot();
  void setActiveSlot(int slot);
  String lastCommandId();
  void setLastCommandId(const String& id);
  String pendingEvent();
  void setPendingEvent(const String& event);
};

