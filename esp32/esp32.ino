// Project: TI-84 GPT HACK
// Author:  Andy (ChinesePrince07)
// Date:    2025

#include "./launcher.h"
#include "./ti_tokens.h"
#include <TICL.h>
#include <CBL2.h>
#include <TIVar.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <UrlEncode.h>
#include <Preferences.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <HTTPUpdate.h>
#include "esp_sleep.h"
#include "esp_wifi.h"
#include "esp_wpa2.h"

// Default server URL
#define SERVER "https://api.andypandy.org"
#define SECURE

// Telnet serial monitor
#define TELNET_PORT 23
WiFiServer telnetServer(TELNET_PORT);
WiFiClient telnetClient;

// Dual output: Serial + Telnet
class DualPrint : public Print {
public:
  size_t write(uint8_t c) override {
    Serial.write(c);
    if (telnetClient && telnetClient.connected()) {
      telnetClient.write(c);
    }
    return 1;
  }
  size_t write(const uint8_t *buf, size_t size) override {
    Serial.write(buf, size);
    if (telnetClient && telnetClient.connected()) {
      telnetClient.write(buf, size);
    }
    return size;
  }
};
DualPrint out;

// Firmware version (increment this when updating)
#define FIRMWARE_VERSION "1.11.1"

// Captive portal settings
#define AP_SSID "calc"
#define AP_PASS ""
#define DNS_PORT 53

// Deep sleep idle timeout (milliseconds)
#define IDLE_TIMEOUT_MS 120000UL

WebServer webServer(80);
DNSServer dnsServer;
bool portalActive = false;

// Stored WiFi credentials
String storedSSID = "";
String storedPass = "";
String storedEapUser = "";
char sessionId[16] = "";
char scanResults[8][33];
int scanResultCount = 0;

// #define CAMERA

#ifdef CAMERA
#include <esp_camera.h>
#define CAMERA_MODEL_XIAO_ESP32S3
#include "./camera_pins.h"
#include "./camera_index.h"
#endif

constexpr auto TIP = D1;
constexpr auto RING = D10;
constexpr auto MAXHDRLEN = 16;
constexpr auto MAXDATALEN = 4096;
constexpr auto MAXARGS = 5;
constexpr auto MAXSTRARGLEN = 256;
constexpr auto PICSIZE = 756;
constexpr auto PICVARSIZE = PICSIZE + 2;
constexpr auto PASSWORD = 42069;

CBL2 cbl;
Preferences prefs;

// whether or not the user has entered the password
bool unlocked = true;

// Arguments
int currentArg = 0;
char strArgs[MAXARGS][MAXSTRARGLEN];
double realArgs[MAXARGS];

// the command to execute
int command = -1;
// last time we received communication from the calculator
unsigned long lastActivityMillis = 0;
// whether or not the operation has completed
bool status = 0;
// whether or not the operation failed
bool error = 0;
// error or success message
char message[MAXSTRARGLEN];
// list data
constexpr auto LISTLEN = 256;
constexpr auto LISTENTRYLEN = 20;
char list[LISTLEN][LISTENTRYLEN];
// http response
constexpr auto MAXHTTPRESPONSELEN = 4096;
char response[MAXHTTPRESPONSELEN];
// image variable (96x63)
uint8_t frame[PICVARSIZE] = { PICSIZE & 0xff, PICSIZE >> 8 };

// Decode case: lowercase by default, (X) for uppercase
void decodeCasing(char* str) {
  char tmp[MAXSTRARGLEN];
  int j = 0;
  for (int i = 0; str[i] && j < MAXSTRARGLEN - 1; i++) {
    if (str[i] == '(' && str[i+1] && str[i+2] == ')') {
      tmp[j++] = str[i+1];  // keep original (uppercase)
      i += 2;  // skip past )
    } else if (str[i] >= 'A' && str[i] <= 'Z') {
      tmp[j++] = str[i] + 32;  // lowercase
    } else {
      tmp[j++] = str[i];
    }
  }
  tmp[j] = '\0';
  strcpy(str, tmp);
}

void connect();
void disconnect();
int askGpt(const String& question, bool isMath);
void gpt();
void gpt_chat();
void gpt_history();
void gpt_new();
void send();
void launcher();
void snap();
void solve();
void image_list();
void fetch_image();
void program_list();
void fetch_program();
void setup_wifi();
void derivative();
void integrate();
void series();
void ota_update();
void get_version();
void get_newest();
void weather();
void translate();
void define();
void units();
void double_integral();
void get_mac();
void set_mac();
void wifi_scan();
void wifi_connect();
void eduroam_connect();
void suffield_connect();
void get_ip();
void avg_value();
void math_solver();
void em_solver();
void em_derive_get();
void em_equation_get();
void em_rhr_get();
void em_behavior_get();
void em_graph_get();
void em_rules_get();
void beginEnterprise(const char* ssid, const char* user, const char* pass);
void _sendLauncher();

struct Command {
  int id;
  const char* name;
  int num_args;
  void (*command_fp)();
  bool wifi;
};

struct Command commands[] = {
  { 0, "connect", 0, connect, false },
  { 1, "disconnect", 0, disconnect, false },
  { 2, "gpt", 1, gpt, true },
  { 3, "gpt_chat", 1, gpt_chat, true },
  { 4, "send", 2, send, true },
  { 5, "launcher", 0, launcher, false },
  { 6, "gpt_history", 1, gpt_history, true },
  { 7, "snap", 0, snap, false },
  { 8, "solve", 1, solve, true },
  { 9, "image_list", 1, image_list, true },
  { 10, "fetch_image", 1, fetch_image, true },
  { 11, "gpt_new", 0, gpt_new, false },
  { 13, "program_list", 1, program_list, true },
  { 14, "fetch_program", 1, fetch_program, true },
  { 15, "setup_wifi", 0, setup_wifi, false },
  { 16, "derivative", 1, derivative, true },
  { 17, "integrate", 1, integrate, true },
  { 20, "ota_update", 0, ota_update, true },
  { 21, "get_version", 0, get_version, false },
  { 26, "get_newest", 0, get_newest, true },
  { 29, "series", 1, series, true },
  { 22, "weather", 1, weather, true },
  { 23, "translate", 1, translate, true },
  { 24, "define", 1, define, true },
  { 25, "units", 1, units, true },
  { 12, "get_mac", 0, get_mac, false },
  { 18, "set_mac", 1, set_mac, false },
  { 19, "wifi_scan", 0, wifi_scan, false },
  { 30, "wifi_connect", 2, wifi_connect, false },
  { 31, "double_integral", 1, double_integral, true },
  { 32, "eduroam_connect", 0, eduroam_connect, false },
  { 33, "suffield_connect", 0, suffield_connect, false },
  { 34, "get_ip", 0, get_ip, false },
  { 35, "avg_value", 1, avg_value, true },
  { 36, "math_solver", 1, math_solver, true },
  { 41, "em_solver", 1, em_solver, true },
  { 50, "em_derive_get", 1, em_derive_get, false },
  { 51, "em_equation_get", 1, em_equation_get, false },
  { 52, "em_rhr_get", 1, em_rhr_get, false },
  { 53, "em_behavior_get", 1, em_behavior_get, false },
  { 54, "em_graph_get", 1, em_graph_get, false },
  { 55, "em_rules_get", 1, em_rules_get, false },
};

constexpr int NUMCOMMANDS = sizeof(commands) / sizeof(struct Command);
constexpr int MAXCOMMAND = 55;

uint8_t header[MAXHDRLEN];
uint8_t data[MAXDATALEN];

// Convert ASCII char to TI-84 token(s). Returns number of bytes written (1 or 2).
int asciiToTIToken(char c, uint8_t* out) {
  // A-Z map directly
  if (c >= 'A' && c <= 'Z') { out[0] = c; return 1; }
  // 0-9 map directly
  if (c >= '0' && c <= '9') { out[0] = c; return 1; }
  // Punctuation and symbols
  switch (c) {
    case ' ':  out[0] = 0x29; return 1;
    case '!':  out[0] = 0x2D; return 1;
    case '"':  out[0] = 0x2A; return 1;
    case '\'': out[0] = 0xAE; return 1;
    case '(':  out[0] = 0x10; return 1;
    case ')':  out[0] = 0x11; return 1;
    case '*':  out[0] = 0x82; return 1;
    case '+':  out[0] = 0x70; return 1;
    case ',':  out[0] = 0x2B; return 1;
    case '-':  out[0] = 0x71; return 1;
    case '.':  out[0] = 0x3A; return 1;
    case '/':  out[0] = 0x83; return 1;
    case ':':  out[0] = 0x3E; return 1;
    case '<':  out[0] = 0x6B; return 1;
    case '=':  out[0] = 0x6A; return 1;
    case '>':  out[0] = 0x6C; return 1;
    case '?':  out[0] = 0xAF; return 1;
    case '^':  out[0] = 0x84; return 1;  // power operator (NOT 0xF0 which is nDeriv)
    case '[':  out[0] = 0x06; return 1;
    case ']':  out[0] = 0x07; return 1;
    case '{':  out[0] = 0x08; return 1;
    case '}':  out[0] = 0x09; return 1;
    case '~':  out[0] = 0xAC; return 1;  // pi (TI builtin)
    case '@':  out[0] = 0x5B; return 1;  // theta (TI builtin)
    default:   out[0] = 0x29; return 1;  // unknown → space
  }
}

