#include "CommandProcessor.hpp"
#include <esp_idf_version.h>
#include <mbedtls/sha256.h>
#include "AppConfig.hpp"

void CommandProcessor::begin(ApiClient& api, FileStore& store, Settings& settings, AnimationEngine& animation, WifiProvisioning& wifi) {
  api_ = &api; store_ = &store; settings_ = &settings; animation_ = &animation; wifi_ = &wifi;
  commandQueue_ = xQueueCreate(2, sizeof(QueuedCommand*));
  networkQueue_ = xQueueCreate(8, sizeof(NetworkJob));
  resultQueue_ = xQueueCreate(4, sizeof(NetworkResult));
}

bool CommandProcessor::enqueue(JsonObject command) {
  if (!commandQueue_) return false;
  size_t length = measureJson(command);
  if (!length || length >= 4096) return false;
  QueuedCommand* queued = static_cast<QueuedCommand*>(calloc(1, sizeof(QueuedCommand)));
  if (!queued) return false;
  serializeJson(command, queued->json, sizeof(queued->json));
  if (xQueueSend(commandQueue_, &queued, 0) == pdTRUE) return true;
  free(queued); return false;
}

void CommandProcessor::accept(JsonObject command) {
  if (busy()) return;
  String id = command["id"] | ""; if (id.isEmpty()) return;
  if (id == settings_->lastCommandId()) { commandId_ = id; finish(true); return; }
  execute(command);
}

void CommandProcessor::execute(JsonObject command) {
  commandId_ = String(command["id"] | ""); String type = String(command["type"] | ""); JsonObject payload = command["payload"];
  int slot = payload["slot"] | -1;
  if (type == "upload_asset") {
    expectedSize_ = payload["size"] | 0; expectedSha_ = String(payload["sha256"] | "");
    if (slot < 0 || slot >= AppConfig::SlotCount || expectedSize_ < 16 || expectedSize_ > AppConfig::MaxAssetBytes || expectedSha_.length() != 64) { finish(false, "invalid upload metadata"); return; }
    size_t existing = store_->tempSize(slot);
    if (store_->totalBytes() - store_->usedBytes() < expectedSize_ + 4096 && existing == 0) { finish(false, "not enough LittleFS space"); return; }
    targetSlot_ = slot; pendingMeta_ = SlotMeta(); pendingMeta_.slot = slot; pendingMeta_.present = true;
    pendingMeta_.name = String(payload["name"] | "Animation"); pendingMeta_.size = expectedSize_; pendingMeta_.sha256 = expectedSha_;
    pendingMeta_.frameCount = payload["frameCount"] | 0; pendingMeta_.durationMs = payload["durationMs"] | 0; pendingMeta_.loop = payload["loop"] | true;
    pendingMeta_.previewBase64 = String(payload["previewBase64"] | ""); pendingMeta_.buttonType = "next";
    if (!store_->prepareTemp(targetSlot_, expectedSize_)) { finish(false, "cannot open temporary file"); return; }
    NetworkJob job = {}; job.type = NetworkJobType::Download; job.slot = targetSlot_; job.expectedSize = expectedSize_;
    snprintf(job.commandId, sizeof(job.commandId), "%s", commandId_.c_str()); snprintf(job.value, sizeof(job.value), "%s", expectedSha_.c_str());
    setBusy(true);
    if (!queueNetworkJob(job)) finish(false, "network queue unavailable");
    return;
  }
  bool ok = true;
  if (type == "delete_asset") {
    bool wasActive = slot >= 0 && animation_->stopForSlot(slot);
    ok = slot >= 0 && store_->removeSlot(slot);
    if (wasActive) { int next = store_->nextPresent(slot); settings_->setActiveSlot(next); if (next >= 0) animation_->play(next); }
  }
  else if (type == "rename_asset") ok = slot >= 0 && store_->renameSlot(slot, String(payload["name"] | "Animation"));
  else if (type == "set_active") { ok = slot >= 0 && animation_->play(slot); if (ok) settings_->setActiveSlot(slot); }
  else if (type == "set_settings") {
    if (payload["brightness"].is<int>()) settings_->setBrightness(constrain(payload["brightness"].as<int>(), 0, 255));
    if (payload["speedMultiplier"].is<float>()) { float speed = constrain(payload["speedMultiplier"].as<float>(), .25f, 4.0f); settings_->setSpeedMultiplier(speed); animation_->setSpeed(speed); }
    if (slot >= 0 && payload["buttonAction"].is<JsonObject>()) { JsonObject action = payload["buttonAction"]; ok = store_->updateButton(slot, String(action["type"] | "next"), action["alternateSlot"] | -1, String(action["eventName"] | "button.press")); }
  } else if (type == "request_manifest") {}
  else if (type == "reboot") pendingRebootCommandId_ = commandId_;
  else if (type == "reset_wifi") { clearWifiOnReboot_ = true; pendingRebootCommandId_ = commandId_; }
  else ok = false;
  finish(ok, ok ? "" : "command rejected");
}

