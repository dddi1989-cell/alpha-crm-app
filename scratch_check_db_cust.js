const { app } = require('electron');
const { getDb, initDatabase } = require('./src/main/database');

app.whenReady().then(() => {
  initDatabase();
  const db = getDb();
  const customer = db.prepare("SELECT id, name, phone, hometax_data FROM customers WHERE name = '이재성'").get();
  if (customer) {
    console.log('Customer ID:', customer.id, 'Name:', customer.name);
    if (customer.hometax_data) {
      try {
        const data = JSON.parse(customer.hometax_data);
        console.log('hometax_data keys:', Object.keys(data));
        console.log('totalExpenseCount:', data.totalExpenseCount);
        console.log('byYear exists?:', !!data.byYear);
        console.log('First 3 expenses:');
        (data.expenseList || []).slice(0, 3).forEach(e => {
          console.log(` - [date: ${e.date} | displayDate: ${e.displayDate}] ${e.hospitalName || e.orgName}: ${e.amount}원`);
        });
      } catch(e) {
        console.log('hometax_data parse error:', e.message);
      }
    } else {
      console.log('No hometax_data in DB for 이재성');
    }
  }
  app.quit();
});
