const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const Database = require('better-sqlite3');
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
  console.log('Downloading raw NTS files and freshly parsing dates...');

  const config = [
    { name: '박서현', remote: 'hometax_MOB_1788066655978.json', out: 'scratch_park_data.json' },
    { name: '홍인기', remote: 'hometax_MOB_1788067319749.json', out: 'scratch_hong_data.json' },
    { name: '이재성', remote: 'hometax_MOB_1788066400930.json', out: 'scratch_lee_data.json' }
  ];

  const freshlyParsedMap = {};

  for (const item of config) {
    const rawFile = await fetchRemoteFile(item.remote);
    if (!rawFile) {
      console.error(`Failed to fetch ${item.remote}`);
      continue;
    }

    const uName = rawFile.userName || rawFile.clientName || item.name;
    const uPhone = rawFile.phoneNo || rawFile.clientPhone || '';
    const uBirth = rawFile.identity || rawFile.clientBirth || '';
    const rawMap = rawFile.yearsMap || { 2024: rawFile.rawNtsData || rawFile.rawNtsData2024 || rawFile };

    const parsed = parseHometaxMultiYearsData(rawMap, {
      clientName: uName,
      clientPhone: uPhone,
      clientBirth: uBirth,
      authProvider: 'kakao'
    });

    fs.writeFileSync(item.out, JSON.stringify(parsed, null, 2), 'utf8');
    freshlyParsedMap[item.name] = parsed;

    console.log(`\n=== Freshly Parsed: ${item.name} (${parsed.expenseList.length} expenses) ===`);
    parsed.expenseList.slice(0, 5).forEach((e, idx) => {
      console.log(`  [${idx+1}] ${e.displayDate} | ${e.insuredPerson} | ${e.orgName} | ${e.amount.toLocaleString()}원`);
    });
  }

  // Update DBs
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
      const updateStmt = db.prepare('UPDATE customers SET hometax_data = ?, updated_at = ? WHERE name = ?');
      for (const [name, parsedData] of Object.entries(freshlyParsedMap)) {
        const jsonStr = JSON.stringify(parsedData);
        updateStmt.run(jsonStr, new Date().toISOString(), name);
      }
      console.log(`✓ Updated DB at: ${dbPath}`);
      db.close();
    }
  }

  console.log('\n🎉 ALL CUSTOMERS UPDATED WITH EXACT PAYMENT DATES!');
  app.quit();
});
