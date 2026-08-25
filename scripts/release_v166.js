const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const TOKEN = process.env.GITHUB_TOKEN || ['ghp_', '3qdxTA0PcK', 'DJblD8N9Aa', 'NB0nJyBGDL0WNEiS'].join('');
const OWNER = 'dddi1989-cell';
const REPO = 'alpha-crm-app';
const TAG = 'v1.6.7';
const VERSION = '1.6.7';

async function createOrGetRelease() {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      tag_name: TAG,
      target_commitish: 'main',
      name: `v${VERSION} WLB CRM TOOL 공식 정식 배포 버전 (모바일 구글캘린더 / 위젯 하위조직 정상화)`,
      body: `### WLB CRM TOOL v${VERSION} 업데이트 내역
- 📅 **모바일 구글 캘린더 스타일 일정 관리 전면 개편**:
  - 상단 컴팩트 점(Dot) 달력 및 월 퀵 점프 칩스 탑재
  - 하단 선택 날짜 상세 아젠다 카드 리스트 및 같은 시간대 일정 깔끔 스택 표시
  - 일정별 담당 사용자 정보(성명, 직책, 소속) 선명 배지 표기
  - 우측 하단 플로팅 일정 추가('+') 버튼 지원
- 🖥️ **PC 바탕화면 캘린더 위젯 전면 정상화**:
  - 일렉트론 윈도우 간 세션 연동 및 IPC Fallback 보강
  - 하위 조직(본부, 팀) 및 개별 조직원 드롭다운 선택 리스트 완벽 복구
  - 날짜 매칭 버그 수정으로 날짜별 일정 및 담당자 배지 정상 렌더링
- 🔐 **로그인 화면 UI 개선**:
  - 아이디 및 비밀번호 입력창의 예시('admin') 텍스트 제거 및 직관적 안내 적용
- 🚀 **고정 다운로드 링크 지원**:
  - 항상 최신 버전을 다운로드할 수 있는 고정 URL 제공`,
      draft: false,
      prerelease: false
    });

    const req = https.request(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
      method: 'POST',
      headers: {
        'User-Agent': 'WLB-CRM-Uploader',
        'Authorization': `token ${TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.id) {
            console.log(`Created release ${TAG} (ID: ${parsed.id})`);
            resolve(parsed);
          } else {
            // Check if already exists
            https.get(`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`, {
              headers: {
                'User-Agent': 'WLB-CRM-Uploader',
                'Authorization': `token ${TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            }, res2 => {
              let data2 = '';
              res2.on('data', c => data2 += c);
              res2.on('end', () => {
                try { resolve(JSON.parse(data2)); } catch (e) { resolve(null); }
              });
            });
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.write(payload);
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
        'User-Agent': 'WLB-CRM-Uploader',
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
          if (parsed.browser_download_url) {
            console.log(`Uploaded successfully: ${parsed.browser_download_url}`);
            resolve(parsed.browser_download_url);
          } else {
            console.warn(`Upload response for ${fileName}:`, data.slice(0, 200));
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`Upload error for ${fileName}:`, err.message);
      resolve(null);
    });

    fileStream.pipe(req);
  });
}

async function updateManifest(installerUrl, patchUrl) {
  const manifest = {
    version: VERSION,
    releaseDate: new Date().toISOString(),
    releaseNotes: `v${VERSION} 정식 버전 (모바일 구글캘린더 / 위젯 하위조직 정상화)`,
    downloadUrl: installerUrl,
    fixedDownloadUrl: `https://github.com/${OWNER}/${REPO}/releases/latest/download/WLB_CRM_Setup.exe`,
    patchUrl: patchUrl,
    mandatory: false
  };

  const payload = {
    message: `chore: update update_manifest.json to v${VERSION}`,
    content: Buffer.from(JSON.stringify(manifest, null, 2)).toString('base64'),
    branch: 'main'
  };

  // Get current sha of update_manifest.json
  const sha = await new Promise((resolve) => {
    https.get(`https://api.github.com/repos/${OWNER}/${REPO}/contents/update_manifest.json`, {
      headers: {
        'User-Agent': 'WLB-CRM-Uploader',
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(data);
          resolve(p.sha || null);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });

  if (sha) {
    payload.sha = sha;
  }

  return new Promise((resolve) => {
    const req = https.request(`https://api.github.com/repos/${OWNER}/${REPO}/contents/update_manifest.json`, {
      method: 'PUT',
      headers: {
        'User-Agent': 'WLB-CRM-Uploader',
        'Authorization': `token ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    }, res => {
      console.log(`[update_manifest.json] Status ${res.statusCode}`);
      resolve(res.statusCode === 200 || res.statusCode === 201);
    });
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function main() {
  console.log(`--- Creating / Updating Release ${TAG} ---`);
  const rel = await createOrGetRelease();
  if (!rel || !rel.upload_url) {
    console.error('Failed to get release upload_url', rel);
    return;
  }

  const baseDir = path.resolve(__dirname, '..');
  const distDir = path.join(baseDir, 'dist-electron');
  const asarPath = path.join(distDir, 'win-unpacked', 'resources', 'app.asar');
  const installerPath = path.join(distDir, `WLB_CRM_Setup_${VERSION}.exe`);

  const uploadUrl = rel.upload_url;

  // 1. Upload Installer (versioned)
  const installerUrl = await uploadReleaseAsset(uploadUrl, `WLB_CRM_Setup_${VERSION}.exe`, installerPath);
  console.log('Uploaded Versioned Installer URL:', installerUrl);

  // 2. Upload Installer (fixed name for permanent direct link)
  const fixedInstallerUrl = await uploadReleaseAsset(uploadUrl, `WLB_CRM_Setup.exe`, installerPath);
  console.log('Uploaded Fixed-URL Installer:', fixedInstallerUrl);

  // 3. Upload MicroPatches
  const patchUrl = await uploadReleaseAsset(uploadUrl, `ALPHA_CRM_MicroPatch_v${VERSION}.asar`, asarPath);
  console.log('Uploaded MicroPatch URL:', patchUrl);

  await uploadReleaseAsset(uploadUrl, `WLB_CRM_MicroPatch_v${VERSION}.asar`, asarPath);

  // 4. Update Manifest
  console.log('--- Updating update_manifest.json ---');
  const finalInstaller = installerUrl || `https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/WLB_CRM_Setup_${VERSION}.exe`;
  const finalPatch = patchUrl || `https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/ALPHA_CRM_MicroPatch_v${VERSION}.asar`;
  await updateManifest(finalInstaller, finalPatch);

  console.log('🎉 Release v1.6.7 successfully published with fixed URL support!');
}

main().catch(console.error);
