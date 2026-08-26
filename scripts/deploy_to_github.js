const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const TOKEN = 'ghp_MASKED';
const OWNER = 'dddi1989-cell';
const REPO = 'alpha-crm-app';
const TAG = 'v1.5.2';

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
    req.on('error', () => resolve(false));
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
          // Create release
          const createPayload = JSON.stringify({
            tag_name: TAG,
            target_commitish: 'main',
            name: `ALPHA CRM Release ${TAG}`,
            body: `ALPHA 고객관리Tool Official Release ${TAG}\n- Direct PAT Authenticated Auto Update\n- Permanent Download Link Enabled`,
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
  console.log('=== STARTING AUTOMATED GITHUB RELEASE & ASSET DEPLOYMENT ===');

  const appDir = path.join(__dirname, '..');
  const desktopDir = path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop');

  // 1. Get or Create GitHub Release
  const release = await createOrGetRelease();
  if (!release || !release.upload_url) {
    console.error('Failed to create/get release asset upload URL.');
    return;
  }

  console.log(`Release created/retrieved: ${release.html_url}`);

  // 2. Upload Release Assets (MicroPatch & Installers)
  const microPatchPath = path.join(appDir, 'ALPHA_CRM_MicroPatch_v1.5.2.asar');
  const setupExePath = path.join(appDir, 'dist-electron', 'ALPHA_CRM_Setup_1.5.2.exe');

  console.log('Uploading release assets to GitHub Release...');
  const microPatchAssetUrl = await uploadReleaseAsset(release.upload_url, 'ALPHA_CRM_MicroPatch_v1.5.2.asar', microPatchPath);
  const setupExeAssetUrl = await uploadReleaseAsset(release.upload_url, 'ALPHA_CRM_Setup_latest.exe', setupExePath);
  await uploadReleaseAsset(release.upload_url, 'ALPHA_CRM_Setup_1.5.2.exe', setupExePath);

  // 3. Upload update_manifest.json to Repository root
  const manifestData = {
    latestVersion: '1.5.2',
    releaseTitle: 'v1.5.2 VBScript Relayer 무무??릴레?�어 & ?�동 ?�시???�치 ?�치',
    releaseNotes: 'Base64 UTF-16LE ?�코??PowerShell ?�크립트�?개행 문맥 ?�싱 ?�류 ?�결, PID ?�로?�스 ?��?�??�치 ??100% ?�동 ?�시??보장',
    downloadUrl: microPatchAssetUrl || `https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/latest`,
    latestSetupUrl: setupExeAssetUrl || `https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/ALPHA_CRM_Setup_latest.exe`,
    updated_at: new Date().toISOString()
  };

  const manifestPath = path.join(appDir, 'update_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
  await uploadContentFile('update_manifest.json', fs.readFileSync(manifestPath));

  // Copy manifest to Desktop
  try {
    fs.copyFileSync(manifestPath, path.join(desktopDir, 'update_manifest.json'));
  } catch (e) {}

  // 4. Sync online_account_store.json to repo root
  const accountStorePath = path.join(process.env.APPDATA || process.env.HOME, 'offline-crm-app', 'online_account_store.json');
  if (fs.existsSync(accountStorePath)) {
    console.log('Syncing online_account_store.json...');
    await uploadContentFile('online_account_store.json', fs.readFileSync(accountStorePath));
  }

  // 5. Clean up old patch files from Desktop
  console.log('Cleaning up old desktop patch files...');
  if (fs.existsSync(desktopDir)) {
    const desktopFiles = fs.readdirSync(desktopDir);
    desktopFiles.forEach(f => {
      if ((f.startsWith('ALPHA_CRM_Patch_v1.3.') || f.startsWith('ALPHA_CRM_MicroPatch_v1.3.')) && !f.includes('1.3.4')) {
        try {
          fs.unlinkSync(path.join(desktopDir, f));
          console.log(`Deleted old desktop file: ${f}`);
        } catch (e) {}
      }
    });
  }

  console.log('=== GITHUB RELEASE DEPLOYMENT COMPLETED SUCCESSFULLY ===');
  console.log(`Latest Installer Download Link: https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/ALPHA_CRM_Setup_latest.exe`);
}

main().catch(err => {
  console.error('Deployment script failed:', err);
});
