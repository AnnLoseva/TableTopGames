#include "WifiProvisioning.hpp"
#include <ArduinoJson.h>
#include <WiFi.h>

static const char PORTAL_HTML[] PROGMEM = R"HTML(
<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta charset="utf-8"><title>OLED Wi-Fi setup</title>
<style>:root{color-scheme:light}*{box-sizing:border-box}body{font:16px system-ui,-apple-system,sans-serif;background:linear-gradient(145deg,#f8f7ef,#e8f1e7);color:#26362e;margin:0;min-height:100vh;padding:24px}.card{max-width:460px;margin:5vh auto;background:#fffffc;padding:28px;border:1px solid #d8e1d8;border-radius:26px;box-shadow:0 22px 70px #49604b24}h1{font:500 2.2rem Georgia,serif;margin:.2em 0}.hint{color:#687a70;line-height:1.55}.state{padding:13px 14px;border-radius:14px;background:#edf3ea;margin:18px 0}.state.error{background:#f7e6e2;color:#873f39}.state.good{background:#dfeee1;color:#285b3d}label{display:grid;gap:7px;margin:15px 0;font-size:.85rem;font-weight:700;color:#53685d}input,select,button{font:inherit;padding:13px;border-radius:13px;border:1px solid #bdcdbf;width:100%;background:#fff;color:#26362e}button{background:#365746;color:#fff;border:0;font-weight:750;min-height:48px}button:disabled{opacity:.5}.small{font-size:.82rem}.hidden{display:none}</style></head>
<body><main class="card"><small>OLED DISPLAY</small><h1>Connect to home Wi-Fi</h1><p class="hint">Choose a 2.4 GHz network. This ESP32 stores the password locally and never shows it again.</p><div id="state" class="state">Looking for nearby networks…</div>
<form id="form"><label>Wi-Fi network<select name="ssid" id="net"><option value="">Scanning…</option></select></label><label>Password<input name="password" type="password" autocomplete="new-password" maxlength="63"></label><button id="connect">Connect</button></form>
<p class="hint small">If this page closes, stay connected to the OLED setup network and open <b>http://192.168.4.1</b>.</p></main>
<script>
const state=document.querySelector('#state'),form=document.querySelector('#form'),net=document.querySelector('#net'),button=document.querySelector('#connect');let submitted=false;
function message(text,kind=''){state.textContent=text;state.className='state '+kind}
async function scan(){try{const r=await fetch('/scan',{cache:'no-store'});if(r.status===202){setTimeout(scan,1200);return}const xs=await r.json();net.innerHTML='';for(const x of xs){const o=document.createElement('option');o.value=x.ssid;o.textContent=x.ssid+' · '+x.rssi+' dBm';net.append(o)}if(!xs.length)net.innerHTML='<option value="">No 2.4 GHz networks found</option>';if(!submitted)message(xs.length?'Choose your home network.':'No networks found. Move closer to the router and try again.',xs.length?'':'error')}catch{setTimeout(scan,1500)}}
async function status(){try{const r=await fetch('/status',{cache:'no-store'}),s=await r.json();if(['ready','registered','waiting_gift_acceptance'].includes(s.state)){message('Connected and confirmed. You can close this page.','good');form.classList.add('hidden');return}if(s.state==='wifi_connected')message('Wi-Fi connected. Confirming the device with the server…');else if(s.state==='connecting')message('Connecting to '+(s.ssid||'your Wi-Fi')+'…');else if(s.state==='no_internet')message('Wi-Fi works, but the internet is not reachable yet. We will keep trying.','error');else if(s.state==='tls_error')message('The secure server connection could not be verified. Check the router and internet connection.','error');else if(s.state==='server_unavailable')message('Wi-Fi works, but the service is temporarily unavailable. We will keep trying.','error');else if(s.state==='registration_error')message('The device reached the server, but registration failed. Please contact the gift giver.','error');else if(s.error){message(s.error,'error');form.classList.remove('hidden');button.disabled=false;submitted=false;scan()}if(submitted)setTimeout(status,1200)}catch{if(submitted)setTimeout(status,1500)}}
form.addEventListener('submit',async e=>{e.preventDefault();if(!net.value){message('Choose a Wi-Fi network first.','error');return}submitted=true;button.disabled=true;message('Starting connection…');const body=new URLSearchParams(new FormData(form));try{const r=await fetch('/save',{method:'POST',body});if(!r.ok){message(await r.text(),'error');button.disabled=false;submitted=false;return}status()}catch{message('The setup network was interrupted. Reconnect to it and open 192.168.4.1.','error');button.disabled=false;submitted=false}});scan();status();
</script></body></html>
)HTML";

void WifiProvisioning::begin(Settings& settings, DeviceIdentity& identity) {
  settings_ = &settings; identity_ = &identity; portalPassword_ = identity.setupPassword();
  WiFi.persistent(false); WiFi.setAutoReconnect(true);
  if (settings.ssid().isEmpty()) startPortal(); else connectSavedStation();
}

void WifiProvisioning::configureRoutes() {
  if (routesConfigured_) return;
  routesConfigured_ = true;
  auto sendPortal = [this]() { server_.send_P(200, "text/html; charset=utf-8", PORTAL_HTML); };
  server_.on("/", HTTP_GET, sendPortal);
  server_.on("/hotspot-detect.html", HTTP_GET, sendPortal);
  server_.on("/library/test/success.html", HTTP_GET, sendPortal);
  server_.on("/generate_204", HTTP_GET, [this]() { server_.sendHeader("Location", "http://192.168.4.1/", true); server_.send(302, "text/plain", ""); });
  server_.on("/connecttest.txt", HTTP_GET, sendPortal);
  server_.on("/ncsi.txt", HTTP_GET, sendPortal);
  server_.on("/fwlink", HTTP_GET, sendPortal);
  server_.on("/status", HTTP_GET, [this]() { server_.send(200, "application/json", statusJson()); });
  server_.on("/scan", HTTP_GET, [this]() {
    int count = WiFi.scanComplete();
    if (count == WIFI_SCAN_RUNNING) { server_.send(202, "application/json", "{\"scanning\":true}"); return; }
    if (count < 0) { startScan(); server_.send(202, "application/json", "{\"scanning\":true}"); return; }
    JsonDocument doc; JsonArray list = doc.to<JsonArray>();
    for (int index = 0; index < count; ++index) {
      String ssid = WiFi.SSID(index); if (ssid.isEmpty()) continue;
      bool duplicate = false; for (JsonObject item : list) if (item["ssid"].as<String>() == ssid) { duplicate = true; break; }
      if (!duplicate) { JsonObject item = list.add<JsonObject>(); item["ssid"] = ssid; item["rssi"] = WiFi.RSSI(index); }
    }
    WiFi.scanDelete(); if (!candidatePending_) startScan(); String response; serializeJson(doc, response); server_.send(200, "application/json", response);
  });
  server_.on("/save", HTTP_POST, [this]() {
    String ssid = server_.arg("ssid"); String password = server_.arg("password");
    if (ssid.isEmpty() || ssid.length() > 32 || password.length() > 63) { server_.send(422, "text/plain; charset=utf-8", "Check the Wi-Fi name and password."); return; }
    connectCandidate(ssid, password); server_.send(202, "application/json", "{\"connecting\":true}");
  });
  server_.onNotFound([this]() { server_.sendHeader("Location", "http://192.168.4.1/", true); server_.send(302, "text/plain", ""); });
}

void WifiProvisioning::startScan() { if (WiFi.scanComplete() != WIFI_SCAN_RUNNING) WiFi.scanNetworks(true, true); }

void WifiProvisioning::startPortal() {
  configureRoutes(); WiFi.disconnect(false, false); WiFi.mode(WIFI_AP_STA);
  portalSsid_ = identity_->setupSsid();
  WiFi.softAP(portalSsid_.c_str(), portalPassword_.c_str()); dns_.start(53, "*", WiFi.softAPIP()); server_.begin(); portalActive_ = true;
  candidatePending_ = false; candidateSaved_ = false; connectionError_ = ""; backendConfirmedAt_ = 0;
  setBackendState(settings_->ssid().isEmpty() ? ConnectionState::WifiUnset : ConnectionState::Connecting); startScan();
  Serial.println("Wi-Fi setup portal active.");
}

void WifiProvisioning::stopPortal() {
  if (!portalActive_) return;
  dns_.stop(); server_.stop(); WiFi.scanDelete(); WiFi.softAPdisconnect(true); portalActive_ = false; WiFi.mode(WIFI_STA);
}

void WifiProvisioning::connectCandidate(const String& ssid, const String& password) {
  candidateSsid_ = ssid; candidatePassword_ = password; candidatePending_ = true; candidateSaved_ = false;
  connectionError_ = ""; connectedAt_ = 0; backendConfirmedAt_ = 0; setBackendState(ConnectionState::Connecting);
  WiFi.scanDelete(); WiFi.disconnect(false, false); WiFi.begin(ssid.c_str(), password.c_str()); lastConnectAttempt_ = millis();
}

void WifiProvisioning::connectSavedStation() {
  String ssid = settings_->ssid(); if (ssid.isEmpty()) { startPortal(); return; }
  WiFi.mode(WIFI_STA); WiFi.begin(ssid.c_str(), settings_->wifiPassword().c_str());
  lastConnectAttempt_ = millis(); if (!firstConnectAttempt_) firstConnectAttempt_ = lastConnectAttempt_; setBackendState(ConnectionState::Connecting);
}

void WifiProvisioning::tick() {
  if (portalActive_) { dns_.processNextRequest(); server_.handleClient(); }
  uint32_t now = millis();
  if (online()) {
    firstConnectAttempt_ = 0;
    if (!connectedAt_) { connectedAt_ = now; Serial.println("Wi-Fi connected."); }
    if (candidatePending_ && !candidateSaved_) {
      settings_->saveWifi(candidateSsid_, candidatePassword_); candidatePassword_ = ""; candidateSaved_ = true; setBackendState(ConnectionState::WifiConnected);
    }
    if (portalActive_ && backendConfirmedAt_ && now - backendConfirmedAt_ > 12000) stopPortal();
    return;
  }
  connectedAt_ = 0;
  if (candidatePending_) {
    wl_status_t status = WiFi.status();
    if (status == WL_CONNECT_FAILED || status == WL_NO_SSID_AVAIL || now - lastConnectAttempt_ > 25000) {
      candidatePending_ = false; candidateSaved_ = false; candidatePassword_ = "";
      connectionError_ = status == WL_NO_SSID_AVAIL ? "That network is no longer visible. Choose it again." : "Could not connect. Check the Wi-Fi password and try again.";
      setBackendState(ConnectionState::WifiUnset); WiFi.disconnect(false, false); startScan();
    }
    return;
  }
  if (portalActive_) return;
  if (firstConnectAttempt_ && now - firstConnectAttempt_ > 45000) { startPortal(); return; }
  if (now - lastConnectAttempt_ > 15000) connectSavedStation();
}

bool WifiProvisioning::online() const { return WiFi.status() == WL_CONNECTED; }
ConnectionState WifiProvisioning::state() const { portENTER_CRITICAL(&stateMux_); ConnectionState value = backendState_; portEXIT_CRITICAL(&stateMux_); return value; }
void WifiProvisioning::setBackendState(ConnectionState value) {
  portENTER_CRITICAL(&stateMux_); backendState_ = value; portEXIT_CRITICAL(&stateMux_);
  if ((value == ConnectionState::Registered || value == ConnectionState::Ready || value == ConnectionState::WaitingGiftAcceptance) && !backendConfirmedAt_) backendConfirmedAt_ = millis();
}

const char* WifiProvisioning::stateCode(ConnectionState value) const {
  switch (value) {
    case ConnectionState::WifiUnset: return "wifi_unset"; case ConnectionState::Connecting: return "connecting";
    case ConnectionState::WifiConnected: return "wifi_connected"; case ConnectionState::NoInternet: return "no_internet";
    case ConnectionState::TlsError: return "tls_error"; case ConnectionState::ServerUnavailable: return "server_unavailable";
    case ConnectionState::RegistrationError: return "registration_error"; case ConnectionState::Registered: return "registered";
    case ConnectionState::WaitingGiftAcceptance: return "waiting_gift_acceptance"; case ConnectionState::Ready: return "ready";
  }
  return "wifi_unset";
}

String WifiProvisioning::statusJson() const {
  JsonDocument doc; doc["state"] = stateCode(state()); doc["ssid"] = candidateSsid_; if (!connectionError_.isEmpty()) doc["error"] = connectionError_;
  String response; serializeJson(doc, response); return response;
}
