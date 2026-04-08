@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Error: Node.js is not installed.
  echo Please install Node.js from https://nodejs.org/
  pause
  exit /b 1
)
start /B node server/server.mjs
timeout /t 1 /nobreak >nul
start http://127.0.0.1:10800
