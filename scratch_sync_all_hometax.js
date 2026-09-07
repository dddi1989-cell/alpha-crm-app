const { app } = require('electron');
const path = require('path');
const https = require('https');
const { initDatabase, getDb } = require('./src/main/database');
const { parseHometaxMultiYearsData } = require('./src/main/services/hometaxDataParser');

const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
const BUCKET = 'wbl-board-files';

function downloadFile(name) {
  return new Promise((resolve) => {
    https.get(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${name}?_t=${Date.now()}`, (res) => {
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
  const db = getDb();
  console.log('Syncing existing Supabase hometax records into local DB...');

  const knownFiles = [
    'hometax_MOB_1788066655978.json', // 박서현 (15건)
    'hometax_MOB_1788067319749.json', // 홍인기 (7건)
    'hometax_MOB_1788066400930.json'  // 이재성 (18건)
  ];

  for (const f of knownFiles) {
    const content = await downloadFile(f);
    if (!content) continue;

    const uName = content.userName || content.clientName;
    const uPhone = (content.phoneNo || content.clientPhone || '').replace(/[^0-9]/g, '');
    const uBirth = (content.identity || content.clientBirth || '').replace(/[^0-9]/g, '');

    let parsedData = content.parsedData;
    if (!parsedData) {
      const rawMap = content.yearsMap || { 2024: content.rawNtsData || content };
      parsedData = parseHometaxMultiYearsData(rawMap, {
        clientName: uName,
        clientPhone: uPhone,
        clientBirth: uBirth,
        authProvider: 'kakao'
      });
    }

    const hometaxJsonStr = JSON.stringify(parsedData);
    const now = new Date().toISOString();

    // Match customer in DB
    const existing = db.prepare(`
      SELECT id, name, phone FROM customers 
      WHERE (REPLACE(phone, '-', '') = ? AND phone IS NOT NULL AND phone != '') 
         OR name = ?
      LIMIT 1
    `).get(uPhone, uName);

    if (existing) {
      db.prepare(`UPDATE customers SET hometax_data = ?, updated_at = ? WHERE id = ?`)
        .run(hometaxJsonStr, now, existing.id);
      console.log(`✓ Updated Customer ID ${existing.id} [${existing.name}] with ${parsedData.totalExpenseCount} expenses`);
    } else {
      const ins = db.prepare(`
        INSERT INTO customers (name, phone, birth_date, status, notes, hometax_data, created_at, updated_at)
        VALUES (?, ?, ?, '가망고객', '국세청 간편인증 실시간 수신', ?, ?, ?)
      `).run(uName, uPhone, uBirth, hometaxJsonStr, now, now);
      console.log(`✓ Inserted Customer ID ${ins.lastInsertRowid} [${uName}] with ${parsedData.totalExpenseCount} expenses`);
    }
  }

  const finalCheck = db.prepare('SELECT id, name, phone, LENGTH(hometax_data) as hometax_len FROM customers WHERE hometax_data IS NOT NULL').all();
  console.log('=== CUSTOMERS WITH HOMETAX DATA ===');
  finalCheck.forEach(c => console.log(`ID: ${c.id}, Name: ${c.name}, DataLen: ${c.hometax_len}`));

  app.quit();
});
