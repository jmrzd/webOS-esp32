// =============================================================================
//  Gerenciador de Dispositivos — Aula 10 (E/S, interrupção, driver)
//  LED: dispositivo de saída (GPIO configurável).
//  Botão BOOT: ISR curta → fila → tarefa "driver-botao" (debounce) → API.
// =============================================================================
#include "webos.h"
#include <Preferences.h>
#include <esp_timer.h>

static const int8_t ALLOWED_LED_PINS[] = {2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33};

static int s_ledPin = WEBOS_DEFAULT_LED_PIN;
static bool s_ledActiveLow = WEBOS_DEFAULT_LED_ACTIVE_LOW;
static bool s_ledOn = false;
static uint32_t s_ledToggles = 0;

// ------------------------------- botão -------------------------------
struct PressEvent { uint32_t uptimeMs; uint32_t sinceLastMs; uint16_t bouncesBefore; };

static QueueHandle_t s_isrQueue = nullptr;           // ISR → driver (timestamps em µs)
static volatile uint32_t s_irqCount = 0;             // interrupções recebidas (escrito só na ISR)
static volatile uint32_t s_irqDropped = 0;           // fila cheia
static uint32_t s_valid = 0, s_filtered = 0;
static uint32_t s_lastValidMs = 0;
static PressEvent s_hist[16];
static uint8_t s_histCount = 0;
static uint16_t s_pendingBounces = 0;
static TaskHandle_t s_driverTask = nullptr;
static portMUX_TYPE s_btnMux = portMUX_INITIALIZER_UNLOCKED;

// ISR: só registra o instante e acorda o driver. Nada de Serial, malloc ou espera.
static void IRAM_ATTR buttonIsr() {
  s_irqCount = s_irqCount + 1;
  int64_t now = esp_timer_get_time();
  BaseType_t woken = pdFALSE;
  if (xQueueSendFromISR(s_isrQueue, &now, &woken) != pdTRUE) s_irqDropped = s_irqDropped + 1;
  if (woken) portYIELD_FROM_ISR();
}

// Driver: dorme bloqueado na fila (sem gastar CPU). Ao receber uma borda,
// espera o contato assentar e confere o nível: só conta se continuar apertado
// e se passou o tempo de debounce desde o último aperto válido.
static void buttonDriver(void*) {
  int64_t ts;
  for (;;) {
    if (xQueueReceive(s_isrQueue, &ts, pdMS_TO_TICKS(1000)) != pdTRUE) continue;  // prazo: aparece como "bloqueada"
    vTaskDelay(pdMS_TO_TICKS(WEBOS_BUTTON_SETTLE_MS));
    // bordas que chegaram durante a espera são repiques do mesmo toque
    uint16_t extra = 0;
    int64_t dummy;
    while (xQueueReceive(s_isrQueue, &dummy, 0) == pdTRUE) extra++;
    bool pressed = digitalRead(WEBOS_BUTTON_PIN) == LOW;
    uint32_t nowMs = uptimeMs();
    portENTER_CRITICAL(&s_btnMux);
    if (pressed && (s_valid == 0 || nowMs - s_lastValidMs >= WEBOS_BUTTON_DEBOUNCE_MS)) {
      PressEvent e{nowMs, s_valid ? nowMs - s_lastValidMs : 0, (uint16_t)(s_pendingBounces + extra)};
      if (s_histCount < 16) s_histCount++;
      for (int k = s_histCount - 1; k > 0; k--) s_hist[k] = s_hist[k - 1];
      s_hist[0] = e;
      s_valid++;
      s_lastValidMs = nowMs;
      s_filtered += extra;
      s_pendingBounces = 0;
    } else {
      s_filtered += 1 + extra;
      s_pendingBounces += 1 + extra;
    }
    portEXIT_CRITICAL(&s_btnMux);
  }
}

// ------------------------------- LED -------------------------------
static void applyLed() { digitalWrite(s_ledPin, (s_ledOn ^ s_ledActiveLow) ? HIGH : LOW); }
bool ledGet() { return s_ledOn; }
int ledPin() { return s_ledPin; }
void ledSet(bool on) { if (on != s_ledOn) s_ledToggles++; s_ledOn = on; applyLed(); }

static bool pinAllowed(long p) {
  for (int8_t a : ALLOWED_LED_PINS) if (a == p) return true;
  return false;
}

void devicesBegin() {
  Preferences prefs;
  if (prefs.begin("webos-dev", true)) {
    int p = prefs.getInt("ledPin", WEBOS_DEFAULT_LED_PIN);
    if (pinAllowed(p)) s_ledPin = p;
    s_ledActiveLow = prefs.getBool("ledLow", WEBOS_DEFAULT_LED_ACTIVE_LOW);
    prefs.end();
  }
  pinMode(s_ledPin, OUTPUT);
  ledSet(false);

  s_isrQueue = xQueueCreate(32, sizeof(int64_t));
  pinMode(WEBOS_BUTTON_PIN, INPUT_PULLUP);   // BOOT: solto = HIGH, apertado = LOW
  xTaskCreatePinnedToCore(buttonDriver, "driver-botao", 2560, nullptr, 3, &s_driverTask, WEBOS_APP_CORE);
  attachInterrupt(digitalPinToInterrupt(WEBOS_BUTTON_PIN), buttonIsr, FALLING);
  Serial.printf("[dev] LED no GPIO %d (%s), botão no GPIO %d por interrupção\n", s_ledPin,
                s_ledActiveLow ? "ativo em LOW" : "ativo em HIGH", WEBOS_BUTTON_PIN);
}

