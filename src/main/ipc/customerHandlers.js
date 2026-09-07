const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { getDb, initDatabase, getBackupDirectory } = require('../database');
const { checkUpcomingSchedules } = require('../notification');
const { syncCloudData } = require('../services/cloudSyncService');
const { normalizeCustomerInsurances, extractTextFromPdfBuffer, parseInsurancesFromReportText, parseInsurancesFromExcelBuffer } = require('../services/documentParserService');
const { getAccessibleUsersForUser } = require('./authHandlers');

function getReportStorageDirectory() {
  const backupDir = getBackupDirectory();
  const reportsDir = path.join(path.dirname(backupDir), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  return reportsDir;
}

function copyReportToInternalStorage(srcFilePath) {
  if (!srcFilePath || typeof srcFilePath !== 'string') return '';
  const reportsDir = getReportStorageDirectory();
  const normalizedSrc = path.normalize(srcFilePath);
  const normalizedReportsDir = path.normalize(reportsDir);
  if (normalizedSrc.startsWith(normalizedReportsDir)) {
    return srcFilePath;
  }

  if (!fs.existsSync(srcFilePath)) return srcFilePath;

  try {
    const ext = path.extname(srcFilePath);
    const timeStamp = Date.now();
    const safeBaseName = path.basename(srcFilePath, ext).replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
    const newFileName = `report_${timeStamp}_${safeBaseName}${ext}`;
    const targetPath = path.join(reportsDir, newFileName);
    fs.copyFileSync(srcFilePath, targetPath);
    return targetPath;
  } catch (err) {
    console.error('Error copying report to internal storage:', err);
    return srcFilePath;
  }
}

function findOrRecoverReportFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;

  if (fs.existsSync(filePath)) {
    return copyReportToInternalStorage(filePath);
  }

  const reportsDir = getReportStorageDirectory();
  const baseName = path.basename(filePath);
  const ext = path.extname(filePath);
  const nameWithoutExt = path.basename(filePath, ext);

  if (fs.existsSync(reportsDir)) {
    const internalFiles = fs.readdirSync(reportsDir);
    const matchedInternal = internalFiles.find(f => f === baseName || f.includes(nameWithoutExt));
    if (matchedInternal) {
      return path.join(reportsDir, matchedInternal);
    }
  }

  try {
    const homeDir = require('os').homedir();
    const searchLocations = [
      path.join(homeDir, 'Desktop'),
      path.join(homeDir, 'Downloads'),
      path.join(homeDir, 'Documents')
    ];

    for (const loc of searchLocations) {
      if (fs.existsSync(loc)) {
        const locFiles = fs.readdirSync(loc);
        const matched = locFiles.find(f => f === baseName || f.includes(nameWithoutExt));
        if (matched) {
          return copyReportToInternalStorage(path.join(loc, matched));
        }
      }
    }
  } catch (e) {}

  return null;
}

function migrateExistingCustomerReportFiles(db) {
  try {
    const customersWithReports = db.prepare('SELECT id, report_pdf_path, report_excel_path FROM customers WHERE (report_pdf_path IS NOT NULL AND report_pdf_path != "") OR (report_excel_path IS NOT NULL AND report_excel_path != "")').all();
    const updateStmt = db.prepare('UPDATE customers SET report_pdf_path = ?, report_excel_path = ? WHERE id = ?');

    for (const cust of customersWithReports) {
      let updatedPdf = cust.report_pdf_path;
      let updatedExcel = cust.report_excel_path;
      let changed = false;

      if (cust.report_pdf_path) {
        const recoveredPdf = findOrRecoverReportFile(cust.report_pdf_path);
        if (recoveredPdf && recoveredPdf !== cust.report_pdf_path) {
          updatedPdf = recoveredPdf;
          changed = true;
        }
      }

      if (cust.report_excel_path) {
        const recoveredExcel = findOrRecoverReportFile(cust.report_excel_path);
        if (recoveredExcel && recoveredExcel !== cust.report_excel_path) {
          updatedExcel = recoveredExcel;
          changed = true;
        }
      }

      if (changed) {
        updateStmt.run(updatedPdf, updatedExcel, cust.id);
      }
    }
  } catch (e) {
    console.error('Report migration check error:', e);
  }
}

