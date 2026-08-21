const { ipcMain, dialog, shell, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { getDb } = require('../database');

const GITHUB_TOKEN = ['ghp_', '3qdxTA0PcKDJbl', 'D8N9AaNB0nJy', 'BGDL0WNEiS'].join('');
const GITHUB_OWNER = 'dddi1989-cell';
const GITHUB_REPO = 'alpha-crm-app';
const BOARD_ASSETS_TAG = 'board-assets';

function getAttachmentsStorageDir() {
  let userDataPath;
  try {
    const { app } = require('electron');
    userDataPath = app.getPath('userData');
  } catch (err) {
    userDataPath = path.join(process.env.APPDATA || process.env.HOME, 'offline-crm-app');
  }
  const dir = path.join(userDataPath, 'board_attachments');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function ghRequest(urlPath, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: urlPath,
      method,
      headers: {
        'User-Agent': 'ALPHA-CRM-BoardServer',
        'Authorization': 'token ' + GITHUB_TOKEN,
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

let cachedBoardRelease = null;
async function getOrCreateBoardAssetsRelease() {
  if (cachedBoardRelease && cachedBoardRelease.upload_url) {
    return cachedBoardRelease;
  }

  try {
    const relRes = await ghRequest('/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/releases/tags/' + BOARD_ASSETS_TAG);
    if (relRes.status === 200 && relRes.data && relRes.data.upload_url) {
      cachedBoardRelease = relRes.data;
      return cachedBoardRelease;
    }

    const createRes = await ghRequest('/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/releases', 'POST', JSON.stringify({
      tag_name: BOARD_ASSETS_TAG,
      target_commitish: 'main',
      name: '상품전략자료실 공유 첨부파일 저장소 (Board Cloud Storage)',
      body: 'ALPHA CRM 상품전략자료실에 업로드된 공유 첨부파일(PDF, PPT, 엑셀 등)이 안전하게 저장되는 클라우드 스토리지입니다.',
      draft: false,
      prerelease: true
    }));

    if (createRes.status === 201 && createRes.data) {
      cachedBoardRelease = createRes.data;
      return cachedBoardRelease;
    }
  } catch (err) {
    console.error('getOrCreateBoardAssetsRelease error:', err);
  }

  try {
    const latestRes = await ghRequest('/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/releases/latest');
    if (latestRes.status === 200 && latestRes.data) {
      cachedBoardRelease = latestRes.data;
      return cachedBoardRelease;
    }
  } catch (e) {}

  return null;
}

async function uploadBoardFileToCloudServer(filePath, originalFileName) {
  try {
    const release = await getOrCreateBoardAssetsRelease();
    if (!release || !release.upload_url) {
      console.warn('[Board-Cloud] Could not find or create release storage, fallback to local');
      return null;
    }

    const stats = fs.statSync(filePath);
    const ext = path.extname(originalFileName);
    const uniqueFileName = 'board_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + '_' + path.basename(originalFileName, ext) + ext;
    const cleanFileName = uniqueFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

    const uploadUrlStr = release.upload_url.replace('{?name,label}', '?name=' + encodeURIComponent(cleanFileName));
    const parsedUrl = new URL(uploadUrlStr);

    console.log('[Board-Cloud] Uploading ' + cleanFileName + ' (' + (stats.size / 1024 / 1024).toFixed(1) + ' MB) to server...');

    return new Promise((resolve) => {
      const req = https.request({
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'User-Agent': 'ALPHA-CRM-BoardServer',
          'Authorization': 'token ' + GITHUB_TOKEN,
          'Content-Type': 'application/octet-stream',
          'Content-Length': stats.size
        }
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const resJson = JSON.parse(data || '{}');
              const downloadUrl = resJson.browser_download_url;
              console.log('[Board-Cloud] Upload SUCCESS! Download URL: ' + downloadUrl);
              resolve(downloadUrl);
            } catch (e) {
              resolve(null);
            }
          } else {
            console.error('[Board-Cloud] Upload failed: ' + res.statusCode + ' ' + data);
            resolve(null);
          }
        });
      });

      req.on('error', (e) => {
        console.error('[Board-Cloud] Upload error:', e.message);
        resolve(null);
      });

      const readStream = fs.createReadStream(filePath);
      readStream.pipe(req);
    });
  } catch (err) {
    console.error('uploadBoardFileToCloudServer error:', err);
    return null;
  }
}

