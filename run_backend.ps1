# AutoVet Backend Watchdog
# This script keeps 'php artisan serve' running and restarts it automatically if it crashes.

$host_port = "127.0.0.1:8000"
$backend_dir = "C:\Users\Dreid\AutoVet\backend"

Write-Host "Starting AutoVet Backend Watchdog..." -ForegroundColor Cyan

while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Starting php artisan serve..." -ForegroundColor Green
    
    # Run artisan serve and wait for it to exit
    Set-Location $backend_dir
    php artisan serve --host=127.0.0.1 --port=8000
    
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Backend crashed or stopped! Restarting in 3 seconds..." -ForegroundColor Red
    Start-Sleep -Seconds 3
}
