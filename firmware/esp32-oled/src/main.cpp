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
static bool pairingPublished = false;
static bool registered = false;
static uint32_t lastRegisterAttempt = 0;
static uint32_t lastPoll = 0;
static uint8_t appliedBrightness = 255;
static bool portalWasActive = false;

static void onShortPress() {
  int current = animation.currentSlot(); if (current < 0) return;
  const SlotMeta& meta = files.slot(current);
  if (meta.buttonType == "next") { int next = files.nextPresent(current); if (next >= 0) { settings.setActiveSlot(next); animation.play(next); } }
  else if (meta.buttonType == "restart") animation.restart();
  else if (meta.buttonType == "alternate" && meta.alternateSlot >= 0) animation.play(meta.alternateSlot, current);
  else if (meta.buttonType == "toggle_pause") animation.togglePause();
  else if (meta.buttonType == "custom") settings.setPendingEvent(meta.eventName.isEmpty() ? "button.press" : meta.eventName);
}

static void onLongPress() {
  uint32_t value = esp_random() % 10000;
  snprintf(pairingPin, sizeof(pairingPin), "%04lu", static_cast<unsigned long>(value));
  pairingUntil = millis() + AppConfig::PairingDurationMs;
  pairingPublished = false;
  lastPairingAttempt = 0;
}

void setup() {
  Serial.begin(115200);
  settings.begin(); identity.begin();
  button.begin(AppConfig::ButtonPin, onShortPress, onLongPress);
  bool forcePortal = button.heldAtBoot(8000);
  if (forcePortal) settings.clearWifi();
  if (!oled.begin()) Serial.println("OLED initialization failed");
  if (!files.begin()) oled.showMessage("LittleFS error", "Format required");
  animation.begin(files, oled, settings.speedMultiplier());
  int selected = settings.activeSlot();
  if (selected < 0 || selected >= AppConfig::SlotCount || !files.slot(selected).present) selected = files.nextPresent(-1);
  if (selected >= 0) animation.play(selected); else oled.showMessage("OLED garden", "No animations yet");
  wifi.begin(settings, forcePortal);
  api.begin(identity, files, settings, animation);
  commands.begin(api, files, settings, animation, wifi);
  diagnostics.begin();
}

void loop() {
  diagnostics.tick(); button.tick(); wifi.tick(); commands.tick();
  bool pairingActive = pairingUntil && static_cast<int32_t>(pairingUntil - millis()) > 0;
  if (pairingActive) oled.showPairingPin(pairingPin, (pairingUntil - millis() + 999) / 1000);
  else if (pairingUntil) { pairingUntil = 0; pairingPublished = false; animation.restart(); }

  if (wifi.portalActive()) {
    if (!portalWasActive) { oled.showMessage("Wi-Fi setup", wifi.portalSsid()); portalWasActive = true; }
  } else portalWasActive = false;
  animation.tick(pairingActive || wifi.portalActive());

  uint8_t brightness = settings.brightness();
  if (brightness != appliedBrightness) { oled.setBrightness(brightness); appliedBrightness = brightness; }
  if (!wifi.online() || !api.ready()) return;

  uint32_t now = millis();
  if (!registered && now - lastRegisterAttempt > 10000) {
    lastRegisterAttempt = now; registered = api.registerDevice();
  }
  if (!registered) return;

  if (pairingActive && !pairingPublished && now - lastPairingAttempt > 5000) {
    lastPairingAttempt = now; pairingPublished = api.createPairing(pairingPin);
  }

  String pendingEvent = settings.pendingEvent();
  if (!pendingEvent.isEmpty() && api.sendEvent(pendingEvent)) settings.setPendingEvent("");

  if (!commands.busy() && now - lastPoll >= AppConfig::PollIntervalMs) {
    lastPoll = now; JsonDocument command;
    if (api.poll(command) && !command.isNull()) commands.accept(command.as<JsonObject>());
  }
}

