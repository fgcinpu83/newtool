$pids = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue | Sort-Object -Unique
if ($pids) {
    foreach ($xpid in $pids) { Stop-Process -Id $xpid -Force -ErrorAction SilentlyContinue }
}
$logpath = 'E:\newtool\logs\backend.log'
if (Test-Path $logpath) {
    Rename-Item -Path $logpath -NewName ('backend.log.' + (Get-Date -Format 'yyyyMMddHHmmss')) -ErrorAction SilentlyContinue
}
Start-Job -ScriptBlock { Set-Location 'E:\newtool\backend'; node dist/src/main.js > '..\\logs\\backend.log' 2>&1 } | Out-Null
Start-Sleep -Seconds 1
Write-Output 'backend-started'
