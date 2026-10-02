@echo off
REM ===========================================================================
REM  AutoVet - offline demo
REM
REM  Both apps are served by Laragon's own Apache, from the backend's public
REM  folder. There is no Node process to start and nothing to leave running:
REM  if Laragon is up, the system is up.
REM
REM  This script only checks that Laragon is running and opens the two apps.
REM ===========================================================================

title AutoVet - offline demo
cd /d "%~dp0"

echo.
echo   AutoVet - offline demo
echo   ======================
echo.

echo   Checking Apache and MySQL...
netstat -ano | findstr /R /C:":80 .*LISTENING" >nul 2>&1
if errorlevel 1 goto :notrunning
netstat -ano | findstr /R /C:":3306 .*LISTENING" >nul 2>&1
if errorlevel 1 goto :notrunning
echo     Apache and MySQL are up.

echo   Checking the application...
curl -s -o nul -m 15 http://autovet.test/api/status
if errorlevel 1 (
    echo     Could not reach http://autovet.test
    echo     In Laragon, click Menu -^> Apache -^> Reload, then run this again.
    echo.
    pause
    exit /b 1
)
echo     Application is responding.

echo   Opening both apps...
start "" http://autovet.test/clinic/
timeout /t 2 /nobreak >nul
start "" http://autovet.test/portal/

echo.
echo   Ready - no internet needed.
echo.
echo     Clinic app (admin, vets, staff) ... http://autovet.test/clinic
echo     Client portal (pet owners) ........ http://autovet.test/portal
echo.
echo     Clinic admin ..... admin@autovet.com              / password123
echo     Veterinarian ..... maria.santos@petwellness.ph    / password123
echo     Front desk ....... joy.mendoza@petwellness.ph     / password123
echo     Super admin ...... superadmin@autovet.com         / password
echo     Pet owner ........ andrea.villanueva@petwellness.ph / password123
echo.
echo   You can close this window - it is not needed once the apps are open.
echo.
pause
exit /b 0

:notrunning
echo     Apache or MySQL is NOT running.
echo     Open Laragon and press "Start All", then run this again.
echo.
pause
exit /b 1
