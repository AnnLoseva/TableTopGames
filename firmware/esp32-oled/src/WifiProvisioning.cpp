#include "WifiProvisioning.hpp"
#include <ArduinoJson.h>
#include <WiFi.h>

static const char PORTAL_HTML[] PROGMEM = R"HTML(
<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8">
<style>body{font:16px system-ui;background:#eef4ec;color:#26362e;margin:0;padding:24px}.card{max-width:440px;margin:8vh auto;background:#fff;padding:26px;border-radius:24px;box-shadow:0 20px 60px #49604b22}h1{font-family:Georgia;font-weight:500}label{display:grid;gap:7px;margin:14px 0}input,select,button{font:inherit;padding:12px;border-radius:12px;border:1px solid #bdcdbf;width:100%;box-sizing:border-box}button{background:#365746;color:#fff;border:0;font-weight:700}</style>
<div class="card"><h1>OLED setup</h1><p>Choose your home network. The password is stored only in this ESP32's NVS.</p><form method="post" action="/save"><label>Wi-Fi<select name="ssid" id="net"><option>Scanning for networks…</option></select></label><label>Password<input name="password" type="password" autocomplete="new-password"></label><button>Connect</button></form></div>
<script>fetch('/scan').then(r=>r.json()).then(xs=>{net.innerHTML='';xs.forEach(x=>{const o=document.createElement('option');o.value=o.textContent=x.ssid+' ('+x.rssi+' dBm)';o.value=x.ssid;net.append(o)})}).catch(()=>net.innerHTML='<option>Enter the network after restarting</option>')</script></html>
)HTML";

void WifiProvisioning::begin(Settings& settings, bool forcePortal) {
  settings_ = &settings;
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  if (forcePortal || settings.ssid().isEmpty()) startPortal(); else connectStation();
}

void WifiProvisioning::configureRoutes() {
  if (routesConfigured_) return;
  routesConfigured_ = true;
  server_.on("/", HTTP_GET, [this]() { server_.send_P(200, "text/html; charset=utf-8", PORTAL_HTML); });
  server_.on("/scan", HTTP_GET, [this]() {
    int count = WiFi.scanNetworks(false, true);
    JsonDocument doc; JsonArray list = doc.to<JsonArray>();
    for (int index = 0; index < count; ++index) {
      JsonObject item = list.add<JsonObject>(); item["ssid"] = WiFi.SSID(index); item["rssi"] = WiFi.RSSI(index);
    }
    WiFi.scanDelete(); String response; serializeJson(doc, response); server_.send(200, "application/json", response);
  });
  server_.on("/save", HTTP_POST, [this]() {
    String ssid = server_.arg("ssid"); String password = server_.arg("password");
    if (ssid.isEmpty() || ssid.length() > 32 || password.length() > 63) { server_.send(422, "text/plain; charset=utf-8", "Invalid Wi-Fi details"); return; }
    settings_->saveWifi(ssid, password);
    server_.send(200, "text/html; charset=utf-8", "<meta charset=utf-8><p>Saved. The ESP32 is connecting; you can close this page.</p>");
    stopPortal(); connectStation();
  });
  server_.onNotFound([this]() { server_.sendHeader("Location", "http://192.168.4.1/"); server_.send(302, "text/plain", ""); });
}

void WifiProvisioning::startPortal() {
  configureRoutes();
  WiFi.disconnect(true, false); WiFi.mode(WIFI_AP_STA);
  uint32_t suffix = static_cast<uint32_t>(ESP.getEfuseMac()) & 0xffff;
  char name[24]; snprintf(name, sizeof(name), "OLED-Setup-%04X", suffix); portalSsid_ = name;
  WiFi.softAP(portalSsid_.c_str());
  dns_.start(53, "*", WiFi.softAPIP()); server_.begin(); portalActive_ = true;
}

void WifiProvisioning::stopPortal() {
  if (!portalActive_) return;
  dns_.stop(); server_.stop(); WiFi.softAPdisconnect(true); portalActive_ = false;
}

void WifiProvisioning::connectStation() {
  String ssid = settings_->ssid(); if (ssid.isEmpty()) { startPortal(); return; }
  WiFi.mode(WIFI_STA); WiFi.begin(ssid.c_str(), settings_->wifiPassword().c_str());
  lastConnectAttempt_ = millis(); if (!firstConnectAttempt_) firstConnectAttempt_ = lastConnectAttempt_;
}

void WifiProvisioning::tick() {
  if (portalActive_) { dns_.processNextRequest(); server_.handleClient(); return; }
  if (online()) { firstConnectAttempt_ = 0; return; }
  uint32_t now = millis();
  if (firstConnectAttempt_ && now - firstConnectAttempt_ > 45000) { startPortal(); return; }
  if (now - lastConnectAttempt_ > 15000) connectStation();
}

bool WifiProvisioning::online() const { return WiFi.status() == WL_CONNECTED; }

