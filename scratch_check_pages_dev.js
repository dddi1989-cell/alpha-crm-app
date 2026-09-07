const https = require('https');

https.get('https://alpha-crm-app.pages.dev/?nocache=' + Date.now(), res => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => {
    console.log('=== Live HTML from alpha-crm-app.pages.dev ===');
    const lines = b.split('\n');
    lines.forEach(line => {
      if (line.includes('<script') || line.includes('<link rel="stylesheet"')) {
        console.log(' -', line.trim());
      }
    });
  });
});
