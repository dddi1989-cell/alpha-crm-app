const https = require('https');
const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
const SUPABASE_KEY = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dXdoaWprd2ZtdWZuamZiZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjgyNDQsImV4cCI6MjEwMzE0NDI0NH0.', '-Vo71FsmwJNd2l1-UwD-ixGT_DymxRlcMp0wsONfCyE'].join('');
const BUCKET = 'wbl-board-files';

https.get(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/auth_result_MOB_1788073206635.json?_t=${Date.now()}`, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('=== auth_result_MOB_1788073206635.json ===');
    console.log(data);
  });
});
