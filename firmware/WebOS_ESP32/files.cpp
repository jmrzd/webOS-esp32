// =============================================================================
//  Explorador de Arquivos — Aula 10 (sistema de arquivos, persistência) e Aula 4
//  (partições). LittleFS na partição de dados da flash: sobrevive a reinicializações.
// =============================================================================
#include "webos.h"
#include <LittleFS.h>

static bool s_mounted = false;
static SemaphoreHandle_t s_fsMux = nullptr;

bool filesMounted() { return s_mounted; }

void filesBegin() {
  s_fsMux = xSemaphoreCreateMutex();
  // formatOnFail = true: só formata se a partição não contiver um LittleFS válido
  // (placa nova ou imagem corrompida). Arquivos existentes não são apagados.
  s_mounted = LittleFS.begin(true, "/littlefs", 10, WEBOS_FS_PARTITION_LABEL);
  if (s_mounted) {
    Serial.printf("[fs] LittleFS montado: %u / %u bytes usados\n", (unsigned)LittleFS.usedBytes(), (unsigned)LittleFS.totalBytes());
    if (!LittleFS.exists(WEBOS_WWW_DIR "/index.html") && !LittleFS.exists(WEBOS_WWW_DIR "/index.html.gz")) {
      Serial.println("[fs] AVISO: interface não encontrada em /www — grave a imagem LittleFS (flash.bat)");
    }
  } else {
    Serial.println("[fs] ERRO: não foi possível montar o LittleFS (confira o esquema de partições)");
  }
}

// Caminho absoluto, sem "..", caracteres seguros, componentes curtos.
bool filesValidPath(const String& p, bool allowWww) {
  if (p.length() < 2 || p.length() > WEBOS_MAX_PATH_LEN || p[0] != '/') return false;
  if (p.indexOf("..") >= 0 || p.indexOf("//") >= 0 || p.endsWith("/")) return false;
  int compLen = 0;
  for (size_t k = 1; k < p.length(); k++) {
    char c = p[k];
    if (c == '/') { if (compLen == 0) return false; compLen = 0; continue; }
    if (!(isalnum((unsigned char)c) || c == '-' || c == '_' || c == '.' || c == ' ')) return false;
    if (++compLen > 31) return false;
  }
  if (!allowWww && (p == WEBOS_WWW_DIR || p.startsWith(WEBOS_WWW_DIR "/"))) return false;
  return true;
}

static bool isProtected(const String& p) { return p == WEBOS_WWW_DIR || p.startsWith(WEBOS_WWW_DIR "/"); }

static bool requireFs() {
  if (!s_mounted) { sendError(503, "fs_unavailable", "LittleFS não montado"); return false; }
  return true;
}

static void handleList() {
  if (!requireFs()) return;
  String dir = server.hasArg("dir") ? server.arg("dir") : String("/");
  if (dir != "/" && !filesValidPath(dir, true)) { sendError(400, "invalid_path", "diretório inválido"); return; }
  xSemaphoreTake(s_fsMux, portMAX_DELAY);
  File d = LittleFS.open(dir);
  if (!d || !d.isDirectory()) {
    if (d) d.close();
    xSemaphoreGive(s_fsMux);
    sendError(404, "not_found", "diretório não existe");
    return;
  }
  JsonWriter j(2400);
  beginOk(j);
  j.s("dir", dir).u("used", LittleFS.usedBytes()).u("total", LittleFS.totalBytes())
   .i("maxFileBytes", WEBOS_MAX_FILE_BYTES).s("partition", WEBOS_FS_PARTITION_LABEL);
  j.arr("entries");
  uint16_t count = 0;
  File f = d.openNextFile();
  while (f && count < 200) {
    String path = f.path();
    j.obj().s("name", f.name()).s("path", path).b("isDir", f.isDirectory())
     .u("size", f.isDirectory() ? 0 : f.size()).b("protected", isProtected(path))
     .u("modified", (uint32_t)f.getLastWrite()).endObj();
    f.close();
    f = d.openNextFile();
    count++;
  }
  if (f) f.close();
  d.close();
  j.endArr();
  xSemaphoreGive(s_fsMux);
  sendOk(j);
}

static bool looksBinary(File& f) {
  uint8_t buf[256];
  size_t n = f.read(buf, sizeof(buf));
  f.seek(0);
  for (size_t k = 0; k < n; k++) {
    uint8_t c = buf[k];
    if (c == 0 || (c < 0x09) || (c > 0x0D && c < 0x20 && c != 0x1B)) return true;
  }
  return false;
}

static void handleRead() {
  if (!requireFs()) return;
  String path;
  if (!argStr("path", path, WEBOS_MAX_PATH_LEN)) return;
  if (!filesValidPath(path, true)) { sendError(400, "invalid_path", "caminho inválido"); return; }
  xSemaphoreTake(s_fsMux, portMAX_DELAY);
  File f = LittleFS.open(path, "r");
  if (!f || f.isDirectory()) {
    if (f) f.close();
    xSemaphoreGive(s_fsMux);
    sendError(404, "not_found", "arquivo não existe");
    return;
  }
  size_t size = f.size();
  bool binary = looksBinary(f);
  JsonWriter j(binary ? 256 : size + 300);
  beginOk(j);
  j.s("path", path).u("size", size).b("binary", binary).b("protected", isProtected(path));
  if (binary) {
    j.null("content").b("truncated", false);
  } else {
    size_t toRead = size > WEBOS_MAX_FILE_BYTES ? WEBOS_MAX_FILE_BYTES : size;
    String content;
    content.reserve(toRead + 1);
    char buf[257];
    size_t got = 0;
    while (got < toRead) {
      size_t n = f.readBytes(buf, min((size_t)256, toRead - got));
      if (n == 0) break;
      buf[n] = '\0';
      content.concat(buf, n);
      got += n;
    }
    j.s("content", content).b("truncated", size > toRead);
  }
  f.close();
  xSemaphoreGive(s_fsMux);
  sendOk(j);
}

