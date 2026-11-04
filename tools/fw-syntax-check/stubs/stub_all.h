// Stubs mínimos SOMENTE para checagem de sintaxe/tipos no PC (g++ -fsyntax-only).
// Não representam o comportamento real do ESP32.
#pragma once
#include <cstdint>
#include <cstddef>
#include <cstring>
#include <cstdio>
#include <cstdlib>
#include <cstdarg>
#include <cmath>
#include <cctype>
#include <string>
#include <functional>
#include <algorithm>
using std::max; using std::min;
#define IRAM_ATTR
#define PROGMEM
#define HIGH 1
#define LOW 0
#define INPUT 1
#define OUTPUT 3
#define INPUT_PULLUP 5
#define FALLING 2
typedef int BaseType_t; typedef unsigned int UBaseType_t; typedef uint32_t TickType_t; typedef uint8_t StackType_t;
typedef int esp_err_t; const esp_err_t ESP_OK = 0;
struct tskTCB; typedef tskTCB* TaskHandle_t; struct QueueDef; typedef QueueDef* QueueHandle_t; typedef QueueHandle_t SemaphoreHandle_t;
struct EGDef; typedef EGDef* EventGroupHandle_t; typedef uint32_t EventBits_t;
#define pdTRUE 1
#define pdFALSE 0
#define pdPASS 1
#define portMAX_DELAY 0xffffffffu
#define pdMS_TO_TICKS(x) ((TickType_t)(x))
#define configTICK_RATE_HZ 1000
#define configMAX_PRIORITIES 25
#ifndef STUB_NOTRACE
#define configUSE_TRACE_FACILITY 1
#define configGENERATE_RUN_TIME_STATS 1
#define configTASKLIST_INCLUDE_COREID 1
#endif
#define configRUN_TIME_COUNTER_TYPE uint32_t
#define tskKERNEL_VERSION_NUMBER "V10.5.1"
typedef enum { eRunning = 0, eReady, eBlocked, eSuspended, eDeleted, eInvalid } eTaskState;
typedef struct { TaskHandle_t xHandle; const char* pcTaskName; UBaseType_t xTaskNumber; eTaskState eCurrentState; UBaseType_t uxCurrentPriority; UBaseType_t uxBasePriority; configRUN_TIME_COUNTER_TYPE ulRunTimeCounter; StackType_t* pxStackBase; uint32_t usStackHighWaterMark; BaseType_t xCoreID; } TaskStatus_t;
typedef void (*TaskFunction_t)(void*);
BaseType_t xTaskCreatePinnedToCore(TaskFunction_t, const char*, uint32_t, void*, UBaseType_t, TaskHandle_t*, BaseType_t);
void vTaskDelete(TaskHandle_t); void vTaskSuspend(TaskHandle_t); void vTaskResume(TaskHandle_t);
void vTaskPrioritySet(TaskHandle_t, UBaseType_t); UBaseType_t uxTaskPriorityGet(TaskHandle_t);
eTaskState eTaskGetState(TaskHandle_t); UBaseType_t uxTaskGetNumberOfTasks(); UBaseType_t uxTaskGetTaskNumber(TaskHandle_t);
UBaseType_t uxTaskGetSystemState(TaskStatus_t*, UBaseType_t, configRUN_TIME_COUNTER_TYPE*);
UBaseType_t uxTaskGetStackHighWaterMark(TaskHandle_t); BaseType_t xTaskGetCoreID(TaskHandle_t);
TaskHandle_t xTaskGetIdleTaskHandleForCore(BaseType_t);
void vTaskDelay(TickType_t); void vTaskDelayUntil(TickType_t*, TickType_t); TickType_t xTaskGetTickCount();
SemaphoreHandle_t xSemaphoreCreateMutex(); BaseType_t xSemaphoreTake(SemaphoreHandle_t, TickType_t); BaseType_t xSemaphoreGive(SemaphoreHandle_t);
TaskHandle_t xSemaphoreGetMutexHolder(SemaphoreHandle_t);
QueueHandle_t xQueueCreate(UBaseType_t, UBaseType_t); BaseType_t xQueueReceive(QueueHandle_t, void*, TickType_t);
BaseType_t xQueueSendFromISR(QueueHandle_t, const void*, BaseType_t*); UBaseType_t uxQueueMessagesWaiting(QueueHandle_t);
EventGroupHandle_t xEventGroupCreate(); EventBits_t xEventGroupWaitBits(EventGroupHandle_t, EventBits_t, BaseType_t, BaseType_t, TickType_t);
EventBits_t xEventGroupSetBits(EventGroupHandle_t, EventBits_t); EventBits_t xEventGroupClearBits(EventGroupHandle_t, EventBits_t);
#define portYIELD_FROM_ISR(...) do{}while(0)
typedef struct { int x; } portMUX_TYPE;
#define portMUX_INITIALIZER_UNLOCKED {0}
void portENTER_CRITICAL(portMUX_TYPE*); void portEXIT_CRITICAL(portMUX_TYPE*);
esp_err_t esp_task_wdt_status(TaskHandle_t); esp_err_t esp_task_wdt_delete(TaskHandle_t); esp_err_t esp_task_wdt_add(TaskHandle_t);
int64_t esp_timer_get_time(); void esp_fill_random(void*, size_t);
#define MALLOC_CAP_INTERNAL (1<<11)
#define MALLOC_CAP_8BIT (1<<2)
typedef struct { size_t total_free_bytes, total_allocated_bytes, largest_free_block, minimum_free_bytes, allocated_blocks, free_blocks, total_blocks; } multi_heap_info_t;
size_t heap_caps_get_free_size(uint32_t); size_t heap_caps_get_total_size(uint32_t); size_t heap_caps_get_minimum_free_size(uint32_t);
size_t heap_caps_get_largest_free_block(uint32_t); void heap_caps_get_info(multi_heap_info_t*, uint32_t);
void* heap_caps_malloc(size_t, uint32_t); void heap_caps_free(void*);
typedef enum { ESP_PARTITION_TYPE_APP = 0, ESP_PARTITION_TYPE_DATA = 1, ESP_PARTITION_TYPE_ANY = 0xff } esp_partition_type_t;
typedef enum { ESP_PARTITION_SUBTYPE_APP_FACTORY = 0, ESP_PARTITION_SUBTYPE_APP_OTA_MIN = 0x10, ESP_PARTITION_SUBTYPE_APP_OTA_MAX = 0x1f,
  ESP_PARTITION_SUBTYPE_DATA_OTA = 0, ESP_PARTITION_SUBTYPE_DATA_PHY = 1, ESP_PARTITION_SUBTYPE_DATA_NVS = 2, ESP_PARTITION_SUBTYPE_DATA_COREDUMP = 3,
  ESP_PARTITION_SUBTYPE_DATA_FAT = 0x81, ESP_PARTITION_SUBTYPE_DATA_SPIFFS = 0x82, ESP_PARTITION_SUBTYPE_ANY = 0xff } esp_partition_subtype_t;
