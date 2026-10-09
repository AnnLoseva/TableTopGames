#include "Diagnostics.hpp"
#include <esp_task_wdt.h>

void Diagnostics::begin() {
  esp_task_wdt_init(20, true);
  esp_task_wdt_add(nullptr);
}

void Diagnostics::tick() {
  esp_task_wdt_reset();
  if (millis() - lastReport_ > 60000) {
    lastReport_ = millis();
    Serial.printf("health heap=%u largest=%u\n", ESP.getFreeHeap(), ESP.getMaxAllocHeap());
  }
}