// Build TI-84 string variable from ASCII message. Returns total byte length.
int asciiToTIString(const char* msg, uint8_t* strVar) {
  int pos = 2;  // leave room for length word prefix
  int tokenCount = 0;
  for (int i = 0; msg[i] && pos < MAXDATALEN - 2; i++) {
    uint8_t tok[2];
    int n = asciiToTIToken(msg[i], tok);
    for (int j = 0; j < n && pos < MAXDATALEN - 2; j++) {
      strVar[pos++] = tok[j];
    }
    tokenCount++;
  }
  // Write token length as little-endian 16-bit at start
  strVar[0] = (pos - 2) & 0xFF;
  strVar[1] = ((pos - 2) >> 8) & 0xFF;
  return pos;
}

int onReceived(uint8_t type, enum Endpoint model, int datalen);
int onRequest(uint8_t type, enum Endpoint model, int* headerlen,
              int* datalen, data_callback* data_callback);

void startCommand(int cmd) {
  command = cmd;
  status = 0;
  error = 0;
  currentArg = 0;
  for (int i = 0; i < MAXARGS; ++i) {
    memset(&strArgs[i], 0, MAXSTRARGLEN);
    realArgs[i] = 0;
  }
  strncpy(message, "no command", MAXSTRARGLEN);
}

// Sanitize string for TI-84 display (uppercase ASCII, printable chars)
void sanitizeForTI(char* dest, const char* src, size_t maxLen) {
  size_t i = 0;
  size_t j = 0;
  while (src[i] && j < maxLen - 1) {
    char c = src[i];
    if (c >= 'a' && c <= 'z') {
      dest[j++] = c - 32;  // Convert to uppercase
    } else if (c >= ' ' && c <= '~') {
      dest[j++] = c;       // Allow all printable ASCII
    } else if (c == '\n' || c == '\r') {
      dest[j++] = ' ';     // Replace newlines with space
    }
    // Skip non-printable / non-ASCII characters
    i++;
  }
  dest[j] = '\0';
}

void setError(const char* err) {
  out.print("ERROR: ");
  out.println(err);
  error = 1;
  status = 1;
  command = -1;
  sanitizeForTI(message, err, MAXSTRARGLEN);
}

void setSuccess(const char* success) {
  out.print("SUCCESS: ");
  out.println(success);
  error = 0;
  status = 1;
  command = -1;
  sanitizeForTI(message, success, MAXSTRARGLEN);
}

int sendProgramVariable(const char* name, uint8_t* program, size_t variableSize);

bool camera_sign = false;

