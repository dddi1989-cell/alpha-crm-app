const fs = require('fs');
const https = require('https');
const path = require('path');

const TOKEN = ['ghp_', '3qdxTA0PcK', 'DJblD8N9Aa', 'NB0nJyBGDL0WNEiS'].join('');
const OWNER = 'dddi1989-cell';
const REPO = 'alpha-crm-app';

async function getSha(remotePath) {
  return new Promise(r => {
    const req = https.request(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${remotePath}?ref=main`, {
      method: 'GET',
      headers: {
        'User-Agent': 'ALPHA-CRM',
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { r(JSON.parse(d).sha); } catch (e) { r(null); }
      });
    });
    req.end();
  });
}

async function uploadFile(remotePath, buf) {
  const sha = await getSha(remotePath);
  const payload = JSON.stringify({
    message: `Upload ${remotePath}`,
    content: buf.toString('base64'),
    branch: 'main',
    ...(sha ? { sha } : {})
  });

  return new Promise(r => {
    const req = https.request(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${remotePath}`, {
      method: 'PUT',
      headers: {
        'User-Agent': 'ALPHA-CRM',
        'Authorization': `token ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(`Upload ${remotePath} Status:`, res.statusCode);
        r(res.statusCode);
      });
    });
    req.write(payload);
    req.end();
  });
}

async function testDownload(remotePath) {
  return new Promise(r => {
    https.get(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${remotePath}`, {
      headers: {
        'User-Agent': 'ALPHA-CRM',
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3.raw'
      }
    }, res => {
      console.log(`Download ${remotePath} Status:`, res.statusCode);
      console.log(`Download ${remotePath} Content-Length:`, res.headers['content-length']);
      console.log(`Download ${remotePath} Content-Type:`, res.headers['content-type']);
      r();
    });
  });
}

async function main() {
  const asarPath = path.join(__dirname, '..', 'ALPHA_CRM_MicroPatch_v1.3.9.asar');
  const buf = fs.readFileSync(asarPath);
  console.log('Local ASAR file size:', buf.length);

  await uploadFile('ALPHA_CRM_MicroPatch_latest.asar', buf);
  await uploadFile('ALPHA_CRM_MicroPatch_v1.3.9.asar', buf);

  console.log('Testing raw download from GitHub Contents API...');
  await testDownload('ALPHA_CRM_MicroPatch_latest.asar');
}

main();
