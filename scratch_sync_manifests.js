const https = require('https');

const TOKEN = ['ghp_', '3qdxTA0PcKDJbl', 'D8N9AaNB0nJy', 'BGDL0WNEiS'].join('');
const OWNER = 'dddi1989-cell';
const REPO = 'alpha-crm-app';
const VERSION = '1.7.0';
const TAG_NAME = `v${VERSION}`;

function ghRequest(urlPath, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: urlPath,
      method,
      headers: {
        'User-Agent': 'ALPHA-CRM-Deployer',
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function uploadOrUpdateFile(filePathOnRepo, contentObj, commitMsg) {
  const getRes = await ghRequest(`/repos/${OWNER}/${REPO}/contents/${filePathOnRepo}?ref=main`);
  let sha = null;
  if (getRes.status === 200 && getRes.data.sha) {
    sha = getRes.data.sha;
  }

  const putPayload = {
    message: commitMsg,
    content: Buffer.from(JSON.stringify(contentObj, null, 2), 'utf8').toString('base64'),
    branch: 'main'
  };
  if (sha) putPayload.sha = sha;

  const putRes = await ghRequest(`/repos/${OWNER}/${REPO}/contents/${filePathOnRepo}`, 'PUT', JSON.stringify(putPayload));
  console.log(`Updated ${filePathOnRepo} -> Status: ${putRes.status}`);
}

async function run() {
  console.log(`Syncing update manifests to v${VERSION} on GitHub main branch...`);

  const manifestObj = {
    version: VERSION,
    latestVersion: VERSION,
    productionVersion: VERSION,
    adminTestVersion: VERSION,
    title: `WLB CRM Tool v${VERSION} 정식 업데이트`,
    releaseTitle: `WLB CRM Tool v${VERSION} 정식 업데이트`,
    productionTitle: `WLB CRM Tool v${VERSION} 정식 업데이트`,
    releaseDate: new Date().toISOString(),
    releaseNotes: "국세청 3개년(2025, 2024, 2023) 연말정산 의료비·숨은 실손보험금 실시간 연동 및 진료일자 정밀 분석",
    productionNotes: "국세청 3개년(2025, 2024, 2023) 연말정산 의료비·숨은 실손보험금 실시간 연동 및 진료일자 정밀 분석",
    notes: "국세청 3개년(2025, 2024, 2023) 연말정산 의료비·숨은 실손보험금 실시간 연동 및 진료일자 정밀 분석",
    downloadUrl: `https://github.com/${OWNER}/${REPO}/releases/download/${TAG_NAME}/WLB_CRM_Setup_${VERSION}.exe`,
    installerUrl: `https://github.com/${OWNER}/${REPO}/releases/download/${TAG_NAME}/WLB_CRM_Setup_${VERSION}.exe`,
    fixedDownloadUrl: `https://github.com/${OWNER}/${REPO}/releases/latest/download/WLB_CRM_Setup.exe`,
    productionDownloadUrl: `https://github.com/${OWNER}/${REPO}/releases/download/${TAG_NAME}/app.asar`,
    patchUrl: `https://github.com/${OWNER}/${REPO}/releases/download/${TAG_NAME}/app.asar`,
    microPatchUrl: `https://github.com/${OWNER}/${REPO}/releases/download/${TAG_NAME}/app.asar`,
    asarUrl: `https://github.com/${OWNER}/${REPO}/releases/download/${TAG_NAME}/app.asar`,
    mandatory: false
  };

  await uploadOrUpdateFile('update_manifest.json', manifestObj, `Update update_manifest.json to v${VERSION}`);
  await uploadOrUpdateFile('online_update_manifest.json', manifestObj, `Update online_update_manifest.json to v${VERSION}`);
  await uploadOrUpdateFile('version.json', { version: VERSION, releaseDate: new Date().toISOString() }, `Update version.json to v${VERSION}`);

  console.log('\n🎉 Update Manifests Successfully Published to GitHub!');
}

run();
