@echo off
rem ============================================================================
rem  WebOS ESP32 - INSTALADOR COMPLETO (clique duas vezes)
rem  Conecte o ESP32 por USB e execute. Faz: preparacao, compilacao e gravacao.
rem  Uso opcional:  install.bat COM5
rem ============================================================================
setlocal EnableExtensions
title WebOS ESP32 - instalador
echo.
echo  #########################################################
echo  #                 WebOS ESP32 - instalador              #
echo  #########################################################
echo.
echo  Antes de continuar:
echo   - ESP32 conectado por um cabo USB de DADOS
echo   - driver CP210x ou CH340 instalado, se a porta nao aparecer
echo   - Monitor Serial da Arduino IDE FECHADO, ele ocupa a porta
echo.
pause
call "%~dp0setup.bat"  || goto :fail
call "%~dp0build.bat"  || goto :fail
call "%~dp0flash.bat" %1 || goto :fail
echo.
echo Tudo pronto!
pause
exit /b 0
:fail
echo.
echo A instalacao parou. Corrija o problema indicado acima e execute de novo.
echo Dica: docs\SOLUCAO-DE-PROBLEMAS.md
pause
exit /b 1
