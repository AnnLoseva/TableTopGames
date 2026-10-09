#pragma once
#include <Arduino.h>

class DeviceIdentity {
 public:
  void begin();
  const String& id() const { return deviceId_; }
  const String& token() const { return token_; }

 private:
  String deviceId_;
  String token_;
};

