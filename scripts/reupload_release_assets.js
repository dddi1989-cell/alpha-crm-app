const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const TOKEN = 'ghp_MASKED';
const OWNER = 'dddi1989-cell';
const REPO = 'alpha-crm-app';
const TAG = 'v1.6.8';

function ghRequest(urlPath, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: urlPath,
      method,
      headers: {
        'User-Agent': 'ALPHA-CRM-Uploader',
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }); }
        catch { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function uploadAsset(uploadUrlTemplate, fileName, filePath) {
  const stats = fs.statSync(filePath);
  const uploadUrlStr = uploadUrlTemplate.replace('{?name,label}', `?name=${encodeURIComponent(fileName)}`);
  const parsedUrl = new URL(uploadUrlStr);
  console.log(`Uploading: ${fileName} (${(stats.size / 1024 / 1024).toFixed(1)} MB)...`);
  return new Promise((resolve) => {
    const req = https.request({
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'User-Agent': 'ALPHA-CRM-Uploader',
        'Authorization': `token ${TOKEN}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': stats.size
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`  -> Status ${res.statusCode}`);
        try { resolve(JSON.parse(data).browser_download_url); } catch { resolve(null); }
      });
    });
    req.on('error', (e) => { console.error(`  -> Error: ${e.message}`); resolve(null); });
    fs.createReadStream(filePath).pipe(req);
  });
}

async function main() {
  console.log('=== STEP 1: Get release info ===');
  const rel = await ghRequest(`/repos/${OWNER}/${REPO}/releases/tags/${TAG}`);
  if (rel.status !== 200) { console.error('Release not found'); return; }
  const release = rel.data;
  
  console.log(`Release: ${release.name}, Assets: ${release.assets.length}`);

  // Step 2: Delete ALL old assets in release
  console.log('\n=== STEP 2: Delete old assets ===');
  for (const asset of release.assets) {
    const del = await ghRequest(`/repos/${OWNER}/${REPO}/releases/assets/${asset.id}`, 'DELETE');
    console.log(`  Deleted: ${asset.name} -> ${del.status}`);
  }

  // Step 3: Upload new files
  console.log('\n=== STEP 3: Upload new assets ===');
  const appDir = path.join(__dirname, '..');
  const files = [
    { name: 'WLB_CRM_Setup_1.6.8.exe', path: path.join(appDir, 'dist-electron', 'WLB_CRM_Setup_1.6.8.exe') },
    { name: 'WLB_CRM_Setup.exe', path: path.join(appDir, 'dist-electron', 'WLB_CRM_Setup_1.6.8.exe') },
    { name: 'ALPHA_CRM_MicroPatch_v1.6.8.asar', path: path.join(appDir, 'dist-electron', 'win-unpacked', 'resources', 'app.asar') },
    { name: 'WLB_CRM_MicroPatch_v1.6.8.asar', path: path.join(appDir, 'dist-electron', 'win-unpacked', 'resources', 'app.asar') },
  ];

  const urls = {};
  for (const f of files) {
    if (!fs.existsSync(f.path)) { console.error(`  NOT FOUND: ${f.path}`); continue; }
    const url = await uploadAsset(release.upload_url, f.name, f.path);
    urls[f.name] = url;
  }

  console.log('\n=== All assets cleanly uploaded for v1.6.8! ===');
  console.log('Download URLs:');
  for (const [name, url] of Object.entries(urls)) {
    console.log(`  ${name}: ${url}`);
  }
}

main().catch(console.error);
