#pragma once

#include <Arduino.h>

namespace AppConfig {
constexpr char ApiBase[] = "https://annloseva-ttg.xyz";
constexpr char FirmwareVersion[] = "1.0.0";
constexpr uint8_t OledAddress = 0x3C;
constexpr int OledSda = 0;
constexpr int OledScl = 2;
constexpr int ButtonPin = 3;
constexpr uint32_t PollIntervalMs = 5000;
constexpr uint32_t PairingDurationMs = 120000;
constexpr uint32_t LongPressMs = 5000;
constexpr uint32_t DebounceMs = 35;
constexpr size_t DownloadChunkBytes = 4096;
constexpr size_t MaxAssetBytes = 2 * 1024 * 1024;
constexpr uint8_t SlotCount = 10;
}

