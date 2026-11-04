// =============================================================================
//  Servidor HTTP: JSON, rotas da API, arquivos estáticos (React no LittleFS)
// =============================================================================
#include "webos.h"
#include <LittleFS.h>
#include <cmath>

WebServer server(80);

// ----------------------------------------------------------------- JsonWriter
void JsonWriter::escapeInto(String& out, const char* v) {
  out += '"';
  for (const char* p = v; p && *p; ++p) {
    char c = *p;
    switch (c) {
      case '"':  out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n";  break;
      case '\r': out += "\\r";  break;
      case '\t': out += "\\t";  break;
      default:
        if ((uint8_t)c < 0x20) {
          char buf[8];
          snprintf(buf, sizeof(buf), "\\u%04x", (unsigned)(uint8_t)c);
          out += buf;
        } else {
          out += c;   // UTF-8 passa intacto
        }
    }
  }
  out += '"';
}

void JsonWriter::_prefix(const char* key) {
  if (_depth > 0 && _depth <= 16) {
    if (!_first[_depth - 1]) _out += ',';
    _first[_depth - 1] = false;
  }
  if (key) { escapeInto(_out, key); _out += ':'; }
}

JsonWriter& JsonWriter::s(const char* key, const char* v) { _prefix(key); escapeInto(_out, v ? v : ""); return *this; }
JsonWriter& JsonWriter::i(const char* key, int64_t v) {
  _prefix(key); char buf[24]; snprintf(buf, sizeof(buf), "%lld", (long long)v); _out += buf; return *this;
}
JsonWriter& JsonWriter::u(const char* key, uint64_t v) {
  _prefix(key); char buf[24]; snprintf(buf, sizeof(buf), "%llu", (unsigned long long)v); _out += buf; return *this;
}
JsonWriter& JsonWriter::f(const char* key, double v, uint8_t decimals) {
  _prefix(key);
  if (std::isnan(v) || std::isinf(v)) { _out += "null"; return *this; }
  char buf[32]; snprintf(buf, sizeof(buf), "%.*f", (int)decimals, v); _out += buf; return *this;
}

// ------------------------------------------------------------ respostas padrão
void beginOk(JsonWriter& j) { j.obj().b("ok", true).obj("data"); }
void sendOk(JsonWriter& j) {
  j.endObj().endObj();
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json; charset=utf-8", j.str());
}
void sendError(int http, const char* code, const char* message) {
  JsonWriter j(160);
  j.obj().b("ok", false).obj("error").s("code", code).s("message", message).endObj().endObj();
  server.sendHeader("Cache-Control", "no-store");
  server.send(http, "application/json; charset=utf-8", j.str());
}

bool argInt(const char* name, long& out, long minV, long maxV, bool required) {
  if (!server.hasArg(name) || server.arg(name).length() == 0) {
    if (required) {
      String m = String("parâmetro obrigatório ausente: ") + name;
      sendError(400, "missing_param", m.c_str());
    }
    return false;
  }
  const String& v = server.arg(name);
  char* end = nullptr;
  long n = strtol(v.c_str(), &end, 10);
  if (end == v.c_str() || *end != '\0' || n < minV || n > maxV) {
    char m[96];
    snprintf(m, sizeof(m), "parâmetro inválido: %s (esperado inteiro entre %ld e %ld)", name, minV, maxV);
    sendError(400, "invalid_param", m);
    return false;
  }
  out = n;
  return true;
}

bool argStr(const char* name, String& out, size_t maxLen, bool required) {
  if (!server.hasArg(name)) {
    if (required) {
      String m = String("parâmetro obrigatório ausente: ") + name;
      sendError(400, "missing_param", m.c_str());
    }
    return false;
  }
  out = server.arg(name);
  if (out.length() > maxLen) {
    char m[96];
    snprintf(m, sizeof(m), "parâmetro %s excede %u bytes", name, (unsigned)maxLen);
    sendError(413, "too_large", m);
    return false;
  }
  return true;
}

// --------------------------------------------------- limite de requisições (API)
static uint32_t s_rateWindow = 0;
static uint16_t s_rateCount = 0;
static uint32_t s_rejected = 0;

static bool rateAllow() {
  uint32_t sec = millis() / 1000;
  if (sec != s_rateWindow) { s_rateWindow = sec; s_rateCount = 0; }
  if (++s_rateCount > WEBOS_RATE_LIMIT_PER_SEC) { s_rejected++; return false; }
  return true;
}
uint32_t webRejectedRequests() { return s_rejected; }

