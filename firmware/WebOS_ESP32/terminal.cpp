// =============================================================================
//  Terminal — Aula 3 (shell e chamadas de sistema)
//  O navegador só envia o texto; o firmware interpreta e executa o comando,
//  como um shell que traduz comandos em chamadas ao núcleo (FreeRTOS/ESP-IDF).
// =============================================================================
#include "webos.h"
#include <LittleFS.h>
#include <WiFi.h>
#include <esp_heap_caps.h>

#define CAPS (MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT)

static String pad(const String& s, int w) {
  String r = s;
  if ((int)r.length() > w) r = r.substring(0, w);
  while ((int)r.length() < w) r += ' ';
  return r;
}

static String fmtUptime(uint32_t ms) {
  uint32_t s = ms / 1000;
  char b[32];
  snprintf(b, sizeof(b), "%luh %02lum %02lus", (unsigned long)(s / 3600), (unsigned long)((s / 60) % 60), (unsigned long)(s % 60));
  return b;
}

static void cmdHelp(String& o) {
  o += "Comandos disponíveis (executados no ESP32):\n"
       "  help              esta ajuda\n"
       "  ps                lista as tarefas do FreeRTOS (uxTaskGetSystemState)\n"
       "  kill <pid>        finaliza uma tarefa do usuário (vTaskDelete)\n"
       "  mem | free        estado do heap (heap_caps_*)\n"
       "  ls [dir]          lista um diretório do LittleFS\n"
       "  cat <arquivo>     mostra um arquivo de texto\n"
       "  df                uso do sistema de arquivos\n"
       "  uptime            tempo ligado\n"
       "  uname [-a]        identificação do sistema\n"
       "  led on|off|toggle controla o LED\n"
       "  clear             limpa a tela (no navegador)\n";
}

static void cmdPs(String& o) {
#if WEBOS_HAS_TRACE
  UBaseType_t cap = uxTaskGetNumberOfTasks() + 4;
  TaskStatus_t* arr = (TaskStatus_t*)malloc(cap * sizeof(TaskStatus_t));
  if (!arr) { o += "ps: sem memória\n"; return; }
  UBaseType_t got = uxTaskGetSystemState(arr, cap, nullptr);
  o += "  PID NOME             ESTADO       PRIO NUC  PILHA  CPU%\n";
  for (UBaseType_t k = 0; k < got; k++) {
    TaskStatus_t& s = arr[k];
    BaseType_t core;
  #if defined(configTASKLIST_INCLUDE_COREID) && (configTASKLIST_INCLUDE_COREID == 1)
    core = s.xCoreID;
  #else
    core = xTaskGetCoreID(s.xHandle);
  #endif
    int pm = monitorCpuPermille(s.xHandle);
    char line[96];
    snprintf(line, sizeof(line), "%5lu %s %s %4lu %3s %6lu %5s\n", (unsigned long)s.xTaskNumber,
             pad(s.pcTaskName, 16).c_str(), pad(taskStateName(s.eCurrentState), 12).c_str(),
             (unsigned long)s.uxCurrentPriority, (core == 0 || core == 1) ? (core ? "1" : "0") : "-",
             (unsigned long)s.usStackHighWaterMark, pm < 0 ? "-" : String(pm / 10.0, 1).c_str());
    o += line;
  }
  free(arr);
  o += String(got) + " tarefas. PILHA = bytes livres no pior momento.\n";
#else
  o += "ps: este core do Arduino foi compilado sem configUSE_TRACE_FACILITY\n";
#endif
}

static void cmdMem(String& o) {
  char b[256];
  size_t freeB = heap_caps_get_free_size(CAPS), largest = heap_caps_get_largest_free_block(CAPS);
  snprintf(b, sizeof(b),
           "heap total      %7u bytes\nheap livre      %7u bytes\nmenor livre     %7u bytes (pior momento desde o boot)\n"
           "maior bloco     %7u bytes\nfragmentação    %6.1f %%\n",
           (unsigned)heap_caps_get_total_size(CAPS), (unsigned)freeB, (unsigned)heap_caps_get_minimum_free_size(CAPS),
           (unsigned)largest, freeB ? 100.0 * (1.0 - (double)largest / freeB) : 0.0);
  o += b;
}

static void cmdLs(const String& arg, String& o) {
  if (!filesMounted()) { o += "ls: LittleFS não montado\n"; return; }
  String dir = arg.length() ? arg : String("/");
  if (dir != "/" && !filesValidPath(dir, true)) { o += "ls: caminho inválido\n"; return; }
  File d = LittleFS.open(dir);
  if (!d || !d.isDirectory()) { o += "ls: " + dir + ": diretório não existe\n"; if (d) d.close(); return; }
  File f = d.openNextFile();
  int n = 0;
  while (f && n < 100) {
    char line[80];
    snprintf(line, sizeof(line), "%s %8u  %s%s\n", f.isDirectory() ? "d" : "-", (unsigned)(f.isDirectory() ? 0 : f.size()),
             f.name(), f.isDirectory() ? "/" : "");
    o += line;
    f.close();
    f = d.openNextFile();
    n++;
  }
  if (f) f.close();
  d.close();
  if (!n) o += "(vazio)\n";
}

