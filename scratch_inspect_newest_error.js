const https = require('https');

const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
const SUPABASE_KEY = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dXdoaWprd2ZtdWZuamZiZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjgyNDQsImV4cCI6MjEwMzE0NDI0NH0.', '-Vo71FsmwJNd2l1-UwD-ixGT_DymxRlcMp0wsONfCyE'].join('');
const BUCKET = 'wbl-board-files';

async function check() {
  const fileList = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'wvuwhijkwfmufnjfbefi.supabase.co',
      path: '/storage/v1/object/list/' + BUCKET,
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.write(JSON.stringify({ prefix: '', limit: 10, sortBy: { column: 'created_at', order: 'desc' } }));
    req.end();
  });

  const newestHometax = fileList.find(f => f.name.startsWith('hometax_'));
  const newestConfirm = fileList.find(f => f.name.startsWith('auth_confirm_'));
  const newestResp = fileList.find(f => f.name.startsWith('auth_response_'));

  console.log('Newest files:');
  console.log(' Hometax:', newestHometax?.name, newestHometax?.created_at);
  console.log(' Confirm:', newestConfirm?.name, newestConfirm?.created_at);
  console.log(' Response:', newestResp?.name, newestResp?.created_at);

  if (newestResp) {
    console.log(`\n=== Fetching ${newestResp.name} ===`);
    const respData = await new Promise(r => {
      https.get(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${newestResp.name}?_t=${Date.now()}`, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => r(d));
      });
    });
    console.log(respData);
  }

  if (newestHometax) {
    console.log(`\n=== Fetching ${newestHometax.name} ===`);
    const hometaxData = await new Promise(r => {
      https.get(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${newestHometax.name}?_t=${Date.now()}`, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => r(d));
      });
    });
    try {
      const json = JSON.parse(hometaxData);
      console.log('Session ID:', json.sessionId);
      console.log('yearsMap:', JSON.stringify(json.yearsMap, null, 2).substring(0, 500));
    } catch(e) {
      console.log('Raw:', hometaxData.substring(0, 300));
    }
  }
}

check();
