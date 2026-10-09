#pragma once
#include <Arduino.h>

class ButtonHandler {
 public:
  using Callback = void (*)();
  void begin(int pin, Callback shortPress, Callback longPress);
  void tick();
  bool heldAtBoot(uint32_t durationMs);
 private:
  int pin_ = -1;
  Callback shortPress_ = nullptr;
  Callback longPress_ = nullptr;
  bool stablePressed_ = false;
  bool rawPressed_ = false;
  bool longFired_ = false;
  uint32_t rawChangedAt_ = 0;
  uint32_t pressedAt_ = 0;
};

