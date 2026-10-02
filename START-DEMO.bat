@echo off
REM ===========================================================================
REM  AutoVet - offline demo launcher
REM
REM  Starts everything the system needs on this machine and opens both apps.
REM  Nothing here reaches the internet: the database is local MySQL, uploads and
REM  images are served from the database, mail is written to the log, and the AI
REM  forecast runs the bundled Python.
REM
REM  Close this window to stop both front ends. Laragon keeps running.
REM ===========================================================================

title AutoVet - offline demo
cd /d "%~dp0"

echo.
echo   AutoVet - starting the offline demo
echo   ===================================
echo.

REM --- 1. Laragon (Apache + MySQL) -----------------------------------------
echo   [1/4] Checking Apache and MySQL...
netstat -ano | findstr /R /C:":80 .*LISTENING" >nul 2>&1
if errorlevel 1 (
    echo         Apache is NOT running.
    echo         Open Laragon and press "Start All", then run this again.
    echo.
    pause
    exit /b 1
)
netstat -ano | findstr /R /C:":3306 .*LISTENING" >nul 2>&1
if errorlevel 1 (
    echo         MySQL is NOT running.
    echo         Open Laragon and press "Start All", then run this again.
    echo.
    pause
    exit /b 1
)
echo         Apache and MySQL are up.

REM --- 2. Backend reachable -------------------------------------------------
echo   [2/4] Checking the API at http://autovet.test ...
curl -s -o nul -m 10 -w "" http://autovet.test/api/status
if errorlevel 1 (
    echo         Could not reach http://autovet.test
    echo         In Laragon: Menu -^> www -^> make sure AutoVet is listed,
    echo         or re-run "Laragon -^> Apache -^> Reload".
    echo.
    pause
    exit /b 1
)
echo         API is responding.

REM --- 3. Front ends --------------------------------------------------------
REM  vite preview serves the production build and proxies /api, /media and
REM  /storage to http://autovet.test, so both apps talk to the local backend.
echo   [3/4] Starting the clinic app and the client portal...
start "AutoVet - Clinic (admin)" /min cmd /c "cd /d "%~dp0frontend\admin" && npx vite preview --port 4173"
start "AutoVet - Client portal"  /min cmd /c "cd /d "%~dp0frontend\portal" && npx vite preview --port 4174"

REM Give both a moment to bind before opening the browser.
timeout /t 6 /nobreak >nul

REM --- 4. Open both ---------------------------------------------------------
echo   [4/4] Opening both apps in your browser...
start "" http://localhost:4173/
timeout /t 2 /nobreak >nul
start "" http://localhost:4174/

echo.
echo   Ready.
echo.
echo     Clinic app (admin, vets, staff) ..... http://localhost:4173
echo     Client portal (pet owners) .......... http://localhost:4174
echo     API .................................. http://autovet.test
echo.
echo     Sign in - clinic app
echo       Clinic admin ....... admin@autovet.com        / password123
echo       Veterinarian ....... maria.santos@petwellness.ph / password123
echo       Front desk ......... joy.mendoza@petwellness.ph  / password123
echo       Super admin ........ superadmin@autovet.com   / password
echo.
echo     Sign in - client portal
echo       Pet owner .......... andrea.villanueva@petwellness.ph / password123
echo.
echo   Leave this window open. Close it to stop both front ends.
echo.
pause
