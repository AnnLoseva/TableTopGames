#pragma once
#include <Arduino.h>
#include <DNSServer.h>
#include <WebServer.h>
#include "DeviceIdentity.hpp"
#include "Settings.hpp"

enum class ConnectionState : uint8_t {
  WifiUnset, Connecting, WifiConnected, NoInternet, TlsError,
  ServerUnavailable, RegistrationError, Registered,
  WaitingGiftAcceptance, Ready,
};

class WifiProvisioning {
 public:
  void begin(Settings& settings, DeviceIdentity& identity);
  void tick();
  bool online() const;
  bool portalActive() const { return portalActive_; }
  const String& portalSsid() const { return portalSsid_; }
  const String& portalPassword() const { return portalPassword_; }
  ConnectionState state() const;
  void setBackendState(ConnectionState state);
  void startPortal();
 private:
  void connectSavedStation();
  void connectCandidate(const String& ssid, const String& password);
  void stopPortal();
  void configureRoutes();
  void startScan();
  String statusJson() const;
  const char* stateCode(ConnectionState state) const;
  Settings* settings_ = nullptr;
  DeviceIdentity* identity_ = nullptr;
  DNSServer dns_;
  WebServer server_{80};
  bool portalActive_ = false;
  bool routesConfigured_ = false;
  bool candidatePending_ = false;
  bool candidateSaved_ = false;
  String candidateSsid_;
  String candidatePassword_;
  String portalSsid_;
  String portalPassword_;
  String connectionError_;
  uint32_t lastConnectAttempt_ = 0;
  uint32_t firstConnectAttempt_ = 0;
  uint32_t connectedAt_ = 0;
  uint32_t backendConfirmedAt_ = 0;
  mutable portMUX_TYPE stateMux_ = portMUX_INITIALIZER_UNLOCKED;
  ConnectionState backendState_ = ConnectionState::WifiUnset;
};
