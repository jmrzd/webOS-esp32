// =============================================================================
//  Sistema: identificação da placa, métricas, partições e tarefa de monitoramento
//  Aula 1 (arquitetura), Aula 2 (SO como gerenciador de recursos), Aula 4 (partições)
// =============================================================================
#include "webos.h"
#include <WiFi.h>
#include <LittleFS.h>
#include <esp_heap_caps.h>
#include <esp_partition.h>
#include <esp_ota_ops.h>
#include <esp_task_wdt.h>
#include <esp_timer.h>

#define HEAP_CAPS (MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT)

uint32_t uptimeMs() { return (uint32_t)(esp_timer_get_time() / 1000ULL); }

const char* taskStateName(eTaskState st) {
  switch (st) {
    case eRunning:   return "executando";
    case eReady:     return "pronta";
    case eBlocked:   return "bloqueada";
    case eSuspended: return "suspensa";
    case eDeleted:   return "finalizada";
    default:         return "invalida";
  }
}

// ------------------------------------------------------------------------------
//  Watchdog do IDLE0. Tarefas "cpu" nunca bloqueiam; se ocuparem o núcleo 0, a
//  tarefa IDLE0 não roda e o Task Watchdog dispararia. Durante os experimentos
//  removemos o IDLE0 do watchdog e o devolvemos quando a última tarefa sai.
// ------------------------------------------------------------------------------
static portMUX_TYPE s_coreMux = portMUX_INITIALIZER_UNLOCKED;
static int s_coreBusy = 0;
static bool s_wdtRemoved = false;

void demoCoreAcquire() {
  bool first;
  portENTER_CRITICAL(&s_coreMux);
  first = (s_coreBusy++ == 0);
  portEXIT_CRITICAL(&s_coreMux);
  if (first) {
    TaskHandle_t idle = xTaskGetIdleTaskHandleForCore(WEBOS_DEMO_CORE);
    if (idle && esp_task_wdt_status(idle) == ESP_OK) {
      s_wdtRemoved = (esp_task_wdt_delete(idle) == ESP_OK);
    }
  }
}

void demoCoreRelease() {
  bool last;
  portENTER_CRITICAL(&s_coreMux);
  if (s_coreBusy > 0) s_coreBusy--;
  last = (s_coreBusy == 0);
  portEXIT_CRITICAL(&s_coreMux);
  if (last && s_wdtRemoved) {
    TaskHandle_t idle = xTaskGetIdleTaskHandleForCore(WEBOS_DEMO_CORE);
    if (idle) esp_task_wdt_add(idle);
    s_wdtRemoved = false;
  }
}

int demoCoreBusyCount() { return s_coreBusy; }

// ------------------------------------------------------------------------------
//  Monitor: a cada 1 s amostra o heap e calcula a % de CPU de cada tarefa no
//  ÚLTIMO intervalo (delta do contador de tempo de execução ÷ tempo de parede).
//  Isso é utilização instantânea, não o tempo acumulado desde o boot.
// ------------------------------------------------------------------------------
struct CpuEntry { TaskHandle_t h; uint32_t prevRun; int16_t permille; };
static CpuEntry s_cpu[56];
static int s_cpuN = 0;
static int16_t s_coreLoad[2] = {-1, -1};
static uint32_t s_heapHist[WEBOS_HISTORY_LEN];
static uint8_t s_histHead = 0, s_histCount = 0;
static uint32_t s_samples = 0;
static SemaphoreHandle_t s_monMux = nullptr;

