@echo off
rem ============================================================================
rem  Variaveis compartilhadas pelos scripts do WebOS ESP32
rem ============================================================================
set "ROOT=%~dp0.."
for %%i in ("%ROOT%") do set "ROOT=%%~fi"
set "TOOLS=%ROOT%\tools\arduino-cli"
set "CLI=%TOOLS%\arduino-cli.exe"
set "SKETCH=%ROOT%\firmware\WebOS_ESP32"
set "BUILD=%ROOT%\firmware\build"
set "DATA=%SKETCH%\data"
set "FS_IMAGE=%BUILD%\littlefs.bin"
set "ESP32_URL=https://espressif.github.io/arduino-esp32/package_esp32_index.json"
rem Placa "ESP32 Dev Module" com o esquema de particoes padrao (4 MB, com spiffs).
if not defined FQBN set "FQBN=esp32:esp32:esp32:PartitionScheme=default"
rem Versao do core usada no desenvolvimento. Troque com:  set ESP32_CORE_VERSION=3.x.y
if not defined ESP32_CORE_VERSION set "ESP32_CORE_VERSION=3.3.10"
rem Velocidade de gravacao. Se der "timeout"/"serial exception", use: set UPLOAD_BAUD=115200
if not defined UPLOAD_BAUD set "UPLOAD_BAUD=921600"
rem Prefere o arduino-cli baixado pelo setup.bat; senao usa um do PATH.
if not exist "%CLI%" (
  where arduino-cli >nul 2>nul && for /f "delims=" %%c in ('where arduino-cli') do set "CLI=%%c"
)
exit /b 0
