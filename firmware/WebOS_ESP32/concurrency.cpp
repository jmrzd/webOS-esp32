// =============================================================================
//  Laboratório de Concorrência — Aula 8 (condição de corrida, região crítica, mutex)
//  Duas tarefas, uma em cada núcleo, fazem N vezes:  t = contador; t = t + 1; contador = t;
//  Sem mutex, leituras simultâneas fazem uma escrita apagar a outra (incrementos perdidos).
// =============================================================================
#include "webos.h"
#include <esp_timer.h>

#define BIT_GO    (1 << 0)
#define BIT_DONE0 (1 << 1)
#define BIT_DONE1 (1 << 2)

struct LabResult {
  uint32_t id;
  bool mutex;
  uint32_t n;
  uint32_t expected;
  uint32_t obtained;
  uint32_t elapsedUs;
  bool aborted;
  bool sameCore;
};

static volatile int32_t s_shared = 0;           // o contador compartilhado
static SemaphoreHandle_t s_counterMutex = nullptr;
static EventGroupHandle_t s_eg = nullptr;
static SemaphoreHandle_t s_stateMux = nullptr;

static volatile bool s_running = false;
static volatile bool s_abort = false;
static bool s_useMutex = false;
static uint32_t s_n = 0;
static int64_t s_t0 = 0;
static volatile int64_t s_tDone[2] = {0, 0};
static volatile uint32_t s_progress[2] = {0, 0};
static uint32_t s_runId = 0;
static LabResult s_hist[12];
static uint8_t s_histCount = 0;
static bool s_sameCore = false;

bool labRunning() { return s_running; }

static void worker(void* arg) {
  const int idx = (int)(intptr_t)arg;
  xEventGroupWaitBits(s_eg, BIT_GO, pdFALSE, pdTRUE, portMAX_DELAY);  // largada simultânea
  const uint32_t n = s_n;
  if (s_useMutex) {
    for (uint32_t k = 0; k < n; k++) {
      xSemaphoreTake(s_counterMutex, portMAX_DELAY);  // entra na região crítica
      int32_t t = s_shared;                           // 1. lê
      t = t + 1;                                      // 2. modifica
      s_shared = t;                                   // 3. escreve
      xSemaphoreGive(s_counterMutex);                 // sai da região crítica
      if ((k & 1023) == 0) { s_progress[idx] = k; if (s_abort) break; }
    }
  } else {
    for (uint32_t k = 0; k < n; k++) {
      int32_t t = s_shared;                           // 1. lê
      t = t + 1;                                      // 2. modifica
      s_shared = t;                                   // 3. escreve (pode apagar a escrita da outra)
      if ((k & 1023) == 0) { s_progress[idx] = k; if (s_abort) break; }
    }
  }
  s_progress[idx] = n;
  s_tDone[idx] = esp_timer_get_time();
  xEventGroupSetBits(s_eg, idx == 0 ? BIT_DONE0 : BIT_DONE1);
  vTaskDelete(nullptr);
}

// Coordenadora: espera as duas terminarem (com prazo) e registra o resultado.
static void coordinator(void*) {
  EventBits_t bits = xEventGroupWaitBits(s_eg, BIT_DONE0 | BIT_DONE1, pdTRUE, pdTRUE,
                                         pdMS_TO_TICKS(WEBOS_LAB_TIMEOUT_MS));
  bool timedOut = (bits & (BIT_DONE0 | BIT_DONE1)) != (BIT_DONE0 | BIT_DONE1);
  if (timedOut) {
    s_abort = true;
    xEventGroupWaitBits(s_eg, BIT_DONE0 | BIT_DONE1, pdTRUE, pdTRUE, pdMS_TO_TICKS(5000));
  }
  int64_t d0 = s_tDone[0], d1 = s_tDone[1];
  int64_t tEnd = d0 > d1 ? d0 : d1;
  xSemaphoreTake(s_stateMux, portMAX_DELAY);
  LabResult r;
  r.id = s_runId;
  r.mutex = s_useMutex;
  r.n = s_n;
  r.expected = s_n * 2;
  r.obtained = (uint32_t)s_shared;
  r.elapsedUs = (uint32_t)(tEnd > s_t0 ? tEnd - s_t0 : 0);
  r.aborted = s_abort;
  r.sameCore = s_sameCore;
  if (s_histCount < 12) s_histCount++;
  for (int k = s_histCount - 1; k > 0; k--) s_hist[k] = s_hist[k - 1];   // mais recente primeiro
  s_hist[0] = r;
  xEventGroupClearBits(s_eg, BIT_GO);
  s_running = false;
  xSemaphoreGive(s_stateMux);
  demoCoreRelease();
  vTaskDelete(nullptr);
}

