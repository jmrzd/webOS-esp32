#pragma once
#include "stub_all.h"
struct MDNSClass { bool begin(const char*); void addService(const char*, const char*, int); }; extern MDNSClass MDNS;