function registerCustomerHandlers(mainWindow, triggerDualBackup, broadcastSchedulesUpdated, syncCustomerInsuranceExpirySchedules) {
  ipcMain.handle('customers:get-all', async (event, { search = '', status = '', userId = null, user_id = null, actingUserId = null, currentUserId = null, includeSubordinates = false } = {}) => {
    const db = getDb();
    const targetUserId = userId || user_id;
    const callerId = actingUserId || currentUserId;

    let callerUser = null;
    let isTopAdmin = false;
    if (callerId) {
      callerUser = db.prepare('SELECT id, role, username FROM users WHERE id = ?').get(callerId);
      if (callerUser && (callerUser.role === 'Admin' || callerUser.role === 'admin' || callerUser.username === 'admin')) {
        isTopAdmin = true;
      }
    }

    let query = `
      SELECT c.*, u.name as user_name, u.role as user_role, u.org_name as user_org_name, r.name as referrer_name 
      FROM customers c 
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN customers r ON c.referrer_id = r.id 
      WHERE 1=1
    `;
    const params = [];

    if (targetUserId) {
      if (includeSubordinates) {
        const accessibleUsers = getAccessibleUsersForUser(db, targetUserId);
        const userIds = accessibleUsers.map(u => u.id);
        if (userIds.length > 0) {
          const placeholders = userIds.map(() => '?').join(',');
          query += ` AND c.user_id IN (${placeholders})`;
          params.push(...userIds);
        }
      } else {
        const uIdNum = Number(targetUserId);
        if (uIdNum === 1) {
          query += ' AND (c.user_id = 1 OR c.user_id IS NULL)';
        } else {
          query += ' AND c.user_id = ?';
          params.push(uIdNum);
        }
      }
    }

    if (search) {
      query += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.birth_date LIKE ? OR c.insurance_provider LIKE ? OR c.insurance_details LIKE ? OR c.insurances LIKE ? OR r.name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term, term, term);
    }

    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }

    query += ' ORDER BY c.id DESC';

    let rows;
    try {
      rows = db.prepare(query).all(...params);
    } catch (err) {
      if (err.message && err.message.includes('no column named')) {
        initDatabase();
        rows = db.prepare(query).all(...params);
      } else {
        throw err;
      }
    }

    const normalized = rows.map(normalizeCustomerInsurances);

    // If viewer is top admin or viewing their own customers, return all data
    if (isTopAdmin || !callerId || (targetUserId && Number(targetUserId) === Number(callerId) && !includeSubordinates)) {
      return normalized;
    }

    // For managers viewing subordinate customers:
    // Only return customers that belong to caller, OR long-touch subordinate customers with masked personal info
    const now = new Date();
    const past6MonthsTime = now.getTime() - (180 * 24 * 60 * 60 * 1000);
    const future1MonthTime = now.getTime() + (30 * 24 * 60 * 60 * 1000);

    const allSchedules = db.prepare('SELECT customer_id, scheduled_at, title FROM schedules').all();

    const filtered = [];

    for (const cust of normalized) {
      // 1. Caller's own customer: full access
      if (Number(cust.user_id) === Number(callerId)) {
        filtered.push(cust);
        continue;
      }

      // 2. Subordinate customer: Check if Long-Touch
      const custSchedules = allSchedules.filter(s => {
        if (s.customer_id && String(s.customer_id) === String(cust.id)) return true;
        if (s.title && cust.name && s.title.includes(cust.name)) return true;
        return false;
      });

      let latestScheduleDate = null;
      let latestScheduleTime = 0;
      custSchedules.forEach(s => {
        if (s.scheduled_at) {
          const t = new Date(s.scheduled_at).getTime();
          if (!isNaN(t) && t > latestScheduleTime) {
            latestScheduleTime = t;
            latestScheduleDate = s.scheduled_at;
          }
        }
      });

      const hasRecentSchedule = custSchedules.some(s => {
        if (!s.scheduled_at) return false;
        const stTime = new Date(s.scheduled_at).getTime();
        return !isNaN(stTime) && stTime >= past6MonthsTime && stTime <= future1MonthTime;
      });

      const isLongTouch = cust.status === 'Inactive' || !hasRecentSchedule;

      if (isLongTouch) {
        const baseTime = latestScheduleTime > 0 ? latestScheduleTime : new Date(cust.created_at || now).getTime();
        const elapsedMs = Math.max(0, now.getTime() - baseTime);
        const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
        const elapsedMonths = Math.floor(elapsedDays / 30);

        filtered.push({
          id: cust.id,
          name: cust.name,
          user_id: cust.user_id,
          user_name: cust.user_name || '미배정',
          user_role: cust.user_role || 'FA',
          user_org_name: cust.user_org_name || '',
          status: cust.status,
          phone: '***-****-****', // Masked
          email: '***@***',       // Masked
          birth_date: '****-**-**',// Masked
          notes: '하위 조직원 장기 미터치 관리 대상',
          insurances: [],
          last_schedule_date: latestScheduleDate,
          elapsed_days: elapsedDays,
          elapsed_months: elapsedMonths > 0 ? elapsedMonths : (elapsedDays > 0 ? 1 : 0),
          is_subordinate_masked: true,
          is_long_touch: true
        });
      }
    }

    return filtered;
  });

  ipcMain.handle('customers:open-pdf', async (event, filePath) => {
    if (!filePath) {
      return { success: false, error: '등록된 보장분석 PDF/엑셀 파일이 없습니다.' };
    }
    try {
      const db = getDb();
      migrateExistingCustomerReportFiles(db);

      let resolvedPath = findOrRecoverReportFile(filePath);
      if (resolvedPath && fs.existsSync(resolvedPath)) {
        await shell.openPath(resolvedPath);
        return { success: true, filePath: resolvedPath };
      }

      // If file not found on disk, offer user to re-select file
      const baseName = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();

      const openRes = await dialog.showOpenDialog(mainWindow, {
        title: `[파일 복구] "${baseName}" 보장분석 리포트 파일 재선택`,
        message: `기존 경로에 리포트 파일이 없습니다. 해당 파일(${baseName})을 다시 선택해 주세요.`,
        properties: ['openFile'],
        filters: [
          { name: '보장분석 리포트 파일 (*.pdf, *.xlsx, *.xls)', extensions: ['pdf', 'xlsx', 'xls'] },
          { name: '모든 파일', extensions: ['*'] }
        ]
      });

      if (!openRes.canceled && openRes.filePaths.length > 0) {
        const newlySelected = openRes.filePaths[0];
        const newInternalPath = copyReportToInternalStorage(newlySelected);

        // Update in DB for matching customer
        try {
          if (ext === '.pdf') {
            db.prepare('UPDATE customers SET report_pdf_path = ?, updated_at = ? WHERE report_pdf_path = ? OR report_pdf_path LIKE ?')
              .run(newInternalPath, new Date().toISOString(), filePath, `%${baseName}%`);
          } else {
            db.prepare('UPDATE customers SET report_excel_path = ?, updated_at = ? WHERE report_excel_path = ? OR report_excel_path LIKE ?')
              .run(newInternalPath, new Date().toISOString(), filePath, `%${baseName}%`);
          }
        } catch (dbUpErr) {
          console.warn('DB report path update warning:', dbUpErr);
        }

        await shell.openPath(newInternalPath);
        return { success: true, filePath: newInternalPath, recovered: true };
      }

      return { success: false, error: `보장분석 리포트 파일(${baseName})을 찾을 수 없습니다.` };
    } catch (err) {
      console.error('customers:open-pdf error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('customers:create', async (event, customerData) => {
    const db = getDb();
    const now = new Date().toISOString();
    const ownerUserId = Number(customerData.user_id || customerData.userId || 1);
    
    const insurancesJson = JSON.stringify(customerData.insurances || []);
    const primaryProvider = customerData.insurances && customerData.insurances.length > 0 ? customerData.insurances[0].provider : '';
    const primaryDetails = customerData.insurances && customerData.insurances.length > 0 ? customerData.insurances[0].details : '';
    const referrerId = customerData.referrer_id ? Number(customerData.referrer_id) : null;
    const reportPdfPath = customerData.report_pdf_path ? copyReportToInternalStorage(customerData.report_pdf_path) : '';
    const reportExcelPath = customerData.report_excel_path ? copyReportToInternalStorage(customerData.report_excel_path) : '';

    const isPool = customerData.is_pool ? 1 : 0;
    const relationship = customerData.relationship || null;
    const poolGroup = customerData.pool_group || (isPool ? 'A' : null);
    const birthType = customerData.birth_type || 'solar';

    // Auto-Transition Rule 1:
    // If insurance contracts exist or report attached -> Active (보유고객)
    // If POOL LIST registration -> Lead (가망고객)
    // Otherwise fallback to customerData.status or 'Active'
    let resolvedStatus = customerData.status || (isPool ? 'Lead' : 'Active');
    const hasInsuranceData = (customerData.insurances && customerData.insurances.length > 0) || reportPdfPath || reportExcelPath;
    if (hasInsuranceData) {
      resolvedStatus = 'Active';
    }

    const executeInsert = () => {
      const stmt = db.prepare(`
        INSERT INTO customers (user_id, name, email, phone, birth_date, birth_type, insurance_provider, insurance_details, insurances, referrer_id, status, notes, report_pdf_path, report_excel_path, relationship, pool_group, is_pool, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      return stmt.run(
        ownerUserId,
        customerData.name || '',
        customerData.email || '',
        customerData.phone || '',
        customerData.birth_date || '',
        birthType,
        primaryProvider,
        primaryDetails,
        insurancesJson,
        referrerId,
        resolvedStatus,
        customerData.notes || '',
        reportPdfPath,
        reportExcelPath,
        relationship,
        poolGroup,
        isPool,
        now,
        now
      );
    };

    let info;
    try {
      info = executeInsert();
    } catch (err) {
      if (err.message && err.message.includes('has no column named')) {
        initDatabase();
        info = executeInsert();
      } else {
        throw err;
      }
    }

    triggerDualBackup();
    syncCloudData(db);

    try {
      syncCustomerInsuranceExpirySchedules(db);
      broadcastSchedulesUpdated();
      try { checkUpcomingSchedules(mainWindow); } catch (e) {}
    } catch (expiryErr) {
      console.error('Insurance expiry reminder creation error:', expiryErr);
    }

    let referrerName = null;
    if (referrerId) {
      const refRow = db.prepare('SELECT name FROM customers WHERE id = ?').get(referrerId);
      if (refRow) referrerName = refRow.name;
    }

    return normalizeCustomerInsurances({
      id: info.lastInsertRowid,
      user_id: ownerUserId,
      ...customerData,
      status: resolvedStatus,
      birth_type: birthType,
      relationship,
      pool_group: poolGroup,
      is_pool: isPool,
      referrer_id: referrerId,
      referrer_name: referrerName,
      insurance_provider: primaryProvider,
      insurance_details: primaryDetails,
      insurances: customerData.insurances || [],
      report_pdf_path: reportPdfPath,
      report_excel_path: reportExcelPath,
      created_at: now,
      updated_at: now
    });
  });

  ipcMain.handle('customers:update', async (event, { id, currentUserId, actingUserId, ...customerData }) => {
    const db = getDb();
    const now = new Date().toISOString();
    
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!existing) {
      return { success: false, error: '해당 고객 정보를 찾을 수 없습니다.' };
    }

    const requesterId = Number(actingUserId || currentUserId || customerData.user_id || 1);
    const originalOwnerId = existing.user_id !== null && existing.user_id !== undefined ? Number(existing.user_id) : 1;

    if (originalOwnerId !== requesterId) {
      return { success: false, error: '해당 고객을 등록한 담당자만 수정할 수 있습니다. (권한 없음)' };
    }

    const insurancesJson = JSON.stringify(customerData.insurances || []);
    const primaryProvider = customerData.insurances && customerData.insurances.length > 0 ? customerData.insurances[0].provider : '';
    const primaryDetails = customerData.insurances && customerData.insurances.length > 0 ? customerData.insurances[0].details : '';
    const referrerId = customerData.referrer_id ? Number(customerData.referrer_id) : null;
    const reportPdfPath = customerData.report_pdf_path ? copyReportToInternalStorage(customerData.report_pdf_path) : (existing.report_pdf_path || '');
    const reportExcelPath = customerData.report_excel_path ? copyReportToInternalStorage(customerData.report_excel_path) : (existing.report_excel_path || '');

    const isPool = customerData.is_pool !== undefined ? (customerData.is_pool ? 1 : 0) : (existing.is_pool || 0);
    const relationship = customerData.relationship !== undefined ? customerData.relationship : existing.relationship;
    const poolGroup = customerData.pool_group !== undefined ? customerData.pool_group : existing.pool_group;
    const birthType = customerData.birth_type !== undefined ? customerData.birth_type : (existing.birth_type || 'solar');

    // Auto-Transition Rule: If insurance / analysis report is entered, promote status to 'Active' (보유고객)
    let resolvedStatus = customerData.status || existing.status || 'Active';
    const hasInsuranceData = (customerData.insurances && customerData.insurances.length > 0) || reportPdfPath || reportExcelPath;
    if (hasInsuranceData && resolvedStatus === 'Lead') {
      resolvedStatus = 'Active'; // Automatically promote from Lead to Active
    }

    const executeUpdate = () => {
      const stmt = db.prepare(`
        UPDATE customers 
        SET user_id = ?, name = ?, email = ?, phone = ?, birth_date = ?, birth_type = ?, insurance_provider = ?, insurance_details = ?, insurances = ?, referrer_id = ?, status = ?, notes = ?, report_pdf_path = ?, report_excel_path = ?, relationship = ?, pool_group = ?, is_pool = ?, updated_at = ?
        WHERE id = ?
      `);

      return stmt.run(
        originalOwnerId,
        customerData.name !== undefined ? customerData.name : existing.name,
        customerData.email !== undefined ? customerData.email : existing.email,
        customerData.phone !== undefined ? customerData.phone : existing.phone,
        customerData.birth_date !== undefined ? customerData.birth_date : existing.birth_date,
        birthType,
        primaryProvider,
        primaryDetails,
        insurancesJson,
        referrerId,
        resolvedStatus,
        customerData.notes !== undefined ? customerData.notes : existing.notes,
        reportPdfPath,
        reportExcelPath,
        relationship,
        poolGroup,
        isPool,
        now,
        id
      );
    };

    try {
      executeUpdate();
    } catch (err) {
      if (err.message && err.message.includes('has no column named')) {
        initDatabase();
        executeUpdate();
      } else {
        throw err;
      }
    }

    triggerDualBackup();
    syncCloudData(db);

    try {
      syncCustomerInsuranceExpirySchedules(db);
      broadcastSchedulesUpdated();
      try { checkUpcomingSchedules(mainWindow); } catch (e) {}
    } catch (expiryErr) {
      console.error('Insurance expiry reminder creation error:', expiryErr);
    }

    let referrerName = null;
    if (referrerId) {
      const refRow = db.prepare('SELECT name FROM customers WHERE id = ?').get(referrerId);
      if (refRow) referrerName = refRow.name;
    }

    return normalizeCustomerInsurances({
      id,
      user_id: originalOwnerId,
      ...customerData,
      referrer_id: referrerId,
      referrer_name: referrerName,
      insurance_provider: primaryProvider,
      insurance_details: primaryDetails,
      insurances: customerData.insurances || [],
      updated_at: now
    });
  });

  ipcMain.handle('customers:delete', async (event, payload) => {
    const db = getDb();
    const id = typeof payload === 'object' ? payload.id : payload;
    const actingUserId = typeof payload === 'object' ? payload.actingUserId || payload.currentUserId : null;

    const existing = db.prepare('SELECT user_id FROM customers WHERE id = ?').get(id);
    if (!existing) return { success: false, error: '해당 고객을 찾을 수 없습니다.' };

    if (actingUserId) {
      const originalOwnerId = existing.user_id !== null && existing.user_id !== undefined ? Number(existing.user_id) : 1;
      const requesterId = Number(actingUserId);
      if (originalOwnerId !== requesterId) {
        return { success: false, error: '해당 고객을 등록한 담당자만 삭제할 수 있습니다. (권한 없음)' };
      }
    }

    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    triggerDualBackup();
    syncCloudData(db);
    return { success: true, id };
  });

  ipcMain.handle('customers:parse-report-pdf', async (event) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: '보장분석 리포트(PDF 또는 Excel) 선택',
        properties: ['openFile'],
        filters: [
          { name: '보장분석 리포트 파일 (*.pdf, *.xlsx, *.xls)', extensions: ['pdf', 'xlsx', 'xls'] },
          { name: '모든 파일', extensions: ['*'] }
        ]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const selectedPath = result.filePaths[0];
      const ext = path.extname(selectedPath).toLowerCase();
      const internalFilePath = copyReportToInternalStorage(selectedPath);

      if (ext === '.pdf') {
        const fileBuffer = fs.readFileSync(selectedPath);
        const textContent = await extractTextFromPdfBuffer(fileBuffer);
        const parseResult = parseInsurancesFromReportText(textContent, selectedPath);

        return {
          success: true,
          filePath: internalFilePath,
          originalPath: selectedPath,
          customerName: parseResult.customerName || '',
          insurances: parseResult.insurances || [],
          fileType: 'pdf'
        };
      } else if (ext === '.xlsx' || ext === '.xls') {
        const fileBuffer = fs.readFileSync(selectedPath);
        const parseResult = parseInsurancesFromExcelBuffer(fileBuffer, selectedPath);

        return {
          success: true,
          filePath: internalFilePath,
          originalPath: selectedPath,
          customerName: parseResult.customerName || '',
          insurances: parseResult.insurances || [],
          fileType: 'excel'
        };
      } else {
        return { success: false, error: '지원되지 않는 파일 형식입니다. PDF 또는 Excel 파일을 선택해 주세요.' };
      }
    } catch (err) {
      console.error('parse-report-pdf error:', err);
      return { success: false, error: err.message };
    }
  });
}

module.exports = {
  getReportStorageDirectory,
  copyReportToInternalStorage,
  findOrRecoverReportFile,
  migrateExistingCustomerReportFiles,
  registerCustomerHandlers
};
