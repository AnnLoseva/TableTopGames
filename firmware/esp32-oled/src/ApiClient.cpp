#include "ApiClient.hpp"
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include "AppConfig.hpp"
#include "TlsRoot.hpp"

void ApiClient::begin(DeviceIdentity& identity, FileStore& store, Settings& settings, AnimationEngine& animation) {
  identity_ = &identity; store_ = &store; settings_ = &settings; animation_ = &animation;
  configTime(0, 0, "pool.ntp.org", "time.cloudflare.com");
}

bool ApiClient::ready() const { return time(nullptr) > 1700000000; }

bool ApiClient::postJson(const String& path, const String& body, String& response, bool authenticate) {
  if (!ready()) return false;
  WiFiClientSecure tls; tls.setCACert(GTS_ROOT_R4); tls.setTimeout(4000);
  HTTPClient http; http.setConnectTimeout(2500); http.setTimeout(4000);
  if (!http.begin(tls, String(AppConfig::ApiBase) + path)) return false;
  http.addHeader("Content-Type", "application/json");
  if (authenticate) { http.addHeader("X-Device-Id", identity_->id()); http.addHeader("Authorization", "Bearer " + identity_->token()); }
  int status = http.POST(reinterpret_cast<uint8_t*>(const_cast<char*>(body.c_str())), body.length());
  response = status > 0 ? http.getString() : ""; http.end(); return status >= 200 && status < 300;
}

void ApiClient::addState(JsonObject object) {
  object["firmwareVersion"] = AppConfig::FirmwareVersion; object["flashSize"] = ESP.getFlashChipSize();
  object["fsTotal"] = store_->totalBytes(); object["fsUsed"] = store_->usedBytes(); object["activeSlot"] = animation_->currentSlot();
  object["brightness"] = settings_->brightness(); object["speedMultiplier"] = settings_->speedMultiplier();
  object["actualFps"] = animation_->actualFps(); object["maxFrameGapMs"] = animation_->maxFrameGapMs();
  store_->addManifest(object["manifest"].to<JsonArray>());
}

bool ApiClient::registerDevice() {
  JsonDocument doc; doc["deviceId"] = identity_->id(); doc["token"] = identity_->token();
  doc["firmwareVersion"] = AppConfig::FirmwareVersion; doc["flashSize"] = ESP.getFlashChipSize(); doc["fsTotal"] = store_->totalBytes(); doc["fsUsed"] = store_->usedBytes();
  JsonObject hardware = doc["hardware"].to<JsonObject>(); hardware["chip"] = ESP.getChipModel(); hardware["cores"] = ESP.getChipCores(); hardware["revision"] = ESP.getChipRevision();
  String body; serializeJson(doc, body); String response; return postJson("/api/esp32/device/register", body, response, false);
}

bool ApiClient::createPairing(const char pin[5]) {
  JsonDocument doc; doc["pin"] = pin; String body; serializeJson(doc, body); String response; return postJson("/api/esp32/device/pairing", body, response);
}

bool ApiClient::poll(JsonDocument& command) {
  JsonDocument doc; addState(doc.to<JsonObject>()); String body; serializeJson(doc, body); String response;
  if (!postJson("/api/esp32/device/poll", body, response)) return false;
  JsonDocument parsed; if (deserializeJson(parsed, response)) return false;
  if (parsed["command"].isNull()) { command.clear(); return true; }
  command.set(parsed["command"]); return true;
}

bool ApiClient::acknowledge(const String& commandId, bool success, const String& error) {
  JsonDocument doc; doc["status"] = success ? "succeeded" : "failed"; if (!error.isEmpty()) doc["error"] = error;
  addState(doc["state"].to<JsonObject>()); String body; serializeJson(doc, body); String response;
  return postJson("/api/esp32/device/commands/" + commandId + "/ack", body, response);
}

bool ApiClient::sendEvent(const String& eventName) {
  JsonDocument doc; doc["type"] = eventName; doc["payload"]["slot"] = animation_->currentSlot(); String body; serializeJson(doc, body); String response;
  return postJson("/api/esp32/device/events", body, response);
}

int ApiClient::downloadChunk(const String& commandId, size_t offset, uint8_t* buffer, size_t length) {
  if (!ready()) return -1;
  String path = "/api/esp32/device/assets/" + commandId + "?offset=" + String(offset) + "&length=" + String(length);
  WiFiClientSecure tls; tls.setCACert(GTS_ROOT_R4); tls.setTimeout(4000);
  HTTPClient http; http.setConnectTimeout(2500); http.setTimeout(4000); if (!http.begin(tls, String(AppConfig::ApiBase) + path)) return -1;
  http.addHeader("X-Device-Id", identity_->id()); http.addHeader("Authorization", "Bearer " + identity_->token());
  int status = http.GET(); if (status != 206) { http.end(); return -1; }
  int expected = http.getSize(); if (expected < 1 || static_cast<size_t>(expected) > length) { http.end(); return -1; }
  WiFiClient* stream = http.getStreamPtr(); size_t read = stream->readBytes(buffer, expected); http.end(); return read == static_cast<size_t>(expected) ? expected : -1;
}
