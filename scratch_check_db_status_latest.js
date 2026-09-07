const { getDb } = require('./src/main/database');
const db = getDb();

const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get()?.c || 0;
const custCount = db.prepare('SELECT COUNT(*) as c FROM customers').get()?.c || 0;
const hometaxCount = db.prepare("SELECT COUNT(*) as c FROM customers WHERE hometax_data IS NOT NULL AND hometax_data != ''").get()?.c || 0;
const schedCount = db.prepare('SELECT COUNT(*) as c FROM schedules').get()?.c || 0;

console.log('=== Local SQLite DB Status ===');
console.log('Users:', userCount);
console.log('Customers:', custCount);
console.log('Customers with Hometax Data:', hometaxCount);
console.log('Schedules:', schedCount);

const custsWithHometax = db.prepare("SELECT id, name, phone, SUBSTR(hometax_data, 1, 100) as snippet FROM customers WHERE hometax_data IS NOT NULL AND hometax_data != '' LIMIT 10").all();
console.log('\nSample Hometax Customers:');
custsWithHometax.forEach(c => console.log(' -', c.name, '(' + c.phone + ')'));