void labBegin() {
  s_counterMutex = xSemaphoreCreateMutex();
  s_eg = xEventGroupCreate();
  s_stateMux = xSemaphoreCreateMutex();
}

static void writeResult(JsonWriter& j, const LabResult& r) {
  uint32_t lost = r.expected > r.obtained ? r.expected - r.obtained : 0;
  j.obj().u("id", r.id).s("version", r.mutex ? "com mutex" : "sem mutex").b("mutex", r.mutex)
   .u("n", r.n).u("expected", r.expected).u("obtained", r.obtained).u("lost", lost)
   .f("lostPct", r.expected ? 100.0 * lost / r.expected : 0.0, 2)
   .f("elapsedMs", r.elapsedUs / 1000.0, 2).b("aborted", r.aborted).b("sameCore", r.sameCore).endObj();
}

static void respond() {
  JsonWriter j(2200);
  beginOk(j);
  j.b("running", s_running).b("dualCore", ESP.getChipCores() > 1);
  if (s_running) {
    j.obj("current").b("mutex", s_useMutex).u("n", s_n)
     .u("progress0", s_progress[0]).u("progress1", s_progress[1])
     .u("counter", (uint32_t)s_shared).u("elapsedMs", (uint32_t)((esp_timer_get_time() - s_t0) / 1000)).endObj();
  } else {
    j.null("current");
  }
  j.arr("history");
  for (int k = 0; k < s_histCount; k++) writeResult(j, s_hist[k]);
  j.endArr();
  sendOk(j);
}

static void handleGet() {
  xSemaphoreTake(s_stateMux, portMAX_DELAY);
  respond();
  xSemaphoreGive(s_stateMux);
}

static void handleStart() {
  long n, useMutex;
  if (!argInt("n", n, 1000, 1000000)) return;
  if (!argInt("mutex", useMutex, 0, 1)) return;
  xSemaphoreTake(s_stateMux, portMAX_DELAY);
  if (s_running) { xSemaphoreGive(s_stateMux); sendError(409, "busy", "um experimento já está em andamento"); return; }
  if (schedRunning()) { xSemaphoreGive(s_stateMux); sendError(409, "busy", "pare o Escalonador ao vivo antes (ele ocupa o núcleo 0)"); return; }

  s_useMutex = useMutex;
  s_n = (uint32_t)n;
  s_shared = 0;
  s_abort = false;
  s_tDone[0] = 0;
  s_tDone[1] = 0;
  s_progress[0] = 0;
  s_progress[1] = 0;
  s_runId++;
  s_sameCore = ESP.getChipCores() < 2;
  xEventGroupClearBits(s_eg, BIT_GO | BIT_DONE0 | BIT_DONE1);

  // Prioridade 6 no núcleo 0 (acima de tarefas "cpu" do usuário), 1 no núcleo 1
  // (mesma do servidor web, que continua respondendo por Round-Robin).
  demoCoreAcquire();
  TaskHandle_t h0 = nullptr, h1 = nullptr;
  BaseType_t ok0 = xTaskCreatePinnedToCore(worker, "lab-nucleo0", 2048, (void*)0, 6, &h0, 0);
  BaseType_t ok1 = xTaskCreatePinnedToCore(worker, "lab-nucleo1", 2048, (void*)1, 1, &h1, s_sameCore ? 0 : 1);
  BaseType_t okc = xTaskCreatePinnedToCore(coordinator, "lab-coord", 2560, nullptr, 3, nullptr, WEBOS_APP_CORE);
  if (ok0 != pdPASS || ok1 != pdPASS || okc != pdPASS) {
    if (h0) vTaskDelete(h0);
    if (h1) vTaskDelete(h1);
    demoCoreRelease();
    xSemaphoreGive(s_stateMux);
    sendError(507, "no_memory", "não foi possível criar as tarefas do experimento");
    return;
  }
  s_running = true;
  s_t0 = esp_timer_get_time();
  xEventGroupSetBits(s_eg, BIT_GO);   // largada!
  respond();
  xSemaphoreGive(s_stateMux);
}

static void handleStop() {
  s_abort = true;
  handleGet();
}

static void handleReset() {
  xSemaphoreTake(s_stateMux, portMAX_DELAY);
  if (!s_running) { s_histCount = 0; s_shared = 0; }
  respond();
  xSemaphoreGive(s_stateMux);
}

void labRoutes() {
  apiRoute("/api/concurrency", HTTP_GET, handleGet);
  apiRoute("/api/concurrency/start", HTTP_POST, handleStart);
  apiRoute("/api/concurrency/stop", HTTP_POST, handleStop);
  apiRoute("/api/concurrency/reset", HTTP_POST, handleReset);
}
