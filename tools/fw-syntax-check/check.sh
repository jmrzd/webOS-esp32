#!/bin/sh
# Checagem de sintaxe/tipos do firmware no PC (não substitui a compilação real com arduino-cli).
cd "$(dirname "$0")/../../firmware/WebOS_ESP32" || exit 1
rc=0
for def in "" "-DSTUB_NOTRACE"; do
  for f in *.cpp WebOS_ESP32.ino; do
    g++ -std=gnu++17 -fsyntax-only -Wall -Wextra -Wno-unused-parameter $def -I../../tools/fw-syntax-check/stubs -x c++ "$f" || rc=1
  done
done
[ $rc = 0 ] && echo "OK: sintaxe e tipos verificados (com e sem trace facility)"
exit $rc
