# 1. Kill any running ALPHA CRM processes
$procs = Get-CimInstance Win32_Process | Where-Object { 
    ($_.Name -like "*ALPHA*" -or $_.Name -like "*offline-crm*") -or 
    ($_.ExecutablePath -and $_.ExecutablePath -like "*offline-crm-app*")
}
foreach ($p in $procs) {
    Write-Host "Killing PID: $($p.ProcessId), Name: $($p.Name)"
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2

# 2. Check if processes exited
$remaining = Get-CimInstance Win32_Process | Where-Object { 
    ($_.Name -like "*ALPHA*" -or $_.Name -like "*offline-crm*") -or 
    ($_.ExecutablePath -and $_.ExecutablePath -like "*offline-crm-app*")
}
Write-Host "Remaining processes count: $($remaining.Count)"
