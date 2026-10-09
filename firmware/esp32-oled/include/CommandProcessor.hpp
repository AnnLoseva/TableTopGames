#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>
#include "AnimationEngine.hpp"
#include "ApiClient.hpp"
#include "FileStore.hpp"
#include "Settings.hpp"
#include "WifiProvisioning.hpp"

class CommandProcessor {
 public:
  void begin(ApiClient& api, FileStore& store, Settings& settings, AnimationEngine& animation, WifiProvisioning& wifi);
  bool busy() const { return transferActive_; }
  void accept(JsonObject command);
  void tick();
 private:
  void execute(JsonObject command);
  void finish(bool success, const String& error = "");
  bool verifyTemp();
  ApiClient* api_ = nullptr; FileStore* store_ = nullptr; Settings* settings_ = nullptr; AnimationEngine* animation_ = nullptr; WifiProvisioning* wifi_ = nullptr;
  bool transferActive_ = false;
  String commandId_; String expectedSha_; size_t expectedSize_ = 0; uint8_t targetSlot_ = 0; SlotMeta pendingMeta_;
  uint8_t chunk_[AppConfig::DownloadChunkBytes];
  uint32_t rebootAt_ = 0;
  bool clearWifiOnReboot_ = false;
};