#if WEBOS_HAS_RUNTIME
static int64_t s_prevWall = 0;
static void sampleCpu() {
  UBaseType_t cap = uxTaskGetNumberOfTasks() + 4;
  TaskStatus_t* arr = (TaskStatus_t*)malloc(cap * sizeof(TaskStatus_t));
  if (!arr) return;
  configRUN_TIME_COUNTER_TYPE total = 0;
  UBaseType_t got = uxTaskGetSystemState(arr, cap, &total);
  int64_t now = esp_timer_get_time();
  uint32_t wall = (uint32_t)(now - s_prevWall);
  bool firstSample = (s_prevWall == 0);
  s_prevWall = now;

  static CpuEntry next[56];
  int nn = 0;
  for (UBaseType_t k = 0; k < got && nn < 56; k++) {
    uint32_t run = (uint32_t)arr[k].ulRunTimeCounter;   // subtração em 32 bits trata o overflow
    int16_t pm = -1;
    if (!firstSample && wall > 0) {
      for (int p = 0; p < s_cpuN; p++) {
        if (s_cpu[p].h == arr[k].xHandle) {
          uint32_t delta = run - s_cpu[p].prevRun;
          uint32_t v = (uint32_t)(((uint64_t)delta * 1000ULL) / wall);
          pm = (int16_t)(v > 1000 ? 1000 : v);
          break;
        }
      }
    }
    next[nn++] = {arr[k].xHandle, run, pm};
  }
  free(arr);

  xSemaphoreTake(s_monMux, portMAX_DELAY);
  memcpy(s_cpu, next, sizeof(CpuEntry) * nn);
  s_cpuN = nn;
  for (int c = 0; c < 2 && c < ESP.getChipCores(); c++) {
    TaskHandle_t idle = xTaskGetIdleTaskHandleForCore(c);
    s_coreLoad[c] = -1;
    for (int p = 0; p < s_cpuN; p++) {
      if (s_cpu[p].h == idle && s_cpu[p].permille >= 0) { s_coreLoad[c] = 1000 - s_cpu[p].permille; break; }
    }
  }
  xSemaphoreGive(s_monMux);
}
#else
static void sampleCpu() {}
#endif

int monitorCpuPermille(TaskHandle_t h) {
  int r = -1;
  if (!s_monMux || !h) return r;
  xSemaphoreTake(s_monMux, portMAX_DELAY);
  for (int p = 0; p < s_cpuN; p++) if (s_cpu[p].h == h) { r = s_cpu[p].permille; break; }
  xSemaphoreGive(s_monMux);
  return r;
}

int monitorCoreLoadPermille(int core) {
  if (core < 0 || core > 1 || !s_monMux) return -1;
  xSemaphoreTake(s_monMux, portMAX_DELAY);
  int r = s_coreLoad[core];
  xSemaphoreGive(s_monMux);
  return r;
}

void monitorHeapHistory(uint32_t* out, uint8_t& count) {
  xSemaphoreTake(s_monMux, portMAX_DELAY);
  count = s_histCount;
  uint8_t start = (uint8_t)((s_histHead + WEBOS_HISTORY_LEN - s_histCount) % WEBOS_HISTORY_LEN);
  for (uint8_t k = 0; k < s_histCount; k++) out[k] = s_heapHist[(start + k) % WEBOS_HISTORY_LEN];
  xSemaphoreGive(s_monMux);
}

uint32_t monitorSampleCount() { return s_samples; }

static void monitorTask(void*) {
  TickType_t last = xTaskGetTickCount();
  for (;;) {
    vTaskDelayUntil(&last, pdMS_TO_TICKS(1000));
    uint32_t freeHeap = heap_caps_get_free_size(HEAP_CAPS);
    sampleCpu();
    xSemaphoreTake(s_monMux, portMAX_DELAY);
    s_heapHist[s_histHead] = freeHeap;
    s_histHead = (uint8_t)((s_histHead + 1) % WEBOS_HISTORY_LEN);
    if (s_histCount < WEBOS_HISTORY_LEN) s_histCount++;
    xSemaphoreGive(s_monMux);
    tasksTick();
    schedTick();
    s_samples++;
  }
}

void monitorBegin() {
  s_monMux = xSemaphoreCreateMutex();
  // prioridade 4 no núcleo do servidor: acima das tarefas de usuário típicas,
  // mas o trabalho é curto (alguns centésimos de milissegundo por segundo).
  xTaskCreatePinnedToCore(monitorTask, "webos-monitor", 4096, nullptr, 4, nullptr, WEBOS_APP_CORE);
}

