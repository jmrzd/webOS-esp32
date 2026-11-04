#pragma once
#include "FS.h"
struct LittleFSFS { bool begin(bool, const char*, int, const char*); size_t usedBytes(); size_t totalBytes(); bool exists(const String&);
  File open(const String&, const char* mode = "r"); bool mkdir(const String&); bool rmdir(const String&); bool remove(const String&); };
extern LittleFSFS LittleFS;
