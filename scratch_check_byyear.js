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
      console.log('Total Expenses:', parsed.totalExpenseCount, 'Total Indemnities:', parsed.totalIndemnityCount);
      console.log('byYear keys:', Object.keys(parsed.byYear || {}));
      for (const [yr, yrData] of Object.entries(parsed.byYear || {})) {
        console.log(` - ${yr}년: Expenses=${yrData.totalExpenseCount} (${yrData.totalExpenseAmount.toLocaleString()}원), Indemnities=${yrData.totalIndemnityCount}`);
      }
    } catch (e) {
      console.log(`Error parsing ${c.name}:`, e.message);
    }
  });
  app.quit();
});
