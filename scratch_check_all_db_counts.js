const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const appData = process.env.APPDATA;
const paths = [
  path.join(appData, 'offline-crm-app', 'backups', 'main.db'),
  path.join(appData, 'WLB CRM TOOL', 'backups', 'main.db'),
  path.join(appData, 'Electron', 'backups', 'main.db')
];

paths.forEach(p => {
  if (fs.existsSync(p)) {
    const stat = fs.statSync(p);
    try {
      const db = new Database(p);
      const custCount = db.prepare('SELECT count(*) as c FROM customers').get().c;
      const userCount = db.prepare('SELECT count(*) as c FROM users').get().c;
      const schedCount = db.prepare('SELECT count(*) as c FROM schedules').get().c;
      const postCount = db.prepare('SELECT count(*) as c FROM posts').get().c;
      console.log(`[${p}] Size: ${stat.size} bytes | Users: ${userCount} | Custs: ${custCount} | Scheds: ${schedCount} | Posts: ${postCount}`);
      db.close();
    } catch (e) {
      console.log(`[${p}] Error: ${e.message}`);
    }
  } else {
    console.log(`[${p}] DOES NOT EXIST`);
  }
});
