#include "AnimationEngine.hpp"

static uint16_t le16(const uint8_t* value) { return static_cast<uint16_t>(value[0]) | (static_cast<uint16_t>(value[1]) << 8); }

void AnimationEngine::begin(FileStore& store, OledRenderer& renderer, float speed) { store_ = &store; renderer_ = &renderer; speed_ = speed; }

bool AnimationEngine::play(int slot, int returnSlot) {
  if (slot < 0 || slot >= AppConfig::SlotCount || !store_->slotCopy(slot).present) return false;
  if (!store_->lock()) return false;
  File nextFile = LittleFS.open(store_->slotPath(slot), "r");
  if (!nextFile) { store_->unlock(); return false; }
  if (file_) file_.close();
  file_ = nextFile;
  store_->unlock();
  setCurrentSlot(slot); returnSlot_ = returnSlot; frameIndex_ = 0; paused_ = false; nextFrameAt_ = 0;
  portENTER_CRITICAL(&stateMux_); lastRenderedAt_ = 0; metricsWindowAt_ = 0; metricsWindowFrames_ = 0; actualFps_ = 0; portEXIT_CRITICAL(&stateMux_);
  if (readHeader()) return true;
  if (store_->lock()) { file_.close(); store_->unlock(); }
  setCurrentSlot(-1); return false;
}

bool AnimationEngine::readHeader() {
  if (!store_->lock()) return false;
  uint8_t header[12]; size_t read = file_.read(header, sizeof(header));
  store_->unlock();
  if (read != sizeof(header)) return false;
  if (memcmp(header, "OLED1", 5) != 0 || header[5] != 1 || header[7] != 1) return false;
  loop_ = header[6] & 1; frameCount_ = le16(header + 8); return frameCount_ > 0;
}

bool AnimationEngine::decodeFrame(uint32_t& durationMs) {
  if (!store_->lock()) return false;
  uint8_t header[4];
  if (file_.read(header, 4) != 4) { store_->unlock(); return false; }
  uint16_t duration = le16(header); uint16_t length = le16(header + 2);
  if (!length || length > sizeof(compressed_)) { store_->unlock(); return false; }
  if (file_.read(compressed_, length) != length) { store_->unlock(); return false; }
  store_->unlock();
  size_t output = 0;
  for (size_t offset = 0; offset + 1 < length; offset += 2) {
    uint8_t count = compressed_[offset], value = compressed_[offset + 1]; if (!count || output + count > sizeof(frame_)) return false;
    memset(frame_ + output, value, count); output += count;
  }
  if (output != sizeof(frame_)) return false;
  durationMs = max(1UL, static_cast<uint32_t>(duration / max(0.25f, speed_)));
  frameIndex_ += 1; return true;
}

void AnimationEngine::tick(bool displaySuppressed) {
  if (displaySuppressed) {
    nextFrameAt_ = 0;
    portENTER_CRITICAL(&stateMux_); lastRenderedAt_ = 0; metricsWindowAt_ = 0; metricsWindowFrames_ = 0; actualFps_ = 0; portEXIT_CRITICAL(&stateMux_);
    return;
  }
  if (paused_ || currentSlot() < 0) return;
  uint32_t now = millis();
  if (!nextFrameAt_) nextFrameAt_ = now;
  if (static_cast<int32_t>(now - nextFrameAt_) < 0) return;

  constexpr uint8_t MaxCatchUpFrames = 8;
  for (uint8_t skipped = 0; skipped < MaxCatchUpFrames; ++skipped) {
    if (!handleEndOfAnimation()) return;
    uint32_t duration = 0;
    if (!decodeFrame(duration)) { paused_ = true; return; }
    uint32_t followingFrameAt = nextFrameAt_ + duration;
    bool stillLate = static_cast<int32_t>(now - followingFrameAt) >= 0;
    if (!stillLate || skipped + 1 == MaxCatchUpFrames) {
      renderer_->showFrame(frame_);
      recordRenderedFrame(now);
      nextFrameAt_ = stillLate ? now + duration : followingFrameAt;
      return;
    }
    nextFrameAt_ = followingFrameAt;
  }
}

bool AnimationEngine::handleEndOfAnimation() {
  if (frameIndex_ >= frameCount_) {
    if (returnSlot_ >= 0) { int target = returnSlot_; returnSlot_ = -1; play(target); return false; }
    if (!loop_) { paused_ = true; return false; }
    if (!store_->lock()) return false;
    bool sought = file_.seek(12); store_->unlock();
    if (!sought) { paused_ = true; return false; }
    frameIndex_ = 0;
  }
  return true;
}

void AnimationEngine::restart() { int slot = currentSlot(); if (slot >= 0) play(slot, returnSlot_); }

void AnimationEngine::togglePause() {
  paused_ = !paused_;
  if (!paused_) { nextFrameAt_ = 0; portENTER_CRITICAL(&stateMux_); lastRenderedAt_ = 0; metricsWindowAt_ = 0; metricsWindowFrames_ = 0; actualFps_ = 0; portEXIT_CRITICAL(&stateMux_); }
}

bool AnimationEngine::stopForSlot(int slot) {
  if (currentSlot() != slot) return false;
  if (store_->lock()) { if (file_) file_.close(); store_->unlock(); }
  setCurrentSlot(-1); paused_ = true; nextFrameAt_ = 0; return true;
}

void AnimationEngine::recordRenderedFrame(uint32_t now) {
  portENTER_CRITICAL(&stateMux_);
  if (lastRenderedAt_ && now - lastRenderedAt_ > maxFrameGapMs_) maxFrameGapMs_ = now - lastRenderedAt_;
  lastRenderedAt_ = now;
  if (!metricsWindowAt_) metricsWindowAt_ = now;
  metricsWindowFrames_ += 1;
  uint32_t elapsed = now - metricsWindowAt_;
  if (elapsed >= 5000) {
    actualFps_ = static_cast<float>(metricsWindowFrames_) * 1000.0f / static_cast<float>(elapsed);
    metricsWindowAt_ = now; metricsWindowFrames_ = 0;
  }
  portEXIT_CRITICAL(&stateMux_);
}

void AnimationEngine::setCurrentSlot(int slot) { portENTER_CRITICAL(&stateMux_); currentSlot_ = slot; portEXIT_CRITICAL(&stateMux_); }
int AnimationEngine::currentSlot() const { portENTER_CRITICAL(&stateMux_); int slot = currentSlot_; portEXIT_CRITICAL(&stateMux_); return slot; }
float AnimationEngine::actualFps() const { portENTER_CRITICAL(&stateMux_); float fps = actualFps_; portEXIT_CRITICAL(&stateMux_); return fps; }
uint32_t AnimationEngine::maxFrameGapMs() const { portENTER_CRITICAL(&stateMux_); uint32_t gap = maxFrameGapMs_; portEXIT_CRITICAL(&stateMux_); return gap; }

