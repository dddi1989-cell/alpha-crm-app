const { app } = require('electron');
const path = require('path');
const { getDb } = require('./src/main/database');

app.whenReady().then(() => {
  const db = getDb();
  const custs = db.prepare('SELECT id, name, phone, hometax_data IS NOT NULL as has_hometax, LENGTH(hometax_data) as len FROM customers').all();
  console.log('=== CUSTOMERS IN DB ===');
  custs.forEach(c => console.log(` - ID: ${c.id}, Name: ${c.name}, Phone: ${c.phone}, HasHometax: ${c.has_hometax} (len: ${c.len})`));

  const posts = db.prepare('SELECT id, title, author_name FROM posts').all();
  console.log('=== POSTS IN DB ===');
  posts.forEach(p => console.log(` - ID: ${p.id}, Title: ${p.title} (${p.author_name})`));

  app.quit();
});
