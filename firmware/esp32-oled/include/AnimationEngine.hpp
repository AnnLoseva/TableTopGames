#pragma once
#include <Arduino.h>
#include <LittleFS.h>
#include <freertos/FreeRTOS.h>
#include "FileStore.hpp"
#include "OledRenderer.hpp"

class AnimationEngine {
 public:
  void begin(FileStore& store, OledRenderer& renderer, float speed);
  bool play(int slot, int returnSlot = -1);
  void restart();
  void togglePause();
  void setSpeed(float speed) { speed_ = speed; }
  void tick(bool displaySuppressed = false);
  int currentSlot() const;
  bool stopForSlot(int slot);
  float actualFps() const;
  uint32_t maxFrameGapMs() const;
 private:
  bool readHeader();
  bool decodeFrame(uint32_t& durationMs);
  bool handleEndOfAnimation();
  void recordRenderedFrame(uint32_t now);
  void setCurrentSlot(int slot);
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
  uint32_t lastRenderedAt_ = 0;
  uint32_t metricsWindowAt_ = 0;
  uint32_t metricsWindowFrames_ = 0;
  float actualFps_ = 0;
  uint32_t maxFrameGapMs_ = 0;
  mutable portMUX_TYPE stateMux_ = portMUX_INITIALIZER_UNLOCKED;
  uint8_t compressed_[2048];
  uint8_t frame_[1024];
};

