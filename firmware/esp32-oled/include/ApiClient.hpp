#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>
#include "AnimationEngine.hpp"
#include "DeviceIdentity.hpp"
#include "FileStore.hpp"
#include "Settings.hpp"

class ApiClient {
 public:
  void begin(DeviceIdentity& identity, FileStore& store, Settings& settings, AnimationEngine& animation);
  bool ready() const;
  bool registerDevice();
  bool createPairing(const char pin[5]);
  bool poll(JsonDocument& command);
  bool acknowledge(const String& commandId, bool success, const String& error = "");
  bool sendEvent(const String& eventName);
  int downloadChunk(const String& commandId, size_t offset, uint8_t* buffer, size_t length);
 private:
  bool postJson(const String& path, const String& body, String& response, bool authenticate = true);
  void addState(JsonObject object);
  DeviceIdentity* identity_ = nullptr;
  FileStore* store_ = nullptr;
  Settings* settings_ = nullptr;
  AnimationEngine* animation_ = nullptr;
};

