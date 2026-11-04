// =============================================================================
//  Deadlock — Aula 8 (condições de Coffman, detecção, prevenção, recuperação)
//  Tarefa A pega M1 e depois M2; tarefa B pega M2 e depois M1 (ordem invertida).
//  As duas ficam realmente presas em espera circular. Um vigia (watchdog do
//  experimento) monta o grafo de espera, detecta o ciclo e pode recuperar
//  escolhendo uma vítima — a API nunca trava.
// =============================================================================
#include "webos.h"

enum DlMode : uint8_t { DL_DEADLOCK = 0, DL_ORDERED = 1 };
enum DlPhase : uint8_t { PH_IDLE, PH_TAKING_FIRST, PH_HAS_FIRST, PH_WAITING_SECOND, PH_WORKING, PH_FINISHED, PH_VICTIM };

struct DlTask {
  const char* name;
  TaskHandle_t handle;
  volatile DlPhase phase;
  volatile int8_t waitingFor;   // 0 = M1, 1 = M2, -1 = nenhum
  volatile uint32_t rounds;
  volatile bool abort;
};

static SemaphoreHandle_t s_m[2] = {nullptr, nullptr};
static DlTask s_task[2] = {{"A", nullptr, PH_IDLE, -1, 0, false}, {"B", nullptr, PH_IDLE, -1, 0, false}};
static TaskHandle_t s_watch = nullptr;
static volatile bool s_running = false, s_stopAll = false;
static DlMode s_mode = DL_DEADLOCK;
static bool s_autoRecover = true;
static volatile bool s_detected = false;
static uint32_t s_cycleSinceMs = 0, s_detectedAtMs = 0, s_startMs = 0;
static uint32_t s_recoveries = 0, s_detections = 0;
static volatile uint8_t s_alive = 0;
static const uint32_t ORDERED_ROUNDS = 25;

static char s_log[12][72];
static uint8_t s_logCount = 0;
static portMUX_TYPE s_logMux = portMUX_INITIALIZER_UNLOCKED;

static void logEvent(const char* fmt, ...) {
  char line[72];
  int n = snprintf(line, sizeof(line), "[%5.1fs] ", (uptimeMs() - s_startMs) / 1000.0f);
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(line + n, sizeof(line) - n, fmt, ap);
  va_end(ap);
  portENTER_CRITICAL(&s_logMux);
  if (s_logCount < 12) s_logCount++;
  for (int k = s_logCount - 1; k > 0; k--) memcpy(s_log[k], s_log[k - 1], sizeof(s_log[0]));
  memcpy(s_log[0], line, sizeof(line));
  portEXIT_CRITICAL(&s_logMux);
}

// Espera pelo mutex em fatias de 50 ms. A espera é real (a tarefa fica bloqueada
// no semáforo); as fatias só servem para ela poder ser escolhida como vítima.
static bool takeOrAbort(int self, int m) {
  s_task[self].waitingFor = (int8_t)m;
  for (;;) {
    if (xSemaphoreTake(s_m[m], pdMS_TO_TICKS(50)) == pdTRUE) { s_task[self].waitingFor = -1; return true; }
    if (s_task[self].abort || s_stopAll) { s_task[self].waitingFor = -1; return false; }
  }
}

static void dlWorker(void* arg) {
  const int self = (int)(intptr_t)arg;
  DlTask& t = s_task[self];
  // A: M1→M2. B: M2→M1 no modo deadlock; M1→M2 no modo ordenado (prevenção).
  const int first  = (s_mode == DL_ORDERED || self == 0) ? 0 : 1;
  const int second = 1 - first;
  while (!s_stopAll && !t.abort) {
    t.phase = PH_TAKING_FIRST;
    if (!takeOrAbort(self, first)) break;
    t.phase = PH_HAS_FIRST;
    vTaskDelay(pdMS_TO_TICKS(40));         // janela para a outra tarefa pegar o outro mutex
    t.phase = PH_WAITING_SECOND;
    if (!takeOrAbort(self, second)) {      // virou vítima: devolve o que tem
      xSemaphoreGive(s_m[first]);
      if (t.abort) { logEvent("%s liberou M%d (vítima) e encerrou", t.name, first + 1); t.phase = PH_VICTIM; }
      else logEvent("%s liberou M%d (parada)", t.name, first + 1);
      break;
    }
    t.phase = PH_WORKING;
    vTaskDelay(pdMS_TO_TICKS(15));         // "região crítica" usando os dois recursos
    xSemaphoreGive(s_m[second]);
    xSemaphoreGive(s_m[first]);
    t.rounds = t.rounds + 1;
    if (s_mode == DL_ORDERED && t.rounds >= ORDERED_ROUNDS) break;
    if (s_task[1 - self].phase == PH_VICTIM) {   // a outra foi sacrificada: termina a rodada e sai
      logEvent("%s concluiu a rodada após a recuperação", t.name);
      break;
    }
    vTaskDelay(pdMS_TO_TICKS(5 + self * 3));
  }
  if (t.phase != PH_VICTIM) t.phase = PH_FINISHED;
  t.waitingFor = -1;
  t.handle = nullptr;
  portENTER_CRITICAL(&s_logMux);
  s_alive = s_alive - 1;
  portEXIT_CRITICAL(&s_logMux);
  vTaskDelete(nullptr);
}

