const { app } = require('electron');
const path = require('path');
const { initDatabase } = require('./src/main/database');

app.whenReady().then(() => {
  const targetPath = path.join(process.env.APPDATA, 'offline-crm-app', 'backups', 'main.db');
  console.log('Target DB Path:', targetPath);
  const db = initDatabase(targetPath);
  const custs = db.prepare('SELECT id, name, phone, birth_date, hometax_data IS NOT NULL as has_hometax, LENGTH(hometax_data) as hometax_len FROM customers').all();
  console.log('=== CUSTOMERS IN DB (' + custs.length + ') ===');
  custs.forEach(c => {
    console.log('ID: ' + c.id + ', Name: ' + c.name + ', Phone: ' + c.phone + ', HasHometax: ' + c.has_hometax + ' (len: ' + c.hometax_len + ')');
  });
  app.quit();
});
