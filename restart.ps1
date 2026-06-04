# ============================================================================
# VR Robotics Academy - STOP + RESTART all running services (fast)
# Usage:  powershell -ExecutionPolicy Bypass -File .\restart.ps1
#
# Kills every running node process, then relaunches each service that has
# node_modules installed, each in its own window. No install / migrate / seed
# (use run.ps1 for the full first-time setup).
# ============================================================================
$ErrorActionPreference = 'Continue'
$ROOT = $PSScriptRoot
if (-not $ROOT) { $ROOT = (Get-Location).Path }

Write-Host "=== Stopping all node processes ===" -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  all node processes stopped." -ForegroundColor DarkGray

# Services to (re)launch, in start order. Only launched if node_modules exists.
$services = @(
    @{ Name = 'auth-service';       Port = 8001; Path = "$ROOT\backend\auth-service" },
    @{ Name = 'admin-service';      Port = 5000; Path = "$ROOT\backend\admin-service" },
    @{ Name = 'college-service';    Port = 8005; Path = "$ROOT\backend\college-service" },
    @{ Name = 'assessment-service'; Port = 8003; Path = "$ROOT\backend\assessment-service" },
    @{ Name = 'Bastion-server';     Port = 8000; Path = "$ROOT\backend\Bastion-server" },
    @{ Name = 'frontend';           Port = 8080; Path = "$ROOT\frontend" }
)

Write-Host "`n=== Relaunching services ===" -ForegroundColor Cyan
foreach ($svc in $services) {
    $name = $svc.Name
    $port = $svc.Port
    $path = $svc.Path
    if (-not (Test-Path "$path\node_modules")) {
        Write-Host "  SKIP $name (node_modules missing - run: cd $path ; npm install)" -ForegroundColor Yellow
        continue
    }
    $title = "VR Robotics - $name :$port"
    $cmd   = "`$Host.UI.RawUI.WindowTitle = '$title'; Set-Location '$path'; Write-Host '-- $name on port $port --' -ForegroundColor Green; npm run dev"
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $cmd | Out-Null
    Write-Host "  -> launched $name (port $port)" -ForegroundColor DarkGray
    # Stagger: let auth + admin come up before Bastion's health check runs.
    Start-Sleep -Milliseconds 1500
}

Write-Host "`nWaiting ~12s for services to boot..." -ForegroundColor DarkGray
Start-Sleep -Seconds 12

Write-Host "Opening http://localhost:8080" -ForegroundColor Yellow
Start-Process "http://localhost:8080"

Write-Host ""
Write-Host "-------------------------------------------------------------"
Write-Host " Login:" -ForegroundColor Yellow
Write-Host "   Platform admin -> vradmin@vrroboticsacademy.com / VrAdmin@2026"
Write-Host "   Root admin     -> vrroot@vrroboticsacademy.com  / VrRoot@2026"
Write-Host ""
Write-Host " In browser: DevTools (F12) -> Application -> Local Storage -> Clear,"
Write-Host " then Ctrl+Shift+R before logging in."
Write-Host "-------------------------------------------------------------"
