const https = require('https');

const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
const SUPABASE_KEY = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dXdoaWprd2ZtdWZuamZiZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjgyNDQsImV4cCI6MjEwMzE0NDI0NH0.', '-Vo71FsmwJNd2l1-UwD-ixGT_DymxRlcMp0wsONfCyE'].join('');
const BUCKET = 'wbl-board-files';

async function inspectLatest() {
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
  if (!newestHometax) return console.log('No hometax file found');

  console.log(`Inspecting ${newestHometax.name}...`);
  https.get(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${newestHometax.name}?_t=${Date.now()}`, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('--- Top Level Keys ---');
        console.log(Object.keys(json));
        console.log('yearsMap keys:', Object.keys(json.yearsMap || {}));
        for (const [yr, yrVal] of Object.entries(json.yearsMap || {})) {
          const isArr = Array.isArray(yrVal);
          const hasData = yrVal?.data ? Array.isArray(yrVal.data) : false;
          console.log(` Year ${yr}: isArray=${isArr}, dataIsArray=${hasData}, keys=${Object.keys(yrVal || {})}`);
        }
        
        // Inspect raw medical records in json.yearsMap
        const raw2024 = json.yearsMap?.['2024'] || json.rawNtsData;
        const targetList = Array.isArray(raw2024) ? raw2024 : (raw2024?.data || []);
        const medicalItem = targetList.find(i => i.resDeductibleItem === '3' || i.resDeductibleItem === 3);
        console.log('\n--- 2024 Medical Item resBasicList count:', medicalItem?.resBasicList?.length);
        if (medicalItem?.resBasicList) {
          medicalItem.resBasicList.slice(0, 5).forEach((b, idx) => {
            console.log(`\n[Org ${idx + 1}] ${b.resCompanyNm || b.resUserNm} (${b.resAmountPayment || b.resAmount}원)`);
            console.log('  resDetailList count:', b.resDetailList?.length);
            if (b.resDetailList) {
              console.log('  resDetailList sample:', JSON.stringify(b.resDetailList.slice(0, 3)));
            }
          });
        }
      } catch(e) {
        console.error('Error parsing json:', e.message);
      }
    });
  });
}

inspectLatest();
