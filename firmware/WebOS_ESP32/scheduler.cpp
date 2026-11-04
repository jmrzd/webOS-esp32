// =============================================================================
//  Escalonador ao vivo — Aula 7 (escalonamento preemptivo, Round-Robin, inanição)
//  Três tarefas CPU-bound reais ("baixa", "media", "alta") presas ao núcleo 0.
//  O FreeRTOS sempre executa a tarefa PRONTA de maior prioridade; entre tarefas
//  de mesma prioridade alterna a cada tick (1 ms) — Round-Robin.
// =============================================================================
#include "webos.h"

struct SchedTask {
  const char* name;
  TaskHandle_t handle;
  UBaseType_t basePrio;       // prioridade escolhida pelo usuário/cenário
  volatile uint32_t loops;    // voltas do laço de cálculo (atômico em 32 bits)
  uint32_t lastLoops;
  uint32_t loopsPerSec;
  int16_t cpuPermille;        // -1 = sem estatística de tempo de execução
  uint8_t starvedSecs;        // segundos seguidos sem receber CPU
  bool suspended;
  bool aged;                  // prioridade elevada temporariamente pelo aging
};

static SchedTask s_t[3] = {
  {"baixa", nullptr, 1, 0, 0, 0, -1, 0, false, false},
  {"media", nullptr, 2, 0, 0, 0, -1, 0, false, false},
  {"alta",  nullptr, 3, 0, 0, 0, -1, 0, false, false},
};
static volatile bool s_running = false;
static int s_scenario = 0;
static uint32_t s_startMs = 0;
static bool s_aging = false;
static uint32_t s_agingBoosts = 0;
static const char* s_cpuMethod = "runtime";
static SemaphoreHandle_t s_mux = nullptr;
static char s_lastEvent[96] = "";

static void schedWorker(void* arg) {
  SchedTask* t = (SchedTask*)arg;
  volatile uint32_t acc = 1;
  for (;;) {
    for (int k = 0; k < 500; k++) acc = acc * 1664525u + 1013904223u;  // só calcula
    t->loops = t->loops + 1;
  }
}

bool schedIsDemoHandle(TaskHandle_t h) {
  if (!h) return false;
  for (auto& t : s_t) if (t.handle == h) return true;
  return false;
}
bool schedRunning() { return s_running; }

static void stopLocked(const char* why) {
  if (!s_running) return;
  for (auto& t : s_t) {
    if (t.handle) { vTaskDelete(t.handle); t.handle = nullptr; demoCoreRelease(); }
    t.suspended = false;
    t.aged = false;
  }
  s_running = false;
  strlcpy(s_lastEvent, why, sizeof(s_lastEvent));
}

static bool startLocked(int scenario) {
  static const UBaseType_t presets[3][3] = {{1, 1, 1}, {1, 2, 3}, {2, 2, 1}};
  stopLocked("reiniciado");
  s_scenario = scenario;
  for (int k = 0; k < 3; k++) {
    SchedTask& t = s_t[k];
    t.basePrio = presets[scenario - 1][k];
    t.loops = 0; t.lastLoops = 0; t.loopsPerSec = 0; t.cpuPermille = -1;
    t.starvedSecs = 0; t.suspended = false; t.aged = false;
  }
  // Cria da menor para a maior prioridade (a criação acontece no núcleo 1).
  for (int k = 0; k < 3; k++) {
    SchedTask& t = s_t[k];
    demoCoreAcquire();
    if (xTaskCreatePinnedToCore(schedWorker, t.name, 2048, &t, t.basePrio, &t.handle, WEBOS_DEMO_CORE) != pdPASS) {
      demoCoreRelease();
      t.handle = nullptr;
      s_running = true;  // para o stopLocked limpar as já criadas
      stopLocked("falha ao criar tarefas (memória)");
      return false;
    }
  }
  s_running = true;
  s_startMs = uptimeMs();
  snprintf(s_lastEvent, sizeof(s_lastEvent), "cenário %d iniciado", scenario);
  return true;
}

void schedBegin() { s_mux = xSemaphoreCreateMutex(); }

// Chamado a cada 1 s pelo monitor (logo após a amostragem de CPU).
void schedTick() {
  if (!s_mux) return;
  xSemaphoreTake(s_mux, portMAX_DELAY);
  if (s_running) {
    uint32_t sumLps = 0;
    for (auto& t : s_t) {
      uint32_t l = t.loops;
      t.loopsPerSec = l - t.lastLoops;
      t.lastLoops = l;
      sumLps += t.loopsPerSec;
      t.cpuPermille = (int16_t)monitorCpuPermille(t.handle);
    }
    // Sem estatística de tempo de execução: usa a fração das voltas do grupo.
    if (!WEBOS_HAS_RUNTIME) {
      s_cpuMethod = "voltas";
      for (auto& t : s_t) t.cpuPermille = sumLps ? (int16_t)((uint64_t)t.loopsPerSec * 1000 / sumLps) : 0;
    }
    // Inanição + aging (envelhecimento): quem passa 2 s sem CPU sobe de prioridade.
    UBaseType_t top = 1;
    for (auto& t : s_t) if (!t.suspended) top = max(top, uxTaskPriorityGet(t.handle));
    for (auto& t : s_t) {
      if (t.suspended) { t.starvedSecs = 0; continue; }
      if (t.loopsPerSec == 0) { if (t.starvedSecs < 255) t.starvedSecs++; }
      else t.starvedSecs = 0;
      if (s_aging) {
        if (t.starvedSecs >= 2 && uxTaskPriorityGet(t.handle) < top + 1 && top + 1 <= WEBOS_USER_PRIO_MAX) {
          vTaskPrioritySet(t.handle, top + 1);
          t.aged = true;
          s_agingBoosts++;
          snprintf(s_lastEvent, sizeof(s_lastEvent), "aging: '%s' subiu para prioridade %u", t.name, (unsigned)(top + 1));
          break;  // uma promoção por segundo
        } else if (t.aged && t.loopsPerSec > 0 && t.starvedSecs == 0) {
          vTaskPrioritySet(t.handle, t.basePrio);   // já executou: volta à prioridade base
          t.aged = false;
        }
      }
    }
    if (uptimeMs() - s_startMs > (uint32_t)WEBOS_SCHED_MAX_SECONDS * 1000UL) {
      stopLocked("parado automaticamente (limite de tempo de proteção)");
    }
  }
  xSemaphoreGive(s_mux);
}

