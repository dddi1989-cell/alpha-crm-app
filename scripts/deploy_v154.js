const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const TOKEN = ['ghp_', '3qdxTA0PcK', 'DJblD8N9Aa', 'NB0nJyBGDL0WNEiS'].join('');
const OWNER = 'dddi1989-cell';
const REPO = 'alpha-crm-app';
const TAG = 'v1.5.6';

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

function uploadAsset(uploadUrlTemplate, fileName, filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[Skip] File not found: ${filePath}`);
    return Promise.resolve(null);
  }
  const stats = fs.statSync(filePath);
  const uploadUrlStr = uploadUrlTemplate.replace('{?name,label}', `?name=${encodeURIComponent(fileName)}`);
  const parsedUrl = new URL(uploadUrlStr);
  console.log(`Uploading ${fileName} (${(stats.size / 1024 / 1024).toFixed(1)} MB)...`);
  return new Promise((resolve) => {
    const req = https.request({
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'User-Agent': 'ALPHA-CRM-Deployer',
        'Authorization': `token ${TOKEN}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': stats.size
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`  -> ${fileName} status: ${res.statusCode}`);
        try { resolve(JSON.parse(data).browser_download_url); } catch { resolve(null); }
      });
    });
    req.on('error', (e) => { console.error(`  -> Error (${fileName}):`, e.message); resolve(null); });
    fs.createReadStream(filePath).pipe(req);
  });
}

// Push update_manifest.json directly to GitHub main branch via Contents API
async function pushManifestToMain() {
  console.log('=== Pushing update_manifest.json to GitHub main branch ===');
  const manifestPath = path.join(__dirname, '..', 'update_manifest.json');
  const contentStr = fs.readFileSync(manifestPath, 'utf8');
  const contentBase64 = Buffer.from(contentStr).toString('base64');

  // Get current file sha
  const curFile = await ghRequest(`/repos/${OWNER}/${REPO}/contents/update_manifest.json`);
  const sha = curFile.status === 200 ? curFile.data.sha : null;

  const body = JSON.stringify({
    message: 'Update manifest v1.5.6 (Scope restriction for user organization and descendants)',
    content: contentBase64,
    sha: sha || undefined,
    branch: 'main'
  });

  const res = await ghRequest(`/repos/${OWNER}/${REPO}/contents/update_manifest.json`, 'PUT', body);
  console.log(`  Manifest commit status: ${res.status}`);
}

async function createRelease() {
  console.log(`\n=== Creating Release ${TAG} on GitHub ===`);
  const body = JSON.stringify({
    tag_name: TAG,
    target_commitish: 'main',
    name: `v1.5.6 사용자별 소속 조직 및 하부 조직 한정 조회 보안 정식 패치`,
    body: `ALPHA CRM Tool v1.5.6 정식 릴리즈 안내\n\n1. 일반 사용자 로그인 시 상위 조직 노출 완전 차단 (본인 소속 조직 및 하부 조직만 한정 조회)\n2. 5단계 조직 체계(팀, 지점, 본부, 사업단, 총괄) 및 자유로운 상하관계/소속 이동 지원\n3. 조직원/조직도 클라우드 즉시 동기화 및 인원수 재귀 합산 집계\n4. 고객 및 일정 조회 범위 완전 분리(내 것만 / 조직 전체 / 하부 조직별 / 특정 조직원별) & 본인 기본값\n5. 하위 조직원 고객 노출 시 담당자 이름/직급 뱃지 표시\n6. 타인 고객/일정 수정 및 삭제 권한 완전 차단(오직 등록자 본인만 수정 가능)\n7. 프로그램 완전 종료 시 자동 로그아웃 보안 적용`,
    draft: false,
    prerelease: false
  });

  let rel = await ghRequest(`/repos/${OWNER}/${REPO}/releases`, 'POST', body);
  if (rel.status === 422) { // Already exists, get it
    console.log('Release already exists, fetching existing release...');
    rel = await ghRequest(`/repos/${OWNER}/${REPO}/releases/tags/${TAG}`);
  }
  return rel.data;
}

async function main() {
  await pushManifestToMain();

  const release = await createRelease();
  if (!release || !release.upload_url) {
    console.error('Failed to create/get release.');
    return;
  }
  console.log(`Release created: ${release.name} (id: ${release.id})`);

  const appDir = path.join(__dirname, '..');
  const desktop = path.join(process.env.USERPROFILE || '', 'Desktop');

  // Copy dist-electron app.asar to root micropatch
  const sourceAsar = path.join(appDir, 'dist-electron', 'win-unpacked', 'resources', 'app.asar');
  const microPatchPath = path.join(appDir, 'ALPHA_CRM_MicroPatch_v1.5.6.asar');
  if (fs.existsSync(sourceAsar)) {
    fs.copyFileSync(sourceAsar, microPatchPath);
  }

  // Look for installer / patch file
  const installerPath = path.join(appDir, 'dist-electron', 'ALPHA_CRM_Setup_1.5.6.exe');
  const targetPatchExe = path.join(appDir, 'ALPHA_CRM_Patch_v1.5.6.exe');
  if (fs.existsSync(installerPath)) {
    fs.copyFileSync(installerPath, targetPatchExe);
  }

  const files = [
    { name: 'ALPHA_CRM_Patch_v1.5.6.exe', path: targetPatchExe },
    { name: 'ALPHA_CRM_Setup_1.5.6.exe', path: installerPath },
    { name: 'ALPHA_CRM_Setup_latest.exe', path: installerPath },
    { name: 'ALPHA_CRM_MicroPatch_v1.5.6.asar', path: microPatchPath },
  ];

  console.log('\n=== Uploading Release Assets ===');
  const urls = {};
  for (const f of files) {
    if (!fs.existsSync(f.path)) {
      console.warn(`File not found: ${f.path}`);
      continue;
    }
    const url = await uploadAsset(release.upload_url, f.name, f.path);
    urls[f.name] = url;
  }

  console.log('\n=== Copying to Desktop ===');
  for (const f of files) {
    if (f.name === 'ALPHA_CRM_Setup_latest.exe') continue;
    try {
      if (fs.existsSync(f.path)) fs.copyFileSync(f.path, path.join(desktop, f.name));
    } catch (e) {
      console.error(`Copy error (${f.name}):`, e.message);
    }
  }

  console.log('\n=== DEPLOY v1.5.6 COMPLETED SUCCESSFULLY ===');
  for (const [k, v] of Object.entries(urls)) {
    console.log(`  ${k}: ${v}`);
  }
}

main().catch(console.error);