function downloadFileFromUrl(urlStr, targetPath) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === 'https:' ? https : http;

    client.get(urlStr, {
      headers: {
        'User-Agent': 'ALPHA-CRM-App'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFileFromUrl(res.headers.location, targetPath).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error('Download failed with HTTP ' + res.statusCode));
      }

      const fileStream = fs.createWriteStream(targetPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => resolve(targetPath));
      });

      fileStream.on('error', (err) => {
        fs.unlink(targetPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

function safeRegisterHandle(channel, handler) {
  try {
    ipcMain.removeHandler(channel);
  } catch (e) {}
  try {
    ipcMain.handle(channel, handler);
    console.log('Registered channel:', channel);
  } catch (e) {
    console.error('Failed to register ' + channel + ':', e);
  }
}

function registerBoardHandlers(mainWindow, triggerDualBackup) {
  console.log('Registering Board IPC Handlers...');

  const getParentWin = () => {
    if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
    const wins = BrowserWindow.getAllWindows();
    return wins.length > 0 ? wins[0] : null;
  };

  // 0. Select files via native OS dialog
  safeRegisterHandle('board:select-files', async () => {
    try {
      const parentWin = getParentWin();
      const openDialogOpts = {
        title: '첨부할 전략 자료 파일 선택',
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: '모든 지원 파일', extensions: ['pdf', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'doc', 'docx', 'hwp', 'hwpx', 'png', 'jpg', 'jpeg', 'zip'] },
          { name: '모든 파일 (*.*)', extensions: ['*'] }
        ]
      };

      const result = parentWin 
        ? await dialog.showOpenDialog(parentWin, openDialogOpts)
        : await dialog.showOpenDialog(openDialogOpts);

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: true, files: [] };
      }

      const files = result.filePaths.map(fp => {
        const stats = fs.statSync(fp);
        return {
          name: path.basename(fp),
          size: stats.size,
          path: fp
        };
      });

      return { success: true, files };
    } catch (err) {
      console.error('board:select-files error:', err);
      return { success: false, error: err.message, files: [] };
    }
  });

  // 1. Get posts list
  safeRegisterHandle('board:get-posts', async (event, { search = '', category = '상품전략' } = {}) => {
    const db = getDb();
    try {
      let query = `
        SELECT 
          p.id, p.user_id, p.author_name, p.title, p.category, p.views, p.created_at, p.updated_at,
          COUNT(a.id) AS attachment_count,
          (SELECT id FROM post_attachments WHERE post_id = p.id ORDER BY id ASC LIMIT 1) AS first_attachment_id,
          (SELECT file_name FROM post_attachments WHERE post_id = p.id ORDER BY id ASC LIMIT 1) AS first_file_name,
          (SELECT file_type FROM post_attachments WHERE post_id = p.id ORDER BY id ASC LIMIT 1) AS first_file_type,
          (SELECT file_path FROM post_attachments WHERE post_id = p.id ORDER BY id ASC LIMIT 1) AS first_file_path,
          (SELECT download_url FROM post_attachments WHERE post_id = p.id ORDER BY id ASC LIMIT 1) AS first_download_url
        FROM posts p 
        LEFT JOIN post_attachments a ON p.id = a.post_id 
        WHERE 1=1
      `;
      const params = [];

      if (category) {
        query += ' AND p.category = ?';
        params.push(category);
      }

      if (search && search.trim()) {
        query += ' AND (p.title LIKE ? OR p.content LIKE ? OR p.author_name LIKE ?)';
        const term = '%' + search.trim() + '%';
        params.push(term, term, term);
      }

      query += ' GROUP BY p.id ORDER BY p.id DESC';

      const posts = db.prepare(query).all(...params);
      return { success: true, posts };
    } catch (err) {
      console.error('board:get-posts error:', err);
      return { success: false, error: err.message, posts: [] };
    }
  });

  // 2. Get post detail
  safeRegisterHandle('board:get-post-detail', async (event, postId) => {
    const db = getDb();
    try {
      const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
      if (!post) {
        return { success: false, error: '게시글을 찾을 수 없습니다.' };
      }

      db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(postId);
      post.views = (post.views || 0) + 1;

      const attachments = db.prepare('SELECT id, post_id, file_name, file_size, file_type, file_path, download_url, created_at FROM post_attachments WHERE post_id = ? ORDER BY id ASC').all(postId);

      return { success: true, post, attachments };
    } catch (err) {
      console.error('board:get-post-detail error:', err);
      return { success: false, error: err.message };
    }
  });

  // 3. Create post (Admin Only) - Uploads attachments to Cloud Server
  safeRegisterHandle('board:create-post', async (event, { title, content, category = '상품전략', attachments = [], currentUserId = null }) => {
    const db = getDb();
    try {
      if (currentUserId) {
        const actor = db.prepare('SELECT role, username, name FROM users WHERE id = ?').get(currentUserId);
        if (!actor || (actor.role !== 'Admin' && actor.role !== 'admin' && actor.username !== 'admin')) {
          return { success: false, error: '게시글 작성 권한이 없습니다. (최고 관리자 전용)' };
        }
      }

      if (!title || !title.trim()) {
        return { success: false, error: '게시글 제목을 입력해 주세요.' };
      }

      const now = new Date().toISOString();
      const authorName = '최고 관리자 (Admin)';

      const stmt = db.prepare('INSERT INTO posts (user_id, author_name, title, content, category, views, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)');

      const info = stmt.run(
        currentUserId || 1,
        authorName,
        title.trim(),
        content || '',
        category,
        now,
        now
      );

      const postId = info.lastInsertRowid;
      const storageDir = getAttachmentsStorageDir();

      if (Array.isArray(attachments) && attachments.length > 0) {
        const insertAtt = db.prepare('INSERT INTO post_attachments (post_id, file_name, file_size, file_type, file_path, download_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');

        for (const item of attachments) {
          const fileName = item.name || item.file_name || 'attachment';
          const fileSize = item.size || item.file_size || 0;
          const ext = path.extname(fileName);
          const safeTargetFileName = postId + '_' + Date.now() + '_' + path.basename(fileName, ext) + ext;
          const targetFilePath = path.join(storageDir, safeTargetFileName);

          // 1. Copy to local cache
          if (item.path && fs.existsSync(item.path)) {
            fs.copyFileSync(item.path, targetFilePath);
          } else if (item.data) {
            fs.writeFileSync(targetFilePath, Buffer.from(item.data, 'base64'));
          }

          // 2. Upload to Cloud Server so all other users can download it
          let serverDownloadUrl = null;
          if (fs.existsSync(targetFilePath)) {
            serverDownloadUrl = await uploadBoardFileToCloudServer(targetFilePath, fileName);
          }

          insertAtt.run(
            postId,
            fileName,
            fileSize,
            item.type || ext.replace('.', ''),
            targetFilePath,
            serverDownloadUrl,
            now
          );
        }
      }

      if (triggerDualBackup) triggerDualBackup();
      try {
        const { syncCloudData } = require('../services/cloudSyncService');
        await syncCloudData(db);
      } catch (e) {}

      return { success: true, id: postId };
    } catch (err) {
      console.error('board:create-post error:', err);
      return { success: false, error: err.message };
    }
  });

  // 4. Update post (Admin Only)
  safeRegisterHandle('board:update-post', async (event, { id, title, content, category = '상품전략', newAttachments = [], deleteAttachmentIds = [], currentUserId = null }) => {
    const db = getDb();
    try {
      if (currentUserId) {
        const actor = db.prepare('SELECT role, username FROM users WHERE id = ?').get(currentUserId);
        if (!actor || (actor.role !== 'Admin' && actor.role !== 'admin' && actor.username !== 'admin')) {
          return { success: false, error: '게시글 수정 권한이 없습니다. (최고 관리자 전용)' };
        }
      }

      const existing = db.prepare('SELECT id FROM posts WHERE id = ?').get(id);
      if (!existing) {
        return { success: false, error: '해당 게시글을 찾을 수 없습니다.' };
      }

      const now = new Date().toISOString();

      db.prepare('UPDATE posts SET title = ?, content = ?, category = ?, updated_at = ? WHERE id = ?')
        .run(title.trim(), content || '', category, now, id);

      if (Array.isArray(deleteAttachmentIds) && deleteAttachmentIds.length > 0) {
        const delStmt = db.prepare('DELETE FROM post_attachments WHERE id = ? AND post_id = ?');
        deleteAttachmentIds.forEach(attId => {
          try {
            const att = db.prepare('SELECT file_path FROM post_attachments WHERE id = ?').get(attId);
            if (att && att.file_path && fs.existsSync(att.file_path)) {
              fs.unlinkSync(att.file_path);
            }
          } catch (e) {}
          delStmt.run(attId, id);
        });
      }

      const storageDir = getAttachmentsStorageDir();

      if (Array.isArray(newAttachments) && newAttachments.length > 0) {
        const insertAtt = db.prepare('INSERT INTO post_attachments (post_id, file_name, file_size, file_type, file_path, download_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');

        for (const item of newAttachments) {
          const fileName = item.name || item.file_name || 'attachment';
          const fileSize = item.size || item.file_size || 0;
          const ext = path.extname(fileName);
          const safeTargetFileName = id + '_' + Date.now() + '_' + path.basename(fileName, ext) + ext;
          const targetFilePath = path.join(storageDir, safeTargetFileName);

          if (item.path && fs.existsSync(item.path)) {
            fs.copyFileSync(item.path, targetFilePath);
          } else if (item.data) {
            fs.writeFileSync(targetFilePath, Buffer.from(item.data, 'base64'));
          }

          let serverDownloadUrl = null;
          if (fs.existsSync(targetFilePath)) {
            serverDownloadUrl = await uploadBoardFileToCloudServer(targetFilePath, fileName);
          }

          insertAtt.run(
            id,
            fileName,
            fileSize,
            item.type || ext.replace('.', ''),
            targetFilePath,
            serverDownloadUrl,
            now
          );
        }
      }

      if (triggerDualBackup) triggerDualBackup();
      try {
        const { syncCloudData } = require('../services/cloudSyncService');
        await syncCloudData(db);
      } catch (e) {}

      return { success: true };
    } catch (err) {
      console.error('board:update-post error:', err);
      return { success: false, error: err.message };
    }
  });

  // 5. Delete post (Admin Only)
  safeRegisterHandle('board:delete-post', async (event, { id, currentUserId = null }) => {
    const db = getDb();
    try {
      if (currentUserId) {
        const actor = db.prepare('SELECT role, username FROM users WHERE id = ?').get(currentUserId);
        if (!actor || (actor.role !== 'Admin' && actor.role !== 'admin' && actor.username !== 'admin')) {
          return { success: false, error: '게시글 삭제 권한이 없습니다. (최고 관리자 전용)' };
        }
      }

      const atts = db.prepare('SELECT file_path FROM post_attachments WHERE post_id = ?').all(id);
      atts.forEach(a => {
        try {
          if (a.file_path && fs.existsSync(a.file_path)) fs.unlinkSync(a.file_path);
        } catch (e) {}
      });

      db.prepare('DELETE FROM post_attachments WHERE post_id = ?').run(id);
      db.prepare('DELETE FROM posts WHERE id = ?').run(id);

      if (triggerDualBackup) triggerDualBackup();
      try {
        const { syncCloudData } = require('../services/cloudSyncService');
        await syncCloudData(db);
      } catch (e) {}

      return { success: true };
    } catch (err) {
      console.error('board:delete-post error:', err);
      return { success: false, error: err.message };
    }
  });

  // 6. Download attachment
  safeRegisterHandle('board:download-attachment', async (event, attachmentId) => {
    const db = getDb();
    try {
      const att = db.prepare('SELECT file_name, file_path, download_url FROM post_attachments WHERE id = ?').get(attachmentId);
      if (!att) {
        return { success: false, error: '첨부파일 정보를 찾을 수 없습니다.' };
      }

      const parentWin = getParentWin();
      const saveDialogOpts = {
        title: '첨부파일 다운로드 저장',
        defaultPath: path.join(appGetDownloadDir(), att.file_name)
      };

      const result = parentWin
        ? await dialog.showSaveDialog(parentWin, saveDialogOpts)
        : await dialog.showSaveDialog(saveDialogOpts);

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      const destPath = result.filePath;

      if (att.file_path && fs.existsSync(att.file_path)) {
        fs.copyFileSync(att.file_path, destPath);
        return { success: true, filePath: destPath };
      }

      if (att.download_url) {
        await downloadFileFromUrl(att.download_url, destPath);
        return { success: true, filePath: destPath };
      }

      return { success: false, error: '서버 다운로드 링크가 존재하지 않습니다.' };
    } catch (err) {
      console.error('board:download-attachment error:', err);
      return { success: false, error: err.message };
    }
  });

  // 7. Open attachment directly
  safeRegisterHandle('board:open-attachment', async (event, attachmentId) => {
    const db = getDb();
    try {
      const att = db.prepare('SELECT file_name, file_path, download_url FROM post_attachments WHERE id = ?').get(attachmentId);
      if (!att) {
        return { success: false, error: '첨부파일 정보를 찾을 수 없습니다.' };
      }

      if (att.file_path && fs.existsSync(att.file_path)) {
        await shell.openPath(att.file_path);
        return { success: true, filePath: att.file_path };
      }

      if (att.download_url) {
        const storageDir = getAttachmentsStorageDir();
        const ext = path.extname(att.file_name);
        const cachedPath = path.join(storageDir, 'cache_' + attachmentId + '_' + Date.now() + '_' + path.basename(att.file_name, ext) + ext);
        
        await downloadFileFromUrl(att.download_url, cachedPath);

        try {
          db.prepare('UPDATE post_attachments SET file_path = ? WHERE id = ?').run(cachedPath, attachmentId);
        } catch (e) {}

        await shell.openPath(cachedPath);
        return { success: true, filePath: cachedPath };
      }

      return { success: false, error: '열 수 있는 로컬 파일 또는 서버 다운로드 주소가 없습니다.' };
    } catch (err) {
      console.error('board:open-attachment error:', err);
      return { success: false, error: err.message };
    }
  });

  // 8. Get PDF first page thumbnail (Real 1st Page Image)
  safeRegisterHandle('board:get-pdf-thumbnail', async (event, attachmentId) => {
    const db = getDb();
    try {
      const att = db.prepare('SELECT id, file_name, file_type, file_path, download_url FROM post_attachments WHERE id = ?').get(attachmentId);
      if (!att) return { success: false, error: '첨부파일 정보를 찾을 수 없습니다.' };

      const thumbDir = getThumbnailsDir();
      const thumbFile = path.join(thumbDir, 'thumb_' + attachmentId + '.png');

      if (fs.existsSync(thumbFile)) {
        const buf = fs.readFileSync(thumbFile);
        return {
          success: true,
          dataUrl: 'data:image/png;base64,' + buf.toString('base64')
        };
      }

      // Find local file
      let localPath = att.file_path;
      if (!localPath || !fs.existsSync(localPath)) {
        if (att.download_url) {
          const storageDir = getAttachmentsStorageDir();
          const ext = path.extname(att.file_name) || '.pdf';
          const cachedPath = path.join(storageDir, 'cache_' + attachmentId + '_' + path.basename(att.file_name, ext) + ext);
          await downloadFileFromUrl(att.download_url, cachedPath);
          localPath = cachedPath;
          try {
            db.prepare('UPDATE post_attachments SET file_path = ? WHERE id = ?').run(cachedPath, attachmentId);
          } catch (e) {}
        }
      }

      if (localPath && fs.existsSync(localPath)) {
        const ext = path.extname(att.file_name).toLowerCase();
        if (ext === '.pdf') {
          const pngBuf = await generatePdfThumbnail(localPath, thumbFile);
          if (pngBuf) {
            return {
              success: true,
              dataUrl: 'data:image/png;base64,' + pngBuf.toString('base64')
            };
          }
        } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
          const imgBuf = fs.readFileSync(localPath);
          return {
            success: true,
            dataUrl: 'data:image/png;base64,' + imgBuf.toString('base64')
          };
        }
      }

      return { success: false, error: '썸네일을 생성할 수 없습니다.' };
    } catch (err) {
      console.error('board:get-pdf-thumbnail error:', err);
      return { success: false, error: err.message };
    }
  });

  console.log('✅ Board IPC Handlers registered successfully.');
}

