@echo off
rem ============================================================================
rem  WebOS ESP32 - gravacao RAPIDA com os binarios ja compilados (firmware\prebuilt)
rem  Nao precisa de arduino-cli, core esp32 nem Node.js. Precisa so do esptool:
rem  usa o do core esp32 se existir; senao baixa o esptool oficial do GitHub.
rem  Uso:  flash-prebuilt.bat          detecta a porta COM
rem        flash-prebuilt.bat COM5     usa a porta informada
rem  Binarios: core esp32 3.3.10, ESP32 Dev Module, particoes "Default 4MB with spiffs".
rem ============================================================================
setlocal EnableExtensions EnableDelayedExpansion
call "%~dp0_env.bat"
set "PRE=%ROOT%\firmware\prebuilt"
echo.
echo ==== WebOS ESP32 :: gravacao com binarios prontos ====
for %%f in (WebOS_ESP32.ino.bootloader.bin WebOS_ESP32.ino.partitions.bin boot_app0.bin WebOS_ESP32.ino.bin littlefs.bin) do (
  if not exist "%PRE%\%%f" ( echo ERRO: falta %PRE%\%%f & goto :fail )
)

rem ---- esptool ----
set "ESPTOOL="
for /f "delims=" %%e in ('dir /b /s "%LOCALAPPDATA%\Arduino15\packages\esp32\tools\esptool_py\esptool.exe" 2^>nul') do set "ESPTOOL=%%e"
if not defined ESPTOOL for /f "delims=" %%e in ('dir /b /s "%ROOT%\tools\esptool\esptool.exe" 2^>nul') do set "ESPTOOL=%%e"
if not defined ESPTOOL (
  echo Baixando o esptool oficial - github.com/espressif/esptool ...
  if not exist "%ROOT%\tools\esptool" mkdir "%ROOT%\tools\esptool"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing 'https://github.com/espressif/esptool/releases/download/v5.3.0/esptool-v5.3.0-windows-amd64.zip' -OutFile '%ROOT%\tools\esptool\esptool.zip'; Expand-Archive -Force '%ROOT%\tools\esptool\esptool.zip' '%ROOT%\tools\esptool'; Remove-Item '%ROOT%\tools\esptool\esptool.zip'"
  if errorlevel 1 ( echo ERRO: download do esptool falhou & goto :fail )
  for /f "delims=" %%e in ('dir /b /s "%ROOT%\tools\esptool\esptool.exe" 2^>nul') do set "ESPTOOL=%%e"
)
if not defined ESPTOOL ( echo ERRO: esptool.exe nao encontrado & goto :fail )
echo esptool: %ESPTOOL%

rem ---- porta ----
set "PORT=%~1"
if defined PORT goto :have_port
set "PLIST=%TEMP%\webos_ports.txt"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0find-port.ps1" > "%PLIST%"
set /a N=0 & set /a LIKELY=0
for /f "usebackq tokens=1,2,* delims=|" %%a in ("%PLIST%") do (
  set /a N+=1
  set "P!N!=%%a" & set "D!N!=%%c"
  if "%%b"=="0" ( set /a LIKELY+=1 & set "BEST=%%a" )
)
if %N%==0 (
  echo Nenhuma porta COM encontrada. Instale o driver CP210x ou CH340 e use um cabo de dados.
  goto :fail
)
if %LIKELY%==1 ( set "PORT=!BEST!" & echo Porta detectada: !PORT! & goto :have_port )
echo Portas encontradas:
for /l %%i in (1,1,%N%) do echo   %%i^) !P%%i!  -  !D%%i!
set /p "SEL=Numero da porta do ESP32: "
set "PORT=!P%SEL%!"
if not defined PORT ( echo Opcao invalida. & goto :fail )

:have_port
echo.
echo Gravando bootloader, particoes, firmware e interface em %PORT% ...
echo Se ficar parado em "Connecting...", segure o botao BOOT da placa.
set "ARGS=0x1000 "%PRE%\WebOS_ESP32.ino.bootloader.bin" 0x8000 "%PRE%\WebOS_ESP32.ino.partitions.bin" 0xe000 "%PRE%\boot_app0.bin" 0x10000 "%PRE%\WebOS_ESP32.ino.bin" 0x290000 "%PRE%\littlefs.bin""
"%ESPTOOL%" --chip esp32 --port %PORT% --baud %UPLOAD_BAUD% write-flash -z %ARGS%
if errorlevel 1 (
  echo Tentando de novo a 115200 baud...
  "%ESPTOOL%" --chip esp32 --port %PORT% --baud 115200 write-flash -z %ARGS%
  if errorlevel 1 goto :fail
)
echo.
echo Pronto! Conecte ao Wi-Fi WebOS-ESP32-xxxx, senha webos1234, e abra http://192.168.4.1
endlocal & exit /b 0
:fail
echo.
echo *** A gravacao falhou. Veja docs\SOLUCAO-DE-PROBLEMAS.md ***
endlocal & exit /b 1
