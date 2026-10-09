#pragma once
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

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
 private:
  bool lock() const;
  void unlock() const;
  mutable SemaphoreHandle_t mutex_ = nullptr;
  String ssid_;
  String wifiPassword_;
  String lastCommandId_;
  String pendingEvent_;
  uint8_t brightness_ = 128;
  float speedMultiplier_ = 1.0f;
  int activeSlot_ = -1;
};

