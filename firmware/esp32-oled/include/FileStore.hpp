#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
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
  SlotMeta& slot(uint8_t index) { return slots_[index]; }
  const SlotMeta& slot(uint8_t index) const { return slots_[index]; }
  int nextPresent(int current) const;
  String slotPath(uint8_t slot) const;
  String tempPath(uint8_t slot) const;
  bool commitTemp(uint8_t slot, const SlotMeta& meta);
  bool removeSlot(uint8_t slot);
  bool renameSlot(uint8_t slot, const String& name);
  bool updateButton(uint8_t slot, const String& type, int alternateSlot, const String& eventName);
  void addManifest(JsonArray array) const;
  size_t totalBytes() const { return LittleFS.totalBytes(); }
  size_t usedBytes() const { return LittleFS.usedBytes(); }
 private:
  bool loadManifest();
  bool saveManifest();
  SlotMeta slots_[AppConfig::SlotCount];
};

