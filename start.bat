@echo off
setlocal
REM Fleet launcher shim: delegates to start.ps1 with arg passthrough
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
endlocal
