#pragma once
#include "stub_all.h"
struct IPAddress { IPAddress(int,int,int,int){} IPAddress(){} String toString() const; };
enum wifi_mode_t { WIFI_AP = 2 };
struct WiFiClient { size_t write(const uint8_t*, size_t); };
struct WiFiClass { void mode(wifi_mode_t); void softAPmacAddress(uint8_t*); bool softAPConfig(IPAddress, IPAddress, IPAddress);
  bool softAP(const char*, const char*, int, int, int); IPAddress softAPIP(); int softAPgetStationNum(); };
extern WiFiClass WiFi;