static void cmdCat(const String& arg, String& o) {
  if (!filesMounted()) { o += "cat: LittleFS não montado\n"; return; }
  if (!arg.length()) { o += "uso: cat <arquivo>\n"; return; }
  String path = arg.startsWith("/") ? arg : "/" + arg;
  if (!filesValidPath(path, true)) { o += "cat: caminho inválido\n"; return; }
  File f = LittleFS.open(path, "r");
  if (!f || f.isDirectory()) { o += "cat: " + path + ": arquivo não existe\n"; if (f) f.close(); return; }
  if (path.endsWith(".gz")) { o += "cat: arquivo binário (comprimido)\n"; f.close(); return; }
  const size_t limit = 4096;
  size_t total = f.size();
  char buf[129];
  size_t got = 0;
  while (got < limit && f.available()) {
    size_t n = f.readBytes(buf, min((size_t)128, limit - got));
    if (!n) break;
    buf[n] = 0;
    o += buf;
    got += n;
  }
  f.close();
  if (total > limit) o += "\n... (" + String(total - limit) + " bytes omitidos)";
  if (!o.endsWith("\n")) o += "\n";
}

static void cmdDf(String& o) {
  if (!filesMounted()) { o += "df: LittleFS não montado\n"; return; }
  char b[160];
  size_t t = LittleFS.totalBytes(), u = LittleFS.usedBytes();
  snprintf(b, sizeof(b), "Sistema    Tamanho    Usado    Livre  Uso%%\nlittlefs %8u %8u %8u  %3u%%\n",
           (unsigned)t, (unsigned)u, (unsigned)(t - u), (unsigned)(t ? u * 100 / t : 0));
  o += b;
}

static void handleExecute() {
  String cmd;
  if (!argStr("cmd", cmd, WEBOS_TERMINAL_MAX_CMD)) return;
  cmd.trim();
  for (size_t k = 0; k < cmd.length(); k++) {
    if ((uint8_t)cmd[k] < 0x20) { sendError(400, "invalid_input", "caracteres de controle não são permitidos"); return; }
  }
  int sp = cmd.indexOf(' ');
  String name = sp < 0 ? cmd : cmd.substring(0, sp);
  String arg = sp < 0 ? String("") : cmd.substring(sp + 1);
  arg.trim();
  name.toLowerCase();

  String out;
  int code = 0;
  if (name == "" ) {}
  else if (name == "help") cmdHelp(out);
  else if (name == "ps") cmdPs(out);
  else if (name == "mem" || name == "free") cmdMem(out);
  else if (name == "ls") cmdLs(arg, out);
  else if (name == "cat") cmdCat(arg, out);
  else if (name == "df") cmdDf(out);
  else if (name == "uptime") out += "ligado há " + fmtUptime(uptimeMs()) + "\n";
  else if (name == "uname") {
    if (arg == "-a") out += String(WEBOS_NAME) + " " + WEBOS_VERSION + " FreeRTOS " + tskKERNEL_VERSION_NUMBER +
                            " ESP-IDF " + ESP.getSdkVersion() + " " + ESP.getChipModel() + " xtensa\n";
    else out += "WebOS\n";
  } else if (name == "kill") {
    char* end = nullptr;
    long pid = strtol(arg.c_str(), &end, 10);
    if (!arg.length() || *end != '\0' || pid < 0) { out += "uso: kill <pid>\n"; code = 1; }
    else {
      String msg;
      bool ok = tasksKillByPid((uint32_t)pid, msg);
      out += (ok ? "" : "kill: ") + msg + "\n";
      code = ok ? 0 : 1;
    }
  } else if (name == "led") {
    if (arg == "on") ledSet(true);
    else if (arg == "off") ledSet(false);
    else if (arg == "toggle") ledSet(!ledGet());
    else if (arg != "" && arg != "status") { out += "uso: led on|off|toggle|status\n"; code = 1; }
    if (!code) out += String("LED (GPIO ") + ledPin() + "): " + (ledGet() ? "ligado" : "desligado") + "\n";
  } else {
    out += name + ": comando não encontrado (digite help)\n";
    code = 127;
  }

  JsonWriter j(out.length() + 120);
  beginOk(j);
  j.s("cmd", cmd).s("output", out).i("exitCode", code);
  sendOk(j);
}

void terminalRoutes() { apiRoute("/api/terminal/execute", HTTP_POST, handleExecute); }
