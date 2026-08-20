const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { getDb, closeDb, initDatabase, getBackupDirectory, getDbPath } = require('./database');

let rollbackFlag = false;

function getReportStorageDirectory() {
  const backupDir = getBackupDirectory();
  const reportsDir = path.join(path.dirname(backupDir), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  return reportsDir;
}

function calculateElapsedMonths(startDateStr) {
  if (!startDateStr) return null;
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  
  let totalMonths = years * 12 + months + 1;
  return totalMonths > 0 ? totalMonths : 1;
}

function didRollbackOccur() {
  return rollbackFlag;
}

function clearRollbackFlag() {
  rollbackFlag = false;
}

function checkStartupRollback() {
  try {
    const backupDir = getBackupDirectory();
    const lockFilePath = path.join(backupDir, 'dirty_shutdown.lock');
    if (fs.existsSync(lockFilePath)) {
      rollbackFlag = true;
      try { fs.unlinkSync(lockFilePath); } catch (e) {}
    } else {
      try { fs.writeFileSync(lockFilePath, new Date().toISOString(), 'utf8'); } catch (e) {}
    }
  } catch (err) {
    // Ignore lockfile errors
  }
}

function markCleanExit() {
  try {
    const backupDir = getBackupDirectory();
    const lockFilePath = path.join(backupDir, 'dirty_shutdown.lock');
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath);
    }
  } catch (err) {
    // Ignore file deletion errors on exit
  }
}

