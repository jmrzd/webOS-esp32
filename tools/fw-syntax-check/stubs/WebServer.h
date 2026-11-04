#pragma once
#include "WiFi.h"
enum HTTPMethod { HTTP_GET, HTTP_POST };
class WebServer { public: WebServer(int){}
  void on(const char*, HTTPMethod, std::function<void()>); void onNotFound(std::function<void()>); void begin(); void handleClient();
  void enableCORS(bool); bool hasArg(const char*); String arg(const char*); String uri();
  void send(int, const char*, const String&); void send_P(int, const char*, const char*); void sendHeader(const char*, const char*);
  void setContentLength(size_t); WiFiClient client(); };
