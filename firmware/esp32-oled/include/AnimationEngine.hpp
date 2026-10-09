#pragma once
#include <Arduino.h>
#include <LittleFS.h>
#include "FileStore.hpp"
#include "OledRenderer.hpp"

class AnimationEngine {
 public:
  void begin(FileStore& store, OledRenderer& renderer, float speed);
  bool play(int slot, int returnSlot = -1);
  void restart();
  void togglePause() { paused_ = !paused_; }
  void setSpeed(float speed) { speed_ = speed; }
  void tick(bool displaySuppressed = false);
  int currentSlot() const { return currentSlot_; }
 private:
  bool readHeader();
  bool readFrame();
  FileStore* store_ = nullptr;
  OledRenderer* renderer_ = nullptr;
  File file_;
  int currentSlot_ = -1;
  int returnSlot_ = -1;
  uint16_t frameCount_ = 0;
  uint16_t frameIndex_ = 0;
  bool loop_ = true;
  bool paused_ = false;
  float speed_ = 1.0f;
  uint32_t nextFrameAt_ = 0;
  uint8_t compressed_[2048];
  uint8_t frame_[1024];
};

