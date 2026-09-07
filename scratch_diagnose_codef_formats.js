const https = require('https');
const crypto = require('crypto');

const CODEF_CLIENT_ID = 'cd5895af-ff8c-4591-b817-7afb94110d10';
const CODEF_CLIENT_SECRET = '6d869050-50ca-4710-910a-f7fe3067f6d2';
const CODEF_PUBLIC_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAncJ0P8fl5eOm/w5PkP37jw9WWKg9hRxUOHi8h0QJYpv8gPNJ9SM6PG7oXYO3oXT2rjZP9sNUlExuZXdJKq+3CxH1zFi6I4v4+gFVb6pZREHpfGS9/kPKDPp1TxeyOLC84Eg9T7XKog6q+2XZoliWSRfqOgeEsMB2ZH6XF5Ny8bDjmsSAlU4BQuFfrHVoVxhm6/A+macQ1dy7bvoOzioa64fcWsJ3aHEy44BT63VnNDZt9Cmw6vbRmDhO1JEKGFxKaFa8kMmmgWrtPREVKpAPVwv8EQcS8A6M4BTH6ESU1HXDkUOlEtiTjP6fJLmqb//E8RYD198NWnoofWPqKK30DwIDAQAB';

function rsaEncrypt(text) {
  const formattedKey = `-----BEGIN PUBLIC KEY-----\n${CODEF_PUBLIC_KEY}\n-----END PUBLIC KEY-----`;
  const buffer = Buffer.from(text, 'utf8');
  const encrypted = crypto.publicEncrypt({
    key: formattedKey,
    padding: crypto.constants.RSA_PKCS1_PADDING
  }, buffer);
  return encrypted.toString('base64');
}

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

async function testPayload(token, payloadName, payload) {
  console.log(`\n=== Testing [${payloadName}] ===`);
  console.log('Payload:', JSON.stringify(payload));
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
        try { resolve(JSON.parse(decoded)); } catch(e) { resolve(decoded); }
      });
    });
    req.on('error', e => {
      console.log('Request Error:', e.message);
      resolve(null);
    });
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function run() {
  const token = await getAccessToken();
  console.log('Token acquired:', token ? 'YES' : 'NO');

  const encIdentity = rsaEncrypt('19890918');

  // Payload A: Standard format
  await testPayload(token, 'Format A: inquiryTypeCD=111111111111111', {
    organization: '0004',
    loginType: '5',
    loginTypeLevel: '1',
    userName: '이재성',
    phoneNo: '01076797880',
    identity: encIdentity,
    searchStartYear: '2025',
    inquiryTypeCD: '111111111111111'
  });

  // Payload B: inquiryType=0, type=1
  await testPayload(token, 'Format B: inquiryType=0, type=1', {
    organization: '0004',
    loginType: '5',
    loginTypeLevel: '1',
    userName: '이재성',
    phoneNo: '01076797880',
    identity: encIdentity,
    searchStartYear: '2025',
    searchEndYear: '2025',
    inquiryType: '0',
    type: '1'
  });
}

run();