// ------------------------------------------------------------- arquivos estáticos
static const char* mimeFor(const String& p) {
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".js"))   return "application/javascript";
  if (p.endsWith(".css"))  return "text/css";
  if (p.endsWith(".svg"))  return "image/svg+xml";
  if (p.endsWith(".json")) return "application/json";
  if (p.endsWith(".png"))  return "image/png";
  if (p.endsWith(".ico"))  return "image/x-icon";
  if (p.endsWith(".woff2")) return "font/woff2";
  if (p.endsWith(".txt"))  return "text/plain; charset=utf-8";
  if (p.endsWith(".webmanifest")) return "application/manifest+json";
  return "application/octet-stream";
}

static bool streamFromFs(const String& uriPath) {
  if (!filesMounted()) return false;
  String path = uriPath;
  if (path.endsWith("/")) path += "index.html";
  if (path.indexOf("..") >= 0) return false;
  String full = String(WEBOS_WWW_DIR) + path;
  String gz = full + ".gz";
  bool isGz = false;
  File f;
  if (LittleFS.exists(gz))        { f = LittleFS.open(gz, "r"); isGz = true; }
  else if (LittleFS.exists(full)) { f = LittleFS.open(full, "r"); }
  if (!f) return false;
  if (f.isDirectory()) { f.close(); return false; }

  // Arquivos de /assets têm hash no nome → podem ficar em cache para sempre.
  if (path.startsWith("/assets/")) server.sendHeader("Cache-Control", "public, max-age=31536000, immutable");
  else                             server.sendHeader("Cache-Control", "no-cache");
  if (isGz) server.sendHeader("Content-Encoding", "gzip");
  server.setContentLength(f.size());
  server.send(200, mimeFor(path), "");

  static uint8_t buf[1436];
  auto client = server.client();   // NetworkClient no core 3.x
  size_t n;
  while ((n = f.read(buf, sizeof(buf))) > 0) {
    if (client.write(buf, n) != n) break;   // cliente desconectou
  }
  f.close();
  return true;
}

static const char FALLBACK_HTML[] PROGMEM = R"HTML(<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>WebOS ESP32</title>
<style>body{font-family:system-ui,sans-serif;background:#0b1020;color:#dbe4ff;display:grid;place-items:center;min-height:100vh;margin:0}
main{max-width:520px;padding:24px}code{background:#1b2440;padding:2px 6px;border-radius:4px}h1{font-size:20px}</style></head>
<body><main><h1>WebOS ESP32 — firmware ativo</h1>
<p>O firmware está rodando, mas a interface (LittleFS) não foi encontrada na flash.</p>
<p>Grave a interface com <code>scripts\flash.bat</code> (etapa de filesystem). A API já responde em
<a style="color:#7dd3fc" href="/api/system/info">/api/system/info</a>.</p></main></body></html>)HTML";

static void handleNotFound() {
  String uri = server.uri();
  if (uri.startsWith("/api/")) { sendError(404, "not_found", "rota da API não existe"); return; }
  if (streamFromFs(uri)) return;
  // SPA: qualquer rota sem extensão devolve o index.html
  int slash = uri.lastIndexOf('/');
  bool hasExt = uri.indexOf('.', slash) >= 0;
  if (!hasExt && streamFromFs("/index.html")) return;
  if (uri == "/" || !hasExt) {
    server.send_P(200, "text/html; charset=utf-8", FALLBACK_HTML);
    return;
  }
  server.send(404, "text/plain; charset=utf-8", "404 — arquivo não encontrado");
}

// Envolve cada rota de API com o limite de requisições.
typedef void (*Handler)();
static Handler s_handlers[80];
static uint8_t s_handlerCount = 0;

void apiRoute(const char* path, HTTPMethod method, Handler h) {
  if (s_handlerCount >= sizeof(s_handlers) / sizeof(s_handlers[0])) {
    Serial.printf("[web] ERRO: rotas demais, %s ignorada\n", path);
    return;
  }
  uint8_t idx = s_handlerCount++;
  s_handlers[idx] = h;
  server.on(path, method, [idx]() {
    if (!rateAllow()) { sendError(429, "rate_limited", "muitas requisições por segundo; aguarde"); return; }
    s_handlers[idx]();
  });
}

void webBegin() {
  server.enableCORS(true);   // facilita desenvolvimento (vite dev server)
  systemRoutes();
  tasksRoutes();
  schedRoutes();
  labRoutes();
  memRoutes();
  filesRoutes();
  devicesRoutes();
  deadlockRoutes();
  terminalRoutes();
  authRoutes();
  server.onNotFound(handleNotFound);
  server.begin();
  Serial.printf("[web] servidor HTTP na porta 80, %u rotas de API\n", s_handlerCount);
}

void webLoop() { server.handleClient(); }
