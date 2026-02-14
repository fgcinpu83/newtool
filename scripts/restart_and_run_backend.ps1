$p = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'dist/src/main.js' -or $_.CommandLine -match 'backend\\dist' }
if ($p) {
    foreach ($proc in $p) { Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue }
}
$log = 'E:\newtool\logs\backend.log'
if (Test-Path $log) {
    Rename-Item -Path $log -NewName ('backend.log.' + (Get-Date -Format 'yyyyMMddHHmmss')) -ErrorAction SilentlyContinue
}
Start-Job -ScriptBlock { Set-Location 'E:\newtool\backend'; node dist/src/main.js 2>&1 | Out-File '..\\logs\\backend.log' -Encoding utf8 } | Out-Null
Start-Sleep -Seconds 2
if (Test-Path $log) { Get-Content $log -Tail 200 } else { Write-Output 'NO_BACKEND_LOG' }
