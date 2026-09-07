const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { parseHometaxMultiYearsData } = require('./src/main/services/hometaxDataParser');

const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
const BUCKET = 'wbl-board-files';

function fetchRemoteFile(fileName) {
  return new Promise((resolve) => {
    https.get(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${fileName}?_t=${Date.now()}`, (res) => {
      if (res.statusCode !== 200) return resolve(null);
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

app.whenReady().then(async () => {
  console.log('Re-parsing all NTS data with exact payment dates...');

  const filesMap = {
    '박서현': 'hometax_MOB_1788066655978.json',
    '홍인기': 'hometax_MOB_1788067319749.json',
    '이재성': 'hometax_MOB_1788066400930.json'
  };

  const parsedResults = {};

  for (const [name, remoteName] of Object.entries(filesMap)) {
    const rawFile = await fetchRemoteFile(remoteName);
    if (!rawFile) continue;

    const uName = rawFile.userName || rawFile.clientName || name;
    const uPhone = rawFile.phoneNo || rawFile.clientPhone || '';
    const uBirth = rawFile.identity || rawFile.clientBirth || '';
    const rawMap = rawFile.yearsMap || { 2024: rawFile.rawNtsData || rawFile.rawNtsData2024 || rawFile };

    const freshlyParsed = parseHometaxMultiYearsData(rawMap, {
      clientName: uName,
      clientPhone: uPhone,
      clientBirth: uBirth,
      authProvider: 'kakao'
    });

    parsedResults[uName] = freshlyParsed;
    console.log(`✓ Re-parsed [${uName}]: ${freshlyParsed.totalExpenseCount} expenses`);
    freshlyParsed.expenseList.slice(0, 3).forEach(e => {
      console.log(`   - [${e.displayDate}] (${e.insuredPerson}) ${e.orgName} => ${e.amount.toLocaleString()}원`);
    });
  }

  // Update master DB & all clones
  const masterDbPath = path.join(process.env.APPDATA, 'offline-crm-app', 'backups', 'main.db');
  const targetLocations = [
    masterDbPath,
    path.join(process.env.APPDATA, 'Electron', 'backups', 'main.db'),
    path.join(process.env.APPDATA, 'WLB CRM TOOL', 'backups', 'main.db'),
    path.join(process.env.APPDATA, 'wlb-crm-tool', 'backups', 'main.db')
  ];

  const { initDatabase } = require('./src/main/database');
  const db = initDatabase(masterDbPath);

  for (const [name, parsedData] of Object.entries(parsedResults)) {
    const jsonStr = JSON.stringify(parsedData);
    const existing = db.prepare('SELECT id FROM customers WHERE name = ?').get(name);
    if (existing) {
      db.prepare('UPDATE customers SET hometax_data = ?, updated_at = ? WHERE id = ?')
        .run(jsonStr, new Date().toISOString(), existing.id);
      console.log(`✓ Updated DB customer [${name}] (ID: ${existing.id}) with freshly parsed dates`);
    }
  }

  db.close();

  // Clone to all targets
  targetLocations.forEach(target => {
    try {
      const dir = path.dirname(target);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(masterDbPath, target);
      console.log(`✓ Cloned updated DB to: ${target}`);
    } catch (e) {
      console.warn(`Sync warning for ${target}:`, e.message);
    }
  });

  app.quit();
});