static void writeState(JsonWriter& j) {
  j.b("running", s_running).i("scenario", s_scenario).b("aging", s_aging).u("agingBoosts", s_agingBoosts)
   .s("cpuMethod", WEBOS_HAS_RUNTIME ? "runtime" : s_cpuMethod).i("core", WEBOS_DEMO_CORE)
   .u("elapsedMs", s_running ? uptimeMs() - s_startMs : 0).i("maxSeconds", WEBOS_SCHED_MAX_SECONDS)
   .i("otherCpuTasks", demoCoreBusyCount() - (s_running ? 3 : 0))
   .s("lastEvent", s_lastEvent);
  j.arr("tasks");
  for (int k = 0; k < 3; k++) {
    SchedTask& t = s_t[k];
    j.obj().i("id", k).s("name", t.name);
    if (s_running && t.handle) {
      eTaskState st = t.suspended ? eSuspended : eTaskGetState(t.handle);
      j.s("state", taskStateName(st)).u("priority", uxTaskPriorityGet(t.handle));
#if WEBOS_HAS_TRACE
      TaskStatus_t ts;
      vTaskGetInfo(t.handle, &ts, pdFALSE, eInvalid);   // mesmo PID da listagem (xTaskNumber)
      j.u("pid", ts.xTaskNumber);
#else
      j.null("pid");
#endif
    } else {
      j.s("state", "parada").u("priority", t.basePrio).null("pid");
    }
    j.u("basePriority", t.basePrio).u("loopsPerSec", t.loopsPerSec).u("loops", t.loops)
     .b("suspended", t.suspended).b("aged", t.aged).u("starvedSecs", t.starvedSecs);
    if (t.cpuPermille < 0) j.null("cpu"); else j.f("cpu", t.cpuPermille / 10.0, 1);
    j.endObj();
  }
  j.endArr();
}

static void respond() {
  JsonWriter j(1100);
  beginOk(j);
  writeState(j);
  sendOk(j);
}

static void handleGet() { xSemaphoreTake(s_mux, portMAX_DELAY); respond(); xSemaphoreGive(s_mux); }

static void handleStart() {
  long sc;
  if (!argInt("scenario", sc, 1, 3)) return;
  if (labRunning()) { sendError(409, "busy", "aguarde o Laboratório de Concorrência terminar"); return; }
  xSemaphoreTake(s_mux, portMAX_DELAY);
  bool ok = startLocked((int)sc);
  if (!ok) { xSemaphoreGive(s_mux); sendError(507, "no_memory", "não foi possível criar as tarefas"); return; }
  respond();
  xSemaphoreGive(s_mux);
}

static void handleStop() {
  xSemaphoreTake(s_mux, portMAX_DELAY);
  stopLocked("encerrado pelo usuário");
  respond();
  xSemaphoreGive(s_mux);
}

// action = suspend | resume | prio ; id = 0..2 ; priority (para prio)
static void handleTask() {
  long id, prio = 0;
  String action;
  if (!argInt("id", id, 0, 2)) return;
  if (!argStr("action", action, 12)) return;
  if (action == "prio" && !argInt("priority", prio, WEBOS_USER_PRIO_MIN, WEBOS_USER_PRIO_MAX)) return;
  xSemaphoreTake(s_mux, portMAX_DELAY);
  if (!s_running || !s_t[id].handle) {
    xSemaphoreGive(s_mux);
    sendError(409, "not_running", "inicie um cenário primeiro");
    return;
  }
  SchedTask& t = s_t[id];
  if (action == "suspend")      { vTaskSuspend(t.handle); t.suspended = true; }
  else if (action == "resume")  { vTaskResume(t.handle); t.suspended = false; t.starvedSecs = 0; }
  else if (action == "prio")    { vTaskPrioritySet(t.handle, (UBaseType_t)prio); t.basePrio = (UBaseType_t)prio; t.aged = false; }
  else {
    xSemaphoreGive(s_mux);
    sendError(400, "invalid_param", "action deve ser suspend, resume ou prio");
    return;
  }
  snprintf(s_lastEvent, sizeof(s_lastEvent), "'%s': %s", t.name, action.c_str());
  respond();
  xSemaphoreGive(s_mux);
}

static void handleAging() {
  long on;
  if (!argInt("enabled", on, 0, 1)) return;
  xSemaphoreTake(s_mux, portMAX_DELAY);
  s_aging = on;
  if (!s_aging) {
    for (auto& t : s_t) if (t.aged && t.handle) { vTaskPrioritySet(t.handle, t.basePrio); t.aged = false; }
  }
  respond();
  xSemaphoreGive(s_mux);
}

void schedRoutes() {
  apiRoute("/api/scheduler", HTTP_GET, handleGet);
  apiRoute("/api/scheduler/start", HTTP_POST, handleStart);
  apiRoute("/api/scheduler/stop", HTTP_POST, handleStop);
  apiRoute("/api/scheduler/task", HTTP_POST, handleTask);
  apiRoute("/api/scheduler/aging", HTTP_POST, handleAging);
}