function exportCustomersCsv(db, csvPath) {
  const query = `
    SELECT c.*, r.name as referrer_name
    FROM customers c
    LEFT JOIN customers r ON c.referrer_id = r.id
    ORDER BY c.id ASC
  `;
  const customers = db.prepare(query).all();

  const headers = ['ID', '이름', '이메일', '전화번호', '생년월일', '소개자', '가입 보험사 및 가입일자(경과월수) / 내역', '보장분석PDF', '보장분석엑셀', '상태', '상담메모', '등록일자'];
  const rows = customers.map(c => {
    let insuranceSummary = '';
    let insurancesList = [];
    if (c.insurances) {
      try {
        insurancesList = typeof c.insurances === 'string' ? JSON.parse(c.insurances) : c.insurances;
      } catch (e) {
        insurancesList = [];
      }
    }

    if (Array.isArray(insurancesList) && insurancesList.length > 0) {
      insuranceSummary = insurancesList.map(item => {
        const sDate = item.startDate || item.start_date || '';
        const eDate = item.endDate || item.end_date || '';
        const elapsed = calculateElapsedMonths(sDate);
        const dateStr = sDate ? ` (가입일: ${sDate}${elapsed ? `, ${elapsed}개월차` : ''}${eDate ? `, 만기: ${eDate}` : ''})` : '';
        return `[${item.provider || '미지정'}${dateStr}] ${item.details || ''}`;
      }).join(' | ');
    } else if (c.insurance_provider || c.insurance_details) {
      insuranceSummary = `[${c.insurance_provider || ''}] ${c.insurance_details || ''}`;
    }

    return [
      c.id,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.birth_date || '').replace(/"/g, '""')}"`,
      `"${(c.referrer_name || '').replace(/"/g, '""')}"`,
      `"${insuranceSummary.replace(/"/g, '""')}"`,
      `"${(c.report_pdf_path ? path.basename(c.report_pdf_path) : '').replace(/"/g, '""')}"`,
      `"${(c.report_excel_path ? path.basename(c.report_excel_path) : '').replace(/"/g, '""')}"`,
      `"${(c.status || '').replace(/"/g, '""')}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
      `"${(c.created_at || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(csvPath, csvContent, 'utf8');
}

function exportSchedulesCsv(db, csvPath) {
  const query = `
    SELECT s.*, c.name as customer_name
    FROM schedules s
    LEFT JOIN customers c ON s.customer_id = c.id
    ORDER BY s.scheduled_at ASC
  `;
  const schedules = db.prepare(query).all();

  const headers = ['ID', '일정제목', '상세설명', '관련고객', '일시', '알림설정(분전)', '상태', '분류', '등록일자'];
  const rows = schedules.map(s => [
    s.id,
    `"${(s.title || '').replace(/"/g, '""')}"`,
    `"${(s.description || '').replace(/"/g, '""')}"`,
    `"${(s.customer_name || '').replace(/"/g, '""')}"`,
    `"${(s.scheduled_at || '').replace(/"/g, '""')}"`,
    s.reminder_offset_minutes || 0,
    `"${(s.status || '').replace(/"/g, '""')}"`,
    `"${(s.category_type || '').replace(/"/g, '""')}"`,
    `"${(s.created_at || '').replace(/"/g, '""')}"`
  ].join(','));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(csvPath, csvContent, 'utf8');
}

async function performDualBackup(mainWindow = null, targetExportZipPath = null) {
  const db = getDb();
  const backupDir = getBackupDirectory();
  const reportsDir = getReportStorageDirectory();

  const backupDbPath = path.join(backupDir, 'backup.db');
  const tempBackupDbPath = path.join(backupDir, 'backup.db.tmp');
  const csvCustomersPath = path.join(backupDir, 'backup_customers.csv');
  const csvSchedulesPath = path.join(backupDir, 'backup_schedules.csv');
  const autoZipPath = path.join(backupDir, 'full_backup.zip');

  try {
    // 1. Asynchronous WAL Backup to temporary SQLite DB
    if (fs.existsSync(tempBackupDbPath)) {
      try { fs.unlinkSync(tempBackupDbPath); } catch (e) {}
    }

    await db.backup(tempBackupDbPath);
    fs.renameSync(tempBackupDbPath, backupDbPath);

    // 2. Export Customers & Schedules to UTF-8 BOM CSV
    exportCustomersCsv(db, csvCustomersPath);
    exportSchedulesCsv(db, csvSchedulesPath);

    // 3. Create Full ZIP Archive (DB + CSVs + PDF/Excel Reports + Manifest)
    const zip = new AdmZip();
    zip.addLocalFile(backupDbPath, '', 'main.db');
    zip.addLocalFile(csvCustomersPath, '', 'backup_customers.csv');
    zip.addLocalFile(csvSchedulesPath, '', 'backup_schedules.csv');

    // Add registered coverage analysis PDF & Excel report files
    let reportFilesCount = 0;
    if (fs.existsSync(reportsDir)) {
      const reportFiles = fs.readdirSync(reportsDir);
      reportFiles.forEach(fileName => {
        const fullReportPath = path.join(reportsDir, fileName);
        if (fs.statSync(fullReportPath).isFile()) {
          zip.addLocalFile(fullReportPath, 'reports', fileName);
          reportFilesCount++;
        }
      });
    }

    // Add backup manifest metadata
    const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
    const scheduleCount = db.prepare('SELECT COUNT(*) as count FROM schedules').get().count;
    const pkg = require('../../package.json');

    const manifestData = {
      app: 'ALPHA-CRM-App',
      version: pkg.version || '1.4.3',
      createdAt: new Date().toISOString(),
      customerCount,
      scheduleCount,
      reportFilesCount
    };
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifestData, null, 2), 'utf8'));

    // Write to automatic backup zip
    zip.writeZip(autoZipPath);

    // If user requested manual export to a specific location (e.g. Desktop, USB)
    if (targetExportZipPath) {
      zip.writeZip(targetExportZipPath);
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system:backup-completed', {
        timestamp: manifestData.createdAt,
        backupDbPath,
        csvPath: csvCustomersPath,
        zipPath: targetExportZipPath || autoZipPath,
        manifest: manifestData
      });
    }

    return {
      success: true,
      backupDbPath,
      csvCustomersPath,
      csvSchedulesPath,
      zipPath: targetExportZipPath || autoZipPath,
      manifest: manifestData
    };

  } catch (err) {
    rollbackFlag = true;
    if (fs.existsSync(tempBackupDbPath)) {
      try { fs.unlinkSync(tempBackupDbPath); } catch (e) {}
    }
    console.error('Backup error:', err);
    throw err;
  }
}

