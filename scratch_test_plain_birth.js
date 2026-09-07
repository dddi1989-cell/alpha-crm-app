const https = require('https');

const CODEF_CLIENT_ID = 'cd5895af-ff8c-4591-b817-7afb94110d10';
const CODEF_CLIENT_SECRET = '6d869050-50ca-4710-910a-f7fe3067f6d2';

async function getAccessToken() {
  const authHeader = 'Basic ' + Buffer.from(`${CODEF_CLIENT_ID}:${CODEF_CLIENT_SECRET}`).toString('base64');
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'oauth.codef.io',
      port: 443,
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b).access_token); } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write('grant_type=client_credentials&scope=read');
    req.end();
  });
}

async function testPlain() {
  const token = await getAccessToken();

  console.log('Testing plain 8-digit birthdate (19890918) with loginType=5:');
  const payload = {
    organization: '0004',
    loginType: '5',
    loginTypeLevel: '1',
    userName: '이재성',
    phoneNo: '01076797880',
    identity: '19890918',
    id: 'CRM_01076797880_' + Date.now(),
    searchStartYear: '2025',
    inquiryTypeCD: '111111111111111'
  };

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'development.codef.io',
      port: 443,
      path: '/v1/kr/public/nt/etc-yearend-tax/income-tax-credit',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        const decoded = decodeURIComponent(b);
        console.log('Response Status:', res.statusCode);
        console.log('Response Body:', decoded);
        resolve();
      });
    });
    req.on('error', e => resolve(console.log('Error:', e.message)));
    req.write(JSON.stringify(payload));
    req.end();
  });
}

testPlain();
