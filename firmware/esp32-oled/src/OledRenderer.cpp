#include "OledRenderer.hpp"
#include <Wire.h>
#include "AppConfig.hpp"

bool OledRenderer::begin() {
  Wire.begin(AppConfig::OledSda, AppConfig::OledScl);
  if (!display_.begin(SSD1306_SWITCHCAPVCC, AppConfig::OledAddress)) return false;
  display_.clearDisplay(); display_.display(); return true;
}
void OledRenderer::setBrightness(uint8_t value) { display_.ssd1306_command(SSD1306_SETCONTRAST); display_.ssd1306_command(value); }
void OledRenderer::showFrame(const uint8_t* buffer) {
  memcpy(display_.getBuffer(), buffer, 1024); display_.display();
}
void OledRenderer::showMessage(const String& title, const String& line) {
  display_.clearDisplay(); display_.setTextColor(SSD1306_WHITE); display_.setTextSize(1);
  display_.setCursor(4, 16); display_.println(title); display_.setCursor(4, 35); display_.println(line); display_.display();
}
void OledRenderer::showPairingPin(const char pin[5], uint32_t secondsLeft) {
  if (secondsLeft == lastPinSecond_) return;
  lastPinSecond_ = secondsLeft;
  display_.clearDisplay(); display_.setTextColor(SSD1306_WHITE); display_.setTextSize(1); display_.setCursor(39, 2); display_.print("PIN");
  display_.setTextSize(3); display_.setCursor(24, 20); display_.print(pin);
  display_.setTextSize(1); display_.setCursor(45, 52); display_.print(secondsLeft); display_.print(" s"); display_.display();
}

