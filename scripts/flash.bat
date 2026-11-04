@echo off
rem ============================================================================
rem  WebOS ESP32 - gravacao na placa (firmware + interface)
rem  Uso:  flash.bat          detecta a porta COM
rem        flash.bat COM5     usa a porta informada
rem  Nao apaga a flash inteira: grava o firmware nas particoes de aplicativo e a
rem  imagem LittleFS na particao de dados. ATENCAO: a gravacao da imagem LittleFS
rem  substitui os arquivos que voce criou na placa pelo conteudo da pasta firmware\WebOS_ESP32\data.
rem ============================================================================
setlocal EnableExtensions EnableDelayedExpansion
call "%~dp0_env.bat"
echo.
echo ==== WebOS ESP32 :: gravacao ====
if not exist "%CLI%" ( echo ERRO: rode scripts\setup.bat primeiro & goto :fail )
if not exist "%BUILD%\WebOS_ESP32.ino.bin" ( echo ERRO: firmware nao compilado - rode scripts\build.bat & goto :fail )
if not exist "%FS_IMAGE%" ( echo ERRO: imagem LittleFS ausente - rode scripts\build.bat & goto :fail )

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
  echo.
  echo Nenhuma porta COM encontrada. Verifique:
  echo   - o cabo USB transmite dados? muitos cabos so carregam
  echo   - o driver do conversor USB-serial esta instalado?
  echo       CP210x  : https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers
  echo       CH340/CH9102 : https://www.wch-ic.com/downloads/CH341SER_EXE.html
  echo   - Gerenciador de Dispositivos ^> Portas COM e LPT
  goto :fail
)
if %LIKELY%==1 (
  set "PORT=!BEST!"
  echo Porta detectada: !PORT!
  goto :have_port
)
echo.
echo Portas encontradas:
for /l %%i in (1,1,%N%) do echo   %%i^) !P%%i!  -  !D%%i!
echo.
set /p "SEL=Numero da porta do ESP32: "
set "PORT=!P%SEL%!"
if not defined PORT ( echo Opcao invalida. & goto :fail )

:have_port
echo.
echo [1/2] Gravando o firmware em %PORT% ...
echo   Se ficar parado em "Connecting...", segure o botao BOOT da placa ate comecar.
"%CLI%" upload -p %PORT% --fqbn %FQBN%,UploadSpeed=%UPLOAD_BAUD% --input-dir "%BUILD%" "%SKETCH%"
if errorlevel 1 (
  echo   Falhou a %UPLOAD_BAUD% baud. Tentando novamente a 115200...
  "%CLI%" upload -p %PORT% --fqbn %FQBN%,UploadSpeed=115200 --input-dir "%BUILD%" "%SKETCH%"
  if errorlevel 1 goto :fail
  set "UPLOAD_BAUD=115200"
)

echo.
echo [2/2] Gravando a interface - imagem LittleFS ...
set "ADATA="
for /f "delims=" %%d in ('call "%CLI%" config get directories.data 2^>nul') do set "ADATA=%%d"
if not defined ADATA set "ADATA=%LOCALAPPDATA%\Arduino15"
set "ESPTOOL="
for /f "delims=" %%e in ('dir /b /s "%ADATA%\packages\esp32\tools\esptool_py\esptool.exe" 2^>nul') do set "ESPTOOL=%%e"
if not defined ESPTOOL (
  echo ERRO: esptool.exe nao encontrado em %ADATA%\packages\esp32\tools\esptool_py
  goto :fail
)
set "FS_OFFSET=0x290000"
if exist "%BUILD%\fs-layout.txt" for /f "usebackq tokens=1" %%o in ("%BUILD%\fs-layout.txt") do set "FS_OFFSET=%%o"
echo   esptool: %ESPTOOL%
echo   endereco: %FS_OFFSET%
rem esptool 5.x usa "write-flash"; versoes 4.x usam "write_flash"
"%ESPTOOL%" --chip esp32 --port %PORT% --baud %UPLOAD_BAUD% write-flash %FS_OFFSET% "%FS_IMAGE%"
if errorlevel 1 (
  "%ESPTOOL%" --chip esp32 --port %PORT% --baud 115200 write_flash %FS_OFFSET% "%FS_IMAGE%"
  if errorlevel 1 goto :fail
)

echo.
echo ================================================================
echo  Gravacao concluida! A placa reiniciou sozinha.
echo.
echo  1. Se quiser, desconecte do PC e alimente a placa por outra fonte USB.
echo  2. No celular ou PC, conecte ao Wi-Fi  WebOS-ESP32-xxxx
echo     senha: webos1234
echo  3. Abra no navegador:  http://192.168.4.1
echo     no celular: desligue os dados moveis e aceite "rede sem internet"
echo.
echo  Para ver as mensagens da placa: scripts\monitor.bat %PORT%
echo ================================================================
endlocal & exit /b 0

:fail
echo.
echo *** A gravacao falhou. Veja docs\SOLUCAO-DE-PROBLEMAS.md ***
endlocal & exit /b 1
