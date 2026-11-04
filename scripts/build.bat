@echo off
rem ============================================================================
rem  WebOS ESP32 - compilacao
rem  1. interface React -> firmware\WebOS_ESP32\data\www (somente se o Node.js estiver instalado;
rem     senao usa a interface ja compilada que acompanha o projeto)
rem  2. firmware C++ -> firmware\build
rem  3. imagem LittleFS (pasta firmware\WebOS_ESP32\data) -> firmware\build\littlefs.bin
rem  Opcoes:  set SKIP_FRONTEND=1   para nunca recompilar a interface
rem ============================================================================
setlocal EnableExtensions EnableDelayedExpansion
call "%~dp0_env.bat"
echo.
echo ==== WebOS ESP32 :: compilacao ====
if not exist "%CLI%" (
  echo ERRO: arduino-cli nao encontrado. Rode primeiro scripts\setup.bat
  goto :fail
)

echo.
echo [1/3] Interface web
if defined SKIP_FRONTEND goto :prebuilt
where node >nul 2>nul
if errorlevel 1 goto :prebuilt
pushd "%ROOT%\frontend"
if not exist node_modules (
  echo   Instalando dependencias do frontend - npm ci ...
  call npm ci --no-audit --no-fund
  if errorlevel 1 ( popd & goto :fail )
)
echo   npm run build ...
call npm run build
if errorlevel 1 ( popd & goto :fail )
popd
goto :firmware

:prebuilt
if not exist "%DATA%\www\index.html.gz" (
  echo ERRO: firmware\WebOS_ESP32\data\www esta vazio e o Node.js nao foi encontrado.
  echo Instale o Node.js LTS de https://nodejs.org ou use o pacote completo do projeto.
  goto :fail
)
echo   Node.js ausente ou SKIP_FRONTEND definido: usando a interface ja compilada em firmware\WebOS_ESP32\data\www

:firmware
echo.
echo [2/3] Firmware - %FQBN%
if not exist "%BUILD%" mkdir "%BUILD%"
"%CLI%" compile --fqbn %FQBN% --build-path "%BUILD%" --warnings default "%SKETCH%"
if errorlevel 1 goto :fail

echo.
echo [3/3] Imagem do sistema de arquivos LittleFS
set "ADATA="
for /f "delims=" %%d in ('call "%CLI%" config get directories.data 2^>nul') do set "ADATA=%%d"
if not defined ADATA set "ADATA=%LOCALAPPDATA%\Arduino15"
set "MKLFS="
for /f "delims=" %%m in ('dir /b /s "%ADATA%\packages\esp32\tools\mklittlefs\mklittlefs.exe" 2^>nul') do set "MKLFS=%%m"
if not defined MKLFS (
  echo ERRO: mklittlefs.exe nao encontrado em %ADATA%\packages\esp32\tools
  echo Ele vem com o core esp32 3.x - rode scripts\setup.bat
  goto :fail
)
set "FS_OFFSET=" & set "FS_SIZE="
for /f "tokens=1,2" %%a in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0partition.ps1" -Csv "%BUILD%\partitions.csv"') do (
  set "FS_OFFSET=%%a" & set "FS_SIZE=%%b"
)
if not defined FS_OFFSET (
  echo   Aviso: particao spiffs nao encontrada em partitions.csv; usando o padrao 0x290000 / 0x160000
  set "FS_OFFSET=0x290000" & set "FS_SIZE=0x160000"
)
echo   particao de dados: inicio %FS_OFFSET%, tamanho %FS_SIZE%
"%MKLFS%" -c "%DATA%" -p 256 -b 4096 -s %FS_SIZE% "%FS_IMAGE%"
if errorlevel 1 goto :fail
> "%BUILD%\fs-layout.txt" echo %FS_OFFSET% %FS_SIZE%

echo.
echo Compilacao concluida:
echo   firmware : %BUILD%\WebOS_ESP32.ino.bin
echo   LittleFS : %FS_IMAGE%
echo Proximo passo: scripts\flash.bat
endlocal & exit /b 0

:fail
echo.
echo *** A compilacao falhou. Veja a mensagem acima. ***
endlocal & exit /b 1
