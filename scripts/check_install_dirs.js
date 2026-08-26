const fs = require('fs');
const path = require('path');

const p1 = 'C:\\Program Files\\offline-crm-app\\resources';
const p2 = 'C:\\Users\\USER\\AppData\\Local\\Programs\\offline-crm-app\\resources';

console.log('Program Files resources:', fs.existsSync(p1) ? fs.readdirSync(p1) : 'NOT FOUND');
console.log('Local Programs resources:', fs.existsSync(p2) ? fs.readdirSync(p2) : 'NOT FOUND');

if (fs.existsSync(path.join(p1, 'app.asar'))) {
  const stat = fs.statSync(path.join(p1, 'app.asar'));
  console.log('P1 app.asar size:', stat.size, 'mtime:', stat.mtime);
}
if (fs.existsSync(path.join(p2, 'app.asar'))) {
  const stat = fs.statSync(path.join(p2, 'app.asar'));
  console.log('P2 app.asar size:', stat.size, 'mtime:', stat.mtime);
}
