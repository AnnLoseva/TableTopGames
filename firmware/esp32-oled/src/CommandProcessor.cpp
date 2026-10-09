#include "CommandProcessor.hpp"
#include <esp_idf_version.h>
#include <mbedtls/sha256.h>
#include "AppConfig.hpp"

void CommandProcessor::begin(ApiClient& api, FileStore& store, Settings& settings, AnimationEngine& animation, WifiProvisioning& wifi) {
  api_ = &api; store_ = &store; settings_ = &settings; animation_ = &animation; wifi_ = &wifi;
}

void CommandProcessor::accept(JsonObject command) {
  if (transferActive_) return;
  String id = command["id"] | ""; if (id.isEmpty()) return;
  if (id == settings_->lastCommandId()) { api_->acknowledge(id, true); return; }
  execute(command);
}

void CommandProcessor::execute(JsonObject command) {
  commandId_ = String(command["id"] | ""); String type = String(command["type"] | ""); JsonObject payload = command["payload"];
  int slot = payload["slot"] | -1;
  if (type == "upload_asset") {
    expectedSize_ = payload["size"] | 0; expectedSha_ = String(payload["sha256"] | "");
    if (slot < 0 || slot >= AppConfig::SlotCount || expectedSize_ < 16 || expectedSize_ > AppConfig::MaxAssetBytes || expectedSha_.length() != 64) { finish(false, "invalid upload metadata"); return; }
    if (store_->totalBytes() - store_->usedBytes() < expectedSize_ + 4096 && LittleFS.exists(store_->tempPath(slot)) == false) { finish(false, "not enough LittleFS space"); return; }
    targetSlot_ = slot; pendingMeta_ = SlotMeta(); pendingMeta_.slot = slot; pendingMeta_.present = true;
    pendingMeta_.name = String(payload["name"] | "Animation"); pendingMeta_.size = expectedSize_; pendingMeta_.sha256 = expectedSha_;
    pendingMeta_.frameCount = payload["frameCount"] | 0; pendingMeta_.durationMs = payload["durationMs"] | 0; pendingMeta_.loop = payload["loop"] | true;
    pendingMeta_.previewBase64 = String(payload["previewBase64"] | ""); pendingMeta_.buttonType = "next";
    File temp = LittleFS.open(store_->tempPath(targetSlot_), "a"); if (!temp) { finish(false, "cannot open temporary file"); return; }
    if (temp.size() > expectedSize_) { temp.close(); LittleFS.remove(store_->tempPath(targetSlot_)); temp = LittleFS.open(store_->tempPath(targetSlot_), "w"); }
    temp.close(); transferActive_ = true; return;
  }
  bool ok = true;
  if (type == "delete_asset") { ok = slot >= 0 && store_->removeSlot(slot); if (animation_->currentSlot() == slot) { int next = store_->nextPresent(slot); settings_->setActiveSlot(next); if (next >= 0) animation_->play(next); } }
  else if (type == "rename_asset") ok = slot >= 0 && store_->renameSlot(slot, String(payload["name"] | "Animation"));
  else if (type == "set_active") { ok = slot >= 0 && animation_->play(slot); if (ok) settings_->setActiveSlot(slot); }
  else if (type == "set_settings") {
    if (payload["brightness"].is<int>()) settings_->setBrightness(constrain(payload["brightness"].as<int>(), 0, 255));
    if (payload["speedMultiplier"].is<float>()) { float speed = constrain(payload["speedMultiplier"].as<float>(), .25f, 4.0f); settings_->setSpeedMultiplier(speed); animation_->setSpeed(speed); }
    if (slot >= 0 && payload["buttonAction"].is<JsonObject>()) { JsonObject action = payload["buttonAction"]; ok = store_->updateButton(slot, String(action["type"] | "next"), action["alternateSlot"] | -1, String(action["eventName"] | "button.press")); }
  } else if (type == "request_manifest") {}
  else if (type == "reboot") rebootAt_ = millis() + 1000;
  else if (type == "reset_wifi") { clearWifiOnReboot_ = true; rebootAt_ = millis() + 1000; }
  else ok = false;
  finish(ok, ok ? "" : "command rejected");
}

bool CommandProcessor::verifyTemp() {
  File file = LittleFS.open(store_->tempPath(targetSlot_), "r"); if (!file || file.size() != expectedSize_) return false;
  mbedtls_sha256_context context; mbedtls_sha256_init(&context);
#if ESP_IDF_VERSION_MAJOR >= 5
  mbedtls_sha256_starts(&context, 0);
  while (file.available()) { size_t count = file.read(chunk_, sizeof(chunk_)); if (!count) break; mbedtls_sha256_update(&context, chunk_, count); }
  uint8_t digest[32]; mbedtls_sha256_finish(&context, digest);
#else
  mbedtls_sha256_starts_ret(&context, 0);
  while (file.available()) { size_t count = file.read(chunk_, sizeof(chunk_)); if (!count) break; mbedtls_sha256_update_ret(&context, chunk_, count); }
  uint8_t digest[32]; mbedtls_sha256_finish_ret(&context, digest);
#endif
  mbedtls_sha256_free(&context); file.close();
  char hex[65]; for (int index = 0; index < 32; ++index) snprintf(hex + index * 2, 3, "%02x", digest[index]); hex[64] = 0;
  return expectedSha_.equalsIgnoreCase(hex);
}

void CommandProcessor::tick() {
  if (rebootAt_ && static_cast<int32_t>(millis() - rebootAt_) >= 0) { if (clearWifiOnReboot_) settings_->clearWifi(); ESP.restart(); }
  if (!transferActive_) return;
  File temp = LittleFS.open(store_->tempPath(targetSlot_), "a"); if (!temp) { finish(false, "temporary file unavailable"); return; }
  size_t offset = temp.size();
  if (offset < expectedSize_) {
    size_t wanted = min(static_cast<size_t>(AppConfig::DownloadChunkBytes), expectedSize_ - offset);
    int received = api_->downloadChunk(commandId_, offset, chunk_, wanted);
    if (received < 0) { temp.close(); return; }
    size_t written = temp.write(chunk_, received); temp.flush(); temp.close(); if (written != static_cast<size_t>(received)) finish(false, "LittleFS write failed"); return;
  }
  temp.close();
  if (!verifyTemp()) { LittleFS.remove(store_->tempPath(targetSlot_)); finish(false, "SHA-256 mismatch"); return; }
  if (!store_->commitTemp(targetSlot_, pendingMeta_)) { finish(false, "atomic install failed"); return; }
  if (animation_->currentSlot() < 0) { settings_->setActiveSlot(targetSlot_); animation_->play(targetSlot_); }
  finish(true);
}

void CommandProcessor::finish(bool success, const String& error) {
  transferActive_ = false;
  if (success) settings_->setLastCommandId(commandId_);
  api_->acknowledge(commandId_, success, error);
}
