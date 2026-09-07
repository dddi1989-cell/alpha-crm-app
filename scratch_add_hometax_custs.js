const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

app.whenReady().then(() => {
  const parkData = require('./scratch_park_data.json');
  const hongData = require('./scratch_hong_data.json');
  const leeData = require('./scratch_lee_data.json');

  const list = [
    { name: '이재성', phone: '010-7679-7880', birth: '890918', data: JSON.stringify(leeData) },
    { name: '박서현', phone: '01025749161', birth: '980101', data: JSON.stringify(parkData) },
    { name: '홍인기', phone: '01083970137', birth: '900101', data: JSON.stringify(hongData) }
  ];

  const appData = process.env.APPDATA;
  const targetDirs = [
    path.join(appData, 'offline-crm-app', 'backups', 'main.db'),
    path.join(appData, 'WLB CRM TOOL', 'backups', 'main.db'),
    path.join(appData, 'Electron', 'backups', 'main.db'),
    path.join(appData, 'wlb-crm-tool', 'backups', 'main.db')
  ];

  for (const dbPath of targetDirs) {
    if (fs.existsSync(dbPath)) {
      const db = new Database(dbPath);
      const ins = db.prepare(`
        INSERT INTO customers (user_id, name, phone, birth_date, status, notes, hometax_data, created_at, updated_at)
        VALUES (1, ?, ?, ?, '가망고객', '국세청 간편인증 실시간 수신', ?, ?, ?)
      `);
      for (const item of list) {
        const existing = db.prepare('SELECT id FROM customers WHERE name = ?').get(item.name);
        if (!existing) {
          const now = new Date().toISOString();
          ins.run(item.name, item.phone, item.birth, item.data, now, now);
          console.log(`✓ Inserted ${item.name} into ${dbPath}`);
        } else {
          db.prepare('UPDATE customers SET hometax_data = ?, phone = ?, updated_at = ? WHERE id = ?')
            .run(item.data, item.phone, new Date().toISOString(), existing.id);
          console.log(`✓ Updated ${item.name} in ${dbPath}`);
        }
      }
      db.close();
    }
  }

  console.log('✓ All 12 customers ready!');
  app.quit();
});
