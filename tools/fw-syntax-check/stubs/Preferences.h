#pragma once
#include "stub_all.h"
struct Preferences { bool begin(const char*, bool); void end(); int getInt(const char*, int); bool getBool(const char*, bool);
  String getString(const char*, const char*); bool isKey(const char*); size_t putInt(const char*, int); size_t putBool(const char*, bool);
  size_t putString(const char*, const String&); };
