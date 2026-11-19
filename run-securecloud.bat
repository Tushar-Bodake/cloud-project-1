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

if not exist "node_modules\.bin\vite.cmd" goto install_dependencies
if not exist "node_modules\.bin\firebase.cmd" goto install_dependencies
goto dependencies_ready

:install_dependencies
echo Installing project dependencies...
call npm install
if errorlevel 1 goto failed

:dependencies_ready
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

curl.exe --fail --silent --output NUL http://127.0.0.1:5173/ 2>nul
if errorlevel 1 (
  echo Starting SecureCloud web app...
  start "SecureCloud Web App" /D "%~dp0" cmd /k "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"
  echo Waiting for the web app...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline = (Get-Date).AddSeconds(60); do { if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { exit 0 }; Start-Sleep -Seconds 2 } while ((Get-Date) -lt $deadline); exit 1"
  if errorlevel 1 (
    echo The web app did not become ready within 60 seconds.
    goto failed
  )
) else (
  echo SecureCloud web app is already running.
)

start "" "http://127.0.0.1:5173/"
echo.
echo SecureCloud is ready at http://127.0.0.1:5173/
echo Firebase Emulator UI: http://127.0.0.1:4000/
exit /b 0

:failed
echo.
echo SecureCloud could not be started. Review the messages above.
pause
exit /b 1
