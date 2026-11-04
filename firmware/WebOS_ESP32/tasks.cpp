// =============================================================================
//  Gerenciador de Tarefas — Aula 7 (processos, estados, tabela de processos)
//  Lista TODAS as tarefas reais via uxTaskGetSystemState() e permite criar,
//  suspender, retomar, finalizar e mudar a prioridade das tarefas do usuário.
// =============================================================================
#include "webos.h"

enum UserTaskType : uint8_t { UT_CPU = 0, UT_COUNTER = 1 };

struct UserTask {
  bool used;
  TaskHandle_t handle;
  UserTaskType type;
  uint32_t pid;
  char name[16];
  volatile uint32_t counter;   // trabalho realizado (incrementado pela própria tarefa)
  uint32_t lastCounter;
  uint32_t rate;               // incrementos no último segundo
  uint32_t createdMs;
};

static UserTask s_tasks[WEBOS_MAX_USER_TASKS];
static SemaphoreHandle_t s_regMux = nullptr;
static uint32_t s_seq = 0;

// "cpu": só calcula, nunca bloqueia (CPU-bound). Fica presa ao núcleo 0.
static void cpuTaskFn(void* arg) {
  UserTask* t = (UserTask*)arg;
  volatile uint32_t acc = 0;
  for (;;) {
    for (int k = 0; k < 2000; k++) acc += (uint32_t)k * 2654435761u;
    t->counter = t->counter + 1;
  }
}

