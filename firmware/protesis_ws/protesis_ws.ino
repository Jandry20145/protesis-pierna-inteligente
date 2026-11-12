/*
 * ============================================================================
 *  Prótesis de pierna instrumentada — Firmware de telemetría Wi-Fi
 * ============================================================================
 *  El ESP32 se une a la red Wi-Fi de secrets.h (p. ej. el punto de acceso del teléfono) y:
 *    1) Lee 2 FSR (talón / punta) y una IMU MPU6050 a 20 Hz.
 *    2) Transmite cada muestra como JSON por WebSocket en ws://<IP>:81/
 *    3) Sirve el dashboard web (carpeta data/ → LittleFS) en http://<IP>/
 *       → página y WebSocket por HTTP: sin problema de "Mixed Content".
 *  La IP la asigna el teléfono y se imprime en el Monitor Serie (115200).
 *  Si esa red no aparece en 15 s, crea su propia red "Protesis-ESP32" (IP 192.168.4.1).
 *
 *  Trama enviada (idéntica a la versión por puerto serie):
 *    {"fsr_talon":4000,"fsr_punta":100,"acc_x":0.50,"acc_y":9.80,"acc_z":0.10,
 *     "gyr_x":0.000,"gyr_y":0.265,"gyr_z":0.000}
 *    acc en m/s², gyr en rad/s (unidades de Adafruit_MPU6050).
 *
 *  Librerías (Gestor de librerías del Arduino IDE):
 *    - "ESP Async WebServer" y "Async TCP"  (autor: ESP32Async)
 *    - "Adafruit MPU6050" (+ Adafruit Unified Sensor, Adafruit BusIO)
 *  Placa: core "esp32" de Espressif ≥ 3.x · "ESP32 Dev Module"
 *  Partición: cualquiera con SPIFFS/LittleFS (p. ej. "Default 4MB with spiffs").
 *
 *  Subir el dashboard: ver firmware/README.md (npm run build:esp32 + LittleFS Upload).
 * ============================================================================
 */
#include <WiFi.h>
#include <ESPmDNS.h>
#include <Wire.h>
#include <LittleFS.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
// Pines (sin cambios respecto al sketch original)
#define I2C_SDA 33
#define I2C_SCL 32
#define FSR_TALON 34  // ADC1_CH6 — ADC1 sigue funcionando con Wi-Fi activo
#define FSR_PUNTA 35  // ADC1_CH7   (los pines de ADC2 NO sirven con Wi-Fi)

// Red Wi-Fi a la que se une el ESP32 (p. ej. el punto de acceso del teléfono).
// Las credenciales van en secrets.h (NO se sube a GitHub; copia secrets.example.h).
// Sin secrets.h el firmware compila igual y arranca directamente su red de respaldo.
#if __has_include("secrets.h")
#include "secrets.h"
#else
#define WIFI_SSID ""
#define WIFI_PASS ""
#endif
static const char *STA_SSID = WIFI_SSID;
static const char *STA_PASS = WIFI_PASS;
static const uint32_t STA_TIMEOUT_MS = 15000;  // si no conecta en este tiempo → crea su propia red

// Nombre en la red: http://protesis.local/ (mDNS; funciona en Windows/macOS/iOS,
// no siempre en Android → usa la IP que aparece en el Monitor Serie)
static const char *HOSTNAME = "protesis";

// Red propia de respaldo (solo si no encuentra STA_SSID)
static const char *AP_SSID = "Protesis-ESP32";
static const char *AP_PASS = "protesis2026";  // mínimo 8 caracteres (WPA2)
static const uint8_t AP_CHANNEL = 6;
static const uint8_t AP_MAX_CLIENTS = 4;
static const IPAddress AP_IP(192, 168, 4, 1);
static const IPAddress AP_MASK(255, 255, 255, 0);

// Puertos: 80 = página web, 81 = WebSocket (el dashboard usa ws://<ip>:81)
static const uint16_t HTTP_PORT = 80;
static const uint16_t WS_PORT = 81;

// Muestreo
static const uint32_t SAMPLE_PERIOD_MS = 50;  // 20 Hz
static const uint8_t FSR_OVERSAMPLE = 4;      // promedio de N lecturas ADC (reduce ruido)

// Depuración: también enviar cada trama por el puerto serie (115200 baudios)
static const bool SERIAL_STREAM = false;

// ---------------------------------------------------------------------------
// Objetos globales
// ---------------------------------------------------------------------------
Adafruit_MPU6050 mpu;
AsyncWebServer httpServer(HTTP_PORT);
AsyncWebServer wsServer(WS_PORT);
AsyncWebSocket ws("/");

bool imuOk = false;
bool fsOk = false;
bool apMode = false;  // true si no encontró la red y creó la suya propia
uint32_t lastSampleMs = 0;
uint32_t lastImuRetryMs = 0;
uint32_t lastCleanupMs = 0;
uint32_t droppedFrames = 0;

