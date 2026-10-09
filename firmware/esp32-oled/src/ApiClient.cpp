#include "ApiClient.hpp"
#include <HTTPClient.h>
#include <WiFi.h>
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
  if (!ready()) { setStatus(ApiConnectionStatus::WaitingForInternet); return false; }
  WiFiClientSecure tls; tls.setCACert(GTS_ROOT_R4); tls.setTimeout(4000);
  HTTPClient http; http.setConnectTimeout(2500); http.setTimeout(4000);
  if (!http.begin(tls, String(AppConfig::ApiBase) + path)) { setStatus(ApiConnectionStatus::TlsError); return false; }
  http.addHeader("Content-Type", "application/json");
  if (authenticate) { http.addHeader("X-Device-Id", identity_->id()); http.addHeader("Authorization", "Bearer " + identity_->token()); }
  int status = http.POST(reinterpret_cast<uint8_t*>(const_cast<char*>(body.c_str())), body.length());
  response = status > 0 ? http.getString() : "";
  if (status > 0 && !transportConfirmed_) { Serial.println("Internet reachable."); Serial.println("TLS verified."); transportConfirmed_ = true; }
  if (status < 0) {
    IPAddress address;
    String transportError = HTTPClient::errorToString(status); transportError.toLowerCase();
    if (transportError.indexOf("ssl") >= 0 || transportError.indexOf("tls") >= 0 || transportError.indexOf("certificate") >= 0) setStatus(ApiConnectionStatus::TlsError, status);
    else setStatus(WiFi.hostByName("annloseva-ttg.xyz", address) ? ApiConnectionStatus::ServerUnavailable : ApiConnectionStatus::WaitingForInternet, status);
  } else if (status == 401 || status == 403 || (status >= 400 && status < 500)) {
    setStatus(ApiConnectionStatus::RegistrationError, status);
  } else if (status >= 500) setStatus(ApiConnectionStatus::ServerUnavailable, status);
  http.end(); return status >= 200 && status < 300;
}

void ApiClient::addState(JsonObject object) {
  object["firmwareVersion"] = AppConfig::FirmwareVersion; object["flashSize"] = ESP.getFlashChipSize();
  object["fsTotal"] = store_->totalBytes(); object["fsUsed"] = store_->usedBytes(); object["activeSlot"] = animation_->currentSlot();
  object["brightness"] = settings_->brightness(); object["speedMultiplier"] = settings_->speedMultiplier();
  object["actualFps"] = animation_->actualFps(); object["maxFrameGapMs"] = animation_->maxFrameGapMs();
  object["connectionState"] = statusCode(status()); object["lastHttpStatus"] = lastHttpStatus();
  store_->addManifest(object["manifest"].to<JsonArray>());
}

bool ApiClient::registerDevice() {
  JsonDocument doc; doc["deviceId"] = identity_->id(); doc["token"] = identity_->token();
  doc["firmwareVersion"] = AppConfig::FirmwareVersion; doc["flashSize"] = ESP.getFlashChipSize(); doc["fsTotal"] = store_->totalBytes(); doc["fsUsed"] = store_->usedBytes();
  JsonObject hardware = doc["hardware"].to<JsonObject>(); hardware["chip"] = ESP.getChipModel(); hardware["cores"] = ESP.getChipCores(); hardware["revision"] = ESP.getChipRevision();
  doc["setupApSsid"] = identity_->setupSsid(); doc["setupApPassword"] = identity_->setupPassword();
  String body; serializeJson(doc, body); String response;
  if (!postJson("/api/esp32/device/register", body, response, false)) return false;
  JsonDocument parsed; if (deserializeJson(parsed, response)) { setStatus(ApiConnectionStatus::RegistrationError); return false; }
  String giftStatus = parsed["giftStatus"] | "";
  setStatus(giftStatus == "pending" ? ApiConnectionStatus::WaitingGiftAcceptance : ApiConnectionStatus::Registered);
  Serial.println("Device registration successful.");
  return true;
}

bool ApiClient::createPairing(const char pin[5]) {
  JsonDocument doc; doc["pin"] = pin; String body; serializeJson(doc, body); String response;
  bool success = postJson("/api/esp32/device/pairing", body, response); if (success) Serial.println("Pairing published."); return success;
}

bool ApiClient::poll(JsonDocument& command) {
  JsonDocument doc; addState(doc.to<JsonObject>()); String body; serializeJson(doc, body); String response;
  if (!postJson("/api/esp32/device/poll", body, response)) return false;
  JsonDocument parsed; if (deserializeJson(parsed, response)) return false;
  String giftStatus = parsed["giftStatus"] | "";
  if (giftStatus == "pending") setStatus(ApiConnectionStatus::WaitingGiftAcceptance);
  else { setStatus(ApiConnectionStatus::Ready); if (giftStatus == "wifi_reset_sent") Serial.println("Ready for gift recipient."); }
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
  int status = http.GET(); if (status != 206) { setStatus(status < 0 || status >= 500 ? ApiConnectionStatus::ServerUnavailable : ApiConnectionStatus::RegistrationError, status); http.end(); return -1; }
  int expected = http.getSize(); if (expected < 1 || static_cast<size_t>(expected) > length) { http.end(); return -1; }
  WiFiClient* stream = http.getStreamPtr(); size_t read = stream->readBytes(buffer, expected); http.end(); return read == static_cast<size_t>(expected) ? expected : -1;
}

void ApiClient::setStatus(ApiConnectionStatus value, int httpStatus) {
  portENTER_CRITICAL(&statusMux_); bool changed = status_ != value || (httpStatus && lastHttpStatus_ != httpStatus); status_ = value; if (httpStatus) lastHttpStatus_ = httpStatus; portEXIT_CRITICAL(&statusMux_);
  if (changed && httpStatus) { Serial.print("Backend error "); Serial.println(httpStatus); }
}

ApiConnectionStatus ApiClient::status() const { portENTER_CRITICAL(&statusMux_); ApiConnectionStatus value = status_; portEXIT_CRITICAL(&statusMux_); return value; }
int ApiClient::lastHttpStatus() const { portENTER_CRITICAL(&statusMux_); int value = lastHttpStatus_; portEXIT_CRITICAL(&statusMux_); return value; }
const char* ApiClient::statusCode(ApiConnectionStatus value) const {
  switch (value) {
    case ApiConnectionStatus::WaitingForInternet: return "no_internet"; case ApiConnectionStatus::TlsError: return "tls_error";
    case ApiConnectionStatus::ServerUnavailable: return "server_unavailable"; case ApiConnectionStatus::RegistrationError: return "registration_error";
    case ApiConnectionStatus::Registered: return "registered"; case ApiConnectionStatus::WaitingGiftAcceptance: return "waiting_gift_acceptance";
    case ApiConnectionStatus::Ready: return "ready";
  }
  return "no_internet";
}
