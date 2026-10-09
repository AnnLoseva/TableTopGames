#include "AnimationEngine.hpp"

static uint16_t le16(const uint8_t* value) { return static_cast<uint16_t>(value[0]) | (static_cast<uint16_t>(value[1]) << 8); }

void AnimationEngine::begin(FileStore& store, OledRenderer& renderer, float speed) { store_ = &store; renderer_ = &renderer; speed_ = speed; }

bool AnimationEngine::play(int slot, int returnSlot) {
  if (slot < 0 || slot >= AppConfig::SlotCount || !store_->slot(slot).present) return false;
  if (file_) file_.close(); file_ = LittleFS.open(store_->slotPath(slot), "r"); if (!file_) return false;
  currentSlot_ = slot; returnSlot_ = returnSlot; frameIndex_ = 0; paused_ = false; nextFrameAt_ = 0; return readHeader();
}

bool AnimationEngine::readHeader() {
  uint8_t header[12]; if (file_.read(header, sizeof(header)) != sizeof(header)) return false;
  if (memcmp(header, "OLED1", 5) != 0 || header[5] != 1 || header[7] != 1) return false;
  loop_ = header[6] & 1; frameCount_ = le16(header + 8); return frameCount_ > 0;
}

bool AnimationEngine::readFrame() {
  uint8_t header[4]; if (file_.read(header, 4) != 4) return false;
  uint16_t duration = le16(header); uint16_t length = le16(header + 2); if (!length || length > sizeof(compressed_)) return false;
  if (file_.read(compressed_, length) != length) return false;
  size_t output = 0;
  for (size_t offset = 0; offset + 1 < length; offset += 2) {
    uint8_t count = compressed_[offset], value = compressed_[offset + 1]; if (!count || output + count > sizeof(frame_)) return false;
    memset(frame_ + output, value, count); output += count;
  }
  if (output != sizeof(frame_)) return false;
  renderer_->showFrame(frame_); nextFrameAt_ = millis() + static_cast<uint32_t>(duration / max(0.25f, speed_)); frameIndex_ += 1; return true;
}

void AnimationEngine::tick(bool displaySuppressed) {
  if (displaySuppressed || paused_ || currentSlot_ < 0 || static_cast<int32_t>(millis() - nextFrameAt_) < 0) return;
  if (frameIndex_ >= frameCount_) {
    if (returnSlot_ >= 0) { int target = returnSlot_; returnSlot_ = -1; play(target); return; }
    if (!loop_) { paused_ = true; return; }
    file_.seek(12); frameIndex_ = 0;
  }
  if (!readFrame()) paused_ = true;
}

void AnimationEngine::restart() { if (currentSlot_ >= 0) play(currentSlot_, returnSlot_); }

