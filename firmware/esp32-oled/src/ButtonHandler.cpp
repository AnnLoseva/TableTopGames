#include "ButtonHandler.hpp"
#include "AppConfig.hpp"

void ButtonHandler::begin(int pin, Callback shortPress, Callback longPress) {
  pin_ = pin; shortPress_ = shortPress; longPress_ = longPress; pinMode(pin_, INPUT_PULLUP);
  rawPressed_ = stablePressed_ = digitalRead(pin_) == LOW; rawChangedAt_ = millis(); pressedAt_ = stablePressed_ ? millis() : 0;
}

void ButtonHandler::tick() {
  bool pressed = digitalRead(pin_) == LOW; uint32_t now = millis();
  if (pressed != rawPressed_) { rawPressed_ = pressed; rawChangedAt_ = now; }
  if (now - rawChangedAt_ >= AppConfig::DebounceMs && rawPressed_ != stablePressed_) {
    stablePressed_ = rawPressed_;
    if (stablePressed_) { pressedAt_ = now; longFired_ = false; }
    else if (!longFired_ && now - pressedAt_ < AppConfig::LongPressMs && shortPress_) shortPress_();
  }
  if (stablePressed_ && !longFired_ && now - pressedAt_ >= AppConfig::LongPressMs) {
    longFired_ = true;
    if (longPress_) longPress_();
  }
}

bool ButtonHandler::heldAtBoot(uint32_t durationMs) {
  if (digitalRead(pin_) != LOW) return false;
  uint32_t started = millis();
  while (digitalRead(pin_) == LOW && millis() - started < durationMs) { delay(10); }
  return millis() - started >= durationMs;
}

