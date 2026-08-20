const { ipcMain, dialog, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { getDb, getDbPath, getBackupDirectory, initDatabase } = require('../database');
const { performDualBackup, restoreFromBackupFile, didRollbackOccur, clearRollbackFlag } = require('../backupEngine');
const { loadCloudAccounts, loadCloudData, syncCloudAccounts, syncCloudData } = require('../services/cloudSyncService');

function registerSystemHandlers(mainWindow, triggerDualBackup) {
  ipcMain.handle('system:open-url', async (event, url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      shell.openExternal(url);
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('system:sync-cloud-data', async () => {
    const db = getDb();
    try {
      await Promise.all([
        loadCloudAccounts(db),
        loadCloudData(db)
      ]);
      syncCloudAccounts(db);
      syncCloudData(db);
      return { success: true, message: '클라우드 동기화가 성공적으로 완료되었습니다.' };
    } catch (err) {
      console.error('sync-cloud-data error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('system:get-app-version', async () => {
    return require('../../../package.json').version || '1.5.6';
  });

  ipcMain.handle('system:get-info', async () => {
    const db = getDb();
    const customersCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
    const schedulesCount = db.prepare('SELECT COUNT(*) as count FROM schedules').get().count;
    const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

    return {
      version: require('../../../package.json').version || '1.5.6',
      dbPath: getDbPath(),
      backupPath: getBackupDirectory(),
      stats: {
        customers: customersCount,
        schedules: schedulesCount,
        users: usersCount
      }
    };
  });

  ipcMain.handle('system:trigger-backup', async () => {
    try {
      const results = await performDualBackup(mainWindow);
      return { success: true, backups: results };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('system:export-backup', async () => {
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const defaultFileName = `ALPHA_CRM_Backup_${dateStr}.db`;

      const result = await dialog.showSaveDialog(mainWindow, {
        title: '데이터베이스 백업 내보내기',
        defaultPath: path.join(app.getPath('documents'), defaultFileName),
        filters: [
          { name: 'SQLite Database', extensions: ['db', 'sqlite'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      const db = getDb();
      await db.backup(result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('system:restore-db', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: '복원할 데이터베이스 파일 선택',
        defaultPath: getBackupDirectory(),
        filters: [
          { name: 'SQLite Database / Backup', extensions: ['db', 'sqlite', 'bak'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const backupFilePath = result.filePaths[0];
      const res = await restoreFromBackupFile(backupFilePath, mainWindow);
      return res;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('system:get-rollback-status', async () => {
    return { didRollback: didRollbackOccur() };
  });

  ipcMain.handle('system:clear-rollback-flag', async () => {
    clearRollbackFlag();
    return { success: true };
  });

  ipcMain.handle('system:reset-data', async () => {
    const db = getDb();
    try {
      db.prepare('DELETE FROM schedules').run();
      db.prepare('DELETE FROM customers').run();
      db.prepare('DELETE FROM users WHERE role NOT IN ("admin", "Admin")').run();
      triggerDualBackup();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('system:get-widget-status', async () => {
    return { isWidgetOpen: false };
  });

  ipcMain.handle('system:set-always-on-top', async (event, isTop) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(!!isTop);
      return { success: true, alwaysOnTop: mainWindow.isAlwaysOnTop() };
    }
    return { success: false };
  });

  ipcMain.handle('system:set-window-opacity', async (event, opacity) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const val = Math.max(0.2, Math.min(1.0, parseFloat(opacity) || 1.0));
      mainWindow.setOpacity(val);
      return { success: true, opacity: val };
    }
    return { success: false };
  });
}

module.exports = {
  registerSystemHandlers
};