// ------------------------------------------------------------------------------
//  Rotas
// ------------------------------------------------------------------------------
static void writeHeap(JsonWriter& j) {
  multi_heap_info_t info;
  heap_caps_get_info(&info, HEAP_CAPS);
  j.obj("heap")
    .u("total", heap_caps_get_total_size(HEAP_CAPS))
    .u("free", heap_caps_get_free_size(HEAP_CAPS))
    .u("minFree", heap_caps_get_minimum_free_size(HEAP_CAPS))
    .u("largestBlock", heap_caps_get_largest_free_block(HEAP_CAPS))
    .u("allocatedBlocks", info.allocated_blocks)
    .u("freeBlocks", info.free_blocks)
    .u("psramTotal", ESP.getPsramSize())
    .u("psramFree", ESP.getPsramSize() ? ESP.getFreePsram() : 0)
  .endObj();
}

static void handleInfo() {
  JsonWriter j(1400);
  beginOk(j);
  j.s("name", WEBOS_NAME).s("version", WEBOS_VERSION).s("build", __DATE__ " " __TIME__);
  uint8_t mac[6]; WiFi.softAPmacAddress(mac);
  char macs[20];
  snprintf(macs, sizeof(macs), "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  j.obj("chip")
    .s("model", ESP.getChipModel())
    .i("revision", ESP.getChipRevision())
    .i("cores", ESP.getChipCores())
    .u("cpuMHz", ESP.getCpuFreqMHz())
    .u("flashBytes", ESP.getFlashChipSize())
    .u("flashMHz", ESP.getFlashChipSpeed() / 1000000UL)
    .u("psramBytes", ESP.getPsramSize())
    .s("mac", macs)
  .endObj();
  j.s("sdk", ESP.getSdkVersion());
#if defined(ESP_ARDUINO_VERSION_MAJOR)
  char av[16];
  snprintf(av, sizeof(av), "%d.%d.%d", ESP_ARDUINO_VERSION_MAJOR, ESP_ARDUINO_VERSION_MINOR, ESP_ARDUINO_VERSION_PATCH);
  j.s("arduinoCore", av);
#else
  j.null("arduinoCore");
#endif
  j.obj("freertos")
    .s("kernel", tskKERNEL_VERSION_NUMBER)
    .u("tickHz", configTICK_RATE_HZ)
    .u("maxPriorities", configMAX_PRIORITIES)
    .u("tasks", uxTaskGetNumberOfTasks())
  .endObj();
  j.obj("capabilities")
    .b("traceFacility", WEBOS_HAS_TRACE)
    .b("runtimeStats", WEBOS_HAS_RUNTIME)
    .b("dualCore", ESP.getChipCores() > 1)
    .b("littlefs", filesMounted())
  .endObj();
  j.obj("network")
    .s("mode", "access-point")
    .s("ssid", webosSsid())
    .s("ip", WiFi.softAPIP().toString())
    .i("channel", WEBOS_AP_CHANNEL)
    .s("hostname", WEBOS_MDNS_HOSTNAME ".local")
    .i("stations", WiFi.softAPgetStationNum())
    .i("maxStations", WEBOS_AP_MAX_CLIENTS)
  .endObj();
  j.obj("hardware").i("ledPin", ledPin()).i("buttonPin", WEBOS_BUTTON_PIN).endObj();
  j.u("uptimeMs", uptimeMs());
  writeHeap(j);
  sendOk(j);
}

static void handleHealth() {
  JsonWriter j(160);
  beginOk(j);
  j.s("status", "ok").u("uptimeMs", uptimeMs()).u("freeHeap", heap_caps_get_free_size(HEAP_CAPS))
   .u("samples", monitorSampleCount());
  sendOk(j);
}

static void handleMetrics() {
  JsonWriter j(1200);
  beginOk(j);
  j.u("uptimeMs", uptimeMs());
  writeHeap(j);
  j.u("tasks", uxTaskGetNumberOfTasks());
  j.i("stations", WiFi.softAPgetStationNum());
  j.obj("cpu");
  for (int c = 0; c < 2; c++) {
    int l = monitorCoreLoadPermille(c);
    const char* k = c == 0 ? "core0" : "core1";
    if (l < 0) j.null(k); else j.f(k, l / 10.0, 1);
  }
  j.b("measured", WEBOS_HAS_RUNTIME).endObj();
  j.obj("fs").b("mounted", filesMounted())
    .u("used", filesMounted() ? LittleFS.usedBytes() : 0)
    .u("total", filesMounted() ? LittleFS.totalBytes() : 0).endObj();
  uint32_t hist[WEBOS_HISTORY_LEN]; uint8_t n = 0;
  monitorHeapHistory(hist, n);
  j.arr("heapHistory");
  for (uint8_t k = 0; k < n; k++) j.u(nullptr, hist[k]);
  j.endArr();
  j.b("led", ledGet());
  j.i("demoCoreBusy", demoCoreBusyCount());
  j.u("rateLimited", webRejectedRequests());
  sendOk(j);
}

static const char* partTypeName(esp_partition_type_t t) {
  if (t == ESP_PARTITION_TYPE_APP) return "app";
  if (t == ESP_PARTITION_TYPE_DATA) return "data";
  return "outro";
}

static const char* partSubtypeName(esp_partition_type_t t, esp_partition_subtype_t st) {
  if (t == ESP_PARTITION_TYPE_APP) {
    if (st == ESP_PARTITION_SUBTYPE_APP_FACTORY) return "factory";
    if (st >= ESP_PARTITION_SUBTYPE_APP_OTA_MIN && st <= ESP_PARTITION_SUBTYPE_APP_OTA_MAX) return "ota";
    return "app";
  }
  switch (st) {
    case ESP_PARTITION_SUBTYPE_DATA_OTA:      return "otadata";
    case ESP_PARTITION_SUBTYPE_DATA_PHY:      return "phy";
    case ESP_PARTITION_SUBTYPE_DATA_NVS:      return "nvs";
    case ESP_PARTITION_SUBTYPE_DATA_COREDUMP: return "coredump";
    case ESP_PARTITION_SUBTYPE_DATA_SPIFFS:   return "spiffs";
    case ESP_PARTITION_SUBTYPE_DATA_FAT:      return "fat";
    default:                                  return "dados";
  }
}

static void handlePartitions() {
  JsonWriter j(1200);
  beginOk(j);
  const esp_partition_t* running = esp_ota_get_running_partition();
  j.u("flashBytes", ESP.getFlashChipSize());
  j.arr("partitions");
  esp_partition_iterator_t it = esp_partition_find(ESP_PARTITION_TYPE_ANY, ESP_PARTITION_SUBTYPE_ANY, nullptr);
  while (it) {
    const esp_partition_t* p = esp_partition_get(it);
    j.obj()
      .s("label", p->label)
      .s("type", partTypeName(p->type))
      .s("subtype", partSubtypeName(p->type, p->subtype))
      .u("offset", p->address)
      .u("size", p->size)
      .b("running", running && running->address == p->address)
      .b("filesystem", p->type == ESP_PARTITION_TYPE_DATA && strcmp(p->label, WEBOS_FS_PARTITION_LABEL) == 0)
    .endObj();
    it = esp_partition_next(it);
  }
  esp_partition_iterator_release(it);
  j.endArr();
  sendOk(j);
}

static void handleRestart() {
  JsonWriter j(64);
  beginOk(j);
  j.s("message", "reiniciando em 500 ms");
  sendOk(j);
  delay(500);
  ESP.restart();
}

void systemRoutes() {
  apiRoute("/api/system/info", HTTP_GET, handleInfo);
  apiRoute("/api/system/health", HTTP_GET, handleHealth);
  apiRoute("/api/system/metrics", HTTP_GET, handleMetrics);
  apiRoute("/api/system/partitions", HTTP_GET, handlePartitions);
  apiRoute("/api/system/restart", HTTP_POST, handleRestart);
}
