#pragma once
#include <Arduino.h>
#include <DNSServer.h>
#include <WebServer.h>
#include "Settings.hpp"

class WifiProvisioning {
 public:
  void begin(Settings& settings, bool forcePortal = false);
  void tick();
  bool online() const;
  bool portalActive() const { return portalActive_; }
  const String& portalSsid() const { return portalSsid_; }
  void startPortal();
 private:
  void connectStation();
  void stopPortal();
  void configureRoutes();
  Settings* settings_ = nullptr;
  DNSServer dns_;
  WebServer server_{80};
  bool portalActive_ = false;
  bool routesConfigured_ = false;
  String portalSsid_;
  uint32_t lastConnectAttempt_ = 0;
  uint32_t firstConnectAttempt_ = 0;
};

