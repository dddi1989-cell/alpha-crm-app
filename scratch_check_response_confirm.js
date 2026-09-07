const https = require('https');
const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
const SUPABASE_KEY = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dXdoaWprd2ZtdWZuamZiZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjgyNDQsImV4cCI6MjEwMzE0NDI0NH0.', '-Vo71FsmwJNd2l1-UwD-ixGT_DymxRlcMp0wsONfCyE'].join('');
const BUCKET = 'wbl-board-files';

async function fetchFile(name) {
  return new Promise((resolve) => {
    https.get(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${name}?_t=${Date.now()}`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', () => resolve(null));
  });
}

async function run() {
  console.log('[auth_response_MOB_1788137458773.json]');
  console.log(await fetchFile('auth_response_MOB_1788137458773.json'));

  console.log('\n[auth_confirm_MOB_1788137458773.json]');
  console.log(await fetchFile('auth_confirm_MOB_1788137458773.json'));
}

run();
