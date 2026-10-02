@echo off
REM ===========================================================================
REM  AutoVet - rebuild the offline demo
REM
REM  Run this after changing front-end code, or to refresh the demo data before
REM  a presentation. It rebuilds both apps into the backend's public folder,
REM  where Apache serves them, and re-seeds the database.
REM
REM  Re-seeding matters: the AI forecast reads the last 30 days of stock usage,
REM  and the seeded history is dated relative to when it was seeded, so it goes
REM  stale over weeks. Re-seed the morning of the demo.
REM ===========================================================================

title AutoVet - rebuild offline demo
cd /d "%~dp0"

echo.
echo   AutoVet - rebuilding the offline demo
echo   ====================================
echo.

echo   [1/4] Building the clinic app...
cd /d "%~dp0frontend\admin"
set "VITE_BASE_PATH=/clinic/"
call npx vite build --outDir ../../backend/public/clinic --emptyOutDir
if errorlevel 1 goto :failed

echo   [2/4] Building the client portal...
cd /d "%~dp0frontend\portal"
set "VITE_BASE_PATH=/portal/"
call npx vite build --outDir ../../backend/public/portal --emptyOutDir
if errorlevel 1 goto :failed

echo   [3/4] Publishing the shared fallback images...
REM  Avatar and pet placeholders are referenced from the site root, so they are
REM  served once from public/images rather than from each app's own folder.
if not exist "%~dp0backend\public\images" mkdir "%~dp0backend\public\images"
xcopy /E /I /Y /Q "%~dp0backend\public\clinic\images\*" "%~dp0backend\public\images\" >nul

echo   [4/4] Re-seeding the demo database...
cd /d "%~dp0backend"
call php artisan migrate:fresh --seed --force
if errorlevel 1 goto :failed
call php artisan config:clear >nul 2>&1
call php artisan route:clear >nul 2>&1
call php artisan cache:clear >nul 2>&1

echo.
echo   Done. Run START-DEMO.bat to open the apps.
echo.
pause
exit /b 0

:failed
echo.
echo   A step failed - see the output above.
echo.
pause
exit /b 1
