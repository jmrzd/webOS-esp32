// =============================================================================
//  WebOS ESP32 — configuração central
//  Altere aqui rede Wi-Fi, pinos e limites. Tudo o mais lê destas constantes.
// =============================================================================
#pragma once

#define WEBOS_NAME            "WebOS ESP32"
#define WEBOS_VERSION         "1.0.0"

// ---------------- Rede (Access Point próprio) ----------------
// O SSID final recebe os 4 últimos dígitos do MAC: "WebOS-ESP32-A1B2".
#define WEBOS_AP_SSID_PREFIX  "WebOS-ESP32"
#define WEBOS_AP_PASSWORD     "webos1234"   // WPA2: mínimo 8 caracteres. "" = rede aberta
#define WEBOS_AP_CHANNEL      6
#define WEBOS_AP_MAX_CLIENTS  4
#define WEBOS_MDNS_HOSTNAME   "webos"       // http://webos.local (quando o aparelho suporta mDNS)

// ---------------- Hardware ----------------
// LED: o ESP32 DevKit V1 costuma ter LED azul no GPIO 2. Outras placas variam,
// por isso o pino pode ser trocado pela interface (Gerenciador de Dispositivos)
// e fica salvo na NVS. Aqui fica apenas o valor de fábrica.
#define WEBOS_DEFAULT_LED_PIN        2
#define WEBOS_DEFAULT_LED_ACTIVE_LOW false
// Botão BOOT: GPIO 0 no ESP32 DevKit. Nível lógico: solto = HIGH (pull-up), apertado = LOW.
#define WEBOS_BUTTON_PIN             0
#define WEBOS_BUTTON_DEBOUNCE_MS     200
#define WEBOS_BUTTON_SETTLE_MS       20    // espera do driver antes de ler o nível estável

// ---------------- FreeRTOS / experimentos ----------------
#define WEBOS_DEMO_CORE              0     // tarefas "cpu" e escalonador rodam no núcleo 0
#define WEBOS_APP_CORE               1     // servidor web (loopTask) roda no núcleo 1
#define WEBOS_MAX_USER_TASKS         12
#define WEBOS_USER_PRIO_MIN          1
#define WEBOS_USER_PRIO_MAX          8
#define WEBOS_USER_TASK_STACK        2560
#define WEBOS_SCHED_MAX_SECONDS      180   // escalonador para sozinho (proteção)
#define WEBOS_LAB_TIMEOUT_MS         30000 // laboratório de concorrência aborta após isso
#define WEBOS_DEADLOCK_DETECT_MS     1000  // ciclo persistente por este tempo = deadlock
#define WEBOS_DEADLOCK_AUTORECOVER_MS 8000 // watchdog do experimento
#define WEBOS_DEADLOCK_MAX_SECONDS   90

// ---------------- Memória ----------------
#define WEBOS_HEAP_RESERVE_BYTES     (40 * 1024)  // nunca deixar menos que isso livre
#define WEBOS_MAX_MEM_BLOCKS         48
#define WEBOS_MEM_BLOCK_MIN_KB       1
#define WEBOS_MEM_BLOCK_MAX_KB       32
#define WEBOS_HISTORY_LEN            60           // amostras de 1 s

// ---------------- Arquivos / API ----------------
#define WEBOS_FS_PARTITION_LABEL     "spiffs"     // nome da partição de dados no esquema padrão
#define WEBOS_WWW_DIR                "/www"       // interface React (somente leitura pela API)
#define WEBOS_MAX_FILE_BYTES         16384
#define WEBOS_MAX_PATH_LEN           63
#define WEBOS_RATE_LIMIT_PER_SEC     60           // requisições de API por segundo (todas as origens)
#define WEBOS_TERMINAL_MAX_CMD       120

// ---------------- Login educacional ----------------
#define WEBOS_DEFAULT_USER           "admin"
#define WEBOS_DEFAULT_PASS           "webos"
#define WEBOS_LOGIN_MAX_FAILS        5
#define WEBOS_LOGIN_LOCK_MS          30000