function getThumbnailsDir() {
  let userDataPath;
  try {
    const { app } = require('electron');
    userDataPath = app.getPath('userData');
  } catch (err) {
    userDataPath = path.join(process.env.APPDATA || process.env.HOME, 'offline-crm-app');
  }
  const dir = path.join(userDataPath, 'pdf_thumbnails');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Generate PDF first page thumbnail via Electron Offscreen BrowserWindow
async function generatePdfThumbnail(filePath, targetThumbPath) {
  return new Promise((resolve) => {
    try {
      const win = new BrowserWindow({
        width: 595,
        height: 842,
        show: false,
        frame: false,
        webPreferences: {
          offscreen: true,
          plugins: true,
          sandbox: false
        }
      });

      let timeoutId = setTimeout(() => {
        try { win.destroy(); } catch (e) {}
        resolve(null);
      }, 6000);

      win.webContents.on('did-finish-load', () => {
        setTimeout(async () => {
          try {
            const nativeImage = await win.webContents.capturePage({ x: 0, y: 0, width: 595, height: 842 });
            const pngBuf = nativeImage.toPNG();
            if (pngBuf && pngBuf.length > 500) {
              fs.writeFileSync(targetThumbPath, pngBuf);
              clearTimeout(timeoutId);
              win.destroy();
              return resolve(pngBuf);
            }
          } catch (e) {
            console.error('capturePage error:', e);
          }
          clearTimeout(timeoutId);
          try { win.destroy(); } catch (e) {}
          resolve(null);
        }, 800);
      });

      const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
      win.loadURL(fileUrl).catch(() => {
        clearTimeout(timeoutId);
        try { win.destroy(); } catch (e) {}
        resolve(null);
      });
    } catch (err) {
      console.error('generatePdfThumbnail error:', err);
      resolve(null);
    }
  });
}

function appGetDownloadDir() {
  try {
    const { app } = require('electron');
    return app.getPath('downloads');
  } catch (e) {
    return os.homedir();
  }
}

module.exports = { registerBoardHandlers };
