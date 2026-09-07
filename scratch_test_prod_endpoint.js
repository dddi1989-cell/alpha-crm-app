const https = require('https');

const CODEF_CLIENT_ID = 'cd5895af-ff8c-4591-b817-7afb94110d10';
const CODEF_CLIENT_SECRET = '6d869050-50ca-4710-910a-f7fe3067f6d2';

async function testApiEndpoint() {
  const authHeader = 'Basic ' + Buffer.from(`${CODEF_CLIENT_ID}:${CODEF_CLIENT_SECRET}`).toString('base64');
  
  const token = await new Promise((resolve) => {
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

  console.log('OAuth Token acquired:', !!token);

  console.log('\nTesting api.codef.io (Production endpoint)...');
  const payload = {
    organization: '0004',
    loginType: '5',
    loginTypeLevel: '1',
    userName: '이재성',
    phoneNo: '01076797880',
    identity: '19890918',
    id: 'CRM_TEST_' + Date.now(),
    searchStartYear: '2024',
    inquiryTypeCD: '111111111111111'
  };

  const prodResult = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.codef.io',
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
        console.log('api.codef.io Response Status:', res.statusCode);
        console.log('api.codef.io Response Body:', decoded);
        resolve(decoded);
      });
    });
    req.on('error', e => resolve(console.log('Error:', e.message)));
    req.write(JSON.stringify(payload));
    req.end();
  });
}

testApiEndpoint();
