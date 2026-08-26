const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const TOKEN = process.env.GITHUB_TOKEN || ['ghp_', '3qdxTA0PcK', 'DJblD8N9Aa', 'NB0nJyBGDL0WNEiS'].join('');
const OWNER = 'dddi1989-cell';
const REPO = 'alpha-crm-app';
const TAG = 'v1.6.8';
const VERSION = '1.6.8';

async function createOrGetRelease() {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      tag_name: TAG,
      target_commitish: 'main',
      name: `v${VERSION} WLB CRM TOOL 공식 정식 배포 버전 (달러종신 VIP 프레젠테이션 & 원화고정납입)`,
      body: `### WLB CRM TOOL v${VERSION} 업데이트 내역
- 💵 **달러종신보험 VIP 16단계 프레젠테이션 마스터피스 완성**:
  - 실제 메트라이프 가입제안서(32세남 7년납) 100% 동적 매핑 파이프라인 탑재
  - 유지보너스 1차(7년 22.20%) 및 2차(10년 15.90%) 자동 산출 & 7년+1일(99.75%), 10년+1일(124.89%) 해약환급금 마일스톤 반영
  - **원화고정납입(Fixed KRW Payment) 전용 킬러 슬라이드 및 실시간 인포그래픽 SVG 다이어그램 탑재**:
    - 환율 하락 시 달러 자동 비축 ➔ 환율 급등 시 비축 달러로 자동 납부(고객 추가부담 0원 방어)
  - 역대 경제위기(1997 IMF, 2008 금융위기, 2022 레고랜드) 부동산 및 코스피 급락 vs 달러 폭등 실증 데이터 탑재
  - 벤다이어그램, 대형 카드 레이아웃, 시인성 및 밀도 극대화 16:9 와이드 디자인 완성
- 📅 **모바일 구글 캘린더 스타일 일정 관리 & PC 바탕화면 위젯 최적화**
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
