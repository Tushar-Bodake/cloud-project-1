@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 goto failed

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js, then run this file again.
  goto failed
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm is required. Install Node.js with npm, then run this file again.
  goto failed
)

if not exist "node_modules\.bin\firebase.cmd" (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 goto failed
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(4000, 8080, 9099, 9199); $ready = $true; foreach ($port in $ports) { if (-not (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) { $ready = $false; break } }; if ($ready) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo Starting Firebase emulators...
  start "SecureCloud Firebase Emulators" /D "%~dp0" cmd /k "npx firebase emulators:start --project demo-securecloud"
  echo Waiting for Firebase emulators...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(4000, 8080, 9099, 9199); $deadline = (Get-Date).AddSeconds(120); do { $ready = $true; foreach ($port in $ports) { if (-not (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) { $ready = $false; break } }; if ($ready) { exit 0 }; Start-Sleep -Seconds 2 } while ((Get-Date) -lt $deadline); exit 1"
  if errorlevel 1 (
    echo Firebase emulators did not become ready within 120 seconds.
    goto failed
  )
) else (
  echo Firebase emulators are already running.
)

start "" "http://127.0.0.1:4000/"
echo.
echo Firebase Emulator Suite: http://127.0.0.1:4000/
exit /b 0

:failed
echo.
echo The Firebase Emulator Suite could not be opened. Review the messages above.
pause
exit /b 1
