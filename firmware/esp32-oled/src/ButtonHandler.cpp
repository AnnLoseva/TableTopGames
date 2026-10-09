#include "ButtonHandler.hpp"
#include "AppConfig.hpp"

void ButtonHandler::begin(int pin, Callback shortPress, HoldCallback holdReleased) {
  pin_ = pin; shortPress_ = shortPress; holdReleased_ = holdReleased; pinMode(pin_, INPUT_PULLUP);
  rawPressed_ = stablePressed_ = digitalRead(pin_) == LOW; rawChangedAt_ = millis(); pressedAt_ = stablePressed_ ? millis() : 0;
}

void ButtonHandler::tick() {
  bool pressed = digitalRead(pin_) == LOW; uint32_t now = millis();
  if (pressed != rawPressed_) { rawPressed_ = pressed; rawChangedAt_ = now; }
  if (now - rawChangedAt_ >= AppConfig::DebounceMs && rawPressed_ != stablePressed_) {
    stablePressed_ = rawPressed_;
    if (stablePressed_) pressedAt_ = now;
    else {
      uint32_t duration = now - pressedAt_;
      if (duration < AppConfig::PairingHoldMs) { if (shortPress_) shortPress_(); }
      else if (holdReleased_) holdReleased_(duration);
    }
  }
}

