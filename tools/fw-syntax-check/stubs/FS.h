#pragma once
#include "stub_all.h"
class File { public: explicit operator bool() const; bool isDirectory(); size_t size(); const char* name(); const char* path();
  File openNextFile(); void close(); size_t read(uint8_t*, size_t); size_t readBytes(char*, size_t); bool seek(uint32_t);
  int available(); size_t print(const String&); long getLastWrite(); };
