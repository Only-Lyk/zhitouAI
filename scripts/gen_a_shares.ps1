# 生成全量A股代码列表 -> backend/data/a_shares.json
# 数据源：东方财富 datacenter-web（datacenter-web.eastmoney.com，未被限流）
# 该接口每页最多返回 500 条，按 SECURITY_CODE 排序分页抓取 code + name。
$ErrorActionPreference = 'Continue'
$outDir = Join-Path $PSScriptRoot '..\backend\data'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outFile = Join-Path $outDir 'a_shares.json'

$h = @{'User-Agent' = 'Mozilla/5.0'; 'Referer' = 'https://data.eastmoney.com/'}
$list = @()
$p = 1
$pages = 1
do {
    $url = "https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_TS_STOCKNEW&columns=SECURITY_CODE,SECURITY_NAME_ABBR&pageSize=500&p=$p&sortColumns=SECURITY_CODE&sortTypes=1&source=WEB&client=WEB"
    $ok = $false
    for ($a = 1; $a -le 5; $a++) {
        try {
            $r = Invoke-WebRequest $url -UseBasicParsing -Headers $h -TimeoutSec 30
            $j = $r.Content | ConvertFrom-Json
            if ($j.result -and $j.result.data) {
                $pages = [int]$j.result.pages
                foreach ($it in $j.result.data) {
                    if ($it.SECURITY_CODE -and $it.SECURITY_NAME_ABBR) {
                        $list += [pscustomobject]@{ code = $it.SECURITY_CODE; name = $it.SECURITY_NAME_ABBR.Trim() }
                    }
                }
                $ok = $true
                break
            }
        } catch { Start-Sleep -Seconds 2 }
    }
    if (-not $ok) { Write-Host "page $p failed" }
    else { Write-Host "page $p/$pages ok (total so far: $($list.Count))" }
    $p++
    Start-Sleep -Milliseconds 300
} while ($p -le $pages)

$json = $list | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText($outFile, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "total collected: $($list.Count) -> $outFile"
