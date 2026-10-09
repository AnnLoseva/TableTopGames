#pragma once
#include <Arduino.h>

class DeviceIdentity {
 public:
  void begin();
  const String& id() const { return deviceId_; }
  const String& token() const { return token_; }
  const String& setupSsid() const { return setupSsid_; }
  const String& setupPassword() const { return setupPassword_; }

 private:
  String deviceId_;
  String token_;
  String setupSsid_;
  String setupPassword_;
};

