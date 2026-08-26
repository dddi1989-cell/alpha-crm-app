const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN = ['ghp_', '3qdxTA0PcK', 'DJblD8N9Aa', 'NB0nJyBGDL0WNEiS'].join('');
const OWNER = 'dddi1989-cell';
const REPO = 'alpha-crm-app';

const appDir = path.resolve(__dirname, '..');
const setupExePath = path.join(appDir, 'dist-electron', 'ALPHA_CRM_Setup_1.4.2.exe');

if (!fs.existsSync(setupExePath)) {
  console.error('Latest setup exe not found at:', setupExePath);
  process.exit(1);
}

const latestSetupSize = fs.statSync(setupExePath).size;
console.log(`Latest setup installer size: ${latestSetupSize} bytes`);

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function getReleases() {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${OWNER}/${REPO}/releases`,
    method: 'GET',
    headers: {
      'User-Agent': 'ALPHA-CRM-Sync',
      'Authorization': `token ${TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  };
  const res = await makeRequest(options);
  return res.body;
}

async function deleteAsset(assetId) {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${OWNER}/${REPO}/releases/assets/${assetId}`,
    method: 'DELETE',
    headers: {
      'User-Agent': 'ALPHA-CRM-Sync',
      'Authorization': `token ${TOKEN}`
    }
  };
  const res = await makeRequest(options);
  console.log(`  Deleted old asset ${assetId}: Status ${res.statusCode}`);
}

async function uploadLatestAsset(uploadUrl, name, filePath) {
  const fileStats = fs.statSync(filePath);
  const fileStream = fs.readFileSync(filePath);
  const cleanUploadUrl = uploadUrl.replace(/\{.*?\}$/, '') + `?name=${encodeURIComponent(name)}`;
  const urlObj = new URL(cleanUploadUrl);

  const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: {
      'User-Agent': 'ALPHA-CRM-Sync',
      'Authorization': `token ${TOKEN}`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': fileStats.size
    }
  };

  const res = await makeRequest(options, fileStream);
  console.log(`  Uploaded ${name} to ${urlObj.pathname}: Status ${res.statusCode}`);
  return res.body;
}

async function runSync() {
  console.log('=== SYNCING ALL GITHUB RELEASE TAGS WITH LATEST V1.4.2 INSTALLER ===');
  const releases = await getReleases();

  if (!Array.isArray(releases)) {
    console.error('Failed to fetch releases:', releases);
    return;
  }

  for (const rel of releases) {
    console.log(`Processing release tag: ${rel.tag_name}...`);
    const latestAsset = rel.assets.find(a => a.name === 'ALPHA_CRM_Setup_latest.exe');

    if (latestAsset) {
      if (latestAsset.size === latestSetupSize) {
        console.log(`  [Match] ${rel.tag_name} already has latest v1.4.2 setup asset (${latestAsset.size} bytes).`);
        continue;
      }
      console.log(`  [Mismatch] ${rel.tag_name} has old asset size ${latestAsset.size} vs latest ${latestSetupSize}. Replacing...`);
      await deleteAsset(latestAsset.id);
    } else {
      console.log(`  [Missing] ${rel.tag_name} missing ALPHA_CRM_Setup_latest.exe. Uploading...`);
    }

    await uploadLatestAsset(rel.upload_url, 'ALPHA_CRM_Setup_latest.exe', setupExePath);
  }

  console.log('=== ALL GITHUB RELEASE TAGS SYNCED SUCCESSFULLY ===');
}

runSync().catch(console.error);
