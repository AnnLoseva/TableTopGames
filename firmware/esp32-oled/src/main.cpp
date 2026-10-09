#include <Arduino.h>
#include <esp_system.h>
#include "AnimationEngine.hpp"
#include "ApiClient.hpp"
#include "AppConfig.hpp"
#include "ButtonHandler.hpp"
#include "CommandProcessor.hpp"
#include "DeviceIdentity.hpp"
#include "Diagnostics.hpp"
#include "FileStore.hpp"
#include "OledRenderer.hpp"
#include "Settings.hpp"
#include "WifiProvisioning.hpp"

static Settings settings;
static DeviceIdentity identity;
static FileStore files;
static OledRenderer oled;
static AnimationEngine animation;
static WifiProvisioning wifi;
static ApiClient api;
static CommandProcessor commands;
static ButtonHandler button;
static Diagnostics diagnostics;

static char pairingPin[5] = "";
static uint32_t pairingUntil = 0;
static uint32_t lastPairingAttempt = 0;
static uint8_t appliedBrightness = 255;
static bool portalWasActive = false;
static ConnectionState displayedConnectionState = ConnectionState::WifiUnset;
static uint32_t diagnosticUntil = 0;

static void onShortPress() {
  int current = animation.currentSlot(); if (current < 0) return;
  SlotMeta meta = files.slotCopy(current);
  if (meta.buttonType == "next") { int next = files.nextPresent(current); if (next >= 0) { settings.setActiveSlot(next); animation.play(next); } }
  else if (meta.buttonType == "restart") animation.restart();
  else if (meta.buttonType == "alternate" && meta.alternateSlot >= 0) animation.play(meta.alternateSlot, current);
  else if (meta.buttonType == "toggle_pause") animation.togglePause();
  else if (meta.buttonType == "custom") settings.setPendingEvent(meta.eventName.isEmpty() ? "button.press" : meta.eventName);
}

static void startPairing() {
  uint32_t value = esp_random() % 10000;
  snprintf(pairingPin, sizeof(pairingPin), "%04lu", static_cast<unsigned long>(value));
  pairingUntil = millis() + AppConfig::PairingDurationMs;
  commands.resetPairing();
  lastPairingAttempt = 0;
}

static void onHoldReleased(uint32_t durationMs) {
  if (durationMs >= AppConfig::WifiResetHoldMs) {
    pairingUntil = 0; commands.resetPairing(); settings.clearWifi(); wifi.startPortal();
    oled.showMessage("SETUP WIFI", wifi.portalSsid());
    Serial.println("Wi-Fi settings cleared; device identity and files preserved.");
    return;
  }
  startPairing();
}

static ConnectionState connectionStateFor(ApiConnectionStatus value) {
  switch (value) {
    case ApiConnectionStatus::WaitingForInternet: return ConnectionState::NoInternet;
    case ApiConnectionStatus::TlsError: return ConnectionState::TlsError;
    case ApiConnectionStatus::ServerUnavailable: return ConnectionState::ServerUnavailable;
    case ApiConnectionStatus::RegistrationError: return ConnectionState::RegistrationError;
    case ApiConnectionStatus::Registered: return ConnectionState::Registered;
    case ApiConnectionStatus::WaitingGiftAcceptance: return ConnectionState::WaitingGiftAcceptance;
    case ApiConnectionStatus::Ready: return ConnectionState::Ready;
  }
  return ConnectionState::NoInternet;
}

static void showConnectionDiagnostic(ConnectionState state) {
  switch (state) {
    case ConnectionState::Connecting: oled.showMessage("WIFI", "Connecting"); break;
    case ConnectionState::WifiConnected: oled.showMessage("WIFI CONNECTED", "Checking server"); break;
    case ConnectionState::NoInternet: oled.showMessage("NO INTERNET", "Animation saved"); break;
    case ConnectionState::TlsError: oled.showMessage("TLS ERROR", "Check internet"); break;
    case ConnectionState::ServerUnavailable: oled.showMessage("SERVER OFFLINE", "Will retry"); break;
    case ConnectionState::RegistrationError: oled.showMessage("REGISTER ERROR", "See website"); break;
    case ConnectionState::Registered: oled.showMessage("REGISTERED", "Backend confirmed"); break;
    case ConnectionState::WaitingGiftAcceptance: oled.showMessage("GIFT PENDING", "Waiting acceptance"); break;
    case ConnectionState::Ready: oled.showMessage("DEVICE READY", "Connected"); break;
    case ConnectionState::WifiUnset: oled.showMessage("WIFI FAILED", "Try setup again"); break;
  }
  diagnosticUntil = millis() + 2200;
}

