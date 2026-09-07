const { app } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  const masterDbPath = path.join(process.env.APPDATA, 'offline-crm-app', 'backups', 'main.db');
  const targetLocations = [
    path.join(process.env.APPDATA, 'Electron', 'backups', 'main.db'),
    path.join(process.env.APPDATA, 'WLB CRM TOOL', 'backups', 'main.db'),
    path.join(process.env.APPDATA, 'wlb-crm-tool', 'backups', 'main.db')
  ];

  // 1. Update masterDb with all 3 hometax records
  const { initDatabase } = require('./src/main/database');
  const db = initDatabase(masterDbPath);

  // Sync Supabase contents for Park, Hong, Lee into masterDb
  const supabaseDataMap = {
    '박서현': require('./scratch_park_data.json'),
    '홍인기': require('./scratch_hong_data.json'),
    '이재성': require('./scratch_lee_data.json')
  };

  for (const [name, parsedData] of Object.entries(supabaseDataMap)) {
    const jsonStr = JSON.stringify(parsedData);
    const existing = db.prepare('SELECT id FROM customers WHERE name = ?').get(name);
    if (existing) {
      db.prepare('UPDATE customers SET hometax_data = ?, updated_at = ? WHERE id = ?')
        .run(jsonStr, new Date().toISOString(), existing.id);
      console.log(`✓ Updated master DB customer [${name}] (ID: ${existing.id})`);
    } else {
      const ins = db.prepare('INSERT INTO customers (name, phone, status, notes, hometax_data, created_at, updated_at) VALUES (?, ?, "가망고객", "국세청 인증 수신", ?, ?, ?)')
        .run(name, parsedData.clientPhone || '', jsonStr, new Date().toISOString(), new Date().toISOString());
      console.log(`✓ Inserted master DB customer [${name}] (ID: ${ins.lastInsertRowid})`);
    }
  }

  const allCusts = db.prepare('SELECT id, name, phone, hometax_data IS NOT NULL as has_hometax FROM customers').all();
  console.log(`=== MASTER DB TOTAL CUSTOMERS: ${allCusts.length} ===`);
  allCusts.forEach(c => console.log(` - ID ${c.id}: ${c.name} (${c.phone}) [Hometax: ${c.has_hometax}]`));

  db.close();

  // 2. Clone master DB to all AppData target locations
  targetLocations.forEach(target => {
    try {
      const dir = path.dirname(target);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(masterDbPath, target);
      console.log(`✓ Synced master DB to: ${target}`);
    } catch (e) {
      console.warn(`Sync warning for ${target}:`, e.message);
    }
  });

  app.quit();
});
