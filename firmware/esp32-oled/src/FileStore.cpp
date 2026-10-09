#include "FileStore.hpp"

String FileStore::slotPath(uint8_t slot) const { return "/slot" + String(slot) + ".oled"; }
String FileStore::tempPath(uint8_t slot) const { return "/slot" + String(slot) + ".tmp"; }

bool FileStore::begin() {
  if (!LittleFS.begin(true)) return false;
  for (uint8_t index = 0; index < AppConfig::SlotCount; ++index) slots_[index].slot = index;
  return loadManifest();
}

bool FileStore::loadManifest() {
  if (!LittleFS.exists("/manifest.json")) return true;
  File file = LittleFS.open("/manifest.json", "r"); if (!file) return false;
  JsonDocument doc; DeserializationError error = deserializeJson(doc, file); file.close(); if (error) return false;
  for (JsonObject item : doc.as<JsonArray>()) {
    int index = item["slot"] | -1; if (index < 0 || index >= AppConfig::SlotCount || !LittleFS.exists(slotPath(index))) continue;
    SlotMeta& meta = slots_[index]; meta.present = true; meta.name = String(item["name"] | "Animation");
    meta.size = item["size"] | 0; meta.sha256 = String(item["sha256"] | ""); meta.frameCount = item["frameCount"] | 0;
    meta.durationMs = item["durationMs"] | 0; meta.loop = item["loop"] | true; meta.previewBase64 = String(item["previewBase64"] | "");
    JsonObject action = item["buttonAction"]; meta.buttonType = String(action["type"] | "next");
    meta.alternateSlot = action["alternateSlot"] | -1; meta.eventName = String(action["eventName"] | "button.press");
  }
  return true;
}

void FileStore::addManifest(JsonArray array) const {
  for (uint8_t index = 0; index < AppConfig::SlotCount; ++index) {
    const SlotMeta& meta = slots_[index]; if (!meta.present) continue;
    JsonObject item = array.add<JsonObject>(); item["slot"] = index; item["name"] = meta.name; item["size"] = meta.size;
    item["sha256"] = meta.sha256; item["frameCount"] = meta.frameCount; item["durationMs"] = meta.durationMs; item["loop"] = meta.loop;
    if (!meta.previewBase64.isEmpty()) item["previewBase64"] = meta.previewBase64;
    JsonObject action = item["buttonAction"].to<JsonObject>(); action["type"] = meta.buttonType;
    if (meta.alternateSlot >= 0) action["alternateSlot"] = meta.alternateSlot;
    if (!meta.eventName.isEmpty()) action["eventName"] = meta.eventName;
  }
}

bool FileStore::saveManifest() {
  JsonDocument doc; addManifest(doc.to<JsonArray>());
  File temp = LittleFS.open("/manifest.tmp", "w"); if (!temp) return false;
  bool written = serializeJson(doc, temp) > 0; temp.flush(); temp.close(); if (!written) { LittleFS.remove("/manifest.tmp"); return false; }
  LittleFS.remove("/manifest.bak"); if (LittleFS.exists("/manifest.json")) LittleFS.rename("/manifest.json", "/manifest.bak");
  if (!LittleFS.rename("/manifest.tmp", "/manifest.json")) { if (LittleFS.exists("/manifest.bak")) LittleFS.rename("/manifest.bak", "/manifest.json"); return false; }
  LittleFS.remove("/manifest.bak"); return true;
}

bool FileStore::commitTemp(uint8_t index, const SlotMeta& meta) {
  if (index >= AppConfig::SlotCount || !LittleFS.exists(tempPath(index))) return false;
  String finalPath = slotPath(index); String backup = finalPath + ".bak"; LittleFS.remove(backup);
  if (LittleFS.exists(finalPath) && !LittleFS.rename(finalPath, backup)) return false;
  if (!LittleFS.rename(tempPath(index), finalPath)) { if (LittleFS.exists(backup)) LittleFS.rename(backup, finalPath); return false; }
  slots_[index] = meta; slots_[index].present = true; slots_[index].slot = index;
  if (!saveManifest()) { LittleFS.remove(finalPath); if (LittleFS.exists(backup)) LittleFS.rename(backup, finalPath); return false; }
  LittleFS.remove(backup); return true;
}

bool FileStore::removeSlot(uint8_t index) {
  if (index >= AppConfig::SlotCount) return false;
  LittleFS.remove(slotPath(index)); LittleFS.remove(tempPath(index)); slots_[index] = SlotMeta(); slots_[index].slot = index; return saveManifest();
}
bool FileStore::renameSlot(uint8_t index, const String& name) { if (index >= AppConfig::SlotCount || !slots_[index].present) return false; slots_[index].name = name.substring(0, 48); return saveManifest(); }
bool FileStore::updateButton(uint8_t index, const String& type, int alternateSlot, const String& eventName) {
  if (index >= AppConfig::SlotCount || !slots_[index].present) return false;
  slots_[index].buttonType = type; slots_[index].alternateSlot = alternateSlot; slots_[index].eventName = eventName.substring(0, 64); return saveManifest();
}
int FileStore::nextPresent(int current) const {
  for (int step = 1; step <= AppConfig::SlotCount; ++step) { int index = (current + step) % AppConfig::SlotCount; if (slots_[index].present) return index; }
  return -1;
}

