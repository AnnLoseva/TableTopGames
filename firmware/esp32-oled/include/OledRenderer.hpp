#pragma once
#include <Adafruit_SSD1306.h>

class OledRenderer {
 public:
  bool begin();
  void setBrightness(uint8_t value);
  void showFrame(const uint8_t* buffer);
  void showMessage(const String& title, const String& line = "");
  void showPairingPin(const char pin[5], uint32_t secondsLeft);
 private:
  Adafruit_SSD1306 display_{128, 64, &Wire, -1};
  uint32_t lastPinSecond_ = UINT32_MAX;
};

