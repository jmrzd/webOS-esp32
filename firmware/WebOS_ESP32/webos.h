// =============================================================================
//  WebOS ESP32 — declarações compartilhadas entre as abas do sketch
// =============================================================================
#pragma once

#include <Arduino.h>
#include <WebServer.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include <freertos/queue.h>
#include <freertos/event_groups.h>
#include "config.h"

// Capacidades do FreeRTOS compilado no core do Arduino (dependem do sdkconfig).
#if defined(configUSE_TRACE_FACILITY) && (configUSE_TRACE_FACILITY == 1)
  #define WEBOS_HAS_TRACE 1
#else
  #define WEBOS_HAS_TRACE 0
#endif
#if WEBOS_HAS_TRACE && defined(configGENERATE_RUN_TIME_STATS) && (configGENERATE_RUN_TIME_STATS == 1)
  #define WEBOS_HAS_RUNTIME 1
#else
  #define WEBOS_HAS_RUNTIME 0
#endif

// -----------------------------------------------------------------------------
//  JsonWriter: monta JSON numa String sem bibliotecas externas.
//  Métodos com chave (key) para objetos; passe nullptr dentro de arrays.
// -----------------------------------------------------------------------------
class JsonWriter {
 public:
  explicit JsonWriter(size_t reserve = 512) { _out.reserve(reserve); }
  JsonWriter& obj(const char* key = nullptr)  { _prefix(key); _out += '{'; _push(); return *this; }
  JsonWriter& endObj()                        { _pop(); _out += '}'; return *this; }
  JsonWriter& arr(const char* key = nullptr)  { _prefix(key); _out += '['; _push(); return *this; }
  JsonWriter& endArr()                        { _pop(); _out += ']'; return *this; }
  JsonWriter& s(const char* key, const char* v);
  JsonWriter& s(const char* key, const String& v) { return s(key, v.c_str()); }
  JsonWriter& i(const char* key, int64_t v);
  JsonWriter& u(const char* key, uint64_t v);
  JsonWriter& f(const char* key, double v, uint8_t decimals = 1);
  JsonWriter& b(const char* key, bool v)      { _prefix(key); _out += v ? "true" : "false"; return *this; }
  JsonWriter& null(const char* key)           { _prefix(key); _out += "null"; return *this; }
  const String& str() const { return _out; }
  static void escapeInto(String& out, const char* v);

 private:
  String _out;
  uint8_t _depth = 0;
  bool _first[16] = {};
  void _push() { if (_depth < 16) _first[_depth] = true; _depth++; }
  void _pop()  { if (_depth) _depth--; }
  void _prefix(const char* key);
};

// -----------------------------------------------------------------------------
//  Servidor / respostas padronizadas  {ok:true,data:{...}} | {ok:false,error:{...}}
// -----------------------------------------------------------------------------
extern WebServer server;
void webBegin();
void webLoop();
void apiRoute(const char* path, HTTPMethod method, void (*handler)());  // rota com limite de taxa
uint32_t webRejectedRequests();
const char* webosSsid();
void beginOk(JsonWriter& j);          // abre {"ok":true,"data":{
void sendOk(JsonWriter& j);           // fecha e envia HTTP 200
void sendError(int http, const char* code, const char* message);
bool argInt(const char* name, long& out, long minV, long maxV, bool required = true);
bool argStr(const char* name, String& out, size_t maxLen, bool required = true);

// -----------------------------------------------------------------------------
//  Utilidades de núcleo (watchdog do IDLE0 durante experimentos CPU-bound)
// -----------------------------------------------------------------------------
void demoCoreAcquire();   // chamada quando surge uma tarefa que nunca bloqueia no núcleo 0
void demoCoreRelease();
int  demoCoreBusyCount();
const char* taskStateName(eTaskState st);
uint32_t uptimeMs();

// -----------------------------------------------------------------------------
//  Monitor (amostragem a cada 1 s): histórico de heap e % de CPU por tarefa
// -----------------------------------------------------------------------------
void monitorBegin();
int  monitorCpuPermille(TaskHandle_t h);         // ‰ de CPU no último segundo; -1 = indisponível
int  monitorCoreLoadPermille(int core);          // 1000 - IDLE; -1 = indisponível
void monitorHeapHistory(uint32_t* out, uint8_t& count); // mais antigo → mais recente
uint32_t monitorSampleCount();

// -----------------------------------------------------------------------------
//  Módulos (cada .cpp registra suas rotas)
// -----------------------------------------------------------------------------
void systemRoutes();
void tasksBegin();       void tasksRoutes();      void tasksTick();
bool tasksIsUserHandle(TaskHandle_t h);
bool tasksKillByPid(uint32_t pid, String& msg);
void schedBegin();       void schedRoutes();      void schedTick();
bool schedIsDemoHandle(TaskHandle_t h);
bool schedRunning();
void labBegin();         void labRoutes();
bool labRunning();
void memBegin();         void memRoutes();
void filesBegin();       void filesRoutes();
bool filesMounted();
bool filesValidPath(const String& p, bool allowWww);
void devicesBegin();     void devicesRoutes();
bool ledGet();           void ledSet(bool on);    int ledPin();
void deadlockBegin();    void deadlockRoutes();
void terminalRoutes();
void authBegin();        void authRoutes();
