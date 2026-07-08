# 智投AI - Windows 服务器一键部署脚本
# 用法：以管理员身份运行 PowerShell，执行：.\deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  智投AI 一键部署脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. 停止旧服务
Write-Host "`n[1/6] 停止旧服务..." -ForegroundColor Yellow
taskkill /F /IM python.exe 2>$null
Start-Sleep -Seconds 2

# 2. 安装前端依赖并构建
Write-Host "`n[2/6] 安装前端依赖..." -ForegroundColor Yellow
Set-Location C:\zhitouAI
pnpm install

Write-Host "`n[3/6] 构建前端..." -ForegroundColor Yellow
pnpm vite build

# 3. 后端环境
Write-Host "`n[4/6] 准备后端环境..." -ForegroundColor Yellow
Set-Location C:\zhitouAI\backend

# 如果虚拟环境不存在则创建
if (-not (Test-Path "venv\Scripts\python.exe")) {
    Write-Host "  创建虚拟环境..." -ForegroundColor Gray
    python -m venv venv
}

# 安装/更新依赖（使用虚拟环境的 pip）
Write-Host "`n[5/6] 安装后端依赖..." -ForegroundColor Yellow
& venv\Scripts\python.exe -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 4. 启动服务
Write-Host "`n[6/6] 启动后端服务..." -ForegroundColor Yellow
Write-Host "  服务将在 http://0.0.0.0:5000 启动" -ForegroundColor Gray
Write-Host "  首次启动会自动创建数据库和默认 admin 账户" -ForegroundColor Gray
Write-Host "  默认管理员: admin / admin123" -ForegroundColor Gray
Write-Host "`n  按 Ctrl+C 停止服务`n" -ForegroundColor Gray

& venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 5000
