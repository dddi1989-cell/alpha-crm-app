const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.env.APPDATA || '', 'offline-crm-app', 'backups', 'main.db');
console.log('DB Path:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });
  
  console.log('\n=== USERS TABLE ===');
  const users = db.prepare('SELECT id, username, name, role FROM users').all();
  console.log(JSON.stringify(users, null, 2));
  
  console.log('\n=== CUSTOMERS user_id DISTRIBUTION ===');
  const dist = db.prepare('SELECT user_id, COUNT(*) as cnt FROM customers GROUP BY user_id').all();
  console.log(JSON.stringify(dist, null, 2));
  
  console.log('\n=== TOTAL CUSTOMERS ===');
  const total = db.prepare('SELECT COUNT(*) as total FROM customers').get();
  console.log(JSON.stringify(total));
  
  console.log('\n=== FIRST 10 CUSTOMERS (id, name, user_id) ===');
  const custs = db.prepare('SELECT id, name, user_id, phone FROM customers ORDER BY id LIMIT 10').all();
  console.log(JSON.stringify(custs, null, 2));
  
  db.close();
} catch (err) {
  console.error('DB Error:', err.message);
}