bool CommandProcessor::verifyTemp(const NetworkJob& job) {
  if (store_->tempSize(job.slot) != job.expectedSize) return false;
  mbedtls_sha256_context context; mbedtls_sha256_init(&context);
#if ESP_IDF_VERSION_MAJOR >= 5
  mbedtls_sha256_starts(&context, 0);
  for (size_t offset = 0; offset < job.expectedSize;) { size_t count = store_->readTemp(job.slot, offset, chunk_, min(static_cast<size_t>(512), job.expectedSize - offset)); if (!count) { mbedtls_sha256_free(&context); return false; } mbedtls_sha256_update(&context, chunk_, count); offset += count; vTaskDelay(1); }
  uint8_t digest[32]; mbedtls_sha256_finish(&context, digest);
#else
  mbedtls_sha256_starts_ret(&context, 0);
  for (size_t offset = 0; offset < job.expectedSize;) { size_t count = store_->readTemp(job.slot, offset, chunk_, min(static_cast<size_t>(512), job.expectedSize - offset)); if (!count) { mbedtls_sha256_free(&context); return false; } mbedtls_sha256_update_ret(&context, chunk_, count); offset += count; vTaskDelay(1); }
  uint8_t digest[32]; mbedtls_sha256_finish_ret(&context, digest);
#endif
  mbedtls_sha256_free(&context);
  char hex[65]; for (int index = 0; index < 32; ++index) snprintf(hex + index * 2, 3, "%02x", digest[index]); hex[64] = 0;
  return String(job.value).equalsIgnoreCase(hex);
}

void CommandProcessor::tick() {
  if (rebootAt_ && static_cast<int32_t>(millis() - rebootAt_) >= 0) { if (clearWifiOnReboot_) settings_->clearWifi(); ESP.restart(); }
  NetworkResult result = {};
  while (resultQueue_ && xQueueReceive(resultQueue_, &result, 0) == pdTRUE) {
    if (result.type == ResultType::Acknowledge) {
      if (pendingRebootCommandId_ == result.value) { rebootAt_ = millis() + (result.success ? 250 : 2000); pendingRebootCommandId_ = ""; }
    } else if (result.type == ResultType::Pairing) { pairingQueued_ = false; pairingPublished_ = result.success; }
    else if (result.type == ResultType::Event) {
      eventQueued_ = false;
      if (result.success && settings_->pendingEvent() == result.value) settings_->setPendingEvent("");
    } else if (result.type == ResultType::Download) {
      bool ok = result.success;
      String error = result.value;
      if (ok) {
        bool wasActive = animation_->stopForSlot(targetSlot_);
        ok = store_->commitTemp(targetSlot_, pendingMeta_);
        if (ok && (wasActive || animation_->currentSlot() < 0)) { settings_->setActiveSlot(targetSlot_); animation_->play(targetSlot_); }
        if (!ok) { error = "atomic install failed"; if (wasActive) animation_->play(targetSlot_); }
      } else store_->removeTemp(targetSlot_);
      finish(ok, ok ? "" : error);
    }
  }

  if (!eventQueued_) {
    String event = settings_->pendingEvent();
    if (!event.isEmpty()) {
      NetworkJob job = {}; job.type = NetworkJobType::Event; snprintf(job.value, sizeof(job.value), "%s", event.c_str());
      eventQueued_ = queueNetworkJob(job);
    }
  }

  if (busy() || !commandQueue_) return;
  QueuedCommand* queued = nullptr;
  if (xQueueReceive(commandQueue_, &queued, 0) == pdTRUE && queued) {
    JsonDocument command;
    DeserializationError error = deserializeJson(command, queued->json);
    free(queued);
    if (!error) accept(command.as<JsonObject>());
  }
}

