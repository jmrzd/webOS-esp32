// =============================================================================
//  Monitor de Memória — Aula 9 (alocação dinâmica, fragmentação externa)
//  Usa o alocador real do ESP-IDF (heap_caps_malloc / heap_caps_free) na RAM interna.
// =============================================================================
#include "webos.h"
#include <esp_heap_caps.h>

#define CAPS (MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT)

struct MemBlock { void* ptr; uint32_t size; uint32_t id; uint32_t allocMs; };

static MemBlock s_blocks[WEBOS_MAX_MEM_BLOCKS];
static uint8_t s_count = 0;
static uint32_t s_nextId = 1;
static uint64_t s_bytesAllocated = 0, s_bytesFreed = 0;
static uint32_t s_allocOps = 0, s_freeOps = 0, s_refused = 0;
static char s_lastEvent[110] = "";
static SemaphoreHandle_t s_mux = nullptr;

void memBegin() { s_mux = xSemaphoreCreateMutex(); }

// Retorna mensagem de erro ou nullptr se alocou.
static const char* allocLocked(uint32_t size) {
  if (s_count >= WEBOS_MAX_MEM_BLOCKS) { s_refused++; return "limite de blocos atingido (libere algum)"; }
  size_t freeNow = heap_caps_get_free_size(CAPS);
  if (freeNow < size + WEBOS_HEAP_RESERVE_BYTES) {
    s_refused++;
    return "recusado: deixaria menos de 40 KB livres para o sistema";
  }
  void* p = heap_caps_malloc(size, CAPS);
  if (!p) { s_refused++; return "malloc retornou NULL: não há bloco contíguo desse tamanho (fragmentação!)"; }
  memset(p, 0xA5, size);   // toca a memória: a alocação é real
  s_blocks[s_count++] = {p, size, s_nextId++, uptimeMs()};
  s_bytesAllocated += size;
  s_allocOps++;
  return nullptr;
}

static void freeIndexLocked(uint8_t idx) {
  heap_caps_free(s_blocks[idx].ptr);
  s_bytesFreed += s_blocks[idx].size;
  s_freeOps++;
  for (uint8_t k = idx; k + 1 < s_count; k++) s_blocks[k] = s_blocks[k + 1];
  s_count--;
}

static void respond() {
  JsonWriter j(3600);
  beginOk(j);
  multi_heap_info_t info;
  heap_caps_get_info(&info, CAPS);
  size_t freeB = heap_caps_get_free_size(CAPS);
  size_t largest = heap_caps_get_largest_free_block(CAPS);
  size_t total = heap_caps_get_total_size(CAPS);
  uint64_t mine = 0;
  for (uint8_t k = 0; k < s_count; k++) mine += s_blocks[k].size;
  j.obj("heap")
    .u("total", total).u("free", freeB).u("used", total - freeB)
    .u("minFree", heap_caps_get_minimum_free_size(CAPS)).u("largestBlock", largest)
    .u("freeBlocks", info.free_blocks).u("allocatedBlocks", info.allocated_blocks)
    .f("fragmentationPct", freeB ? 100.0 * (1.0 - (double)largest / (double)freeB) : 0.0, 1)
  .endObj();
  j.obj("app")
    .u("blocks", s_count).u("bytesHeld", mine)
    .u("bytesAllocatedTotal", s_bytesAllocated).u("bytesFreedTotal", s_bytesFreed)
    .u("allocOps", s_allocOps).u("freeOps", s_freeOps).u("refused", s_refused)
    .u("reserveBytes", WEBOS_HEAP_RESERVE_BYTES).u("maxBlocks", WEBOS_MAX_MEM_BLOCKS)
  .endObj();
  j.s("lastEvent", s_lastEvent);
  j.arr("blocks");
  for (uint8_t k = 0; k < s_count; k++) {
    j.obj().u("id", s_blocks[k].id).u("size", s_blocks[k].size)
     .u("address", (uint32_t)(uintptr_t)s_blocks[k].ptr).u("ageMs", uptimeMs() - s_blocks[k].allocMs).endObj();
  }
  j.endArr();
  uint32_t hist[WEBOS_HISTORY_LEN]; uint8_t n = 0;
  monitorHeapHistory(hist, n);
  j.arr("history");
  for (uint8_t k = 0; k < n; k++) j.u(nullptr, hist[k]);
  j.endArr();
  sendOk(j);
}

