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

  console.log('Top 10 files in Supabase:');
  fileList.slice(0, 10).forEach(f => console.log(` - ${f.name} (${f.created_at})`));

  const newestHometax = fileList.find(f => f.name.startsWith('hometax_'));
  const newestConfirm = fileList.find(f => f.name.startsWith('auth_confirm_'));
  const newestResult = fileList.find(f => f.name.startsWith('auth_result_'));
  const newestResp = fileList.find(f => f.name.startsWith('auth_response_'));

  async function getFile(name) {
    if (!name) return null;
    return new Promise(r => {
      https.get(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${name}?_t=${Date.now()}`, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => r(d));
      }).on('error', () => r(null));
    });
  }

  console.log('\n--- Newest Response ---');
  console.log(await getFile(newestResp?.name));

  console.log('\n--- Newest Confirm ---');
  console.log(await getFile(newestConfirm?.name));

  console.log('\n--- Newest Result ---');
  console.log(await getFile(newestResult?.name));

  console.log('\n--- Newest Hometax ---');
  console.log(await getFile(newestHometax?.name));
}

check();