// ---------------------------------------------------------------------------
// Sensores
// ---------------------------------------------------------------------------
bool initImu() {
  if (!mpu.begin(0x68, &Wire)) return false;
  mpu.setAccelerometerRange(MPU6050_RANGE_4_G);  // rango intermedio para impactos
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);       // rotación de la pierna
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);    // pasa bajas: reduce el ruido de impacto
  return true;
}

int readFsr(uint8_t pin) {
  uint32_t acc = 0;
  for (uint8_t i = 0; i < FSR_OVERSAMPLE; i++) acc += analogRead(pin);
  return (int)(acc / FSR_OVERSAMPLE);  // 0..4095
}

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------
void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type,
               void *arg, uint8_t *data, size_t len) {
  switch (type) {
    case WS_EVT_CONNECT:
      Serial.printf("[WS] Cliente #%u conectado desde %s (total: %u)\n", client->id(),
                    client->remoteIP().toString().c_str(), server->count());
      break;
    case WS_EVT_DISCONNECT:
      Serial.printf("[WS] Cliente #%u desconectado\n", client->id());
      break;
    case WS_EVT_DATA:
      // Reservado para comandos futuros desde el dashboard (p. ej. calibración).
      break;
    case WS_EVT_ERROR:
      Serial.printf("[WS] Error en cliente #%u\n", client->id());
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Servidor web (dashboard desde LittleFS)
// ---------------------------------------------------------------------------
void setupHttp() {
  if (fsOk) {
    // Archivos con hash en el nombre (assets/index-XXXX.js): caché larga.
    httpServer.serveStatic("/assets/", LittleFS, "/assets/").setCacheControl("public, max-age=31536000, immutable");
    // index.html y resto: siempre revalidar para recoger nuevas versiones.
    // Si existe "archivo.gz" se sirve comprimido automáticamente.
    httpServer.serveStatic("/", LittleFS, "/").setDefaultFile("index.html").setCacheControl("no-cache");
  }

  // Estado del dispositivo (útil para diagnóstico: http://192.168.4.1/status)
  httpServer.on("/status", HTTP_GET, [](AsyncWebServerRequest *req) {
    char buf[240];
    snprintf(buf, sizeof(buf),
             "{\"wifi\":\"%s\",\"rssi\":%d,\"imu\":%s,\"fs\":%s,\"clients\":%u,\"uptime_s\":%lu,\"heap\":%u,\"dropped\":%lu}",
             apMode ? "ap" : "sta", apMode ? 0 : WiFi.RSSI(),
             imuOk ? "true" : "false", fsOk ? "true" : "false", ws.count(),
             (unsigned long)(millis() / 1000), ESP.getFreeHeap(), (unsigned long)droppedFrames);
    req->send(200, "application/json", buf);
  });

  httpServer.onNotFound([](AsyncWebServerRequest *req) {
    if (!fsOk || (!LittleFS.exists("/index.html") && !LittleFS.exists("/index.html.gz"))) {
      req->send(200, "text/html; charset=utf-8",
                "<!doctype html><meta charset=utf-8><body style='background:#020617;color:#e2e8f0;"
                "font-family:sans-serif;padding:2rem'><h2>Prótesis ESP32</h2>"
                "<p>El dashboard no está cargado en LittleFS.</p>"
                "<p>Telemetría disponible en el puerto 81 (<code>ws://&lt;IP&gt;:81/</code>).</p>"
                "<p>Ver <code>firmware/README.md</code> para subir la carpeta <code>data/</code>.</p></body>");
    } else {
      req->send(404, "text/plain", "No encontrado");
    }
  });

  httpServer.begin();
}

// ---------------------------------------------------------------------------
// Muestreo y envío
// ---------------------------------------------------------------------------
void sampleAndSend() {
  const int fuerzaTalon = readFsr(FSR_TALON);
  const int fuerzaPunta = readFsr(FSR_PUNTA);

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  char json[200];
  const int n = snprintf(json, sizeof(json),
                         "{\"fsr_talon\":%d,\"fsr_punta\":%d,"
                         "\"acc_x\":%.2f,\"acc_y\":%.2f,\"acc_z\":%.2f,"
                         "\"gyr_x\":%.3f,\"gyr_y\":%.3f,\"gyr_z\":%.3f}",
                         fuerzaTalon, fuerzaPunta,
                         a.acceleration.x, a.acceleration.y, a.acceleration.z,
                         g.gyro.x, g.gyro.y, g.gyro.z);
  if (n <= 0 || n >= (int)sizeof(json)) return;

  if (ws.count() > 0) {
    // Si algún cliente va lento (Wi-Fi débil) su cola se llena: se descarta la
    // trama en lugar de acumular retraso. El dashboard tolera huecos.
    if (ws.availableForWriteAll()) {
      ws.textAll(json, (size_t)n);
    } else {
      droppedFrames++;
    }
  }

  if (SERIAL_STREAM) Serial.println(json);
}

// ---------------------------------------------------------------------------
// Wi-Fi
// ---------------------------------------------------------------------------
void printUrls(const IPAddress &ip) {
  Serial.println("------------------------------------------------------------");
  Serial.printf(" Dashboard:   http://%s/   (o http://%s.local/)\n", ip.toString().c_str(), HOSTNAME);
  Serial.printf(" Telemetría:  ws://%s:%u/\n", ip.toString().c_str(), WS_PORT);
  Serial.println("------------------------------------------------------------");
}

/** Conecta a STA_SSID; si falla en STA_TIMEOUT_MS, levanta el AP de respaldo. Devuelve la IP. */
/** Intenta unirse a STA_SSID durante STA_TIMEOUT_MS. */
bool connectStation() {
  if (strlen(STA_SSID) == 0) {
    Serial.println("Sin secrets.h: no hay red Wi-Fi configurada.");
    return false;
  }
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.setAutoReconnect(true);  // si la red se cae, el ESP32 se reconecta solo
  WiFi.begin(STA_SSID, STA_PASS);
  Serial.printf("Conectando a la red \"%s\"", STA_SSID);

  const uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < STA_TIMEOUT_MS) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();
  return WiFi.status() == WL_CONNECTED;
}

IPAddress setupWifi() {
  if (connectStation()) {
    WiFi.setSleep(false);  // menor latencia del enlace
    Serial.printf("Conectado a \"%s\" · IP %s · RSSI %d dBm\n", STA_SSID,
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    // Si el teléfono asigna otra IP tras una reconexión, mostrarla de nuevo
    WiFi.onEvent([](WiFiEvent_t, WiFiEventInfo_t) { printUrls(WiFi.localIP()); },
                 ARDUINO_EVENT_WIFI_STA_GOT_IP);
    return WiFi.localIP();
  }

  // ---- Respaldo: red propia ----
  Serial.printf("Sin conexión a \"%s\". Creando red propia \"%s\"…\n", STA_SSID, AP_SSID);
  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(AP_IP, AP_IP, AP_MASK);
  if (!WiFi.softAP(AP_SSID, AP_PASS, AP_CHANNEL, 0, AP_MAX_CLIENTS)) {
    Serial.println("ERROR: no se pudo iniciar el Access Point");
  }
  WiFi.setSleep(false);
  apMode = true;
  return WiFi.softAPIP();
}

// ---------------------------------------------------------------------------
// setup / loop
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\nInicializando prótesis instrumentada…");

  // ADC: 12 bits, atenuación 11 dB → rango ≈ 0–3.1 V
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  pinMode(FSR_TALON, INPUT);
  pinMode(FSR_PUNTA, INPUT);

  // IMU
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);
  imuOk = initImu();
  Serial.println(imuOk ? "MPU6050 OK" : "ERROR: MPU6050 no encontrado (se reintentará cada 2 s)");

  // Sistema de archivos (dashboard). No se formatea automáticamente para no borrar datos.
  fsOk = LittleFS.begin(false);
  Serial.println(fsOk ? "LittleFS OK" : "AVISO: LittleFS no montado — sube la carpeta data/");

  // Wi-Fi: unirse a la red configurada; si no está disponible, crear red propia
  const IPAddress ip = setupWifi();

  // mDNS → http://protesis.local/
  if (MDNS.begin(HOSTNAME)) {
    MDNS.addService("http", "tcp", HTTP_PORT);
    MDNS.addService("ws", "tcp", WS_PORT);
  }

  // WebSocket en el puerto 81
  ws.onEvent(onWsEvent);
  wsServer.addHandler(&ws);
  wsServer.begin();

  // Página web en el puerto 80
  setupHttp();

  printUrls(ip);
}

void loop() {
  const uint32_t now = millis();

  // Muestreo a periodo fijo (sin delay(): la deriva no se acumula)
  if (now - lastSampleMs >= SAMPLE_PERIOD_MS) {
    lastSampleMs += SAMPLE_PERIOD_MS;
    if (now - lastSampleMs >= SAMPLE_PERIOD_MS) lastSampleMs = now;  // tras un bloqueo largo, re-sincronizar
    if (imuOk) sampleAndSend();
  }

  // Reintento de la IMU si falló (cable suelto, arranque en frío…)
  if (!imuOk && now - lastImuRetryMs >= 2000) {
    lastImuRetryMs = now;
    imuOk = initImu();
    if (imuOk) Serial.println("MPU6050 detectado");
  }

  // Liberar clientes WebSocket desconectados
  if (now - lastCleanupMs >= 1000) {
    lastCleanupMs = now;
    ws.cleanupClients();
  }
}
