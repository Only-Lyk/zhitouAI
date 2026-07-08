# 智投AI - Windows Server 环境安装脚本（无需 winget）
# 以管理员身份运行 PowerShell，然后执行: .\install-env.ps1

$ErrorActionPreference = "Stop"

function Install-FromUrl {
    param(
        [string]$Url,
        [string]$OutFile,
        [string]$InstallArgs = ""
    )
    Write-Host "正在下载 $OutFile ..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
    Write-Host "正在安装 $OutFile ..." -ForegroundColor Cyan
    if ($OutFile.EndsWith(".msi")) {
        Start-Process msiexec.exe -ArgumentList "/i", $OutFile, "/qn", "/norestart", $InstallArgs -Wait
    } else {
        Start-Process $OutFile -ArgumentList "/VERYSILENT", "/NORESTART", $InstallArgs -Wait
    }
    Remove-Item $OutFile -Force
    Write-Host "$OutFile 安装完成" -ForegroundColor Green
}

# 创建临时目录
$tmp = "$env:TEMP\zhitou-install"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Set-Location $tmp

# 1. 安装 Git
Write-Host "`n=== 安装 Git ===" -ForegroundColor Yellow
Install-FromUrl "https://github.com/git-for-windows/git/releases/download/v2.45.1.windows.1/Git-2.45.1-64-bit.exe" "git.exe"

# 2. 安装 Node.js LTS
Write-Host "`n=== 安装 Node.js ===" -ForegroundColor Yellow
Install-FromUrl "https://nodejs.org/dist/v20.15.0/node-v20.15.0-x64.msi" "nodejs.msi"

# 3. 安装 Python 3.12
Write-Host "`n=== 安装 Python ===" -ForegroundColor Yellow
Install-FromUrl "https://www.python.org/ftp/python/3.12.4/python-3.12.4-amd64.exe" "python.exe" "InstallAllUsers=1 PrependPath=1"

# 4. 刷新环境变量
Write-Host "`n=== 刷新环境变量 ===" -ForegroundColor Yellow
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# 5. 安装 pnpm
Write-Host "`n=== 安装 pnpm ===" -ForegroundColor Yellow
npm install -g pnpm

# 6. 验证
Write-Host "`n=== 验证安装 ===" -ForegroundColor Yellow
Write-Host "Git 版本:" -NoNewline; git --version
Write-Host "Node 版本:" -NoNewline; node --version
Write-Host "pnpm 版本:" -NoNewline; pnpm --version
Write-Host "Python 版本:" -NoNewline; python --version

Write-Host "`n=== 全部安装完成 ===" -ForegroundColor Green
Write-Host "请关闭当前 PowerShell 窗口，重新打开后再继续部署项目。" -ForegroundColor Cyan
