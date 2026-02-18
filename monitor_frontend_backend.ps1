$iterations=20
for ($i=0;$i -lt $iterations;$i++) {
    Write-Output "=== ITER $i @ $(Get-Date -Format o)"
    if (Test-Path 'E:\newtool\frontend_new\frontend_run.log') {
        Write-Output '--- frontend_run.log ---'
        Get-Content 'E:\newtool\frontend_new\frontend_run.log' -Tail 60
    } else {
        Write-Output 'No frontend_run.log yet'
    }

    Write-Output '--- backend_run.log ---'
    if (Test-Path 'E:\newtool\backend\backend_run.log') {
        Get-Content 'E:\newtool\backend\backend_run.log' -Tail 60
    } else {
        Write-Output 'No backend_run.log'
    }

    try {
        $null = Invoke-RestMethod -Uri 'http://127.0.0.1:3000' -Method GET -UseBasicParsing -ErrorAction Stop
        Write-Output 'FRONTEND_HTTP: OK'
    } catch {
        Write-Output 'FRONTEND_HTTP: DOWN'
    }

    try {
        $s = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/debug/backend-state' -UseBasicParsing -ErrorAction Stop
        Write-Output 'BACKEND_HTTP: OK'
        $s | ConvertTo-Json -Depth 3 | Write-Output
    } catch {
        Write-Output 'BACKEND_HTTP: DOWN'
    }

    Start-Sleep -Seconds 2
}
Write-Output 'Monitor script finished.'
