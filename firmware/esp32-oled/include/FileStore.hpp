#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include "AppConfig.hpp"

struct SlotMeta {
  bool present = false;
  uint8_t slot = 0;
  String name;
  size_t size = 0;
  String sha256;
  uint16_t frameCount = 0;
  uint32_t durationMs = 0;
  bool loop = true;
  String previewBase64;
  String buttonType = "next";
  int alternateSlot = -1;
  String eventName = "button.press";
};

class FileStore {
 public:
  bool begin();
  SlotMeta slotCopy(uint8_t index) const;
  int nextPresent(int current) const;
  String slotPath(uint8_t slot) const;
  String tempPath(uint8_t slot) const;
  bool prepareTemp(uint8_t slot, size_t expectedSize);
  size_t tempSize(uint8_t slot) const;
  bool appendTemp(uint8_t slot, const uint8_t* data, size_t length);
  size_t readTemp(uint8_t slot, size_t offset, uint8_t* data, size_t length) const;
  void removeTemp(uint8_t slot);
  bool commitTemp(uint8_t slot, const SlotMeta& meta);
  bool removeSlot(uint8_t slot);
  bool renameSlot(uint8_t slot, const String& name);
  bool updateButton(uint8_t slot, const String& type, int alternateSlot, const String& eventName);
  void addManifest(JsonArray array) const;
  size_t totalBytes() const;
  size_t usedBytes() const;
  bool lock(TickType_t timeout = portMAX_DELAY) const;
  void unlock() const;
 private:
  bool loadManifest();
  bool saveManifest();
  SlotMeta slots_[AppConfig::SlotCount];
  mutable SemaphoreHandle_t mutex_ = nullptr;
};

