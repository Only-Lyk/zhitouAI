# ZhiTou AI - Windows Server One-Click Deploy Script
# Usage: .\deploy.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ZhiTou AI Deploy Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Stop old service
Write-Host "`n[1/6] Stopping old service..." -ForegroundColor Yellow
$proc = Get-Process python -ErrorAction SilentlyContinue
if ($proc) { Stop-Process -Name python -Force; Start-Sleep -Seconds 2 }

# 2. Install frontend dependencies
Write-Host "`n[2/6] Installing frontend deps..." -ForegroundColor Yellow
Set-Location C:\zhitouAI
pnpm install

Write-Host "`n[3/6] Building frontend..." -ForegroundColor Yellow
pnpm vite build

# 3. Backend environment
Write-Host "`n[4/6] Preparing backend..." -ForegroundColor Yellow
Set-Location C:\zhitouAI\backend

if (-not (Test-Path "venv\Scripts\python.exe")) {
    Write-Host "  Creating venv..." -ForegroundColor Gray
    python -m venv venv
}

Write-Host "`n[5/6] Installing backend deps..." -ForegroundColor Yellow
& venv\Scripts\python.exe -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 4. Start service
Write-Host "`n[6/6] Starting backend..." -ForegroundColor Yellow
Write-Host "  Service will start at http://0.0.0.0:5000" -ForegroundColor Gray
Write-Host "  First run auto-creates DB and default admin account" -ForegroundColor Gray
Write-Host "  Default admin: admin / admin123" -ForegroundColor Gray
Write-Host "`n  Press Ctrl+C to stop`n" -ForegroundColor Gray

& venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 5000