// ------------------------------- API -------------------------------
static void writeLed(JsonWriter& j) {
  j.obj("led").i("pin", s_ledPin).b("activeLow", s_ledActiveLow).b("on", s_ledOn).u("toggles", s_ledToggles)
   .i("level", digitalRead(s_ledPin));
  j.arr("allowedPins");
  for (int8_t a : ALLOWED_LED_PINS) j.i(nullptr, a);
  j.endArr().endObj();
}

static void writeButton(JsonWriter& j) {
  portENTER_CRITICAL(&s_btnMux);
  PressEvent hist[16];
  uint8_t n = s_histCount;
  memcpy(hist, s_hist, sizeof(PressEvent) * n);
  uint32_t valid = s_valid, filtered = s_filtered, lastValid = s_lastValidMs;
  portEXIT_CRITICAL(&s_btnMux);
  j.obj("button").i("pin", WEBOS_BUTTON_PIN).s("trigger", "FALLING").b("pullup", true)
   .b("pressedNow", digitalRead(WEBOS_BUTTON_PIN) == LOW)
   .u("interrupts", s_irqCount).u("valid", valid).u("filtered", filtered).u("dropped", s_irqDropped)
   .u("queued", s_isrQueue ? uxQueueMessagesWaiting(s_isrQueue) : 0)
   .i("debounceMs", WEBOS_BUTTON_DEBOUNCE_MS).u("lastValidMs", lastValid).u("nowMs", uptimeMs());
  if (s_driverTask) j.s("driverState", taskStateName(eTaskGetState(s_driverTask))); else j.null("driverState");
  j.arr("history");
  for (uint8_t k = 0; k < n; k++)
    j.obj().u("atMs", hist[k].uptimeMs).u("sinceLastMs", hist[k].sinceLastMs).u("bounces", hist[k].bouncesBefore).endObj();
  j.endArr().endObj();
}

static void handleDevices() {
  JsonWriter j(1200);
  beginOk(j);
  writeLed(j);
  writeButton(j);
  sendOk(j);
}

static void handleButton() {
  JsonWriter j(900);
  beginOk(j);
  writeButton(j);
  sendOk(j);
}

// state = on | off | toggle
static void handleLed() {
  String state;
  if (!argStr("state", state, 8)) return;
  if (state == "on") ledSet(true);
  else if (state == "off") ledSet(false);
  else if (state == "toggle") ledSet(!s_ledOn);
  else { sendError(400, "invalid_param", "state deve ser on, off ou toggle"); return; }
  JsonWriter j(400);
  beginOk(j);
  writeLed(j);
  sendOk(j);
}

static void handleConfig() {
  long pin, low;
  if (!argInt("ledPin", pin, 0, 39)) return;
  if (!argInt("activeLow", low, 0, 1)) return;
  if (!pinAllowed(pin)) {
    sendError(400, "invalid_pin", "pino não permitido (6–11 = flash, 34–39 só entrada, 0 = BOOT, 1/3 = serial)");
    return;
  }
  if (pin != s_ledPin) {
    digitalWrite(s_ledPin, LOW);
    pinMode(s_ledPin, INPUT);   // devolve o pino antigo ao estado seguro
    s_ledPin = pin;
    pinMode(s_ledPin, OUTPUT);
  }
  s_ledActiveLow = low;
  applyLed();
  Preferences prefs;
  if (prefs.begin("webos-dev", false)) { prefs.putInt("ledPin", s_ledPin); prefs.putBool("ledLow", s_ledActiveLow); prefs.end(); }
  JsonWriter j(400);
  beginOk(j);
  writeLed(j);
  sendOk(j);
}

static void handleButtonReset() {
  portENTER_CRITICAL(&s_btnMux);
  s_valid = s_filtered = 0;
  s_histCount = 0;
  s_pendingBounces = 0;
  s_irqCount = 0;
  s_irqDropped = 0;
  portEXIT_CRITICAL(&s_btnMux);
  handleButton();
}

void devicesRoutes() {
  apiRoute("/api/devices", HTTP_GET, handleDevices);
  apiRoute("/api/devices/button", HTTP_GET, handleButton);
  apiRoute("/api/devices/button/reset", HTTP_POST, handleButtonReset);
  apiRoute("/api/devices/led", HTTP_POST, handleLed);
  apiRoute("/api/devices/config", HTTP_POST, handleConfig);
}
