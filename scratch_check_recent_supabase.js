const https = require('https');

const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
const SUPABASE_KEY = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dXdoaWprd2ZtdWZuamZiZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjgyNDQsImV4cCI6MjEwMzE0NDI0NH0.', '-Vo71FsmwJNd2l1-UwD-ixGT_DymxRlcMp0wsONfCyE'].join('');
const BUCKET = 'wbl-board-files';

async function listAndFetchLatest() {
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
    req.write(JSON.stringify({ prefix: '', limit: 40, sortBy: { column: 'created_at', order: 'desc' } }));
    req.end();
  });

  console.log('Latest 20 files in Supabase:');
  fileList.slice(0, 20).forEach(f => console.log(` - ${f.name} (${f.created_at})`));

  // Find newest files from the latest session
  const newestHometax = fileList.find(f => f.name.startsWith('hometax_'));
  const newestAuthResult = fileList.find(f => f.name.startsWith('auth_result_'));
  const newestAuthRequest = fileList.find(f => f.name.startsWith('auth_request_'));
  const newestAuthResponse = fileList.find(f => f.name.startsWith('auth_response_'));
  const newestAuthConfirm = fileList.find(f => f.name.startsWith('auth_confirm_'));

  async function fetchFile(name) {
    if (!name) return null;
    return new Promise((resolve) => {
      https.get(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${name}?_t=${Date.now()}`, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(d));
      }).on('error', () => resolve(null));
    });
  }

  console.log('\n--- Details of latest files ---');
  if (newestAuthRequest) {
    console.log(`\n[${newestAuthRequest.name}]`);
    console.log(await fetchFile(newestAuthRequest.name));
  }
  if (newestAuthResponse) {
    console.log(`\n[${newestAuthResponse.name}]`);
    console.log(await fetchFile(newestAuthResponse.name));
  }
  if (newestAuthConfirm) {
    console.log(`\n[${newestAuthConfirm.name}]`);
    console.log(await fetchFile(newestAuthConfirm.name));
  }
  if (newestAuthResult) {
    console.log(`\n[${newestAuthResult.name}]`);
    console.log(await fetchFile(newestAuthResult.name));
  }
  if (newestHometax) {
    console.log(`\n[${newestHometax.name}]`);
    const content = await fetchFile(newestHometax.name);
    try {
      const parsed = JSON.parse(content);
      console.log('User:', parsed.userName, 'Phone:', parsed.phoneNo);
      console.log('yearsMap keys:', Object.keys(parsed.yearsMap || {}));
      console.log('parsedData summary:', parsed.parsedData ? {
        totalExpenseCount: parsed.parsedData.totalExpenseCount,
        totalExpenseAmount: parsed.parsedData.totalExpenseAmount,
        totalClaimedAmount: parsed.parsedData.totalClaimedAmount,
        unclaimedAmount: parsed.parsedData.unclaimedAmount,
        yearsAvailable: parsed.parsedData.yearsAvailable
      } : 'No parsedData');
      if (parsed.rawNtsData) {
        console.log('rawNtsData keys:', Object.keys(parsed.rawNtsData));
      }
    } catch(e) {
      console.log('Raw snippet:', content?.substring(0, 300));
    }
  }
}

listAndFetchLatest();