static bool enoughSpace(size_t need) {
  size_t freeB = LittleFS.totalBytes() - LittleFS.usedBytes();
  return freeB > need + 8192;   // margem para metadados e blocos do LittleFS
}

static bool writeFile(const String& path, const String& content, const char* mode) {
  File f = LittleFS.open(path, mode);
  if (!f) return false;
  size_t w = f.print(content);
  f.close();
  return w == content.length();
}

// type = file | dir
static void handleCreate() {
  if (!requireFs()) return;
  String path, type, content;
  if (!argStr("path", path, WEBOS_MAX_PATH_LEN)) return;
  type = "file";
  if (server.hasArg("type") && !argStr("type", type, 8, false)) return;
  if (server.hasArg("content") && !argStr("content", content, WEBOS_MAX_FILE_BYTES, false)) return;  // erro já enviado
  if (type != "file" && type != "dir") { sendError(400, "invalid_param", "type deve ser file ou dir"); return; }
  if (!filesValidPath(path, false)) {
    sendError(400, "invalid_path", "caminho inválido ou protegido (use letras, números, . - _ ; até 31 caracteres por nome)");
    return;
  }
  xSemaphoreTake(s_fsMux, portMAX_DELAY);
  if (LittleFS.exists(path)) { xSemaphoreGive(s_fsMux); sendError(409, "exists", "já existe um item com esse nome"); return; }
  bool ok;
  if (type == "dir") ok = LittleFS.mkdir(path);
  else {
    if (!enoughSpace(content.length())) { xSemaphoreGive(s_fsMux); sendError(507, "no_space", "espaço insuficiente no LittleFS"); return; }
    ok = writeFile(path, content, "w");
  }
  xSemaphoreGive(s_fsMux);
  if (!ok) { sendError(500, "io_error", "falha de escrita na flash"); return; }
  JsonWriter j(160);
  beginOk(j);
  j.s("path", path).s("type", type == "dir" ? "dir" : "file").u("size", content.length());
  sendOk(j);
}

static void handleWrite() {
  if (!requireFs()) return;
  String path, content;
  if (!argStr("path", path, WEBOS_MAX_PATH_LEN)) return;
  if (!argStr("content", content, WEBOS_MAX_FILE_BYTES)) return;
  if (!filesValidPath(path, false)) { sendError(403, "protected", "caminho inválido ou protegido (/www é a interface)"); return; }
  xSemaphoreTake(s_fsMux, portMAX_DELAY);
  File cur = LittleFS.open(path, "r");
  size_t oldSize = 0;
  if (cur) { if (cur.isDirectory()) { cur.close(); xSemaphoreGive(s_fsMux); sendError(400, "is_dir", "é um diretório"); return; } oldSize = cur.size(); cur.close(); }
  if (content.length() > oldSize && !enoughSpace(content.length() - oldSize)) {
    xSemaphoreGive(s_fsMux);
    sendError(507, "no_space", "espaço insuficiente no LittleFS");
    return;
  }
  bool ok = writeFile(path, content, "w");
  xSemaphoreGive(s_fsMux);
  if (!ok) { sendError(500, "io_error", "falha de escrita na flash"); return; }
  JsonWriter j(160);
  beginOk(j);
  j.s("path", path).u("size", content.length()).u("used", LittleFS.usedBytes());
  sendOk(j);
}

static void handleDelete() {
  if (!requireFs()) return;
  String path;
  if (!argStr("path", path, WEBOS_MAX_PATH_LEN)) return;
  if (!filesValidPath(path, false)) { sendError(403, "protected", "caminho inválido ou protegido (/www é a interface)"); return; }
  xSemaphoreTake(s_fsMux, portMAX_DELAY);
  File f = LittleFS.open(path, "r");
  if (!f) { xSemaphoreGive(s_fsMux); sendError(404, "not_found", "não existe"); return; }
  bool isDir = f.isDirectory();
  bool empty = true;
  if (isDir) { File c = f.openNextFile(); if (c) { empty = false; c.close(); } }
  f.close();
  if (isDir && !empty) { xSemaphoreGive(s_fsMux); sendError(409, "not_empty", "o diretório não está vazio"); return; }
  bool ok = isDir ? LittleFS.rmdir(path) : LittleFS.remove(path);
  xSemaphoreGive(s_fsMux);
  if (!ok) { sendError(500, "io_error", "falha ao apagar"); return; }
  JsonWriter j(120);
  beginOk(j);
  j.s("path", path).b("deleted", true).u("used", LittleFS.usedBytes());
  sendOk(j);
}

void filesRoutes() {
  apiRoute("/api/files", HTTP_GET, handleList);
  apiRoute("/api/files/read", HTTP_GET, handleRead);
  apiRoute("/api/files/create", HTTP_POST, handleCreate);
  apiRoute("/api/files/write", HTTP_POST, handleWrite);
  apiRoute("/api/files/delete", HTTP_POST, handleDelete);
}