static void handleGet() { xSemaphoreTake(s_mux, portMAX_DELAY); respond(); xSemaphoreGive(s_mux); }

static void handleAllocate() {
  long kb;
  if (!argInt("kb", kb, WEBOS_MEM_BLOCK_MIN_KB, WEBOS_MEM_BLOCK_MAX_KB)) return;
  xSemaphoreTake(s_mux, portMAX_DELAY);
  const char* err = allocLocked((uint32_t)kb * 1024);
  if (err) {
    strlcpy(s_lastEvent, err, sizeof(s_lastEvent));
    xSemaphoreGive(s_mux);
    sendError(409, "refused", err);
    return;
  }
  snprintf(s_lastEvent, sizeof(s_lastEvent), "malloc(%ld KB) → bloco #%lu", kb, (unsigned long)(s_nextId - 1));
  respond();
  xSemaphoreGive(s_mux);
}

// mode = one (id) | all | alternate
static void handleFree() {
  String mode;
  if (!argStr("mode", mode, 12)) return;
  xSemaphoreTake(s_mux, portMAX_DELAY);
  if (mode == "one") {
    long id;
    if (!argInt("id", id, 1, 0x7FFFFFFF)) { xSemaphoreGive(s_mux); return; }
    int idx = -1;
    for (uint8_t k = 0; k < s_count; k++) if (s_blocks[k].id == (uint32_t)id) { idx = k; break; }
    if (idx < 0) { xSemaphoreGive(s_mux); sendError(404, "not_found", "bloco não existe"); return; }
    freeIndexLocked((uint8_t)idx);
    snprintf(s_lastEvent, sizeof(s_lastEvent), "free(#%ld)", id);
  } else if (mode == "all") {
    uint8_t n = s_count;
    while (s_count) freeIndexLocked(s_count - 1);
    snprintf(s_lastEvent, sizeof(s_lastEvent), "%u blocos liberados", n);
  } else if (mode == "alternate") {
    // libera blocos de ordem par (1º, 3º, 5º...) deixando "buracos" entre os que ficam
    uint8_t freed = 0;
    for (int k = s_count - 1; k >= 0; k--) if ((k % 2) == 0) { freeIndexLocked((uint8_t)k); freed++; }
    snprintf(s_lastEvent, sizeof(s_lastEvent), "%u blocos alternados liberados (buracos entre os restantes)", freed);
  } else {
    xSemaphoreGive(s_mux);
    sendError(400, "invalid_param", "mode deve ser one, all ou alternate");
    return;
  }
  respond();
  xSemaphoreGive(s_mux);
}

// Provoca fragmentação: enche o heap de blocos de 8 KB (até a reserva) e libera
// metade, alternadamente. A memória livre total cresce, mas fica em pedaços.
static void handleFragment() {
  xSemaphoreTake(s_mux, portMAX_DELAY);
  uint8_t created = 0;
  while (s_count < WEBOS_MAX_MEM_BLOCKS && allocLocked(8 * 1024) == nullptr) created++;
  uint8_t freed = 0;
  for (int k = s_count - 1; k >= 0; k--) if ((k % 2) == 0) { freeIndexLocked((uint8_t)k); freed++; }
  snprintf(s_lastEvent, sizeof(s_lastEvent), "fragmentação: %u blocos de 8 KB alocados, %u liberados alternadamente", created, freed);
  respond();
  xSemaphoreGive(s_mux);
}

void memRoutes() {
  apiRoute("/api/memory", HTTP_GET, handleGet);
  apiRoute("/api/memory/allocate", HTTP_POST, handleAllocate);
  apiRoute("/api/memory/free", HTTP_POST, handleFree);
  apiRoute("/api/memory/fragment", HTTP_POST, handleFragment);
}