// Captive portal HTML
const char* portalHTML = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>TI-84 WiFi Setup</title>
    <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        body { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); min-height: 100vh; margin: 0; display: flex; justify-content: center; align-items: center; padding: 20px; }
        .container { background: white; border-radius: 16px; padding: 32px; max-width: 380px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        h1 { margin: 0 0 8px 0; font-size: 24px; color: #1a1a2e; }
        .subtitle { color: #666; margin-bottom: 24px; font-size: 14px; }
        .logo { text-align: center; margin-bottom: 16px; }
        .logo img { width: 64px; height: 64px; border-radius: 50%; }
        label { display: block; margin-bottom: 6px; font-weight: 600; color: #333; font-size: 14px; }
        input { width: 100%; padding: 14px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; margin-bottom: 16px; }
        input:focus { outline: none; border-color: #4a6cf7; }
        button { width: 100%; padding: 16px; background: linear-gradient(135deg, #4a6cf7 0%, #6366f1 100%); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
        .tabs { display: flex; margin-bottom: 24px; border-bottom: 2px solid #e0e0e0; }
        .tab { flex: 1; padding: 12px; text-align: center; cursor: pointer; font-weight: 600; color: #999; border-bottom: 2px solid transparent; margin-bottom: -2px; }
        .tab.active { color: #4a6cf7; border-bottom-color: #4a6cf7; }
        .form { display: none; }
        .form.active { display: block; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #999; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo"><img src="data:image/jpeg;base64,/9j/2wCEAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDIBCQkJDAsMGA0NGDIhHCEyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMv/AABEIAEAAQAMBIgACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/AOjOnDVfDwtEA+0QtIF/3ldsD8RxXESyC0RmfOcEbccg13sF6uk/2pMzY8idnHPUFQcfnmuCZZtf1SWZsKXfe23oMnPFel7ZwhY85UFOdzDkuiVCrGvXoSc49Rj/AOvVCfYy5RGOfQZFdy3h2DysBORyB1xVZrGGI8hM+rFRXDKuj0oYaT3PO7hJT/yyYe+2qZUg8lgfevSvssEpx8rf7il/5AU59Bt71Cvlgn/aXB/UVKr+Ro8Jpozg7K4eORfmIxXRrhgCDkEZBrF1/RJtEvUQjEcg3JntWrp4P2KLPXbXs5ZUbk0tj5/NqSjFSe9z07WrT7QupoSBmOOTJ9t2f6VieFo18qc479a7Sa3El+8ZAPmW7L9TkY/rXPaVp8mnQXMUrIJBJzg5xwOK82r8J6mH+MsXIjhhaWaRY0AySTXPG9gmd1ilD57sKm1TT5JCZJ5s5OcE8CsaKVYpvKj2sTxkVxSSPUpt31Lt5MYYkVI/MOOmcDPvUNprWtQsNsELBTwMZzVfUJzZzgXLhQRnHc/hUtr4qsIyI4bSWY9yVAB/E9KjXsaSava5e8fQLqvhqw1RITGyvskUjlSf/riuXs0KWcQPUJXV6n4lN14dubVdM3xsVIzLllORjjHPNcyqM4GeAR93GMV7uT9WfM57pyroezzjZqluQeMHP5Y/rXK6lYT291qRmaTY0glg2kqMNktnHXt1rsdQQLe2RHRpNn8j/SoPEdqjW0ZkHytkZ+n/AOuuGo/dZ30F76R49qkYkcgAE+pNUbGwee9ijCBxuG7nGBXVajpVokpYs+D2zTtEt7aFpJ/MWOYEK8x5P0rkdTTQ9SNG/Qytb8OqFWS0SNMHDhUAyOvbvXKbFim6MzA16Zc6tYpLKlyw8s8Ag8/UVgTmGxvGMOHgY5Ryozj3rJTfU6PYmp4KsZL6VGuYj9nU7vmOMkcj9cVj3EPk3csZ/gdl/I102g6ygbaSOvWsTVDA2rXbiThpmICjpzXq5ViqdGU/aOyPGznLq+KUFQjdo7PXvGiSeUttp8iGN9weQ8dCO319ayr7xpd6jttrpII0HK+WCCD+JNKlpPcH5IXZQM5xxTT4Ve7YNJbJGSeG3Y/lXnSnJnuRoYaC1sn6nNaneu7n5jjvUNpdXE1rj7MzRg5HA/OuwXwJBLzc3JwR91Mnr05qLVPDttpMcIiBeJhjLHPI/wAism+VXaKoxhWqqnGS/H/I4h4rh5d3kMeeNxUAfmap3Et35373CoOOGzn8q0dZ0poP9Kt3bygfnjJzt9x7ViXc7vHz0FJSUtjavQdGXKzW02/WFvmkAx3qN7stM7bupJz61zTSSSFYI+WcjjPSuq09beyRI1jR5B95yBkmlL3TqwUHK5//2Q=="></div>
        <h1>TI-84 WiFi Setup</h1>
        <p class="subtitle">Configure your calculator's WiFi connection</p>
        <div class="tabs">
            <div class="tab active" onclick="switchTab('wifi')">WiFi</div>
            <div class="tab" onclick="switchTab('eduroam')">Eduroam</div>
        </div>
        <form id="wifi-form" class="form active" action="/save" method="POST">
            <label>WiFi Network Name</label>
            <input type="text" name="ssid" placeholder="Enter your WiFi SSID" required>
            <label>WiFi Password</label>
            <input type="password" name="password" placeholder="Enter your WiFi password">
            <button type="submit">Save & Connect</button>
        </form>
        <form id="eduroam-form" class="form" action="/save" method="POST">
            <input type="hidden" name="ssid" value="eduroam">
            <label>Username</label>
            <input type="text" name="username" placeholder="user@school.edu" required>
            <label>Password</label>
            <input type="password" name="password" placeholder="Enter your password" required>
            <button type="submit">Connect to Eduroam</button>
        </form>
        <div class="footer">TI-84 GPT HACK by Andy</div>
    </div>
    <script>
    function switchTab(t){
        document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));
        document.querySelectorAll('.form').forEach(e=>e.classList.remove('active'));
        if(t==='eduroam'){
            document.querySelectorAll('.tab')[1].classList.add('active');
            document.getElementById('eduroam-form').classList.add('active');
        }else{
            document.querySelectorAll('.tab')[0].classList.add('active');
            document.getElementById('wifi-form').classList.add('active');
        }
    }
    </script>
</body>
</html>
)rawliteral";

const char* successHTML = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Connected!</title>
    <style>
        body { background: #1a1a2e; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .box { text-align: center; padding: 40px; }
        h1 { color: #4ade80; }
    </style>
</head>
<body>
    <div class="box">
        <h1>Connected!</h1>
        <p>WiFi credentials saved. You can close this page.</p>
    </div>
</body>
</html>
)rawliteral";

void handleRoot() {
  webServer.send(200, "text/html", portalHTML);
}

void handleSave() {
  storedSSID = webServer.arg("ssid");
  storedPass = webServer.arg("password");
  storedEapUser = webServer.arg("username");

  prefs.begin("wifi", false);
  prefs.putString("ssid", storedSSID);
  prefs.putString("pass", storedPass);
  if (storedEapUser.length() > 0) {
    prefs.putString("eap_user", storedEapUser);
  } else {
    prefs.remove("eap_user");
  }
  prefs.end();

  out.println("Saved WiFi credentials:");
  out.println("SSID: " + storedSSID);

  webServer.send(200, "text/html", successHTML);

  delay(2000);
  portalActive = false;

  WiFi.softAPdisconnect(true);
  if (storedEapUser.length() > 0) {
    out.println("Connecting via WPA2-Enterprise");
    beginEnterprise(storedSSID.c_str(), storedEapUser.c_str(), storedPass.c_str());
  } else {
    WiFi.begin(storedSSID.c_str(), storedPass.c_str());
  }
}

void handleNotFound() {
  webServer.sendHeader("Location", "http://192.168.4.1/", true);
  webServer.send(302, "text/plain", "");
}

void startCaptivePortal() {
  out.println("[Starting Captive Portal]");
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);

  out.print("AP IP: ");
  out.println(WiFi.softAPIP());

  dnsServer.start(DNS_PORT, "*", WiFi.softAPIP());

  webServer.on("/", handleRoot);
  webServer.on("/save", HTTP_POST, handleSave);
  webServer.onNotFound(handleNotFound);
  webServer.begin();

  portalActive = true;
  out.println("Captive portal started on SSID: calc");
}

void loadSavedCredentials() {
  prefs.begin("wifi", true);
  storedSSID = prefs.getString("ssid", "");
  storedPass = prefs.getString("pass", "");
  storedEapUser = prefs.getString("eap_user", "");
  prefs.end();
}

void beginEnterprise(const char* ssid, const char* user, const char* pass) {
  out.println("=== Enterprise Connect ===");
  out.print("SSID: "); out.println(ssid);
  out.print("User: "); out.println(user);

  WiFi.disconnect(true);
  delay(500);
  WiFi.mode(WIFI_STA);
  delay(500);

  esp_wifi_sta_wpa2_ent_set_identity((uint8_t*)user, strlen(user));
  esp_wifi_sta_wpa2_ent_set_username((uint8_t*)user, strlen(user));
  esp_wifi_sta_wpa2_ent_set_password((uint8_t*)pass, strlen(pass));
  esp_wifi_sta_wpa2_ent_set_ttls_phase2_method(ESP_EAP_TTLS_PHASE2_MSCHAPV2);
  esp_wifi_sta_wpa2_ent_set_disable_time_check(true);

  esp_err_t err = esp_wifi_sta_wpa2_ent_enable();
  out.print("wpa2_ent_enable: ");
  out.println(err);

  WiFi.begin(ssid);
  out.println("WiFi.begin called");
}

void tryAutoConnect() {
  if (storedSSID.length() > 0) {
    out.println("Found saved credentials, connecting...");
    out.println("SSID: " + storedSSID);

    if (storedEapUser.length() > 0) {
      out.println("Using WPA2-Enterprise");
      beginEnterprise(storedSSID.c_str(), storedEapUser.c_str(), storedPass.c_str());
    } else {
      WiFi.begin(storedSSID.c_str(), storedPass.c_str());
    }

    int maxAttempts = (storedEapUser.length() > 0) ? 60 : 20;
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < maxAttempts) {
      delay(500);
      out.print(".");
      attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      out.println("\nConnected to WiFi!");
      out.print("IP: ");
      out.println(WiFi.localIP());
    } else {
      out.println("\nFailed to connect. Use SETUP in calculator to configure WiFi.");
    }
  } else {
    out.println("No saved credentials. Use SETUP in calculator to configure WiFi.");
  }
}

void setup() {
  Serial.begin(115200);
  out.println("[CBL]");

  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
  if (wakeup_reason == ESP_SLEEP_WAKEUP_GPIO) {
    out.println("[woke from deep sleep]");
  }

  cbl.setLines(TIP, RING);
  cbl.resetLines();
  cbl.setupCallbacks(header, data, MAXDATALEN, onReceived, onRequest);
  // cbl.setVerbosity(true, (HardwareSerial *)&Serial);

  pinMode(TIP, INPUT);
  pinMode(RING, INPUT);

  out.println("[preferences]");
  prefs.begin("ccalc", false);
  auto reboots = prefs.getUInt("boots", 0);
  out.print("reboots: ");
  out.println(reboots);
  prefs.putUInt("boots", reboots + 1);
  prefs.end();

#ifdef CAMERA
  out.println("[camera]");

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size = FRAMESIZE_UXGA;
  // this needs to be pixformat grayscale in the future
  config.pixel_format = PIXFORMAT_JPEG;  // for streaming
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  // if PSRAM IC present, init with UXGA resolution and higher JPEG quality
  //                      for larger pre-allocated frame buffer.
  if (config.pixel_format == PIXFORMAT_JPEG) {
    if (psramFound()) {
      config.jpeg_quality = 10;
      config.fb_count = 2;
      config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
      // Limit the frame size when PSRAM is not available
      config.frame_size = FRAMESIZE_SVGA;
      config.fb_location = CAMERA_FB_IN_DRAM;
    }
  } else {
    // Best option for face detection/recognition
    config.frame_size = FRAMESIZE_240X240;
#if CONFIG_IDF_TARGET_ESP32S3
    config.fb_count = 2;
#endif
  }

  // camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    out.printf("Camera init failed with error 0x%x\n", err);
    return;
  } else {
    out.println("camera ready");
    camera_sign = true;  // Camera initialization check passes
  }

  sensor_t* s = esp_camera_sensor_get();
  // enable grayscale
  s->set_special_effect(s, 2);
#endif

  strncpy(message, "default message", MAXSTRARGLEN);
  delay(100);
  memset(data, 0, MAXDATALEN);
  memset(header, 0, 16);

  // Check if we need to push launcher after OTA reboot
  prefs.begin("ccalc", false);
  bool pushLauncher = prefs.getBool("push_launcher", false);
  if (pushLauncher) {
    prefs.putBool("push_launcher", false);
    prefs.end();
    out.println("[pushing launcher after OTA]");
    delay(2000);  // Give calculator time to be ready
    sendProgramVariable("ANDYGPT", __launcher_var, __launcher_var_len);
    out.println("[launcher pushed]");
  } else {
    prefs.end();
  }

  // Set hardcoded MAC address
  {
    uint8_t mac[6] = {0x24, 0xFD, 0xFA, 0x0B, 0x80, 0xBF};
    WiFi.mode(WIFI_STA);
    esp_wifi_set_mac(WIFI_IF_STA, mac);
    out.println("MAC set to 24:FD:FA:0B:80:BF");
  }

  // Load saved WiFi credentials
  loadSavedCredentials();

  // Auto-connect to Suffield Gear (non-blocking)
  WiFi.begin("Suffield Gear", "suffield");
  out.println("[auto-connecting to Suffield Gear in background]");

  telnetServer.begin();
  telnetServer.setNoDelay(true);
  out.println("[ready - telnet on port 23]");
}

void (*queued_action)() = NULL;
unsigned long queued_action_time = 0;

void enterDeepSleep() {
  out.println("[entering deep sleep]");
  Serial.flush();

  if (WiFi.isConnected()) {
    WiFi.disconnect(true);
    delay(100);
  }
  WiFi.mode(WIFI_OFF);

  // Wake on GPIO3 (TIP) going LOW - TI link protocol starts by pulling line LOW
  esp_deep_sleep_enable_gpio_wakeup(1ULL << 3, ESP_GPIO_WAKEUP_GPIO_LOW);
  esp_deep_sleep_start();
}

void loop() {
  // Handle telnet connections
  if (telnetServer.hasClient()) {
    if (telnetClient && telnetClient.connected()) {
      telnetClient.stop();
    }
    telnetClient = telnetServer.accept();
    telnetClient.println("=== TI-84 GPT HACK Serial Monitor ===");
  }

  // Handle captive portal
  if (portalActive) {
    dnsServer.processNextRequest();
    webServer.handleClient();
  }

  if (queued_action && queued_action_time > 0 && millis() >= queued_action_time) {
    out.println("executing queued actions");
    void (*tmp)() = queued_action;
    queued_action_time = 0;
    tmp();
    queued_action = NULL;
  }
  if (command >= 0 && command <= MAXCOMMAND) {
    bool found = false;
    for (int i = 0; i < NUMCOMMANDS; ++i) {
      if (commands[i].id == command && commands[i].num_args == currentArg) {
        found = true;
        out.print("matched command: ");
        out.print(commands[i].name);
        out.print(" (wifi required: ");
        out.print(commands[i].wifi);
        out.print(", connected: ");
        out.print(WiFi.isConnected());
        out.println(")");
        if (commands[i].wifi && !WiFi.isConnected()) {
          out.println("ERROR: WiFi not connected!");
          setError("NO WIFI");
        } else {
          out.print("processing command: ");
          out.println(commands[i].name);
          commands[i].command_fp();
          out.println("command finished");
        }
        break;
      }
    }
  }
  cbl.eventLoopTick();

  // Enter deep sleep after idle timeout
  if (command == -1
      && queued_action == NULL
      && !portalActive
      && lastActivityMillis > 0
      && (millis() - lastActivityMillis) >= IDLE_TIMEOUT_MS) {
    enterDeepSleep();
  }
}

int onReceived(uint8_t type, enum Endpoint model, int datalen) {
  lastActivityMillis = millis();
  char varName = header[3];

  out.print("unlocked: ");
  out.println(unlocked);

  // check for password
  if (!unlocked && varName == 'P') {
    auto password = TIVar::realToLong8x(data, model);
    if (password == PASSWORD) {
      out.println("successful unlock");
      unlocked = true;
      return 0;
    } else {
      out.println("failed unlock");
    }
  }

  if (!unlocked) {
    return -1;
  }

  // check for command
  if (varName == 'C') {
    if (type != VarTypes82::VarReal) {
      return -1;
    }
    int cmd = TIVar::realToLong8x(data, model);
    if (cmd >= 0 && cmd <= MAXCOMMAND) {
      out.print("command: ");
      out.println(cmd);
      startCommand(cmd);
      return 0;
    } else {
      out.print("invalid command: ");
      out.println(cmd);
      return -1;
    }
  }

  if (currentArg >= MAXARGS) {
    out.println("argument overflow");
    setError("argument overflow");
    return -1;
  }

  switch (type) {
    case VarTypes82::VarString:
      {
        // Get the token length from the first two bytes
        int tokenLen = data[0] | (data[1] << 8);
        out.print("token len: ");
        out.println(tokenLen);

        // Debug: print raw hex bytes
        out.print("raw tokens: ");
        for (int i = 0; i < tokenLen && i < 32; i++) {
          out.print("0x");
          if (data[2 + i] < 16) out.print("0");
          out.print(data[2 + i], HEX);
          out.print(" ");
        }
        out.println();

        // Decode the tokens to readable text
        decodeTokenString(data + 2, tokenLen, strArgs[currentArg], MAXSTRARGLEN);
        decodeCasing(strArgs[currentArg]);
        out.print("Str");
        out.print(currentArg);
        out.print(" (decoded): ");
        out.println(strArgs[currentArg]);
        currentArg++;
      }
      break;
    case VarTypes82::VarReal:
      realArgs[currentArg++] = TIVar::realToFloat8x(data, model);
      out.print("Real");
      out.print(currentArg - 1);
      out.print(" ");
      out.println(realArgs[currentArg - 1]);
      break;
    default:
      // maybe set error here?
      return -1;
  }
  return 0;
}

uint8_t frameCallback(int idx) {
  return frame[idx];
}

char varIndex(int idx) {
  return '0' + (idx == 9 ? 0 : (idx + 1));
}

int onRequest(uint8_t type, enum Endpoint model, int* headerlen, int* datalen, data_callback* data_callback) {
  lastActivityMillis = millis();
  char varName = header[3];
  char strIndex = header[4];
  char strname[5] = { 'S', 't', 'r', varIndex(strIndex), 0x00 };
  char picname[5] = { 'P', 'i', 'c', varIndex(strIndex), 0x00 };
  out.print("request for ");
  out.println(varName == 0xaa ? strname : varName == 0x60 ? picname
                                                             : (const char*)&header[3]);
  memset(header, 0, sizeof(header));
  switch (varName) {
    case 0x60:
      if (type != VarTypes82::VarPic) {
        return -1;
      }
      *datalen = PICVARSIZE;
      TIVar::intToSizeWord(*datalen, &header[0]);
      header[2] = VarTypes82::VarPic;
      header[3] = 0x60;
      header[4] = strIndex;
      *data_callback = frameCallback;
      break;
    case 0xAA:
      if (type != VarTypes82::VarString) {
        return -1;
      }
      // Use our own ASCII→TI encoder (TIVar's has bugs like ^→nDeriv)
      *datalen = asciiToTIString(message, data);
      TIVar::intToSizeWord(*datalen, header);
      header[2] = VarTypes82::VarString;
      header[3] = 0xAA;
      // send back as same variable that was requested
      header[4] = strIndex;
      *headerlen = 13;
      break;
    case 'E':
      if (type != VarTypes82::VarReal) {
        return -1;
      }
      *datalen = TIVar::longToReal8x(error, data, model);
      TIVar::intToSizeWord(*datalen, header);
      header[2] = VarTypes82::VarReal;
      header[3] = 'E';
      header[4] = '\0';
      *headerlen = 13;
      break;
    case 'S':
      if (type != VarTypes82::VarReal) {
        return -1;
      }
      out.print("sending S=");
      out.println(status);
      *datalen = TIVar::longToReal8x(status, data, model);
      TIVar::intToSizeWord(*datalen, header);
      header[2] = VarTypes82::VarReal;
      header[3] = 'S';
      header[4] = '\0';
      *headerlen = 13;
      break;
    default:
      return -1;
  }
  return 0;
}

int makeRequest(String url, char* result, int resultLen, size_t* len) {
  memset(result, 0, resultLen);

#ifdef SECURE
  WiFiClientSecure client;
  client.setInsecure();
#else
  WiFiClient client;
#endif
  HTTPClient http;

  out.println(url);
  client.setTimeout(10000);
  http.begin(client, url.c_str());
  http.setTimeout(10000);
  http.addHeader("ngrok-skip-browser-warning", "true");

  // Send HTTP GET request
  int httpResponseCode = http.GET();
  out.print(url);
  out.print(" ");
  out.println(httpResponseCode);

  int responseSize = http.getSize();
  WiFiClient* httpStream = http.getStreamPtr();

  out.print("response size: ");
  out.println(responseSize);

  if (httpResponseCode != 200) {
    return httpResponseCode;
  }

  if (httpStream->available() > resultLen) {
    out.print("response size: ");
    out.print(httpStream->available());
    out.println(" is too big");
    return -1;
  }

  while (httpStream->available()) {
    *(result++) = httpStream->read();
  }
  *len = responseSize;

  http.end();

  return 0;
}

// Unified GPT request — every /gpt/ask call goes through here so all
// commands share one conversation. Server always returns "sid|answer";
// we strip the sid prefix, update the global sessionId, and leave the
// answer at the start of the `response` buffer for the caller.
int askGpt(const String& question, bool isMath) {
  String url = String(SERVER) + "/gpt/ask?";
  if (isMath) url += "math=1&";
  url += "sid=" + urlEncode(String(sessionId)) + "&question=" + urlEncode(question);

  size_t realsize = 0;
  if (makeRequest(url, response, MAXHTTPRESPONSELEN, &realsize)) {
    return -1;
  }

  char* delim = strchr(response, '|');
  if (delim) {
    *delim = '\0';
    strncpy(sessionId, response, sizeof(sessionId) - 1);
    sessionId[sizeof(sessionId) - 1] = '\0';
    memmove(response, delim + 1, strlen(delim + 1) + 1);
  }
  return 0;
}

void connect() {
  if (storedSSID.length() == 0) {
    setError("no wifi configured");
    return;
  }
  out.print("SSID: ");
  out.println(storedSSID);
  out.print("PASS: ");
  out.println("<hidden>");
  bool enterprise = storedEapUser.length() > 0;
  if (enterprise) {
    out.println("Using WPA2-Enterprise");
    beginEnterprise(storedSSID.c_str(), storedEapUser.c_str(), storedPass.c_str());
  } else {
    WiFi.begin(storedSSID.c_str(), storedPass.c_str());
  }
  int maxAttempts = enterprise ? 60 : 20;  // 30s for enterprise, 10s for regular
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < maxAttempts) {
    delay(500);
    attempts++;
    if (WiFi.status() == WL_CONNECT_FAILED) {
      setError("failed to connect");
      return;
    }
  }
  if (WiFi.status() == WL_CONNECTED) {
    setSuccess("connected");
  } else {
    setError("connection timeout");
  }
}

void disconnect() {
  WiFi.disconnect(true);
  setSuccess("disconnected");
}

void setup_wifi() {
  // Stop any existing WiFi connection
  WiFi.disconnect(true);
  delay(100);

  // Start the captive portal
  startCaptivePortal();
  setSuccess("OK");
}

void gpt() {
  const char* prompt = strArgs[0];
  out.print("prompt: ");
  out.println(prompt);

  if (askGpt(String(prompt), false)) {
    setError("error making request");
    return;
  }

  out.print("response: ");
  out.println(response);

  setSuccess(response);
}

void gpt_chat() {
  const char* prompt = strArgs[0];
  if (askGpt(String(prompt), false)) {
    setError("REQUEST FAILED");
    return;
  }
  setSuccess(response);
}

void gpt_history() {
  int page = (int)realArgs[0];
  if (strlen(sessionId) == 0) {
    setError("NO SESSION");
    return;
  }
  String url = String(SERVER) + "/gpt/history?sid=" + urlEncode(String(sessionId)) + "&p=" + String(page);

  size_t realsize = 0;
  if (makeRequest(url, response, MAXHTTPRESPONSELEN, &realsize)) {
    setError("REQUEST FAILED");
    return;
  }
  setSuccess(response);
}

void gpt_new() {
  sessionId[0] = '\0';
  setSuccess("NEW CHAT");
}

void derivative() {
  const char* expr = strArgs[0];
  out.print("derivative of: ");
  out.println(expr);

  String prompt = "Find the derivative of f(x) = " + String(expr) + ". Compute it step by step then give ONLY the simplified result.";
  if (askGpt(prompt, true)) {
    setError("error making request");
    return;
  }

  out.print("result: ");
  out.println(response);

  setSuccess(response);
}

void integrate() {
  const char* expr = strArgs[0];
  out.print("integrate: ");
  out.println(expr);

  String prompt = "Find the indefinite integral of f(x) = " + String(expr) + ". Compute it then give ONLY the result with +C.";
  if (askGpt(prompt, true)) {
    setError("error making request");
    return;
  }

  out.print("result: ");
  out.println(response);

  setSuccess(response);
}

void series() {
  const char* expr = strArgs[0];
  out.print("series convergence: ");
  out.println(expr);

  String prompt = "Does the infinite series sum from n=1 to infinity of " + String(expr) + " converge or diverge? State CONVERGES or DIVERGES, which test, and the sum if known. Brief.";
  if (askGpt(prompt, true)) {
    setError("error making request");
    return;
  }

  setSuccess(response);
}

void double_integral() {
  const char* expr = strArgs[0];
  out.print("double integral: ");
  out.println(expr);

  String prompt = "Evaluate the double integral: " + String(expr) + ". Compute step by step, give ONLY the final number.";
  if (askGpt(prompt, true)) {
    setError("REQUEST FAILED");
    return;
  }

  setSuccess(response);
}

void avg_value() {
  const char* expr = strArgs[0];
  out.print("average value: ");
  out.println(expr);

  String prompt = "Calculate the average value of a function: " + String(expr) + ". Use the formula: avg = (1/Area) * integral from xlow to xhigh of integral from ylow to yhigh of f(x,y) dy dx, where Area = (xhigh-xlow)*(yhigh-ylow). Show the setup: INTEGRAND: (show the fraction 1/Area * f(x,y)), AREA: (show the value), then compute the double integral step by step and give the FINAL ANSWER as a number or fraction.";
  if (askGpt(prompt, true)) {
    setError("REQUEST FAILED");
    return;
  }

  setSuccess(response);
}

void math_solver() {
  const char* problem = strArgs[0];
  out.print("math solver: ");
  out.println(problem);

  String prompt = "Solve this math problem. Show ONLY the final answer, no steps. Problem: " + String(problem);
  if (askGpt(prompt, true)) {
    setError("REQUEST FAILED");
    return;
  }

  setSuccess(response);
}

// ============================================================
// EM REFERENCE CONTENT (no internet required)
// Steps separated by '>'. Each step <=16 chars to fit one calc
// row. ~ -> pi (TI builtin), @ -> theta (TI builtin). Other
// Greek letters spelled out (rho/sigma/lambda/omega/tau/phi/mu).
// Int() = integral. EMF = electromotive force.
// ============================================================

const char* DERIV_BODIES[] = {
  // 0: RC CHRG
  "EMF=iR+q/C>i=dq/dt>Rdq/dt+q/C=EMF>dq/(EMFC-q)>=dt/(RC)>-ln(EMFC-q)>=t/RC+K>t=0:q=0>K=-ln(EMFC)>q=EMFC*>(1-e^-t/RC)>i=(EMF/R)*>e^-t/RC>tau=RC",
  // 1: RC DSCH
  "q/C+iR=0>i=dq/dt>Rdq/dt=-q/C>dq/q=-dt/(RC)>ln(q/Q0)=>-t/(RC)>q=Q0*e^-t/RC>i=-(Q0/RC)*>e^-t/RC>|i|=I0*e^-t/RC>I0=Q0/RC>tau=RC",
  // 2: LC OSC
  "q/C+L*di/dt=0>i=dq/dt>q/C+L*>d2q/dt2=0>d2q/dt2=>-(1/(LC))*q>omega2=1/(LC)>omega=>1/sqrt(LC)>T=2~*sqrt(LC)>q=Qm*cos(>omega*t+phi)>i=-Qm*omega*>sin(omega*t)>Im=Qm*omega>1/2*C*V2=>1/2*L*I2",
  // 3: LR CHRG
  "EMF=iR+L*di/dt>L*di/dt=>EMF-iR>di/(EMF/R-i)>=R/L*dt>-ln(EMF/R-i)>=Rt/L+K>t=0:i=0>K=-ln(EMF/R)>i=(EMF/R)*>(1-e^-Rt/L)>tau=L/R",
  // 4: LR DSCH
  "L*di/dt+iR=0>di/i=-R/L*dt>ln(i/I0)=>-Rt/L>i=I0*e^-Rt/L>I0=EMF/R>tau=L/R",
  // 5: SPHERE E (uniform rho)
  "Int(E*dA)=>Qenc/eps0>r<R INSIDE>Qenc=rho*>(4/3)~*r3>E*4~*r2=>(rho*4~*r3)>/(3*eps0)>E=rho*r/>(3*eps0)>R<r OUTSIDE>Qenc=Q>E*4~*r2=>Q/eps0>E=kQ/r2",
  // 6: CYL E (line charge lambda)
  "Int(E*dA)=>Qenc/eps0>Qenc=lambda*L>E*2~*r*L=>lambda*L/eps0>E=lambda/>(2~*eps0*r)>E=2k*lambda/r",
  // 7: PLANE E (sigma)
  "Int(E*dA)=>Qenc/eps0>Qenc=sigma*A>2EA=sigma*A>/eps0>E=sigma/>(2*eps0)",
  // 8: PAR PLT C
  "Q=sigma*A>E=sigma/eps0>V=E*d>V=sigma*d/eps0>V=Q*d/>(eps0*A)>C=Q/V>C=eps0*A/d",
  // 9: MOT EMF (bar)
  "Phi=BA=BLx>dPhi/dt=>BL*dx/dt=BLv>EMF=-dPhi/dt>|EMF|=BLv>i=BLv/R>F=BiL=>B2*L2*v/R>m*dv/dt=>-B2L2v/R>v=v0*e^-t/tau>tau=mR/(B2L2)",
  // 10: ROT LOOP
  "Phi=BA*cos(>omega*t)>dPhi/dt=>-BA*omega*>sin(omega*t)>EMF=NBA*omega>*sin(omega*t)>EMFm=NBA*omega",
  // 11: CHG B
  "Phi=B*A>dPhi/dt=>A*dB/dt>EMF=-A*dB/dt>|EMF|=A|dB/dt|>i=EMF/R",
  // 12: LOOP B
  "dB=mu0/(4~)*>I*dl x rh/r2>r=R const>|dl x rh|=dl>B=mu0*I/>(4~*R2)*>Int(dl)>Int(dl)=2~*R>B=mu0*I/(2R)",
  // 13: INF WIRE B
  "Int(B*ds)=>mu0*Ienc>B*2~*r=>mu0*I>B=mu0*I/>(2~*r)",
  // 14: SOLN B
  "Int(B*ds)=>mu0*Ienc>Ienc=n*L*I>B*L=mu0*n*L*I>B=mu0*n*I>n=N/L",
  // 15: CAP U
  "dU=V*dq>V=q/C>U=Int(q/C*dq)>=Int(q*dq)/C>U=Q2/(2C)>Q=CV>U=1/2*C*V2>U=1/2*Q*V",
  // 16: SPHERE V (conducting shell)
  "Cond shell Q,R:>r<R INSIDE>E=0 (cond)>V=kQ/R const>same as surface>R<r OUTSIDE>V=kQ/r>like point chg>V=-Int(E*dr)>from infinity",
  // 17: CYLINDER V (line charge)
  "Line charge:>E=lambda/>(2~*eps0*r)>V_B-V_A=>-Int(E*dr)>From R to r>V=-lambda/>(2~*eps0)>*ln(r/R)>Logarithmic>(no V=0 at inf)",
  // 18: RING/HOOP on axis
  "Charge -Q, R>r=sqrt(z2+R2)>each dq same r>V=k*(-Q)/>sqrt(z2+R2)>E_z=-dV/dz>E_z=-kQz/>(z2+R2)^(3/2)>Max E mag at>z=+/-R/sqrt(2)",
};
const int DERIV_COUNT = sizeof(DERIV_BODIES) / sizeof(char*);

const char* EQUATION_BODIES[] = {
  // 0: FLUX
  "Phi=E*A*>cos(@)>For uniform E>@=angle btw>E and area vec>If E para A:>Phi=EA>If E perp A:>Phi=0",
  // 1: UNIFORM V
  "dV=-E*d>For uniform E>over distance d>E from high V>to low V>E=-dV/dx>general case",
  // 2: CAP U (alt forms)
  "U=1/2*Q*V>Equivalent:>U=1/2*C*V2>U=Q2/(2C)>Q=CV>Pick by what's>held constant",
  // 3: POWER
  "P=I*V (given)>P=I2*R>P=V2/R>From V=IR:>sub in P=IV>P=I*(IR)=I2R>P=(V/R)*V=V2/R",
  // 4: RC TRANSIENT
  "Charging:>q=EMFC*>(1-e^-t/RC)>i=(EMF/R)*>e^-t/RC>Discharging:>q=Q0*e^-t/RC>i=I0*e^-t/RC>tau=RC>at tau:63.2%>at 5tau:done",
  // 5: LR TRANSIENT
  "Charging:>i=(EMF/R)*>(1-e^-Rt/L)>Discharging:>i=I0*e^-Rt/L>tau=L/R",
  // 6: GAUSS LAW
  "Int(E*dA)=>Qenc/eps0>LHS=closed>surface S>Qenc=charge>inside S>Use symmetry>to pull E out",
  // 7: AMPERE LAW
  "Int(B*ds)=>mu0*Ienc>LHS=closed>loop L>Ienc=current>through L>Use symmetry>to pull B out",
  // 8: MOTIONAL EMF
  "EMF=B*L*v>Conductor moves>velocity v>length L in B>v perp B perp L>From F=qv*B>charges separate",
  // 9: SOLENOID L
  "L=mu0*N2*A/l>N=total turns>A=cross-sec>l=length>n=N/l per m>L=mu0*n2*A*l",
  // 10: LC FREQ
  "omega=>1/sqrt(LC)>T=2~*sqrt(LC)>f=1/(2~*>sqrt(LC))>From SHM:>d2q/dt2=>-(1/LC)*q",
  // 11: COULOMB K
  "k=1/(4~*eps0)>k=8.99e9>Nm2/C2>eps0=8.85e-12>F/m or>C2/(Nm2)>F=kQ1Q2/r2",
  // 12: DENSITIES
  "Linear:>lambda=Q/L>Surface:>sigma=Q/A>Volume:>rho=Q/V>In Gauss:>Qenc=lambda*L>sigma*A or>rho*V",
  // 13: MAXWELL
  "1)Int(E*dA)=>Q/eps0>2)Int(B*dA)=0>3)Int(E*dl)=>-dPhiB/dt>4)Int(B*dl)=>mu0*I+>mu0*eps0*>dPhiE/dt",
  // 14: NETWORK
  "Cap series:>1/Ceq=sum>1/Ci>Cap parallel:>Ceq=sum Ci>Res series:>Req=sum Ri>Res parallel:>1/Req=sum>1/Ri>Opposite of res",
  // 15: RESISTIVITY
  "R=rho*L/A>rho=resistivity>L=length>A=cross-sec>R(T)=R0(1+>alpha*(T-T0))>units: Ohm*m",
  // 16: KIRCHHOFF
  "Junction Rule:>sum I in=>sum I out>Loop Rule:>sum dV=0>around loop>EMF up, IR down",
  // 17: TORQUE LOOP
  "tau=NIAB*sin(@)>N=turns>I=current>A=loop area>B=field>@=angle btw>n vector & B>Loop aligns>n with B",
  // 18: F ON Q
  "F=qvB*sin(@)>@=angle btw>v and B>Max when perp>Zero when para>F perp v and B>B does no work",
  // 19: F ON WIRE
  "F=ILB*sin(@)>I=current>L=length>B=field>@=angle btw>I and B>Same form as>F=qvB",
  // 20: U DENSITY
  "u_E=1/2*eps0*E2>E energy/vol>u_B=B2/(2mu0)>B energy/vol>u_total=>u_E+u_B>EM wave:>both equal",
  // 21: POYNTING
  "S=(1/mu0)*ExB>EM energy flow>per unit area>per unit time>|S|=intensity>W/m2>Direction:>EM wave dir",
  // 22: PARA WIRES
  "F/L=mu0*I1*I2/>(2~*d)>Same dir:>ATTRACT>Opposite dir:>REPEL>d=wire sep",
  // 23: CYCLOTRON
  "Charged in B:>r=mv/(qB)>radius>T=2~*m/(qB)>period>omega=qB/m>angular freq>B perp v>circular",
  // 24: TRANSFORMER
  "Vs/Vp=Ns/Np>voltage ratio>Is/Ip=Np/Ns>current ratio>P_in=P_out>(ideal)>Step up:Ns>Np>Step down:Ns<Np",
  // 25: QUANTIZATION
  "Q=n*e>n=integer>e=1.60e-19 C>elementary chg>Charge cant be>created or>destroyed>only transferred",
  // 26: TOROID
  "B=mu0*N*I/>(2~*r)>Inside toroid>N=total turns>r=radius from>center axis>Azimuthal dir",
  // 27: CURRENT DIV
  "2 R parallel:>I1=I*R2/>(R1+R2)>I2=I*R1/>(R1+R2)>Bigger R gets>smaller share",
  // 28: DRIFT VEL
  "I=n*q*v_d*A>n=carrier num>density 1/m3>q=charge each>v_d=drift vel>A=cross-sec>J=I/A=n*q*v_d>J=current dens>(A/m2)",
  // 29: INTERNAL R
  "V_t=EMF-I*r>V_t=terminal V>r=internal R>Open ckt:>I=0, V_t=EMF>Short ckt:>I=EMF/r MAX>(limited by r)",
  // 30: WIRE STRETCH
  "Stretch by k:>L'=k*L>Volume const>so A'=A/k>R=rho*L/A>R'=rho*kL/(A/k)>R'=k2 * R>Scales as k2",
};
const int EQUATION_COUNT = sizeof(EQUATION_BODIES) / sizeof(char*);

const char* RHR_BODIES[] = {
  // 0: CURR WIRE B
  "Wire B field:>Thumb=I dir>Fingers curl>=B direction>B above wire>points OUT or>IN based on I",
  // 1: F ON CHARGE
  "F=qv*B (+chg):>Fingers=v dir>Curl to B dir>Thumb=F dir>Reverse for>negative charge",
  // 2: F ON WIRE
  "F=IL*B>Fingers=I dir>Curl toward B>Thumb=F dir",
  // 3: LENZ
  "Flux changing>Find dB/dt dir>i opposes change>Curl fingers>in i direction>Thumb=Binduced",
  // 4: LOOP/SOLN B
  "Curl fingers=>I direction>Thumb=B inside>(N pole side)",
  // 5: CROSS PROD
  "A x B:>Fingers=A dir>Curl toward B>Thumb=A*B dir>Perp to both",
};
const int RHR_COUNT = sizeof(RHR_BODIES) / sizeof(char*);

const char* BEHAVIOR_BODIES[] = {
  // 0: CONDUCTOR
  "E=0 INSIDE>All charge on>outer surface>Whole cond=>equipotential>E outside:>sigma/eps0>perp to surf",
  // 1: CAP IMMED/LONG
  "t=0+:>Cap=short wire>V_C=0>Full EMF on R>i=EMF/R>t=infty:>Cap=open ckt>i=0, V_C=EMF",
  // 2: IND IMMED/LONG
  "t=0+:>L=open ckt>i=0>Full EMF on L>t=infty:>L=short wire>V_L=0>i=EMF/R",
  // 3: CAP vs IND
  "Cap: starts as>short, ends open>Ind: starts as>open, ends short>Each opposes>sudden change",
  // 4: NETWORK
  "Series R:>Req=sum Ri>Series C:>1/Ceq=sum 1/Ci>Parallel R:>1/Req=sum 1/Ri>Parallel C:>Ceq=sum Ci>Opposite pattern",
  // 5: DIELECTRIC
  "kappa boosts C>divides E by k>Battery on:>V fixed,C up>Q up, U up>Battery off:>Q fixed,C up>V down, U down",
  // 6: CIRC IN B
  "F=qv*B perp v>B does no work>KE constant>r=mv/(qB)>T=2~*m/(qB)>If v has || B:>helix path",
  // 7: V FROM E
  "E perp to>equipotentials>E points high>V to low V>Closer eq lines>=stronger E>V=-Int(E*dx)",
  // 8: INDEPENDENCE
  "R, C, L do not>depend on:>R: current I>C: charge Q>or voltage V>L: current I>Only geometry>and material",
  // 9: SUPERPOSITION
  "V: scalar add>V_tot=sum Vi>E,F: vector add>component-wise>Use V whenever>possible: easier>than vector E",
  // 10: REFERENCE V
  "V=0 reference:>point charges:>V=0 at infinity>Uniform field:>V=0 at origin>Choose convention>before solving",
  // 11: SHARP POINT
  "Conductor:>charge dens>highest at>sharpest curve>(small radius)>E strongest near>pointy tips>Why lightning>rods work",
  // 12: FIELD LINES
  "Rules:>Start on +chg>End on -chg>(or at infty)>Density=field>strength>Never cross>(field unique>at each point)>Tangent=E dir",
  // 13: GROUNDING
  "Ground=>infinite charge>sink/source>Ground a cond:>Net Q -> 0>V final = 0>(Earth ref)>Cant ground>an insulator",
  // 14: FARADAY CAGE
  "Hollow cond:>Outer E=0>in cavity>Shields from>external E>(cell phone in>metal box)>Excess charge>on outer surf",
  // 15: CHARGE REDISTR
  "Connect 2 cond>with wire:>Charge flows>until V1=V2>(same potential)>Q_total const>(conservation)>Spheres:>kQ1/R1=kQ2/R2>Q1/Q2=R1/R2",
  // 16: POWER DISSIPATION
  "P=I2*R=V2/R>SERIES (same I):>Big R = big P>P=I2*R rule>PARALLEL:>(same V)>Small R = big P>P=V2/R rule",
  // 17: METER PLACEMENT
  "AMMETER:>measures I>Connect SERIES>Ideal R=0>VOLTMETER:>measures V>Connect PARALLEL>Ideal R=infty>(no I drawn)",
  // 18: dq ELEMENT
  "Continuous chg:>Linear:>dq=lambda*dL>Surface:>dq=sigma*dA>Volume:>dq=rho*dV>Then Int over>the body",
};
const int BEHAVIOR_COUNT = sizeof(BEHAVIOR_BODIES) / sizeof(char*);

const char* RULE_BODIES[] = {
  // 0: KIRCH JUNCTION
  "Sum I in =>Sum I out>at every node>(conservation>of charge)>If 3 wires meet:>I1+I2=I3>or signed sum=0",
  // 1: KIRCH LOOP
  "Sum dV=0>around any>closed loop>(conservation>of energy)>EMF: + when>traverse - to +>IR: - when>traverse with I",
  // 2: LAW OF CHARGES
  "Same sign:>REPEL>Opposite sign:>ATTRACT>Force mag:>F=kq1q2/r2>1/r2 always",
  // 3: LENZ
  "Induced i>opposes change>in mag flux>NOT the flux>only CHANGE>If Phi rising:>i opposes, B opp>If Phi falling:>i supports B",
  // 4: CONSERVATION
  "Charge conserved>Q=n*e (integer)>e=1.60e-19 C>Cant create or>destroy charge>Only transferred>Energy: KVL=0>around loop",
  // 5: SUPERPOSITION
  "V is SCALAR sum:>V=sum Vi>(easier!)>E and F: VECTORS>must add>component-wise>Use V whenever>possible",
  // 6: SYMMETRY
  "Gauss when:>Sphere/Cyl/Plane>Choose surface>perp or para E>Ampere when:>Long wire,>solenoid, toroid>Else use>Biot-Savart",
  // 7: INDEPENDENCE
  "R: not on I>C: not on Q,V>L: not on I>Only geometry>and material>Example:>Double V>Same R, C, L",
};
const int RULE_COUNT = sizeof(RULE_BODIES) / sizeof(char*);

const char* GRAPH_BODIES[] = {
  // 0: RC CHRG Q
  "RC CHRG Q vs t>SHAPE:EXP RISE>y(0)=0>y(inf)=EMF*C>y(tau)=>0.632*EMF*C>y=EMFC*>(1-e^-t/RC)>tau=RC",
  // 1: RC CHRG I
  "RC CHRG I vs t>SHAPE:EXP DECAY>y(0)=EMF/R MAX>y(inf)=0>y(tau)=>0.368*EMF/R>y=(EMF/R)*>e^-t/RC>tau=RC",
  // 2: RC DSCH Q
  "RC DSCH Q vs t>SHAPE:EXP DECAY>y(0)=Q0 MAX>y(inf)=0>y(tau)=0.368*Q0>y=Q0*e^-t/RC>tau=RC",
  // 3: RC DSCH I
  "RC DSCH I vs t>SHAPE:EXP DECAY>y(0)=Q0/(RC) MAX>y(inf)=0>y=I0*e^-t/RC>I0=Q0/RC>(neg of dQ/dt)>tau=RC",
  // 4: RL CHRG I
  "RL CHRG I vs t>SHAPE:EXP RISE>y(0)=0>y(inf)=EMF/R>y(tau)=>0.632*EMF/R>y=(EMF/R)*>(1-e^-Rt/L)>tau=L/R",
  // 5: RL DSCH I
  "RL DSCH I vs t>SHAPE:EXP DECAY>y(0)=I0=EMF/R>y(inf)=0>y(tau)=0.368*I0>y=I0*e^-Rt/L>tau=L/R",
  // 6: LC Q
  "LC Q vs t>SHAPE:COS OSC>y=Qm*cos(>omega*t+phi)>omega=1/sqrt(LC)>T=2~*sqrt(LC)>Peak: y=Qm>Zero at T/4",
  // 7: LC I
  "LC I vs t>SHAPE:SIN OSC>y=-Im*sin(>omega*t+phi)>Im=Qm*omega>90 DEG lag Q>Peak at T/4>Zero at t=0",
  // 8: SPHERE V
  "SPHERE V vs r>r<R INSIDE:>V=kQ/(2R3)*>(3R2-r2)>Parabolic down>R<r OUTSIDE:>V=kQ/r>1/r decay>V(R)=kQ/R",
  // 9: SPHERE E
  "SPHERE E vs r>r<R INSIDE:>E=kQ*r/R3>LINEAR rise>R<r OUTSIDE:>E=kQ/r2>1/r2 decay>Peak at r=R",
  // 10: CYL V
  "CYL V vs r>V=-2k*lambda*>ln(r/r0)>LOG decay>r0=reference>radius>Same shape>inside & out",
  // 11: CYL E
  "CYL E vs r>SHAPE:1/r>E=2k*lambda/r>E=lambda/>(2~*eps0*r)>HYPERBOLIC>Goes to 0 as>r -> infty",
  // 12: WIRE B
  "INF WIRE B vs r>SHAPE:1/r>B=mu0*I/(2~*r)>HYPERBOLIC>Direction:>RHR thumb=I>B circles wire",
  // 13: SOLN B
  "SOLN B in/out>INSIDE: const>B=mu0*n*I>OUTSIDE: B=0>STEP FUNCTION>n=N/L turns/m>Long solenoid",
};
const int GRAPH_COUNT = sizeof(GRAPH_BODIES) / sizeof(char*);

static void emLookup(const char** table, int count, const char* tag) {
  int idx = (int)realArgs[0];
  out.print(tag);
  out.print(": idx=");
  out.println(idx);
  if (idx < 0 || idx >= count) {
    setError("BAD INDEX");
    return;
  }
  setSuccess(table[idx]);
}

void em_derive_get()   { emLookup(DERIV_BODIES,    DERIV_COUNT,    "em_derive_get"); }
void em_equation_get() { emLookup(EQUATION_BODIES, EQUATION_COUNT, "em_equation_get"); }
void em_rhr_get()      { emLookup(RHR_BODIES,      RHR_COUNT,      "em_rhr_get"); }
void em_behavior_get() { emLookup(BEHAVIOR_BODIES, BEHAVIOR_COUNT, "em_behavior_get"); }
void em_graph_get()    { emLookup(GRAPH_BODIES,    GRAPH_COUNT,    "em_graph_get"); }
void em_rules_get()    { emLookup(RULE_BODIES,     RULE_COUNT,     "em_rules_get"); }

void em_solver() {
  const char* problem = strArgs[0];
  out.print("em_solver: ");
  out.println(problem);

  String prompt =
    "Solve this AP Physics C E&M problem and return ONLY the final numeric answer with SI units "
    "(or a short closed-form symbolic answer if the inputs are symbolic). "
    "Use Coulomb's, Gauss's, Ohm's, Kirchhoff's, Biot-Savart, Ampere's, Faraday's, and Lenz's laws as appropriate. "
    "UPPERCASE only, no LaTeX, no steps. Use SQRT() for roots, ^ for powers. "
    "Problem: " + String(problem);
  if (askGpt(prompt, true)) {
    setError("REQUEST FAILED");
    return;
  }
  setSuccess(response);
}

void get_version() {
  setSuccess(FIRMWARE_VERSION);
}

void get_newest() {
  String versionUrl = String(SERVER) + "/firmware/version";
  size_t realsize = 0;
  if (makeRequest(versionUrl, response, MAXHTTPRESPONSELEN, &realsize)) {
    setError("CHECK FAILED");
    return;
  }
  setSuccess(response);
}

void weather() {
  const char* city = strArgs[0];
  out.print("weather for: ");
  out.println(city);

  String prompt = "Current weather in " + String(city) + "? Give temp in F and C, conditions. Very brief, max 50 words.";
  if (askGpt(prompt, false)) {
    setError("REQUEST FAILED");
    return;
  }

  setSuccess(response);
}

void translate() {
  const char* text = strArgs[0];
  out.print("translate: ");
  out.println(text);

  // Format: "LANG:text" e.g. "SPANISH:hello" or just "text" for auto-detect to English
  String prompt = "Translate this: " + String(text) + ". Give only the translation, nothing else.";
  if (askGpt(prompt, false)) {
    setError("REQUEST FAILED");
    return;
  }

  setSuccess(response);
}

void define() {
  const char* word = strArgs[0];
  out.print("define: ");
  out.println(word);

  String prompt = "Define '" + String(word) + "' in one brief sentence.";
  if (askGpt(prompt, false)) {
    setError("REQUEST FAILED");
    return;
  }

  setSuccess(response);
}

void units() {
  const char* conversion = strArgs[0];
  out.print("convert: ");
  out.println(conversion);

  String prompt = "Convert: " + String(conversion) + ". Give only the result with units.";
  if (askGpt(prompt, false)) {
    setError("REQUEST FAILED");
    return;
  }

  setSuccess(response);
}

void get_mac() {
  String mac = WiFi.macAddress();
  setSuccess(mac.c_str());
}

void set_mac() {
  const char* macStr = strArgs[0];

  if (strcmp(macStr, "RESET") == 0) {
    prefs.begin("mac", false);
    prefs.remove("custom");
    prefs.end();
    setSuccess("MAC RESET. REBOOTING");
    delay(1000);
    ESP.restart();
    return;
  }

  // Parse XX:XX:XX:XX:XX:XX
  uint8_t mac[6];
  if (sscanf(macStr, "%hhx:%hhx:%hhx:%hhx:%hhx:%hhx", &mac[0], &mac[1], &mac[2], &mac[3], &mac[4], &mac[5]) != 6) {
    setError("BAD FORMAT XX:XX:XX:XX:XX:XX");
    return;
  }

  WiFi.mode(WIFI_STA);
  if (esp_wifi_set_mac(WIFI_IF_STA, mac) != ESP_OK) {
    setError("FAILED TO SET MAC");
    return;
  }

  prefs.begin("mac", false);
  prefs.putString("custom", String(macStr));
  prefs.end();

  setSuccess("MAC SET. REBOOTING");
  delay(1000);
  ESP.restart();
}

void wifi_scan() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  int n = WiFi.scanNetworks();
  scanResultCount = min(n, 6);

  if (n == 0) {
    setSuccess("NO NETWORKS FOUND");
    return;
  }

  char buf[MAXSTRARGLEN];
  int pos = 0;

  for (int i = 0; i < scanResultCount; i++) {
    String ssid = WiFi.SSID(i);
    strncpy(scanResults[i], ssid.c_str(), 32);
    scanResults[i][32] = '\0';

    // Format as "N:SSID" padded to 16 chars so each gets its own line on TI-84
    ssid.toUpperCase();
    char entry[17];
    snprintf(entry, sizeof(entry), "%d:%-14s", i + 1, ssid.c_str());
    entry[16] = '\0';
    memcpy(buf + pos, entry, 16);
    pos += 16;
  }

  buf[pos] = '\0';
  WiFi.scanDelete();
  setSuccess(buf);
}

void wifi_connect() {
  int idx = (int)realArgs[0] - 1;
  const char* password = strArgs[1];

  if (idx < 0 || idx >= scanResultCount) {
    setError("INVALID SELECTION");
    return;
  }

  const char* ssid = scanResults[idx];
  out.print("Connecting to: ");
  out.println(ssid);

  WiFi.begin(ssid, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    storedSSID = String(ssid);
    storedPass = String(password);
    storedEapUser = "";
    prefs.begin("wifi", false);
    prefs.putString("ssid", storedSSID);
    prefs.putString("pass", storedPass);
    prefs.remove("eap_user");
    prefs.end();
    setSuccess("CONNECTED");
  } else {
    setError("CONNECTION FAILED");
  }
}

void eduroam_connect() {
  const char* user = "jennifersxq.walkerazj.687@my.csun.edu";
  const char* pass = "wcGSRD25983356";
  out.println("Eduroam connect (hardcoded credentials)");

  beginEnterprise("eduroam", user, pass);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 60) {
    delay(500);
    int status = WiFi.status();
    out.print(" s=");
    out.print(status);
    attempts++;
  }
  out.println();
  out.print("Final WiFi.status(): ");
  out.println(WiFi.status());

  if (WiFi.status() == WL_CONNECTED) {
    out.println("Eduroam connected!");
    storedSSID = "eduroam";
    storedPass = String(pass);
    storedEapUser = String(user);
    prefs.begin("wifi", false);
    prefs.putString("ssid", storedSSID);
    prefs.putString("pass", storedPass);
    prefs.putString("eap_user", storedEapUser);
    prefs.end();
    setSuccess("CONNECTED");
  } else {
    setError("CONNECTION FAILED");
  }
}

void suffield_connect() {
  const char* ssid = "Suffield Gear";
  const char* pass = "suffield";
  out.println("Suffield connect (hardcoded)");

  WiFi.begin(ssid, pass);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    storedSSID = String(ssid);
    storedPass = String(pass);
    storedEapUser = "";
    prefs.begin("wifi", false);
    prefs.putString("ssid", storedSSID);
    prefs.putString("pass", storedPass);
    prefs.remove("eap_user");
    prefs.end();
    out.print("Connected! IP: ");
    out.println(WiFi.localIP());
    setSuccess("CONNECTED");
  } else {
    setError("CONNECTION FAILED");
  }
}

void get_ip() {
  if (WiFi.status() == WL_CONNECTED) {
    setSuccess(WiFi.localIP().toString().c_str());
  } else {
    setError("NOT CONNECTED");
  }
}

char programName[256];
char programData[4096];
size_t programLength;

void _resetProgram() {
  memset(programName, 0, 256);
  memset(programData, 0, 4096);
  programLength = 0;
}

void _otaFlashAndReboot() {
  out.println("Downloading + flashing firmware...");
  String firmwareUrl = String(SERVER) + "/firmware/download";

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(120000);

  httpUpdate.rebootOnUpdate(false);
  httpUpdate.setLedPin(-1);
  httpUpdate.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);
  t_httpUpdate_return ret = httpUpdate.update(client, firmwareUrl);

  switch (ret) {
    case HTTP_UPDATE_FAILED:
      out.printf("Firmware update failed (%d): %s\n",
        httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
      out.println("OTA FAILED - old firmware still running");
      return;
    case HTTP_UPDATE_NO_UPDATES:
      out.println("No firmware binary on server");
      return;
    case HTTP_UPDATE_OK:
      out.println("Firmware written to flash!");
      // Set flag to push launcher after reboot (from embedded launcher.h)
      prefs.begin("ccalc", false);
      prefs.putBool("push_launcher", true);
      prefs.end();
      out.println("Rebooting with new firmware...");
      delay(500);
      ESP.restart();
      return;
  }
}

void ota_update() {
  out.println("Starting OTA update...");
  out.print("Current version: ");
  out.println(FIRMWARE_VERSION);

  // Check for new version
  String versionUrl = String(SERVER) + "/firmware/version";
  size_t realsize = 0;
  if (makeRequest(versionUrl, response, MAXHTTPRESPONSELEN, &realsize)) {
    setError("CHECK FAILED");
    return;
  }

  String serverVersion = String(response);
  serverVersion.trim();
  out.print("Server: ");
  out.print(serverVersion);
  out.print(" Local: ");
  out.println(FIRMWARE_VERSION);

  // Queue firmware flash (gives calc time to read status first)
  queued_action = _otaFlashAndReboot;
  queued_action_time = millis() + 3000;
  setSuccess("FLASHING FIRMWARE...");
}

void send() {
  const char* recipient = strArgs[0];
  const char* message = strArgs[1];
  out.print("sending \"");
  out.print(message);
  out.print("\" to \"");
  out.print(recipient);
  out.println("\"");
  setSuccess("OK: sent");
}

void _sendLauncher() {
  sendProgramVariable("ANDYGPT", __launcher_var, __launcher_var_len);
}

void launcher() {
  // we have to queue this action, since otherwise the transfer fails
  // due to the CBL2 library still using the lines
  queued_action = _sendLauncher;
  queued_action_time = millis() + 2000;
  setSuccess("queued transfer");
}

void snap() {
#ifdef CAMERA
  if (!camera_sign) {
    setError("camera failed to initialize");
  }
#else
  setError("pictures not supported");
#endif
}

void solve() {
#ifdef CAMERA
  if (!camera_sign) {
    setError("camera failed to initialize");
  }
#else
  setError("pictures not supported");
#endif
}

void image_list() {
  int page = realArgs[0];
  auto url = String(SERVER) + String("/image/list?p=") + urlEncode(String(page));

  size_t realsize = 0;
  if (makeRequest(url, response, MAXSTRARGLEN, &realsize)) {
    setError("error making request");
    return;
  }

  out.print("response: ");
  out.println(response);

  setSuccess(response);
}

void fetch_image() {
  memset(frame + 2, 0, 756);
  // fetch image and put it into the frame variable
  int id = realArgs[0];
  out.print("id: ");
  out.println(id);

  auto url = String(SERVER) + String("/image/get?id=") + urlEncode(String(id));

  size_t realsize = 0;
  if (makeRequest(url, response, MAXHTTPRESPONSELEN, &realsize)) {
    setError("error making request");
    return;
  }

  if (realsize != PICSIZE) {
    out.print("response size:");
    out.println(realsize);
    setError("bad image size");
    return;
  }

  // load the image
  frame[0] = realsize & 0xff;
  frame[1] = (realsize >> 8) & 0xff;
  memcpy(&frame[2], response, 756);

  setSuccess(response);
}

void program_list() {
  int page = realArgs[0];
  auto url = String(SERVER) + String("/programs/list?p=") + urlEncode(String(page));

  size_t realsize = 0;
  if (makeRequest(url, response, MAXSTRARGLEN, &realsize)) {
    setError("error making request");
    return;
  }

  out.print("response: ");
  out.println(response);

  setSuccess(response);
}


void _sendDownloadedProgram() {
  if (sendProgramVariable(programName, (uint8_t*)programData, programLength)) {
    out.println("failed to transfer requested download");
    out.print(programName);
    out.print("(");
    out.print(programLength);
    out.println(")");
  }
  _resetProgram();
}

void fetch_program() {
  int id = realArgs[0];
  out.print("id: ");
  out.println(id);

  _resetProgram();

  auto url = String(SERVER) + String("/programs/get?id=") + urlEncode(String(id));

  if (makeRequest(url, programData, 4096, &programLength)) {
    setError("error making request for program data");
    return;
  }

  size_t realsize = 0;
  auto nameUrl = String(SERVER) + String("/programs/get_name?id=") + urlEncode(String(id));
  if (makeRequest(nameUrl, programName, 256, &realsize)) {
    setError("error making request for program name");
    return;
  }

  queued_action = _sendDownloadedProgram;
  queued_action_time = millis() + 2000;

  setSuccess("queued download");
}

/// OTHER FUNCTIONS

int sendProgramVariable(const char* name, uint8_t* program, size_t variableSize) {
  out.print("transferring: ");
  out.print(name);
  out.print("(");
  out.print(variableSize);
  out.println(")");

  int dataLength = 0;

  // IF THIS ISNT SET TO COMP83P, THIS DOESNT WORK
  // seems like ti-84s cant silent transfer to each other
  uint8_t msg_header[4] = { COMP83P, RTS, 13, 0 };

  uint8_t rtsdata[13] = { variableSize & 0xff, variableSize >> 8, VarTypes82::VarProgram, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
  int nameSize = strlen(name);
  if (nameSize == 0) {
    return 1;
  }
  memcpy(&rtsdata[3], name, min(nameSize, 8));

  auto rtsVal = cbl.send(msg_header, rtsdata, 13);
  if (rtsVal) {
    out.print("rts return: ");
    out.println(rtsVal);
    return rtsVal;
  }

  cbl.resetLines();
  auto ackVal = cbl.get(msg_header, NULL, &dataLength, 0);
  if (ackVal || msg_header[1] != ACK) {
    out.print("ack return: ");
    out.println(ackVal);
    return ackVal;
  }

  auto ctsRet = cbl.get(msg_header, NULL, &dataLength, 0);
  if (ctsRet || msg_header[1] != CTS) {
    out.print("cts return: ");
    out.println(ctsRet);
    return ctsRet;
  }

  msg_header[1] = ACK;
  msg_header[2] = 0x00;
  msg_header[3] = 0x00;
  ackVal = cbl.send(msg_header, NULL, 0);
  if (ackVal || msg_header[1] != ACK) {
    out.print("ack cts return: ");
    out.println(ackVal);
    return ackVal;
  }

  msg_header[1] = DATA;
  msg_header[2] = variableSize & 0xff;
  msg_header[3] = (variableSize >> 8) & 0xff;
  auto dataRet = cbl.send(msg_header, program, variableSize);
  if (dataRet) {
    out.print("data return: ");
    out.println(dataRet);
    return dataRet;
  }

  ackVal = cbl.get(msg_header, NULL, &dataLength, 0);
  if (ackVal || msg_header[1] != ACK) {
    out.print("ack data: ");
    out.println(ackVal);
    return ackVal;
  }

  msg_header[1] = EOT;
  msg_header[2] = 0x00;
  msg_header[3] = 0x00;
  auto eotVal = cbl.send(msg_header, NULL, 0);
  if (eotVal) {
    out.print("eot return: ");
    out.println(eotVal);
    return eotVal;
  }

  out.print("transferred: ");
  out.println(name);
  return 0;
}