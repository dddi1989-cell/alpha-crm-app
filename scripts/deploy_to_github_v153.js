const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const TOKEN = 'ghp_MASKED';
const OWNER = 'dddi1989-cell';
const REPO = 'alpha-crm-app';
const TAG = 'v1.5.3';

async function getSha(remotePath) {
  return new Promise((resolve) => {
    const req = https.request(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${remotePath}?ref=main`, {
      method: 'GET',
      headers: {
        'User-Agent': 'ALPHA-CRM-Uploader',
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.sha || null);
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function uploadContentFile(remotePath, contentBuffer) {
  const sha = await getSha(remotePath);
  const payload = {
    message: `Deploy ${remotePath} - Release ${TAG}`,
    content: contentBuffer.toString('base64'),
    branch: 'main'
  };
  if (sha) payload.sha = sha;

  const body = JSON.stringify(payload);

  return new Promise((resolve) => {
    const req = https.request(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${remotePath}`, {
      method: 'PUT',
      headers: {
        'User-Agent': 'ALPHA-CRM-Uploader',
        'Authorization': `token ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      console.log(`[GitHub-Content] ${remotePath} -> Status ${res.statusCode}`);
      resolve(res.statusCode === 200 || res.statusCode === 201);
    });
    req.on('error', (err) => {
      console.error('Content upload error:', err);
      resolve(false);
    });
    req.write(body);
    req.end();
  });
}

async function createOrGetRelease() {
  return new Promise((resolve) => {
    const req = https.request(`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'ALPHA-CRM-Uploader',
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
        } else {
          const createPayload = JSON.stringify({
            tag_name: TAG,
            target_commitish: 'main',
            name: `ALPHA CRM Release ${TAG}`,
            body: `ALPHA CRM Release ${TAG}\n- Organization Management & Subordinate Long-touch Monitoring\n- Reliable Process Auto-Kill and Relaunch on Update\n- Realtime GitHub Account and CRM Data Store`,
            draft: false,
            prerelease: false
          });

          const createReq = https.request(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
            method: 'POST',
            headers: {
              'User-Agent': 'ALPHA-CRM-Uploader',
              'Authorization': `token ${TOKEN}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(createPayload)
            }
          }, createRes => {
            let cData = '';
            createRes.on('data', c => cData += c);
            createRes.on('end', () => {
              try { resolve(JSON.parse(cData)); } catch (e) { resolve(null); }
            });
          });
          createReq.write(createPayload);
          createReq.end();
        }
      });
    });
    req.end();
  });
}

async function uploadReleaseAsset(uploadUrlTemplate, fileName, filePath) {
  if (!fs.existsSync(filePath)) return null;

  const stats = fs.statSync(filePath);
  const uploadUrlStr = uploadUrlTemplate.replace('{?name,label}', `?name=${encodeURIComponent(fileName)}`);
  const parsedUrl = new URL(uploadUrlStr);

  return new Promise((resolve) => {
    const fileStream = fs.createReadStream(filePath);
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
      console.log(`[GitHub-Release-Asset] ${fileName} -> Status ${res.statusCode}`);
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.url || parsed.browser_download_url || null);
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', (err) => {
      console.error(`Asset upload error (${fileName}):`, err.message);
      resolve(null);
    });
    fileStream.pipe(req);
  });
}

async function main() {
  console.log('=== STARTING AUTOMATED GITHUB RELEASE & ASSET DEPLOYMENT (v1.5.3) ===');

  const appDir = path.join(__dirname, '..');
  const desktopDir = path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop');

  const sourceAsar = path.join(appDir, 'dist-electron', 'win-unpacked', 'resources', 'app.asar');
  const microPatchPath = path.join(appDir, 'ALPHA_CRM_MicroPatch_v1.5.3.asar');

  if (fs.existsSync(sourceAsar)) {
    fs.copyFileSync(sourceAsar, microPatchPath);
    console.log(`Copied ${sourceAsar} to ${microPatchPath} (${fs.statSync(microPatchPath).size} bytes)`);
  }

  const release = await createOrGetRelease();
  if (!release || !release.upload_url) {
    console.error('Failed to create/get release asset upload URL.');
    return;
  }

  console.log(`Release created/retrieved: ${release.html_url}`);

  console.log('Uploading release assets to GitHub Release...');
  await uploadReleaseAsset(release.upload_url, 'ALPHA_CRM_MicroPatch_v1.5.3.asar', microPatchPath);

  const manifestData = {
    latestVersion: '1.5.3',
    releaseTitle: 'v1.5.3 조직 관리(조직원 일정 & 장기미터치 고객 모니터링) 정식 패치',
    releaseNotes: '조직도상 상위직급자가 하위직급자의 일정 및 6개월 이상 미접촉된 장기미터치 고객을 실시간으로 검색·조회하고 관리할 수 있는 조직 관리 기능 탑재\n- 자동 업데이트 시 기존 프로세스 자동 종료 후 패치 및 100% 자동 재구동 보장',
    downloadUrl: `https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/ALPHA_CRM_MicroPatch_v1.5.3.asar`,
    updated_at: new Date().toISOString()
  };

  const manifestPath = path.join(appDir, 'update_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
  await uploadContentFile('update_manifest.json', fs.readFileSync(manifestPath));

  try {
    fs.copyFileSync(manifestPath, path.join(desktopDir, 'update_manifest.json'));
    fs.copyFileSync(microPatchPath, path.join(desktopDir, 'ALPHA_CRM_MicroPatch_v1.5.3.asar'));
  } catch (e) {}

  console.log('=== GITHUB RELEASE & MANIFEST DEPLOYMENT COMPLETED SUCCESSFULLY ===');
}

main().catch(console.error);
