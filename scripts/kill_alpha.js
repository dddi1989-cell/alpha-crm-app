const { execSync } = require('child_process');

try {
  // Use wmic or PowerShell CIM to kill by process name or path
  const psKill = `
    Get-CimInstance Win32_Process | Where-Object { 
      ($_.Name -like "*ALPHA*" -or $_.Name -like "*offline-crm*") -or 
      ($_.ExecutablePath -and $_.ExecutablePath -like "*offline-crm-app*")
    } | ForEach-Object {
      Write-Host "Killing PID: $($_.ProcessId), Name: $($_.Name)"
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
  `;
  const res = execSync(`powershell -NoProfile -Command "${psKill.replace(/\r?\n/g, ' ')}"`, { encoding: 'utf8' });
  console.log('Kill output:', res);
} catch (e) {
  console.error('Kill error:', e.message);
}
