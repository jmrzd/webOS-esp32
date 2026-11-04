@echo off
rem Abre o monitor serial (115200 baud) para ver as mensagens da placa. Uso: monitor.bat COM5
setlocal
call "%~dp0_env.bat"
if "%~1"=="" ( echo Uso: monitor.bat COM5 & exit /b 1 )
"%CLI%" monitor -p %1 -c baudrate=115200
