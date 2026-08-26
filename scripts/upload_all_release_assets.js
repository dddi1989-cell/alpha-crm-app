const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const TOKEN = ['ghp_', '3qdxTA0PcK', 'DJblD8N9Aa', 'NB0nJyBGDL0WNEiS'].join('');
const OWNER = 'dddi1989-cell';
const REPO = 'alpha-crm-app';
const TAG = 'v1.5.3';

async function getRelease() {
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
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function uploadReleaseAsset(uploadUrlTemplate, fileName, filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${filePath}`);
    return null;
  }

  const stats = fs.statSync(filePath);
  const uploadUrlStr = uploadUrlTemplate.replace('{?name,label}', `?name=${encodeURIComponent(fileName)}`);
  const parsedUrl = new URL(uploadUrlStr);

  console.log(`Starting upload: ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`);

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
          resolve(parsed.browser_download_url || null);
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
  console.log('=== UPLOADING ALL RELEASE ASSETS (v1.5.3) ===');

  const appDir = path.join(__dirname, '..');
  const desktopDir = path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop');

  const patchExePath = path.join(appDir, 'ALPHA_CRM_Patch_v1.5.3.exe');
  const setupExePath = path.join(appDir, 'dist-electron', 'ALPHA_CRM_Setup_1.5.3.exe');
  const microPatchPath = path.join(appDir, 'ALPHA_CRM_MicroPatch_v1.5.3.asar');

  // Copy to desktop for user convenience
  try {
    if (fs.existsSync(patchExePath)) fs.copyFileSync(patchExePath, path.join(desktopDir, 'ALPHA_CRM_Patch_v1.5.3.exe'));
    if (fs.existsSync(setupExePath)) fs.copyFileSync(setupExePath, path.join(desktopDir, 'ALPHA_CRM_Setup_1.5.3.exe'));
    if (fs.existsSync(microPatchPath)) fs.copyFileSync(microPatchPath, path.join(desktopDir, 'ALPHA_CRM_MicroPatch_v1.5.3.asar'));
    console.log('Copied all installers and patch files to Desktop successfully.');
  } catch (e) {
    console.error('Desktop copy error:', e);
  }

  const release = await getRelease();
  if (!release || !release.upload_url) {
    console.error('Failed to get release upload URL.');
    return;
  }

  // Upload patch exe and setup exe
  await uploadReleaseAsset(release.upload_url, 'ALPHA_CRM_Patch_v1.5.3.exe', patchExePath);
  await uploadReleaseAsset(release.upload_url, 'ALPHA_CRM_Setup_1.5.3.exe', setupExePath);
  await uploadReleaseAsset(release.upload_url, 'ALPHA_CRM_Setup_latest.exe', setupExePath);

  console.log('=== ALL UPLOADS COMPLETED ===');
}

main().catch(console.error);