void CommandProcessor::finish(bool success, const String& error) {
  setBusy(false);
  if (success) settings_->setLastCommandId(commandId_);
  NetworkJob job = {}; job.type = NetworkJobType::Acknowledge; job.success = success;
  snprintf(job.commandId, sizeof(job.commandId), "%s", commandId_.c_str()); snprintf(job.value, sizeof(job.value), "%s", error.c_str());
  queueNetworkJob(job);
}

bool CommandProcessor::download(const NetworkJob& job) {
  size_t offset = store_->tempSize(job.slot);
  while (offset < job.expectedSize) {
    if (!wifi_->online()) { vTaskDelay(pdMS_TO_TICKS(250)); continue; }
    size_t wanted = min(static_cast<size_t>(AppConfig::DownloadChunkBytes), job.expectedSize - offset);
    int received = api_->downloadChunk(job.commandId, offset, chunk_, wanted);
    if (received < 0) { vTaskDelay(pdMS_TO_TICKS(250)); continue; }
    if (!store_->appendTemp(job.slot, chunk_, static_cast<size_t>(received))) return false;
    offset += static_cast<size_t>(received);
    vTaskDelay(1);
  }
  return verifyTemp(job);
}

bool CommandProcessor::processNetworkJob() {
  if (!networkQueue_) return false;
  NetworkJob job = {};
  if (xQueueReceive(networkQueue_, &job, 0) != pdTRUE) return false;
  if (job.type == NetworkJobType::Acknowledge) {
    bool acknowledged = false;
    for (uint8_t attempt = 0; attempt < 3 && !acknowledged; ++attempt) {
      acknowledged = api_->acknowledge(job.commandId, job.success, job.value);
      if (!acknowledged) vTaskDelay(pdMS_TO_TICKS(250));
    }
    NetworkResult result = {}; result.type = ResultType::Acknowledge; result.success = acknowledged; snprintf(result.value, sizeof(result.value), "%s", job.commandId);
    xQueueSend(resultQueue_, &result, portMAX_DELAY); return true;
  }
  NetworkResult result = {};
  if (job.type == NetworkJobType::Download) {
    result.type = ResultType::Download; result.success = download(job);
    snprintf(result.value, sizeof(result.value), "%s", result.success ? "" : "download or SHA-256 verification failed");
  } else if (job.type == NetworkJobType::Pairing) {
    result.type = ResultType::Pairing;
    result.success = static_cast<int32_t>(job.expiresAt - millis()) > 0 && api_->createPairing(job.value);
  } else {
    result.type = ResultType::Event; result.success = api_->sendEvent(job.value); snprintf(result.value, sizeof(result.value), "%s", job.value);
  }
  xQueueSend(resultQueue_, &result, portMAX_DELAY);
  return true;
}

void CommandProcessor::requestPairing(const char pin[5], uint32_t expiresAt) {
  if (pairingQueued_ || pairingPublished_) return;
  NetworkJob job = {}; job.type = NetworkJobType::Pairing; job.expiresAt = expiresAt; snprintf(job.value, sizeof(job.value), "%s", pin);
  pairingQueued_ = queueNetworkJob(job);
}

void CommandProcessor::resetPairing() { pairingQueued_ = false; pairingPublished_ = false; }
bool CommandProcessor::queueNetworkJob(const NetworkJob& job) { return networkQueue_ && xQueueSend(networkQueue_, &job, 0) == pdTRUE; }
void CommandProcessor::setBusy(bool busyValue) { portENTER_CRITICAL(&stateMux_); transferActive_ = busyValue; portEXIT_CRITICAL(&stateMux_); }
bool CommandProcessor::busy() const { portENTER_CRITICAL(&stateMux_); bool value = transferActive_; portEXIT_CRITICAL(&stateMux_); return value; }