async function restoreFromBackupFile(selectedFilePath) {
  if (!selectedFilePath || !fs.existsSync(selectedFilePath)) {
    return { success: false, error: '선택한 백업 파일이 존재하지 않습니다.' };
  }

  const ext = path.extname(selectedFilePath).toLowerCase();
  const backupDir = getBackupDirectory();
  const reportsDir = getReportStorageDirectory();
  const tempExtractDir = path.join(appDataTempDir(), `crm_restore_${Date.now()}`);

  let dbToRestore = null;
  let restoredReportsCount = 0;
  let manifestInfo = null;

  try {
    if (ext === '.zip' || ext === '.crmbackup') {
      // 1. Extract ZIP Archive
      fs.mkdirSync(tempExtractDir, { recursive: true });
      const zip = new AdmZip(selectedFilePath);
      zip.extractAllTo(tempExtractDir, true);

      const dbCandidate = path.join(tempExtractDir, 'main.db');
      if (fs.existsSync(dbCandidate)) {
        dbToRestore = dbCandidate;
      } else {
        // Fallback: search for any .db file inside extracted zip
        const files = fs.readdirSync(tempExtractDir);
        const dbFile = files.find(f => f.endsWith('.db'));
        if (dbFile) {
          dbToRestore = path.join(tempExtractDir, dbFile);
        }
      }

      // Check if manifest.json exists
      const manifestPath = path.join(tempExtractDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          manifestInfo = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch (e) {}
      }

      // Restore PDF and Excel report files from reports/ folder in zip
      const zipReportsDir = path.join(tempExtractDir, 'reports');
      if (fs.existsSync(zipReportsDir)) {
        const rFiles = fs.readdirSync(zipReportsDir);
        rFiles.forEach(rf => {
          const srcReport = path.join(zipReportsDir, rf);
          const destReport = path.join(reportsDir, rf);
          if (fs.statSync(srcReport).isFile()) {
            fs.copyFileSync(srcReport, destReport);
            restoredReportsCount++;
          }
        });
      }
    } else if (ext === '.db') {
      dbToRestore = selectedFilePath;
    } else {
      return { success: false, error: '지원되지 않는 백업 파일 형식입니다. (.zip, .crmbackup, .db 파일만 지원)' };
    }

    if (!dbToRestore || !fs.existsSync(dbToRestore)) {
      return { success: false, error: '압축 파일 내에서 복원할 database (.db) 파일을 찾을 수 없습니다.' };
    }

    // 2. Validate SQLite DB integrity and required tables
    const Database = require('better-sqlite3');
    let tempDb = null;
    let isValid = false;
    let errorMessage = '';

    try {
      tempDb = new Database(dbToRestore, { readonly: true, fileMustExist: true });
      const checkResult = tempDb.prepare('PRAGMA quick_check').get();
      const checkVal = checkResult ? Object.values(checkResult)[0] : '';

      if (checkVal !== 'ok') {
        errorMessage = `데이터베이스 무결성 검사 실패 (${checkVal})`;
      } else {
        const tables = tempDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
        const required = ['customers', 'schedules'];
        const missing = required.filter(tbl => !tables.includes(tbl));
        if (missing.length > 0) {
          errorMessage = `필수 테이블 누락: ${missing.join(', ')}`;
        } else {
          isValid = true;
        }
      }
    } catch (valErr) {
      errorMessage = `데이터베이스 구조 오류: ${valErr.message}`;
    } finally {
      if (tempDb) {
        try { tempDb.close(); } catch (e) {}
      }
    }

    if (!isValid) {
      return { success: false, error: errorMessage };
    }

    // 3. Clean Shutdown of active DB & Removal of WAL Files
    closeDb();

    const mainDbPath = getDbPath();
    const mainWalPath = `${mainDbPath}-wal`;
    const mainShmPath = `${mainDbPath}-shm`;

    if (fs.existsSync(mainWalPath)) {
      try { fs.unlinkSync(mainWalPath); } catch (e) {}
    }
    if (fs.existsSync(mainShmPath)) {
      try { fs.unlinkSync(mainShmPath); } catch (e) {}
    }

    // 4. Overwrite main.db with restored DB
    fs.copyFileSync(dbToRestore, mainDbPath);

    // 5. Re-initialize database
    const restoredDb = initDatabase(mainDbPath);

    // Read restored stats
    const customerCount = restoredDb.prepare('SELECT COUNT(*) as count FROM customers').get().count;
    const scheduleCount = restoredDb.prepare('SELECT COUNT(*) as count FROM schedules').get().count;

    // Clean temp extraction folder
    if (fs.existsSync(tempExtractDir)) {
      try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch (e) {}
    }

    return {
      success: true,
      customerCount,
      scheduleCount,
      restoredReportsCount,
      manifest: manifestInfo
    };

  } catch (err) {
    // Attempt database recovery
    try { initDatabase(); } catch (e) {}
    if (fs.existsSync(tempExtractDir)) {
      try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch (e) {}
    }
    console.error('Restore error:', err);
    return { success: false, error: err.message };
  }
}

function appDataTempDir() {
  try {
    const { app } = require('electron');
    return app.getPath('temp');
  } catch (e) {
    return process.env.TEMP || '/tmp';
  }
}

module.exports = {
  performDualBackup,
  restoreFromBackupFile,
  didRollbackOccur,
  clearRollbackFlag,
  checkStartupRollback,
  markCleanExit
};
