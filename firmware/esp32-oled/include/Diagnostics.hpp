#pragma once
#include <Arduino.h>

class Diagnostics {
 public:
  void begin();
  void tick();
 private:
  uint32_t lastReport_ = 0;
};

