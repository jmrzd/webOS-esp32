@echo off
rem ============================================================================
rem  WebOS ESP32 - preparacao do ambiente (rodar uma vez, precisa de internet)
rem  1. baixa o arduino-cli oficial para tools\arduino-cli (se nao houver um no PATH)
rem  2. registra o indice de placas da Espressif
rem  3. instala o core "esp32 by Espressif Systems" 3.x (inclui esptool e mklittlefs)
rem ============================================================================
setlocal EnableExtensions EnableDelayedExpansion
call "%~dp0_env.bat"
echo.
echo ==== WebOS ESP32 :: preparacao do ambiente ====
echo.

echo [1/3] arduino-cli
if exist "%CLI%" goto :have_cli
echo   Baixando o arduino-cli oficial de downloads.arduino.cc ...
if not exist "%TOOLS%" mkdir "%TOOLS%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing 'https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip' -OutFile '%TOOLS%\cli.zip'; Expand-Archive -Force '%TOOLS%\cli.zip' '%TOOLS%'; Remove-Item '%TOOLS%\cli.zip'"
if errorlevel 1 (
  echo   ERRO: nao foi possivel baixar o arduino-cli. Verifique a internet ou instale manualmente:
  echo   https://arduino.github.io/arduino-cli/latest/installation/
  goto :fail
)
set "CLI=%TOOLS%\arduino-cli.exe"
:have_cli
echo   usando: %CLI%
"%CLI%" version
if errorlevel 1 goto :fail

echo.
echo [2/3] Indice de placas da Espressif
"%CLI%" core update-index --additional-urls "%ESP32_URL%"
if errorlevel 1 goto :fail

echo.
echo [3/3] Core esp32
"%CLI%" core list | findstr /r /c:"^esp32:esp32  *3\." >nul
if not errorlevel 1 (
  echo   Ja existe um core esp32 3.x instalado - mantendo:
  "%CLI%" core list | findstr /b /c:"esp32:esp32"
  goto :done
)
echo   Instalando esp32:esp32@%ESP32_CORE_VERSION% - download grande, centenas de MB, aguarde...
"%CLI%" core install esp32:esp32@%ESP32_CORE_VERSION% --additional-urls "%ESP32_URL%"
if errorlevel 1 goto :fail

:done
echo.
echo Ambiente pronto. Proximo passo: scripts\build.bat  ou  scripts\install.bat
endlocal & exit /b 0

:fail
echo.
echo *** A preparacao falhou. Veja a mensagem acima. ***
endlocal & exit /b 1