static void networkTask(void*) {
  bool registered = false;
  uint32_t lastRegisterAttempt = millis() - 10000;
  uint32_t lastPoll = 0;
  for (;;) {
    if (!wifi.online()) { vTaskDelay(pdMS_TO_TICKS(50)); continue; }
    if (!api.ready()) { wifi.setBackendState(ConnectionState::NoInternet); vTaskDelay(pdMS_TO_TICKS(50)); continue; }
    uint32_t now = millis();
    if (!registered && now - lastRegisterAttempt >= 10000) {
      lastRegisterAttempt = now;
      registered = api.registerDevice(); wifi.setBackendState(connectionStateFor(api.status()));
    }
    if (!registered) { vTaskDelay(pdMS_TO_TICKS(50)); continue; }

    if (commands.processNetworkJob()) { vTaskDelay(1); continue; }
    if (!commands.busy() && now - lastPoll >= AppConfig::PollIntervalMs) {
      lastPoll = now;
      JsonDocument command;
      bool polled = api.poll(command); wifi.setBackendState(connectionStateFor(api.status()));
      if (polled && !command.isNull()) commands.enqueue(command.as<JsonObject>());
      if (!polled && api.status() == ApiConnectionStatus::RegistrationError) registered = false;
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

void setup() {
  Serial.begin(115200);
  settings.begin(); identity.begin();
  button.begin(AppConfig::ButtonPin, onShortPress, onHoldReleased);
  if (!oled.begin()) Serial.println("OLED initialization failed");
  if (!files.begin()) oled.showMessage("LittleFS error", "Format required");
  animation.begin(files, oled, settings.speedMultiplier());
  int selected = settings.activeSlot();
  if (selected < 0 || selected >= AppConfig::SlotCount || !files.slotCopy(selected).present) selected = files.nextPresent(-1);
  if (selected >= 0) animation.play(selected); else oled.showMessage("OLED garden", "No animations yet");
  wifi.begin(settings, identity);
  api.begin(identity, files, settings, animation);
  commands.begin(api, files, settings, animation, wifi);
  diagnostics.begin(animation);
  vTaskPrioritySet(nullptr, 2);
  if (xTaskCreatePinnedToCore(networkTask, "https-network", 12288, nullptr, 1, nullptr, 0) != pdPASS) {
    Serial.println("Network task creation failed");
  }
}

void loop() {
  button.tick();
  bool pairingActive = pairingUntil && static_cast<int32_t>(pairingUntil - millis()) > 0;
  if (pairingActive && commands.pairingPublished()) oled.showPairingPin(pairingPin, (pairingUntil - millis() + 999) / 1000);
  else if (pairingActive) oled.showMessage("PAIRING", "Contacting server");
  else if (pairingUntil) { pairingUntil = 0; commands.resetPairing(); animation.restart(); }

  if (wifi.portalActive()) {
    if (!portalWasActive) { oled.showMessage("SETUP WIFI", wifi.portalSsid()); portalWasActive = true; }
  } else portalWasActive = false;
  ConnectionState currentConnectionState = wifi.state();
  if (!pairingActive && currentConnectionState != displayedConnectionState) {
    displayedConnectionState = currentConnectionState; showConnectionDiagnostic(currentConnectionState);
  }
  bool diagnosticActive = diagnosticUntil && static_cast<int32_t>(diagnosticUntil - millis()) > 0;
  animation.tick(pairingActive || diagnosticActive || (wifi.portalActive() && !wifi.online()));

  uint8_t brightness = settings.brightness();
  if (brightness != appliedBrightness) { oled.setBrightness(brightness); appliedBrightness = brightness; }
  commands.tick();
  if (pairingActive && !commands.pairingPublished() && millis() - lastPairingAttempt >= 5000) {
    lastPairingAttempt = millis(); commands.requestPairing(pairingPin, pairingUntil);
  }
  wifi.tick(); diagnostics.tick();
  vTaskDelay(1);
}

