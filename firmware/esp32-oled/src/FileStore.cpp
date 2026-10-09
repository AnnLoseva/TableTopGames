#include "FileStore.hpp"

namespace {
class FileStoreLock {
 public:
  explicit FileStoreLock(const FileStore& store) : store_(store), locked_(store_.lock()) {}
  ~FileStoreLock() { if (locked_) store_.unlock(); }
  bool locked() const { return locked_; }
 private:
  const FileStore& store_;
  bool locked_;
};
}

String FileStore::slotPath(uint8_t slot) const { return "/slot" + String(slot) + ".oled"; }
String FileStore::tempPath(uint8_t slot) const { return "/slot" + String(slot) + ".tmp"; }

bool FileStore::begin() {
  mutex_ = xSemaphoreCreateRecursiveMutex();
  if (!mutex_) return false;
  FileStoreLock guard(*this); if (!guard.locked()) return false;
  if (!LittleFS.begin(true)) return false;
  for (uint8_t index = 0; index < AppConfig::SlotCount; ++index) slots_[index].slot = index;
  return loadManifest();
}

bool FileStore::lock(TickType_t timeout) const {
  return mutex_ && xSemaphoreTakeRecursive(mutex_, timeout) == pdTRUE;
}

void FileStore::unlock() const {
  if (mutex_) xSemaphoreGiveRecursive(mutex_);
}

SlotMeta FileStore::slotCopy(uint8_t index) const {
  FileStoreLock guard(*this);
  if (!guard.locked() || index >= AppConfig::SlotCount) return SlotMeta();
  return slots_[index];
}

bool FileStore::loadManifest() {
  FileStoreLock guard(*this); if (!guard.locked()) return false;
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
  FileStoreLock guard(*this); if (!guard.locked()) return;
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
  FileStoreLock guard(*this); if (!guard.locked()) return false;
  JsonDocument doc; addManifest(doc.to<JsonArray>());
  File temp = LittleFS.open("/manifest.tmp", "w"); if (!temp) return false;
  bool written = serializeJson(doc, temp) > 0; temp.flush(); temp.close(); if (!written) { LittleFS.remove("/manifest.tmp"); return false; }
  LittleFS.remove("/manifest.bak"); if (LittleFS.exists("/manifest.json")) LittleFS.rename("/manifest.json", "/manifest.bak");
  if (!LittleFS.rename("/manifest.tmp", "/manifest.json")) { if (LittleFS.exists("/manifest.bak")) LittleFS.rename("/manifest.bak", "/manifest.json"); return false; }
  LittleFS.remove("/manifest.bak"); return true;
}

bool FileStore::prepareTemp(uint8_t index, size_t expectedSize) {
  FileStoreLock guard(*this); if (!guard.locked() || index >= AppConfig::SlotCount) return false;
  File temp = LittleFS.open(tempPath(index), "a"); if (!temp) return false;
  if (temp.size() > expectedSize) {
    temp.close(); LittleFS.remove(tempPath(index)); temp = LittleFS.open(tempPath(index), "w");
  }
  bool ok = static_cast<bool>(temp); temp.close(); return ok;
}

size_t FileStore::tempSize(uint8_t index) const {
  FileStoreLock guard(*this); if (!guard.locked() || index >= AppConfig::SlotCount) return 0;
  File temp = LittleFS.open(tempPath(index), "r"); if (!temp) return 0;
  size_t size = temp.size(); temp.close(); return size;
}

bool FileStore::appendTemp(uint8_t index, const uint8_t* data, size_t length) {
  if (index >= AppConfig::SlotCount || !lock()) return false;
  File temp = LittleFS.open(tempPath(index), "a");
  unlock();
  if (!temp) return false;

  constexpr size_t WriteSliceBytes = 256;
  size_t offset = 0;
  while (offset < length) {
    size_t wanted = min(WriteSliceBytes, length - offset);
    if (!lock()) return false;
    size_t written = temp.write(data + offset, wanted);
    unlock();
    if (written != wanted) { if (lock()) { temp.close(); unlock(); } return false; }
    offset += written;
    vTaskDelay(1);
  }
  if (!lock()) return false;
  temp.flush(); temp.close(); unlock(); return true;
}

size_t FileStore::readTemp(uint8_t index, size_t offset, uint8_t* data, size_t length) const {
  FileStoreLock guard(*this); if (!guard.locked() || index >= AppConfig::SlotCount) return 0;
  File temp = LittleFS.open(tempPath(index), "r"); if (!temp || !temp.seek(offset)) { temp.close(); return 0; }
  size_t read = temp.read(data, length); temp.close(); return read;
}

void FileStore::removeTemp(uint8_t index) {
  FileStoreLock guard(*this); if (guard.locked() && index < AppConfig::SlotCount) LittleFS.remove(tempPath(index));
}

bool FileStore::commitTemp(uint8_t index, const SlotMeta& meta) {
  FileStoreLock guard(*this); if (!guard.locked()) return false;
  if (index >= AppConfig::SlotCount || !LittleFS.exists(tempPath(index))) return false;
  String finalPath = slotPath(index); String backup = finalPath + ".bak"; LittleFS.remove(backup);
  if (LittleFS.exists(finalPath) && !LittleFS.rename(finalPath, backup)) return false;
  if (!LittleFS.rename(tempPath(index), finalPath)) { if (LittleFS.exists(backup)) LittleFS.rename(backup, finalPath); return false; }
  slots_[index] = meta; slots_[index].present = true; slots_[index].slot = index;
  if (!saveManifest()) { LittleFS.remove(finalPath); if (LittleFS.exists(backup)) LittleFS.rename(backup, finalPath); return false; }
  LittleFS.remove(backup); return true;
}

bool FileStore::removeSlot(uint8_t index) {
  FileStoreLock guard(*this); if (!guard.locked()) return false;
  if (index >= AppConfig::SlotCount) return false;
  LittleFS.remove(slotPath(index)); LittleFS.remove(tempPath(index)); slots_[index] = SlotMeta(); slots_[index].slot = index; return saveManifest();
}
bool FileStore::renameSlot(uint8_t index, const String& name) { FileStoreLock guard(*this); if (!guard.locked() || index >= AppConfig::SlotCount || !slots_[index].present) return false; slots_[index].name = name.substring(0, 48); return saveManifest(); }
bool FileStore::updateButton(uint8_t index, const String& type, int alternateSlot, const String& eventName) {
  FileStoreLock guard(*this); if (!guard.locked() || index >= AppConfig::SlotCount || !slots_[index].present) return false;
  slots_[index].buttonType = type; slots_[index].alternateSlot = alternateSlot; slots_[index].eventName = eventName.substring(0, 64); return saveManifest();
}
int FileStore::nextPresent(int current) const {
  FileStoreLock guard(*this); if (!guard.locked()) return -1;
  for (int step = 1; step <= AppConfig::SlotCount; ++step) { int index = (current + step) % AppConfig::SlotCount; if (slots_[index].present) return index; }
  return -1;
}

size_t FileStore::totalBytes() const { FileStoreLock guard(*this); return guard.locked() ? LittleFS.totalBytes() : 0; }
size_t FileStore::usedBytes() const { FileStoreLock guard(*this); return guard.locked() ? LittleFS.usedBytes() : 0; }

