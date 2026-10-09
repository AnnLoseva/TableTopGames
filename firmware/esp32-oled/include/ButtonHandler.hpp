#pragma once
#include <Arduino.h>

class ButtonHandler {
 public:
  using Callback = void (*)();
  using HoldCallback = void (*)(uint32_t durationMs);
  void begin(int pin, Callback shortPress, HoldCallback holdReleased);
  void tick();
 private:
  int pin_ = -1;
  Callback shortPress_ = nullptr;
  HoldCallback holdReleased_ = nullptr;
  bool stablePressed_ = false;
  bool rawPressed_ = false;
  uint32_t rawChangedAt_ = 0;
  uint32_t pressedAt_ = 0;
};

