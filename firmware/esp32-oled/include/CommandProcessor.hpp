#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include "AnimationEngine.hpp"
#include "ApiClient.hpp"
#include "FileStore.hpp"
#include "Settings.hpp"
#include "WifiProvisioning.hpp"

class CommandProcessor {
 public:
  void begin(ApiClient& api, FileStore& store, Settings& settings, AnimationEngine& animation, WifiProvisioning& wifi);
  bool busy() const;
  bool enqueue(JsonObject command);
  bool processNetworkJob();
  void requestPairing(const char pin[5], uint32_t expiresAt);
  bool pairingPublished() const { return pairingPublished_; }
  void resetPairing();
  void tick();
 private:
  enum class NetworkJobType : uint8_t { Acknowledge, Download, Pairing, Event };
  enum class ResultType : uint8_t { Download, Pairing, Event };
  struct QueuedCommand { char json[4096]; };
  struct NetworkJob {
    NetworkJobType type;
    char commandId[40];
    char value[96];
    bool success;
    uint8_t slot;
    size_t expectedSize;
    uint32_t expiresAt;
  };
  struct NetworkResult {
    ResultType type;
    bool success;
    char value[96];
  };
  void accept(JsonObject command);
  void execute(JsonObject command);
  void finish(bool success, const String& error = "");
  bool download(const NetworkJob& job);
  bool verifyTemp(const NetworkJob& job);
  bool queueNetworkJob(const NetworkJob& job);
  void setBusy(bool busy);
  ApiClient* api_ = nullptr; FileStore* store_ = nullptr; Settings* settings_ = nullptr; AnimationEngine* animation_ = nullptr; WifiProvisioning* wifi_ = nullptr;
  bool transferActive_ = false;
  bool pairingQueued_ = false;
  bool pairingPublished_ = false;
  bool eventQueued_ = false;
  String commandId_; String expectedSha_; size_t expectedSize_ = 0; uint8_t targetSlot_ = 0; SlotMeta pendingMeta_;
  QueueHandle_t commandQueue_ = nullptr;
  QueueHandle_t networkQueue_ = nullptr;
  QueueHandle_t resultQueue_ = nullptr;
  mutable portMUX_TYPE stateMux_ = portMUX_INITIALIZER_UNLOCKED;
  uint8_t chunk_[AppConfig::DownloadChunkBytes];
  uint32_t rebootAt_ = 0;
  bool clearWifiOnReboot_ = false;
};

