# restart.ps1 - Clean restart of the TaskTracker desktop app.
# Kills any running Electron/TaskTracker processes, frees ports 3001/3000,
# then relaunches the desktop window.

$ErrorActionPreference = "SilentlyContinue"
$root = $PSScriptRoot

Write-Host "`n=== TaskTracker: Clean Restart ===`n" -ForegroundColor Cyan

# 1. Kill app processes
Write-Host "[1/3] Stopping app processes..." -ForegroundColor Green
foreach ($name in @("electron", "TaskTracker")) {
    Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host ("  Killing {0} (PID {1})" -f $_.ProcessName, $_.Id) -ForegroundColor Yellow
        Stop-Process -Id $_.Id -Force
    }
}

# 2. Free the server/client ports
Write-Host "[2/3] Freeing ports 3001 / 3000..." -ForegroundColor Green
foreach ($port in @(3001, 3000)) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -Expand OwningProcess -Unique |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Milliseconds 800

# 3. Relaunch the desktop app
Write-Host "[3/3] Launching desktop app...`n" -ForegroundColor Green
Set-Location $root
npm start
