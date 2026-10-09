#include "Diagnostics.hpp"
#include <esp_idf_version.h>
#include <esp_task_wdt.h>

void Diagnostics::begin(AnimationEngine& animation) {
  animation_ = &animation;
#if ESP_IDF_VERSION_MAJOR >= 5
  esp_task_wdt_config_t config = {};
  config.timeout_ms = 20000;
  config.idle_core_mask = (1U << portNUM_PROCESSORS) - 1U;
  config.trigger_panic = true;
  if (esp_task_wdt_init(&config) == ESP_ERR_INVALID_STATE) esp_task_wdt_reconfigure(&config);
#else
  esp_task_wdt_init(20, true);
#endif
  esp_task_wdt_add(nullptr);
}

void Diagnostics::tick() {
  esp_task_wdt_reset();
  if (millis() - lastReport_ > 10000) {
    lastReport_ = millis();
    Serial.printf("health heap=%u largest=%u fps=%.2f max_frame_gap_ms=%lu\n", ESP.getFreeHeap(), ESP.getMaxAllocHeap(),
      animation_ ? animation_->actualFps() : 0.0f,
      static_cast<unsigned long>(animation_ ? animation_->maxFrameGapMs() : 0));
  }
}
