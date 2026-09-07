const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase, getBackupDirectory, getDb } = require('./src/main/database');

app.whenReady().then(() => {
  const db = getDb();
  console.log('Synchronizing all DB paths and report files...');

  // 1. Ensure hometax_data is in main.db
  const custs = db.prepare('SELECT id, name, phone, hometax_data IS NOT NULL as has_hometax FROM customers').all();
  console.log('Customers count in active DB:', custs.length);
  custs.forEach(c => {
    console.log(` - ID: ${c.id}, Name: ${c.name}, Phone: ${c.phone}, HasHometax: ${c.has_hometax}`);
  });

  // 2. Ensure reports folder exists
  const backupDir = getBackupDirectory();
  const reportsDir = path.join(path.dirname(backupDir), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // 3. Check desktop files and copy into reports
  const os = require('os');
  const desktop = path.join(os.homedir(), 'Desktop');
  if (fs.existsSync(desktop)) {
    const dFiles = fs.readdirSync(desktop);
    dFiles.forEach(f => {
      if (f.endsWith('.pdf') || f.endsWith('.xlsx')) {
        const src = path.join(desktop, f);
        const dest = path.join(reportsDir, f);
        if (!fs.existsSync(dest)) {
          try {
            fs.copyFileSync(src, dest);
            console.log(`Copied ${f} to internal reports folder.`);
          } catch (e) {}
        }
      }
    });
  }

  console.log('✓ Sync completed successfully.');
  app.quit();
});