typedef struct { esp_partition_type_t type; esp_partition_subtype_t subtype; uint32_t address; uint32_t size; char label[17]; } esp_partition_t;
struct PIt; typedef PIt* esp_partition_iterator_t;
esp_partition_iterator_t esp_partition_find(esp_partition_type_t, esp_partition_subtype_t, const char*);
const esp_partition_t* esp_partition_get(esp_partition_iterator_t); esp_partition_iterator_t esp_partition_next(esp_partition_iterator_t);
void esp_partition_iterator_release(esp_partition_iterator_t); const esp_partition_t* esp_ota_get_running_partition();
int mbedtls_sha256(const unsigned char*, size_t, unsigned char*, int);
class String {
 public:
  String(const char* s = "") : v(s ? s : "") {}
  String(const std::string& s) : v(s) {}
  String(char c) : v(1, c) {}
  String(int n) : v(std::to_string(n)) {} String(unsigned n) : v(std::to_string(n)) {}
  String(long n) : v(std::to_string(n)) {} String(unsigned long n) : v(std::to_string(n)) {}
  String(double d, unsigned char dec = 2) : v(std::to_string(d)) { (void)dec; }
  void reserve(size_t n) { v.reserve(n); }
  const char* c_str() const { return v.c_str(); }
  size_t length() const { return v.size(); }
  String& operator+=(const String& o) { v += o.v; return *this; }
  String& operator+=(const char* o) { v += o; return *this; }
  String& operator+=(char c) { v += c; return *this; }
  bool concat(const char* s, unsigned int n) { v.append(s, n); return true; }
  char operator[](size_t k) const { return v[k]; }
  bool operator==(const String& o) const { return v == o.v; }
  bool operator==(const char* o) const { return v == o; }
  bool operator!=(const char* o) const { return v != o; }
  bool operator!=(const String& o) const { return v != o.v; }
  bool startsWith(const String& p) const { return v.rfind(p.v, 0) == 0; }
  bool endsWith(const String& p) const { return v.size() >= p.v.size() && v.compare(v.size() - p.v.size(), p.v.size(), p.v) == 0; }
  int indexOf(const String& p, unsigned from = 0) const { auto r = v.find(p.v, from); return r == std::string::npos ? -1 : (int)r; }
  int indexOf(char c, unsigned from = 0) const { auto r = v.find(c, from); return r == std::string::npos ? -1 : (int)r; }
  int lastIndexOf(char c) const { auto r = v.rfind(c); return r == std::string::npos ? -1 : (int)r; }
  String substring(unsigned a) const { return String(v.substr(a)); }
  String substring(unsigned a, unsigned b) const { return String(v.substr(a, b - a)); }
  void trim() {} void toLowerCase() {}
  std::string v;
};
inline String operator+(const String& a, const String& b) { return String(a.v + b.v); }
inline String operator+(const String& a, const char* b) { return String(a.v + b); }
inline String operator+(const char* a, const String& b) { return String(std::string(a) + b.v); }
inline String operator+(const String& a, int b) { return String(a.v + std::to_string(b)); }
inline String operator+(const String& a, unsigned long b) { return String(a.v + std::to_string(b)); }
inline String operator+(const String& a, unsigned b) { return String(a.v + std::to_string(b)); }
inline String operator+(const String& a, long b) { return String(a.v + std::to_string(b)); }
struct HardwareSerial { void begin(int); void println(const char* s = ""); void printf(const char*, ...); };
extern HardwareSerial Serial;
struct EspClass { const char* getChipModel(); int getChipRevision(); int getChipCores(); uint32_t getCpuFreqMHz(); uint32_t getFlashChipSize();
  uint32_t getFlashChipSpeed(); uint32_t getPsramSize(); uint32_t getFreePsram(); const char* getSdkVersion(); void restart(); };
extern EspClass ESP;
unsigned long millis(); void delay(unsigned long); void pinMode(int, int); void digitalWrite(int, int); int digitalRead(int);
int digitalPinToInterrupt(int); void attachInterrupt(int, void (*)(), int);
size_t strlcpy(char*, const char*, size_t);
