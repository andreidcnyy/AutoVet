@echo off
rem Starts everything the Postman tests need, then confirms it is running:
rem   1. MySQL (Laragon's), if it is not already running
rem   2. The AutoVet API on http://127.0.0.1:8010 using the autovet_qa test copy
rem      of the database, in its own window. Keep that window open while testing.
rem Run from anywhere:  C:\laragon\www\AutoVet\docs\postman\testing\start-test-server.cmd

setlocal
set "BACKEND=C:\laragon\www\AutoVet\backend"
set "MYSQLD=C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysqld.exe"

echo.
echo [1/3] MySQL
netstat -ano | findstr /R /C:":3306 .*LISTENING" >nul
if errorlevel 1 (
  echo       not running - starting it...
  powershell -NoProfile -Command "Start-Process '%MYSQLD%' -WindowStyle Hidden"
  call :wait 3306 30 || (echo       FAILED: MySQL did not start. Open Laragon and click Start All. & exit /b 1)
)
echo       OK - MySQL is running on port 3306

echo [2/3] Test server
netstat -ano | findstr /R /C:":8010 .*LISTENING" >nul
if not errorlevel 1 (
  echo       already running on port 8010 - nothing to start
  goto :check
)
rem Settings for the test server only (inherited by the new window):
rem   autovet_qa = test copy of the database; forecast runs on local Python;
rem   e-mails and real-time messages are only logged, never sent.
set "DB_DATABASE=autovet_qa"
set "AI_API_URL=null"
set "MAIL_MAILER=log"
set "BROADCAST_CONNECTION=log"
set "QUEUE_CONNECTION=sync"
rem --no-reload is required: without it artisan serve drops SystemRoot and the
rem Python forecast fails on Windows (WinError 10106).
start "AutoVet TEST SERVER - keep this window open" cmd /k "cd /d %BACKEND% && php artisan serve --port 8010 --no-reload"
call :wait 8010 30 || (echo       FAILED: the server did not start. Read the error in the "AutoVet TEST SERVER" window. & exit /b 1)

:check
echo [3/3] Checking the API answers...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest http://127.0.0.1:8010/up -UseBasicParsing -TimeoutSec 30; exit [int]($r.StatusCode -ne 200) } catch { exit 1 }"
if errorlevel 1 (echo       FAILED: port 8010 is open but the API did not answer. Read the "AutoVet TEST SERVER" window. & exit /b 1)
echo       OK - API is up at http://127.0.0.1:8010
echo.
echo READY. Run the Postman tests in this window, for example:
echo   cd C:\laragon\www\AutoVet\docs\postman\testing
echo   npx newman run 01-Integration-AI-Forecast.postman_collection.json -e AutoVet-QA.postman_environment.json
echo.
echo Close the "AutoVet TEST SERVER" window when you are done.
exit /b 0

rem :wait <port> <seconds> - waits until something listens on the port
:wait
for /L %%i in (1,1,%2) do (
  netstat -ano | findstr /R /C:":%1 .*LISTENING" >nul && exit /b 0
  ping -n 2 127.0.0.1 >nul
)
exit /b 1
