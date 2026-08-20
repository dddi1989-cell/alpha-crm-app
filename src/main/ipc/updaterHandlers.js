const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { fetchServerUpdateInfo, smartDownloadFile, executeReliableUpdateScript, getGitHubConfig, saveGitHubConfig } = require('../services/updaterService');

function registerUpdaterHandlers(mainWindow, triggerDualBackup) {
  ipcMain.handle('system:check-for-updates', async (event, userInfo) => {
    return await fetchServerUpdateInfo(userInfo);
  });

  ipcMain.handle('system:download-and-apply-update', async (event, targetDownloadUrl) => {
    let downloadUrl = targetDownloadUrl;
    if (!downloadUrl) {
      const info = await fetchServerUpdateInfo();
      downloadUrl = info?.downloadUrl;
    }

    if (!downloadUrl) {
      return { success: false, error: '서버에서 다운로드 패치 URL을 불러올 수 없습니다. 인터넷 네트워크 연결을 확인하세요.' };
    }

    try {
      triggerDualBackup();

      const tempDir = app.getPath('temp');
      const downloadedPath = path.join(tempDir, `ALPHA_CRM_Update_${Date.now()}.tmp`);

      console.log(`[Online-Update] Downloading server patch from ${downloadUrl}...`);
      
      await smartDownloadFile(downloadUrl, downloadedPath, (progress) => {
        try {
          if (event?.sender && !event.sender.isDestroyed()) {
            event.sender.send('system:update-progress', progress);
          }
        } catch (e) {}
      });

      const fileSize = fs.statSync(downloadedPath).size;
      console.log(`[Online-Update] Verified server patch (${fileSize} bytes) downloaded to ${downloadedPath}`);

      let isExe = false;
      if (fs.existsSync(downloadedPath)) {
        const buf = Buffer.alloc(4);
        const fd = fs.openSync(downloadedPath, 'r');
        fs.readSync(fd, buf, 0, 4, 0);
        fs.closeSync(fd);
        if (buf[0] === 0x4D && buf[1] === 0x5A) {
          isExe = true;
        }
      }

      const targetAsarPath = process.resourcesPath ? path.join(process.resourcesPath, 'app.asar') : null;
      const appExePath = process.execPath;

      if (!isExe) {
        executeReliableUpdateScript({
          sourcePath: downloadedPath,
          targetAsarPath,
          appExePath,
          isExeInstaller: false,
          removeSourceAfterCopy: true
        });

        setTimeout(() => {
          app.exit(0);
        }, 1200);

        return { success: true };
      } else {
        const finalExePath = path.join(tempDir, `ALPHA_CRM_Setup_Update_${Date.now()}.exe`);
        fs.renameSync(downloadedPath, finalExePath);

        executeReliableUpdateScript({
          sourcePath: finalExePath,
          isExeInstaller: true
        });

        setTimeout(() => {
          app.exit(0);
        }, 1200);

        return { success: true };
      }
    } catch (err) {
      console.error('Update apply error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('system:get-github-config', async () => {
    return { success: true, config: getGitHubConfig() };
  });

  ipcMain.handle('system:set-github-config', async (event, config) => {
    const saved = saveGitHubConfig(config);
    return { success: !!saved, config: saved };
  });

  ipcMain.handle('system:test-github-connection', async (event, config) => {
    const owner = (config?.owner || 'dddi1989-cell').trim();
    const repo = (config?.repo || 'alpha-crm-app').trim();
    const branch = (config?.branch || 'main').trim();

    saveGitHubConfig({ owner, repo, branch });

    const fetchJsonTest = (url) => new Promise((resolve, reject) => {
      const client = url.startsWith('https://') ? https : http;
      const req = client.get(url, { headers: { 'User-Agent': 'ALPHA-CRM-App-Updater' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return fetchJsonTest(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP Status ${res.statusCode} (${res.statusMessage})`));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
    });

    const manifestUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/update_manifest.json`;
    const releasesUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

    let manifestRes = null;
    let releaseRes = null;
    let manifestErr = null;
    let releaseErr = null;

    try { manifestRes = await fetchJsonTest(manifestUrl); } catch (e) { manifestErr = e.message; }
    try { releaseRes = await fetchJsonTest(releasesUrl); } catch (e) { releaseErr = e.message; }

    const isConnected = !!(manifestRes || releaseRes);

    if (isConnected) {
      return {
        success: true,
        message: `✅ 깃허브 저장소 (${owner}/${repo}) 연결 성공 (HTTP 200 OK)!`,
        manifest: manifestRes,
        release: releaseRes
      };
    } else {
      return {
        success: false,
        message: `❌ 깃허브 저장소 (${owner}/${repo}) 연결 실패: Manifest (${manifestErr}), Release API (${releaseErr})`,
        manifestError: manifestErr,
        releaseError: releaseErr
      };
    }
  });
}

module.exports = {
  registerUpdaterHandlers
};
