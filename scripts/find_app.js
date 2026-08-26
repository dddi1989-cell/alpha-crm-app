const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. Check running processes
try {
  const psOutput = execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId, Name, ExecutablePath | ConvertTo-Json"', { encoding: 'utf8' });
  const procs = JSON.parse(psOutput);
  const alphaProcs = procs.filter(p => p.Name && (p.Name.includes('ALPHA') || p.Name.includes('Tool') || (p.ExecutablePath && p.ExecutablePath.includes('CRM'))));
  console.log('ALPHA Processes:', JSON.stringify(alphaProcs, null, 2));
} catch (e) {
  console.error('Process check error:', e.message);
}

// 2. Search common install paths
const candidateDirs = [
  path.join(process.env.LOCALAPPDATA || '', 'Programs'),
  path.join(process.env.APPDATA || '', '..', 'Local', 'Programs'),
  process.env.PROGRAMFILES || 'C:\\Program Files',
  process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)',
  path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs')
];

for (const dir of candidateDirs) {
  if (fs.existsSync(dir)) {
    try {
      const items = fs.readdirSync(dir);
      console.log(`Contents of ${dir}:`, items.filter(i => i.toLowerCase().includes('alpha') || i.toLowerCase().includes('crm') || i.toLowerCase().includes('tool') || i.toLowerCase().includes('offline')));
    } catch (e) {}
  }
}