static int holderOf(int m) {
  TaskHandle_t h = xSemaphoreGetMutexHolder(s_m[m]);
  if (!h) return -1;
  if (h == s_task[0].handle) return 0;
  if (h == s_task[1].handle) return 1;
  return -2;
}

// Grafo de espera: X espera Mi cujo dono é Y. Ciclo A→B→A = deadlock.
static bool cycleNow() {
  int a = s_task[0].waitingFor, b = s_task[1].waitingFor;
  if (a < 0 || b < 0) return false;
  return holderOf(a) == 1 && holderOf(b) == 0;
}

static void recover(const char* why) {
  s_task[1].abort = true;   // vítima: B (a de menor "custo" — escolha fixa e documentada)
  s_recoveries++;
  logEvent("recuperação (%s): B escolhida como vítima", why);
}

static void watchdogTask(void*) {
  while (s_running) {
    vTaskDelay(pdMS_TO_TICKS(100));
    uint32_t now = uptimeMs();
    if (cycleNow()) {
      if (s_cycleSinceMs == 0) s_cycleSinceMs = now;
      if (!s_detected && now - s_cycleSinceMs >= WEBOS_DEADLOCK_DETECT_MS) {
        s_detected = true;
        s_detectedAtMs = now;
        s_detections++;
        logEvent("DEADLOCK: A espera M2 (de B) e B espera M1 (de A)");
      }
      if (s_detected && s_autoRecover && !s_task[1].abort && now - s_detectedAtMs >= WEBOS_DEADLOCK_AUTORECOVER_MS) {
        recover("watchdog");
      }
    } else {
      s_cycleSinceMs = 0;
    }
    if (now - s_startMs > (uint32_t)WEBOS_DEADLOCK_MAX_SECONDS * 1000UL) s_stopAll = true;
    if (s_alive == 0) {
      // As duas saíram: garante os mutexes livres e encerra o experimento.
      logEvent(s_mode == DL_ORDERED ? "fim: %lu + %lu rodadas, nenhum deadlock" : "experimento encerrado (%lu/%lu rodadas)",
               (unsigned long)s_task[0].rounds, (unsigned long)s_task[1].rounds);
      s_running = false;
    }
  }
  s_watch = nullptr;
  vTaskDelete(nullptr);
}

void deadlockBegin() {
  s_m[0] = xSemaphoreCreateMutex();
  s_m[1] = xSemaphoreCreateMutex();
}

static const char* phaseName(DlPhase p) {
  switch (p) {
    case PH_IDLE: return "parada";
    case PH_TAKING_FIRST: return "pegando o 1º mutex";
    case PH_HAS_FIRST: return "com o 1º mutex";
    case PH_WAITING_SECOND: return "esperando o 2º mutex";
    case PH_WORKING: return "com os dois mutex";
    case PH_FINISHED: return "terminou";
    case PH_VICTIM: return "vítima (liberou e saiu)";
  }
  return "?";
}

static void reapIfOrphan() {
  // Sem vigia (falha de criação) e sem tarefas vivas: encerra o estado.
  if (s_running && s_watch == nullptr && s_alive == 0) s_running = false;
}

