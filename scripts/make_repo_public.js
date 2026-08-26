const https = require('https');

const TOKEN = 'ghp_MASKED';
const OWNER = 'dddi1989-cell';
const REPO = 'alpha-crm-app';

const payload = JSON.stringify({
  private: false,
  visibility: 'public'
});

const options = {
  hostname: 'api.github.com',
  path: `/repos/${OWNER}/${REPO}`,
  method: 'PATCH',
  headers: {
    'User-Agent': 'ALPHA-CRM-App-Updater',
    'Authorization': `token ${TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('HTTP Status Code:', res.statusCode);
      console.log('Repository Name:', parsed.name);
      console.log('Private State:', parsed.private);
      console.log('Visibility:', parsed.visibility);
      console.log('HTML URL:', parsed.html_url);
    } catch (err) {
      console.error('Parse error:', err, data);
    }
  });
});

req.on('error', (err) => {
  console.error('Request error:', err);
});

req.write(payload);
req.end();
