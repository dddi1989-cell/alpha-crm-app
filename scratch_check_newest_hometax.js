const https = require('https');

const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
const SUPABASE_KEY = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dXdoaWprd2ZtdWZuamZiZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjgyNDQsImV4cCI6MjEwMzE0NDI0NH0.', '-Vo71FsmwJNd2l1-UwD-ixGT_DymxRlcMp0wsONfCyE'].join('');
const BUCKET = 'wbl-board-files';

async function checkLatest() {
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

  console.log('Top files:');
  fileList.slice(0, 8).forEach(f => console.log(` - ${f.name} (${f.created_at})`));

  const newestHometax = fileList.find(f => f.name.startsWith('hometax_'));
  if (newestHometax) {
    console.log(`\n=== Fetching ${newestHometax.name} ===`);
    https.get(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${newestHometax.name}?_t=${Date.now()}`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          console.log('Session ID:', json.sessionId);
          console.log('Years Map Keys:', Object.keys(json.yearsMap || {}));
          for (const [yr, yrData] of Object.entries(json.yearsMap || {})) {
            console.log(`\n--- Year ${yr} Raw Data ---`);
            console.log(' Type:', typeof yrData, 'Array?:', Array.isArray(yrData));
            if (yrData?.result) console.log(' Result:', yrData.result);
            if (Array.isArray(yrData)) {
              console.log(` Array length: ${yrData.length}`);
              const med = yrData.find(i => i.resDeductibleItem === '3' || i.resDeductibleItem === 3);
              console.log(' Med item basicList count:', med?.resBasicList?.length);
            } else if (yrData?.data) {
              console.log(' yrData.data:', Array.isArray(yrData.data) ? `Array length ${yrData.data.length}` : yrData.data);
            } else {
              console.log(' Content snippet:', JSON.stringify(yrData).substring(0, 300));
            }
          }
          console.log('\n--- parsedData ---');
          console.log(JSON.stringify(json.parsedData, null, 2).substring(0, 600));
        } catch (e) {
          console.error('Parse error:', e);
        }
      });
    });
  }
}

checkLatest();