static void respond() {
  reapIfOrphan();
  JsonWriter j(1800);
  beginOk(j);
  j.b("running", s_running).s("mode", s_mode == DL_ORDERED ? "ordered" : "deadlock").b("autoRecover", s_autoRecover)
   .b("deadlock", s_detected && cycleNow()).b("detected", s_detected).u("detections", s_detections)
   .u("recoveries", s_recoveries).u("elapsedMs", s_running ? uptimeMs() - s_startMs : 0)
   .u("cycleForMs", s_cycleSinceMs ? uptimeMs() - s_cycleSinceMs : 0)
   .i("detectAfterMs", WEBOS_DEADLOCK_DETECT_MS).i("autoRecoverAfterMs", WEBOS_DEADLOCK_AUTORECOVER_MS);
  j.arr("mutexes");
  for (int m = 0; m < 2; m++) {
    int h = holderOf(m);
    j.obj().s("name", m == 0 ? "M1" : "M2");
    if (h == 0) j.s("holder", "A"); else if (h == 1) j.s("holder", "B"); else j.null("holder");
    j.endObj();
  }
  j.endArr();
  j.arr("tasks");
  for (int k = 0; k < 2; k++) {
    DlTask& t = s_task[k];
    j.obj().s("name", t.name).s("phase", phaseName(t.phase)).u("rounds", t.rounds);
    if (t.waitingFor < 0) j.null("waitingFor"); else j.s("waitingFor", t.waitingFor == 0 ? "M1" : "M2");
    const int first = (s_mode == DL_ORDERED || k == 0) ? 0 : 1;
    j.s("order", first == 0 ? "M1 → M2" : "M2 → M1");
    if (t.handle) j.s("state", taskStateName(eTaskGetState(t.handle))); else j.s("state", "finalizada");
    j.endObj();
  }
  j.endArr();
  j.arr("log");
  portENTER_CRITICAL(&s_logMux);
  char copy[12][72];
  uint8_t n = s_logCount;
  memcpy(copy, s_log, sizeof(copy));
  portEXIT_CRITICAL(&s_logMux);
  for (uint8_t k = 0; k < n; k++) j.s(nullptr, copy[k]);
  j.endArr();
  sendOk(j);
}

static void handleStart() {
  String mode;
  long autoRec = 1;
  if (!argStr("mode", mode, 12)) return;
  if (server.hasArg("autoRecover") && !argInt("autoRecover", autoRec, 0, 1, false)) return;
  if (mode != "deadlock" && mode != "ordered") { sendError(400, "invalid_param", "mode deve ser deadlock ou ordered"); return; }
  reapIfOrphan();
  if (s_running || s_alive) { sendError(409, "busy", "experimento em andamento; pare ou recupere primeiro"); return; }
  s_mode = mode == "ordered" ? DL_ORDERED : DL_DEADLOCK;
  s_autoRecover = autoRec;
  s_stopAll = false;
  s_detected = false;
  s_cycleSinceMs = 0;
  s_logCount = 0;
  s_startMs = uptimeMs();
  for (int k = 0; k < 2; k++) { s_task[k].phase = PH_IDLE; s_task[k].rounds = 0; s_task[k].abort = false; s_task[k].waitingFor = -1; }
  s_alive = 2;
  s_running = true;
  logEvent(s_mode == DL_ORDERED ? "início: ambas pegam M1 → M2 (ordem global)" : "início: A pega M1→M2, B pega M2→M1");
  // A no núcleo 0 e B no núcleo 1: execução realmente paralela.
  bool okA = xTaskCreatePinnedToCore(dlWorker, "deadlock-A", 2560, (void*)0, 2, &s_task[0].handle, 0) == pdPASS;
  bool okB = xTaskCreatePinnedToCore(dlWorker, "deadlock-B", 2560, (void*)1, 2, &s_task[1].handle, ESP.getChipCores() > 1 ? 1 : 0) == pdPASS;
  if (!okA) { s_task[0].handle = nullptr; portENTER_CRITICAL(&s_logMux); s_alive = s_alive - 1; portEXIT_CRITICAL(&s_logMux); }
  if (!okB) { s_task[1].handle = nullptr; portENTER_CRITICAL(&s_logMux); s_alive = s_alive - 1; portEXIT_CRITICAL(&s_logMux); }
  bool okW = xTaskCreatePinnedToCore(watchdogTask, "deadlock-vigia", 2560, nullptr, 4, &s_watch, WEBOS_APP_CORE) == pdPASS;
  if (!okA || !okB || !okW) {
    if (!okW) s_watch = nullptr;
    s_stopAll = true;   // quem foi criado sai sozinho
    sendError(507, "no_memory", "não foi possível criar as tarefas");
    return;
  }
  respond();
}

static void handleRecover() {
  if (!s_running) { sendError(409, "not_running", "nenhum experimento em andamento"); return; }
  if (!cycleNow()) { sendError(409, "no_deadlock", "não há ciclo de espera agora"); return; }
  recover("manual");
  respond();
}

static void handleStop() {
  if (s_running) { s_stopAll = true; logEvent("parada solicitada pelo usuário"); }
  respond();
}

void deadlockRoutes() {
  apiRoute("/api/deadlock", HTTP_GET, respond);
  apiRoute("/api/deadlock/start", HTTP_POST, handleStart);
  apiRoute("/api/deadlock/recover", HTTP_POST, handleRecover);
  apiRoute("/api/deadlock/stop", HTTP_POST, handleStop);
}
