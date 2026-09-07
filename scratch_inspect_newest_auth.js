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
    req.write(JSON.stringify({ prefix: '', limit: 30, sortBy: { column: 'created_at', order: 'desc' } }));
    req.end();
  });

  console.log('Latest 10 files in Supabase:');
  fileList.slice(0, 10).forEach(f => console.log(` - ${f.name} (${f.created_at})`));

  // Fetch newest hometax file
  const newestHometax = fileList.find(f => f.name.startsWith('hometax_'));
  if (newestHometax) {
    console.log(`\nFetching ${newestHometax.name}...`);
    https.get(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${newestHometax.name}?_t=${Date.now()}`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log('=== Newest Hometax File Content ===');
        try {
          const json = JSON.parse(data);
          console.log('User:', json.userName, 'Phone:', json.phoneNo);
          console.log('yearsMap keys:', Object.keys(json.yearsMap || {}));
          for (const [yr, yrData] of Object.entries(json.yearsMap || {})) {
            console.log(` Year ${yr}: data keys:`, Object.keys(yrData || {}), 'resDeductibleList count:', yrData?.resDeductibleList?.length);
            if (yrData?.result) console.log(` Year ${yr} CODEF result:`, yrData.result);
          }
        } catch (e) {
          console.log('Raw data snippet:', data.substring(0, 500));
        }
      });
    });
  }
}

listAndFetchLatest();
