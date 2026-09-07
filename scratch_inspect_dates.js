const { app } = require('electron');
const path = require('path');
const { getDb } = require('./src/main/database');

app.whenReady().then(() => {
  const db = getDb();
  const custs = db.prepare('SELECT id, name, hometax_data FROM customers WHERE hometax_data IS NOT NULL').all();
  custs.forEach(c => {
    try {
      const parsed = JSON.parse(c.hometax_data);
      console.log(`=== CUSTOMER: ${c.name} (ID: ${c.id}) ===`);
      console.log('Total Expenses:', parsed.expenseList?.length);
      parsed.expenseList?.slice(0, 5).forEach((e, idx) => {
        console.log(` [${idx+1}] date="${e.date}", displayDate="${e.displayDate}", org="${e.orgName}"`);
      });
    } catch (e) {
      console.log(`Error parsing ${c.name}:`, e.message);
    }
  });
  app.quit();
});
