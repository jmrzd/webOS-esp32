// =============================================================================
//  Login — Aula 3 (estrutura do SO: proteção e segurança) — recurso EDUCACIONAL
//  A senha nunca é guardada em texto: guardamos SHA-256(sal + senha) na NVS.
//  Limitação assumida e explicada na interface: HTTP sem TLS e a API não exige
//  o token (o login protege a área de trabalho, não as rotas da placa).
// =============================================================================
#include "webos.h"
#include <Preferences.h>
#include <mbedtls/sha256.h>
#include <esp_random.h>

static String s_user = WEBOS_DEFAULT_USER;
static String s_salt, s_hash;
static bool s_required = false;
static String s_token;
static uint8_t s_fails = 0;
static uint32_t s_lockUntil = 0;

static String toHex(const uint8_t* b, size_t n) {
  static const char* hx = "0123456789abcdef";
  String s;
  s.reserve(n * 2);
  for (size_t k = 0; k < n; k++) { s += hx[b[k] >> 4]; s += hx[b[k] & 15]; }
  return s;
}

static String randomHex(size_t bytes) {
  uint8_t b[32];
  esp_fill_random(b, bytes);
  return toHex(b, bytes);
}

static String hashPass(const String& salt, const String& pass) {
  String in = salt + ":" + pass;
  uint8_t out[32];
  mbedtls_sha256((const unsigned char*)in.c_str(), in.length(), out, 0);
  return toHex(out, 32);
}

static bool constEq(const String& a, const String& b) {
  if (a.length() != b.length()) return false;
  uint8_t d = 0;
  for (size_t k = 0; k < a.length(); k++) d |= (uint8_t)(a[k] ^ b[k]);
  return d == 0;
}

static void save() {
  Preferences p;
  if (!p.begin("webos-auth", false)) return;
  p.putString("user", s_user);
  p.putString("salt", s_salt);
  p.putString("hash", s_hash);
  p.putBool("req", s_required);
  p.end();
}

void authBegin() {
  Preferences p;
  bool loaded = false;
  if (p.begin("webos-auth", true)) {
    if (p.isKey("hash")) {
      s_user = p.getString("user", WEBOS_DEFAULT_USER);
      s_salt = p.getString("salt", "");
      s_hash = p.getString("hash", "");
      s_required = p.getBool("req", false);
      loaded = s_hash.length() == 64;
    }
    p.end();
  }
  if (!loaded) {
    s_salt = randomHex(8);
    s_hash = hashPass(s_salt, WEBOS_DEFAULT_PASS);
    save();
  }
}

static bool checkPass(const String& user, const String& pass) {
  return constEq(user, s_user) && constEq(hashPass(s_salt, pass), s_hash);
}

static void writeStatus(JsonWriter& j) {
  j.b("required", s_required).s("user", s_user).b("locked", millis() < s_lockUntil)
   .u("lockRemainingMs", millis() < s_lockUntil ? s_lockUntil - millis() : 0)
   .b("defaultPassword", constEq(hashPass(s_salt, WEBOS_DEFAULT_PASS), s_hash))
   .s("algorithm", "SHA-256 com sal (NVS)");
}

static void handleStatus() { JsonWriter j(300); beginOk(j); writeStatus(j); sendOk(j); }

static void handleLogin() {
  String user, pass;
  if (!argStr("user", user, 32)) return;
  if (!argStr("pass", pass, 64)) return;
  if (millis() < s_lockUntil) { sendError(429, "locked", "muitas tentativas erradas; aguarde 30 s"); return; }
  if (!checkPass(user, pass)) {
    if (++s_fails >= WEBOS_LOGIN_MAX_FAILS) { s_lockUntil = millis() + WEBOS_LOGIN_LOCK_MS; s_fails = 0; }
    sendError(401, "bad_credentials", "usuário ou senha incorretos");
    return;
  }
  s_fails = 0;
  s_token = randomHex(16);
  JsonWriter j(200);
  beginOk(j);
  j.s("token", s_token).s("user", s_user);
  sendOk(j);
}

static void handleLogout() {
  s_token = "";
  JsonWriter j(60); beginOk(j); j.b("loggedOut", true); sendOk(j);
}

// Mudar configuração exige a senha atual.
static void handleConfig() {
  String cur, newUser, newPass;
  long req = -1;
  if (!argStr("currentPass", cur, 64)) return;
  if (server.hasArg("newUser") && !argStr("newUser", newUser, 24, false)) return;
  if (server.hasArg("newPass") && !argStr("newPass", newPass, 64, false)) return;
  if (server.hasArg("required") && !argInt("required", req, 0, 1, false)) return;
  if (millis() < s_lockUntil) { sendError(429, "locked", "muitas tentativas erradas; aguarde 30 s"); return; }
  if (!constEq(hashPass(s_salt, cur), s_hash)) {
    if (++s_fails >= WEBOS_LOGIN_MAX_FAILS) { s_lockUntil = millis() + WEBOS_LOGIN_LOCK_MS; s_fails = 0; }
    sendError(401, "bad_credentials", "senha atual incorreta");
    return;
  }
  if (newUser.length()) {
    for (size_t k = 0; k < newUser.length(); k++) if (!isalnum((unsigned char)newUser[k])) { sendError(400, "invalid_param", "usuário: só letras e números"); return; }
    s_user = newUser;
  }
  if (newPass.length()) {
    if (newPass.length() < 4) { sendError(400, "invalid_param", "senha: mínimo 4 caracteres"); return; }
    s_salt = randomHex(8);
    s_hash = hashPass(s_salt, newPass);
    s_token = "";
  }
  if (req >= 0) s_required = req;
  save();
  JsonWriter j(300); beginOk(j); writeStatus(j); sendOk(j);
}

static void handleVerify() {
  String token;
  if (!argStr("token", token, 64)) return;
  JsonWriter j(80); beginOk(j);
  j.b("valid", s_token.length() > 0 && constEq(token, s_token));
  sendOk(j);
}

void authRoutes() {
  apiRoute("/api/auth/status", HTTP_GET, handleStatus);
  apiRoute("/api/auth/login", HTTP_POST, handleLogin);
  apiRoute("/api/auth/logout", HTTP_POST, handleLogout);
  apiRoute("/api/auth/verify", HTTP_POST, handleVerify);
  apiRoute("/api/auth/config", HTTP_POST, handleConfig);
}
