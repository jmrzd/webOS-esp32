// =============================================================================
//  WebOS ESP32 — firmware
//  Placa: ESP32 Dev Module · Arduino IDE 2.x · esp32 by Espressif 3.x
//  Partição: "Default 4MB with spiffs" (a partição spiffs é montada como LittleFS)
//
//  Camadas:  navegador (React)  →  API HTTP JSON  →  serviços  →  FreeRTOS  →  hardware
//  O servidor web roda no loop() (loopTask, núcleo 1). Os experimentos são tarefas
//  FreeRTOS reais criadas pelos módulos de cada aba.
// =============================================================================
#include "webos.h"
#include <WiFi.h>
#include <ESPmDNS.h>

static String g_ssid;

static void startAccessPoint() {
  WiFi.mode(WIFI_AP);
  uint8_t mac[6];
  WiFi.softAPmacAddress(mac);
  char suffix[8];
  snprintf(suffix, sizeof(suffix), "%02X%02X", mac[4], mac[5]);
  g_ssid = String(WEBOS_AP_SSID_PREFIX) + "-" + suffix;

  const char* pass = (strlen(WEBOS_AP_PASSWORD) >= 8) ? WEBOS_AP_PASSWORD : nullptr;
  WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));
  bool ok = WiFi.softAP(g_ssid.c_str(), pass, WEBOS_AP_CHANNEL, 0, WEBOS_AP_MAX_CLIENTS);
  Serial.printf("[wifi] AP %s %s  ip=%s\n", g_ssid.c_str(), ok ? "ativo" : "FALHOU",
                WiFi.softAPIP().toString().c_str());
  if (MDNS.begin(WEBOS_MDNS_HOSTNAME)) {
    MDNS.addService("http", "tcp", 80);
  }
}

const char* webosSsid() { return g_ssid.c_str(); }

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("==============================================");
  Serial.printf ("  %s v%s\n", WEBOS_NAME, WEBOS_VERSION);
  Serial.printf ("  %s rev %d · %d núcleo(s) · %lu MHz\n", ESP.getChipModel(), ESP.getChipRevision(),
                 ESP.getChipCores(), (unsigned long)ESP.getCpuFreqMHz());
  Serial.printf ("  FreeRTOS %s · trace=%d runtime=%d\n", tskKERNEL_VERSION_NUMBER, WEBOS_HAS_TRACE, WEBOS_HAS_RUNTIME);
  Serial.println("==============================================");

  filesBegin();      // LittleFS: precisa vir antes do servidor
  authBegin();
  devicesBegin();    // LED + botão BOOT (ISR + fila + tarefa driver-botao)
  tasksBegin();
  schedBegin();
  labBegin();
  memBegin();
  deadlockBegin();
  monitorBegin();    // tarefa de amostragem (1 s)

  startAccessPoint();
  webBegin();
  Serial.println("[webos] pronto: conecte-se ao Wi-Fi e abra http://192.168.4.1");
}

void loop() {
  webLoop();
  vTaskDelay(1);  // cede a CPU para outras tarefas de mesma prioridade no núcleo 1
}