// "contador": trabalha um pouco e dorme 100 ms (passa quase todo o tempo bloqueada).
static void counterTaskFn(void* arg) {
  UserTask* t = (UserTask*)arg;
  volatile uint32_t acc = 0;
  for (;;) {
    for (int k = 0; k < 200; k++) acc += (uint32_t)k;
    t->counter = t->counter + 1;
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

static bool validName(const String& n) {
  if (n.length() == 0 || n.length() > 15) return false;
  for (size_t k = 0; k < n.length(); k++) {
    char c = n[k];
    if (!(isalnum((unsigned char)c) || c == '-' || c == '_')) return false;
  }
  return true;
}

static UserTask* findByPid(uint32_t pid) {
  for (auto& t : s_tasks) if (t.used && t.pid == pid) return &t;
  return nullptr;
}

bool tasksIsUserHandle(TaskHandle_t h) {
  if (!h) return false;
  for (auto& t : s_tasks) if (t.used && t.handle == h) return true;
  return false;
}

static const char* userTypeName(UserTaskType t) { return t == UT_CPU ? "cpu" : "contador"; }

// Chamado pelo monitor a cada 1 s: calcula o ritmo (incrementos/s).
void tasksTick() {
  if (!s_regMux) return;
  xSemaphoreTake(s_regMux, portMAX_DELAY);
  for (auto& t : s_tasks) {
    if (!t.used) continue;
    uint32_t c = t.counter;
    t.rate = c - t.lastCounter;
    t.lastCounter = c;
  }
  xSemaphoreGive(s_regMux);
}

void tasksBegin() { s_regMux = xSemaphoreCreateMutex(); }

static void removeTask(UserTask& t) {
  TaskHandle_t h = t.handle;
  bool wasCpu = (t.type == UT_CPU);
  t.used = false;
  t.handle = nullptr;
  if (h) vTaskDelete(h);
  if (wasCpu) demoCoreRelease();
}

bool tasksKillByPid(uint32_t pid, String& msg) {
  xSemaphoreTake(s_regMux, portMAX_DELAY);
  UserTask* t = findByPid(pid);
  if (!t) {
    xSemaphoreGive(s_regMux);
    msg = "PID não pertence a uma tarefa de usuário (tarefas do sistema são protegidas)";
    return false;
  }
  msg = String("tarefa ") + t->name + " (PID " + pid + ") finalizada";
  removeTask(*t);
  xSemaphoreGive(s_regMux);
  return true;
}

// ------------------------------------------------------------------------------
static void writeUserFields(JsonWriter& j, TaskHandle_t h) {
  for (auto& t : s_tasks) {
    if (t.used && t.handle == h) {
      j.b("user", true).s("type", userTypeName(t.type)).u("counter", t.counter).u("rate", t.rate)
       .b("protected", false);
      return;
    }
  }
  if (schedIsDemoHandle(h)) {
    j.b("user", false).s("type", "escalonador").null("counter").null("rate").b("protected", true)
     .s("protectedReason", "controlada pelo app Escalonador ao vivo");
    return;
  }
  j.b("user", false).s("type", "sistema").null("counter").null("rate").b("protected", true)
   .s("protectedReason", "tarefa do sistema");
}

static void handleList() {
  JsonWriter j(4096);
  beginOk(j);
  j.u("total", uxTaskGetNumberOfTasks());
  j.i("maxUserTasks", WEBOS_MAX_USER_TASKS);
  j.i("prioMin", WEBOS_USER_PRIO_MIN).i("prioMax", WEBOS_USER_PRIO_MAX);
  j.b("traceFacility", WEBOS_HAS_TRACE).b("runtimeStats", WEBOS_HAS_RUNTIME);
  j.arr("tasks");
#if WEBOS_HAS_TRACE
  UBaseType_t cap = uxTaskGetNumberOfTasks() + 4;
  TaskStatus_t* arr = (TaskStatus_t*)malloc(cap * sizeof(TaskStatus_t));
  if (arr) {
    UBaseType_t got = uxTaskGetSystemState(arr, cap, nullptr);
    xSemaphoreTake(s_regMux, portMAX_DELAY);
    for (UBaseType_t k = 0; k < got; k++) {
      TaskStatus_t& s = arr[k];
      BaseType_t core;
  #if defined(configTASKLIST_INCLUDE_COREID) && (configTASKLIST_INCLUDE_COREID == 1)
      core = s.xCoreID;
  #else
      core = xTaskGetCoreID(s.xHandle);
  #endif
      j.obj()
        .u("pid", s.xTaskNumber)
        .s("name", s.pcTaskName)
        .s("state", taskStateName(s.eCurrentState))
        .u("priority", s.uxCurrentPriority)
        .u("basePriority", s.uxBasePriority)
        .i("core", (core == 0 || core == 1) ? (int)core : -1)
        .u("stackFree", (uint32_t)s.usStackHighWaterMark);   // ESP-IDF: em bytes
      int pm = monitorCpuPermille(s.xHandle);
      if (pm < 0) j.null("cpu"); else j.f("cpu", pm / 10.0, 1);
      writeUserFields(j, s.xHandle);
      j.endObj();
    }
    xSemaphoreGive(s_regMux);
    free(arr);
  }
#else
  // Sem trace facility no FreeRTOS deste core: listamos somente as tarefas que
  // o WebOS conhece (as do usuário). Nada é inventado para as do sistema.
  xSemaphoreTake(s_regMux, portMAX_DELAY);
  for (auto& t : s_tasks) {
    if (!t.used) continue;
    j.obj().u("pid", t.pid).s("name", t.name).s("state", taskStateName(eTaskGetState(t.handle)))
      .u("priority", uxTaskPriorityGet(t.handle)).u("basePriority", uxTaskPriorityGet(t.handle))
      .i("core", t.type == UT_CPU ? WEBOS_DEMO_CORE : WEBOS_APP_CORE)
      .u("stackFree", uxTaskGetStackHighWaterMark(t.handle)).null("cpu");
    writeUserFields(j, t.handle);
    j.endObj();
  }
  xSemaphoreGive(s_regMux);
#endif
  j.endArr();
  sendOk(j);
}

static void handleCreate() {
  String type, name;
  long prio;
  if (!argStr("type", type, 16)) return;
  if (!argInt("priority", prio, WEBOS_USER_PRIO_MIN, WEBOS_USER_PRIO_MAX)) return;
  if (server.hasArg("name") && !argStr("name", name, 32, false)) return;
  UserTaskType tt;
  if (type == "cpu") tt = UT_CPU;
  else if (type == "contador") tt = UT_COUNTER;
  else { sendError(400, "invalid_param", "type deve ser 'cpu' ou 'contador'"); return; }
  if (name.length() && !validName(name)) {
    sendError(400, "invalid_param", "nome: 1 a 15 caracteres, letras, números, - ou _");
    return;
  }

  xSemaphoreTake(s_regMux, portMAX_DELAY);
  UserTask* slot = nullptr;
  for (auto& t : s_tasks) if (!t.used) { slot = &t; break; }
  if (!slot) {
    xSemaphoreGive(s_regMux);
    sendError(409, "limit", "limite de tarefas do usuário atingido; finalize alguma antes");
    return;
  }
  memset(slot, 0, sizeof(UserTask));
  slot->type = tt;
  s_seq++;
  if (name.length()) strlcpy(slot->name, name.c_str(), sizeof(slot->name));
  else snprintf(slot->name, sizeof(slot->name), "%s-%lu", userTypeName(tt), (unsigned long)s_seq);
  slot->createdMs = uptimeMs();

  if (tt == UT_CPU) demoCoreAcquire();
  BaseType_t ok = xTaskCreatePinnedToCore(tt == UT_CPU ? cpuTaskFn : counterTaskFn, slot->name,
                                          WEBOS_USER_TASK_STACK, slot, (UBaseType_t)prio, &slot->handle,
                                          tt == UT_CPU ? WEBOS_DEMO_CORE : WEBOS_APP_CORE);
  if (ok != pdPASS) {
    if (tt == UT_CPU) demoCoreRelease();
    xSemaphoreGive(s_regMux);
    sendError(507, "no_memory", "xTaskCreate falhou: heap insuficiente para a pilha/TCB");
    return;
  }
  slot->used = true;
#if WEBOS_HAS_TRACE
  // PID = número do TCB (xTaskNumber), o mesmo que a listagem e o "ps" mostram.
  // Atenção: uxTaskGetTaskNumber() devolve outro campo (uxTaskNumber, que vale 0
  // se ninguém chamar vTaskSetTaskNumber) — usá-lo quebrava suspender/finalizar.
  {
    TaskStatus_t st;
    vTaskGetInfo(slot->handle, &st, pdFALSE, eInvalid);
    slot->pid = st.xTaskNumber;
  }
#else
  slot->pid = 1000 + s_seq;
#endif
  JsonWriter j(200);
  beginOk(j);
  j.u("pid", slot->pid).s("name", slot->name).s("type", userTypeName(tt)).i("priority", prio)
   .i("core", tt == UT_CPU ? WEBOS_DEMO_CORE : WEBOS_APP_CORE);
  xSemaphoreGive(s_regMux);
  sendOk(j);
}

// Operação sobre uma tarefa do usuário identificada por pid.
enum Op { OP_SUSPEND, OP_RESUME, OP_DELETE, OP_PRIORITY };

static void handleOp(Op op) {
  long pid, prio = 0;
  if (!argInt("pid", pid, 0, 0x7FFFFFFF)) return;
  if (op == OP_PRIORITY && !argInt("priority", prio, WEBOS_USER_PRIO_MIN, WEBOS_USER_PRIO_MAX)) return;
  xSemaphoreTake(s_regMux, portMAX_DELAY);
  UserTask* t = findByPid((uint32_t)pid);
  if (!t) {
    xSemaphoreGive(s_regMux);
    sendError(403, "protected", "somente tarefas criadas pelo usuário podem ser alteradas; tarefas do sistema são protegidas");
    return;
  }
  const char* msg = "";
  switch (op) {
    case OP_SUSPEND:  vTaskSuspend(t->handle); msg = "tarefa suspensa (vTaskSuspend)"; break;
    case OP_RESUME:   vTaskResume(t->handle);  msg = "tarefa retomada (vTaskResume)"; break;
    case OP_PRIORITY: vTaskPrioritySet(t->handle, (UBaseType_t)prio); msg = "prioridade alterada (vTaskPrioritySet)"; break;
    case OP_DELETE:   removeTask(*t); msg = "tarefa finalizada (vTaskDelete)"; break;
  }
  xSemaphoreGive(s_regMux);
  JsonWriter j(120);
  beginOk(j);
  j.i("pid", pid).s("message", msg);
  sendOk(j);
}

void tasksRoutes() {
  apiRoute("/api/tasks", HTTP_GET, handleList);
  apiRoute("/api/tasks", HTTP_POST, handleCreate);
  apiRoute("/api/tasks/suspend", HTTP_POST, []() { handleOp(OP_SUSPEND); });
  apiRoute("/api/tasks/resume", HTTP_POST, []() { handleOp(OP_RESUME); });
  apiRoute("/api/tasks/delete", HTTP_POST, []() { handleOp(OP_DELETE); });
  apiRoute("/api/tasks/priority", HTTP_POST, []() { handleOp(OP_PRIORITY); });
}
