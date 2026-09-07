/**
 * End-to-End CODEF 2-Way Test
 * Step 1: Send auth request → Wait for KakaoTalk signing → Step 2: Confirm
 */
const https = require('https');
const readline = require('readline');

const CODEF_CONFIG = {
  clientId: 'cd5895af-ff8c-4591-b817-7afb94110d10',
  clientSecret: '6d869050-50ca-4710-910a-f7fe3067f6d2',
  host: 'development.codef.io',
  apiPath: '/v1/kr/public/nt/etc-yearend-tax/income-tax-credit'
};

async function getToken() {
  const authHeader = 'Basic ' + Buffer.from(`${CODEF_CONFIG.clientId}:${CODEF_CONFIG.clientSecret}`).toString('base64');
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'oauth.codef.io', port: 443, path: '/oauth/token', method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' }
    }, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b).access_token); } catch (e) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.write('grant_type=client_credentials&scope=read');
    req.end();
  });
}

async function callCodef(token, payload) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: CODEF_CONFIG.host, port: 443, path: CODEF_CONFIG.apiPath, method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    }, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(decodeURIComponent(b))); } catch (e) { resolve({ error: e.message, raw: b }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function askQuestion(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

async function run() {
  console.log('=== CODEF 2-Way End-to-End Test ===\n');
  
  // 1. Get OAuth Token
  const token = await getToken();
  console.log('1. OAuth Token acquired:', !!token);
  
  // 2. Step 1: Send auth request
  const sessionId = 'E2E_TEST_' + Date.now();
  const step1Payload = {
    organization: '0004',
    loginType: '5',
    loginTypeLevel: '1',
    userName: '이재성',
    phoneNo: '01076797880',
    identity: '19890918',
    id: sessionId,
    searchStartYear: '2024',
    inquiryTypeCD: '111111111111111'
  };
  
  console.log('\n2. Sending Step 1 (Session ID:', sessionId, ')...');
  const step1Result = await callCodef(token, step1Payload);
  
  console.log('\n=== Step 1 Result ===');
  console.log('Code:', step1Result.result?.code);
  console.log('Message:', step1Result.result?.message);
  console.log('continue2Way:', step1Result.data?.continue2Way);
  console.log('method:', step1Result.data?.method);
  console.log('jobIndex:', step1Result.data?.jobIndex);
  console.log('threadIndex:', step1Result.data?.threadIndex);
  console.log('jti:', step1Result.data?.jti);
  console.log('twoWayTimestamp:', step1Result.data?.twoWayTimestamp);
  
  if (step1Result.result?.code !== 'CF-03002') {
    console.log('\nStep 1 did not return CF-03002. Full response:');
    console.log(JSON.stringify(step1Result, null, 2));
    return;
  }
  
  // 3. Wait for user to sign on KakaoTalk
  console.log('\n=== 카카오톡에서 서명을 완료한 후 Enter를 눌러주세요 ===');
  await askQuestion('Press Enter after signing on KakaoTalk...');
  
  // 4. Step 2: Confirm with simpleAuth
  const step2Payload = {
    ...step1Payload,
    is2Way: true,
    simpleAuth: '1',
    twoWayInfo: {
      jobIndex: step1Result.data.jobIndex,
      threadIndex: step1Result.data.threadIndex,
      jti: step1Result.data.jti,
      twoWayTimestamp: step1Result.data.twoWayTimestamp
    }
  };
  
  console.log('\n3. Sending Step 2...');
  console.log('Step 2 Payload:', JSON.stringify(step2Payload, null, 2));
  
  const step2Result = await callCodef(token, step2Payload);
  
  console.log('\n=== Step 2 Result ===');
  console.log('Code:', step2Result.result?.code);
  console.log('Message:', step2Result.result?.message);
  
  if (step2Result.result?.code === 'CF-00000') {
    console.log('\n✓ SUCCESS! Data received!');
    const data = step2Result.data;
    if (Array.isArray(data)) {
      console.log('Data is array, length:', data.length);
      data.slice(0, 3).forEach((item, i) => {
        console.log(`Item ${i}:`, JSON.stringify(item).substring(0, 200));
      });
    } else if (data?.resBasicList) {
      console.log('resBasicList length:', data.resBasicList.length);
      data.resBasicList.slice(0, 3).forEach((item, i) => {
        console.log(`Item ${i}:`, JSON.stringify(item).substring(0, 200));
      });
    } else {
      console.log('Data keys:', Object.keys(data || {}));
      console.log('Full data:', JSON.stringify(data).substring(0, 1000));
    }
  } else {
    console.log('\n✗ FAILED!');
    console.log('Full response:', JSON.stringify(step2Result, null, 2).substring(0, 500));
    
    // Retry after 2 seconds
    console.log('\nRetrying in 2 seconds...');
    await new Promise(r => setTimeout(r, 2000));
    const retry = await callCodef(token, step2Payload);
    console.log('\nRetry Result Code:', retry.result?.code);
    console.log('Retry Message:', retry.result?.message);
    if (retry.result?.code === 'CF-00000') {
      console.log('Retry data keys:', Object.keys(retry.data || {}));
      console.log('Retry data:', JSON.stringify(retry.data).substring(0, 1000));
    } else {
      console.log('Retry full:', JSON.stringify(retry).substring(0, 500));
    }
  }
}

run();
