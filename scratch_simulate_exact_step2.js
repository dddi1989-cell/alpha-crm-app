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

async function run() {
  const token = await getAccessToken();

  // Let's inspect the twoWayInfo structure that CODEF requires for Step 2:
  // Step 1:
  // {
  //   organization: '0004',
  //   loginType: '5',
  //   loginTypeLevel: '1',
  //   userName: '이재성',
  //   phoneNo: '01076797880',
  //   identity: '19890918',
  //   id: 'CRM_01076797880_...',
  //   searchStartYear: '2024',
  //   inquiryTypeCD: '111111111111111'
  // }
  //
  // In Step 2, does CODEF require 'is2Way: true' AND 'twoWayInfo' object with { jobIndex, threadIndex, jti, twoWayTimestamp }?
  // Or does it require 'simpleAuth: "1"'?
  console.log('Token acquired:', !!token);
}

run();
