#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>
#include "AnimationEngine.hpp"
#include "DeviceIdentity.hpp"
#include "FileStore.hpp"
#include "Settings.hpp"

enum class ApiConnectionStatus : uint8_t {
  WaitingForInternet, TlsError, ServerUnavailable, RegistrationError, Registered, WaitingGiftAcceptance, Ready,
};

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
  ApiConnectionStatus status() const;
  int lastHttpStatus() const;
 private:
  bool postJson(const String& path, const String& body, String& response, bool authenticate = true);
  void addState(JsonObject object);
  void setStatus(ApiConnectionStatus status, int httpStatus = 0);
  const char* statusCode(ApiConnectionStatus status) const;
  DeviceIdentity* identity_ = nullptr;
  FileStore* store_ = nullptr;
  Settings* settings_ = nullptr;
  AnimationEngine* animation_ = nullptr;
  mutable portMUX_TYPE statusMux_ = portMUX_INITIALIZER_UNLOCKED;
  ApiConnectionStatus status_ = ApiConnectionStatus::WaitingForInternet;
  int lastHttpStatus_ = 0;
  bool transportConfirmed_ = false;
};

