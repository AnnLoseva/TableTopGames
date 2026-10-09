#pragma once
#include <Arduino.h>
#include "AnimationEngine.hpp"

class Diagnostics {
 public:
  void begin(AnimationEngine& animation);
  void tick();
 private:
  AnimationEngine* animation_ = nullptr;
  uint32_t lastReport_ = 0;
};

