@echo off
REM ---------------------------------------------------------------------------
REM Keeps the local autovet_live database up to date with production.
REM
REM Run by Windows Task Scheduler (task name: "AutoVet - sync live DB").
REM Reads live, writes only the local copy. Does nothing at all unless
REM backend\.env.live exists, so it is safe to leave scheduled.
REM
REM Run it by hand any time:  sync-live.bat
REM ---------------------------------------------------------------------------
cd /d "%~dp0"
"C:\xampp\php\php.exe" artisan db:sync-live --database=autovet_live --quiet-when-clean >> "storage\logs\sync-live.log" 2>&1
