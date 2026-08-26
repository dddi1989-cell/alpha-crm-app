const fs = require('fs');
const path = require('path');

const localDir = 'C:\\Users\\USER\\AppData\\Local\\Programs\\offline-crm-app';
if (fs.existsSync(localDir)) {
  console.log('Local directory files:', fs.readdirSync(localDir));
  const resDir = path.join(localDir, 'resources');
  if (fs.existsSync(resDir)) {
    console.log('Local resources files:', fs.readdirSync(resDir));
  } else {
    console.log('Local resources NOT FOUND');
  }
} else {
  console.log('Local dir NOT FOUND');
}
