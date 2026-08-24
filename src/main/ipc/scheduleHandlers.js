const { ipcMain, BrowserWindow } = require('electron');
const { getDb } = require('../database');
const { checkUpcomingSchedules } = require('../notification');
const { syncCloudData } = require('../services/cloudSyncService');
const { getAccessibleUsersForUser } = require('./authHandlers');

function broadcastSchedulesUpdated(payload = null) {
  try {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('schedules:data-changed', payload);
      }
    });
  } catch (err) {
    console.error('Error broadcasting schedules updated:', err);
  }
}

function syncCustomerInsuranceExpirySchedules(db) {
  try {
    const customers = db.prepare('SELECT id, user_id, name, insurances FROM customers WHERE insurances IS NOT NULL AND insurances != ""').all();
    const existingAutoSchedules = db.prepare('SELECT id, customer_id, title, date FROM schedules WHERE type = "expiry"').all();
    const existingKeySet = new Set(existingAutoSchedules.map(s => `${s.customer_id}|${s.title}|${s.date}`));

    const insertStmt = db.prepare(`
      INSERT INTO schedules (user_id, customer_id, title, description, scheduled_at, date, time, type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'expiry', 'Pending', ?, ?)
    `);

    const nowIso = new Date().toISOString();

    for (const cust of customers) {
      let insurances = [];
      try {
        insurances = typeof cust.insurances === 'string' ? JSON.parse(cust.insurances) : cust.insurances;
      } catch (e) {
        continue;
      }

      if (!Array.isArray(insurances)) continue;

      for (const ins of insurances) {
        if (!ins.endDate) continue;

        let endY = 0, endM = 0, endD = 1;
        const parts = String(ins.endDate).trim().split('-');
        if (parts.length >= 2) {
          endY = parseInt(parts[0], 10);
          endM = parseInt(parts[1], 10);
          if (parts.length >= 3) endD = parseInt(parts[2], 10) || 1;
        }

        if (!endY || !endM) continue;

        const scheduledDateStr = `${endY}-${String(endM).padStart(2, '0')}-${String(endD).padStart(2, '0')}`;
        const title = `[만기 알림] ${cust.name} - ${ins.details || ins.provider || '보험'}`;
        const key = `${cust.id}|${title}|${scheduledDateStr}`;

        if (!existingKeySet.has(key)) {
          const description = `${cust.name} 고객님의 [${ins.provider || ''} ${ins.details || ''}] 보험 만기 예정일입니다. 갱신 및 보장 리모델링 상담을 진행하세요.`;
          const scheduledAtIso = `${scheduledDateStr}T09:00:00.000Z`;

          insertStmt.run(
            cust.user_id || 1,
            cust.id,
            title,
            description,
            scheduledAtIso,
            scheduledDateStr,
            '09:00',
            nowIso,
            nowIso
          );
          existingKeySet.add(key);
        }
      }
    }
  } catch (err) {
    console.error('syncCustomerInsuranceExpirySchedules error:', err);
  }
}

function registerScheduleHandlers(mainWindow, triggerDualBackup) {
  ipcMain.handle('schedules:get-all', async (event, { search = '', status = '', userId = null, user_id = null, includeSubordinates = false } = {}) => {
    const db = getDb();
    const targetUserId = userId || user_id;

    let query = `
      SELECT s.*, u.name as user_name, u.role as user_role, u.org_name as user_org_name, c.name as customer_name, c.insurance_provider as customer_insurance_provider 
      FROM schedules s 
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id 
      WHERE 1=1
    `;
    const params = [];

    if (targetUserId) {
      if (includeSubordinates) {
        const accessibleUsers = getAccessibleUsersForUser(db, targetUserId);
        const userIds = accessibleUsers.map(u => u.id);
        if (userIds.length > 0) {
          const placeholders = userIds.map(() => '?').join(',');
          query += ` AND s.user_id IN (${placeholders})`;
          params.push(...userIds);
        }
      } else {
        const uIdNum = Number(targetUserId);
        if (uIdNum === 1) {
          query += ' AND (s.user_id = 1 OR s.user_id IS NULL)';
        } else {
          query += ' AND s.user_id = ?';
          params.push(uIdNum);
        }
      }
    }

    if (search) {
      query += ' AND (s.title LIKE ? OR s.description LIKE ? OR c.name LIKE ? OR s.type LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    query += ' ORDER BY s.scheduled_at ASC, s.id DESC';

    const rows = db.prepare(query).all(...params);
    return rows;
  });

  ipcMain.handle('schedules:create', async (event, scheduleData) => {
    const db = getDb();
    const now = new Date().toISOString();
    const ownerUserId = Number(scheduleData.user_id || scheduleData.userId || 1);

    const stmt = db.prepare(`
      INSERT INTO schedules (user_id, customer_id, title, description, scheduled_at, date, time, type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      ownerUserId,
      scheduleData.customer_id || null,
      scheduleData.title,
      scheduleData.description || '',
      scheduleData.scheduled_at || `${scheduleData.date}T${scheduleData.time || '00:00'}:00`,
      scheduleData.date,
      scheduleData.time || '00:00',
      scheduleData.type || 'Meeting',
      scheduleData.status || 'Pending',
      now,
      now
    );

    triggerDualBackup();
    syncCloudData(db);

    let customerName = null;
    if (scheduleData.customer_id) {
      const cust = db.prepare('SELECT id, name, status FROM customers WHERE id = ?').get(scheduleData.customer_id);
      if (cust) {
        customerName = cust.name;
        // Auto-Transition Rule 4: If customer had Inactive status (장기미터치), restore to 'Active' (보유고객) on new schedule
        if (cust.status === 'Inactive') {
          db.prepare('UPDATE customers SET status = "Active", updated_at = ? WHERE id = ?').run(now, cust.id);
        }
      }
    }

    const newSchedule = {
      id: info.lastInsertRowid,
      user_id: ownerUserId,
      ...scheduleData,
      customer_name: customerName,
      created_at: now,
      updated_at: now
    };

    broadcastSchedulesUpdated(newSchedule);
    try { checkUpcomingSchedules(mainWindow); } catch (e) {}

    return newSchedule;
  });

  ipcMain.handle('schedules:update', async (event, { id, currentUserId, actingUserId, ...scheduleData }) => {
    const db = getDb();
    const now = new Date().toISOString();
    
    const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    if (!existing) {
      return { success: false, error: '해당 일정 정보를 찾을 수 없습니다.' };
    }

    const requesterId = Number(actingUserId || currentUserId || scheduleData.user_id || 1);
    const originalOwnerId = existing.user_id !== null && existing.user_id !== undefined ? Number(existing.user_id) : 1;

    if (originalOwnerId !== requesterId) {
      return { success: false, error: '해당 일정을 등록한 담당자만 수정할 수 있습니다. (권한 없음)' };
    }

    const stmt = db.prepare(`
      UPDATE schedules 
      SET user_id = ?, customer_id = ?, title = ?, description = ?, scheduled_at = ?, date = ?, time = ?, type = ?, status = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      originalOwnerId,
      scheduleData.customer_id !== undefined ? scheduleData.customer_id : existing.customer_id,
      scheduleData.title !== undefined ? scheduleData.title : existing.title,
      scheduleData.description !== undefined ? scheduleData.description : existing.description,
      scheduleData.scheduled_at !== undefined ? scheduleData.scheduled_at : existing.scheduled_at,
      scheduleData.date !== undefined ? scheduleData.date : existing.date,
      scheduleData.time !== undefined ? scheduleData.time : existing.time,
      scheduleData.type !== undefined ? scheduleData.type : existing.type,
      scheduleData.status !== undefined ? scheduleData.status : existing.status,
      now,
      id
    );

    triggerDualBackup();
    syncCloudData(db);

    let customerName = null;
    const effectiveCustomerId = scheduleData.customer_id !== undefined ? scheduleData.customer_id : existing.customer_id;
    if (effectiveCustomerId) {
      const cust = db.prepare('SELECT name FROM customers WHERE id = ?').get(effectiveCustomerId);
      if (cust) customerName = cust.name;
    }

    const updatedSchedule = {
      id,
      user_id: originalOwnerId,
      ...scheduleData,
      customer_name: customerName,
      updated_at: now
    };

    broadcastSchedulesUpdated(updatedSchedule);
    try { checkUpcomingSchedules(mainWindow); } catch (e) {}

    return updatedSchedule;
  });

  ipcMain.handle('schedules:delete', async (event, payload) => {
    const db = getDb();
    const id = typeof payload === 'object' ? payload.id : payload;
    const actingUserId = typeof payload === 'object' ? payload.actingUserId || payload.currentUserId : null;

    const existing = db.prepare('SELECT user_id FROM schedules WHERE id = ?').get(id);
    if (!existing) return { success: false, error: '해당 일정을 찾을 수 없습니다.' };

    if (actingUserId) {
      const originalOwnerId = existing.user_id !== null && existing.user_id !== undefined ? Number(existing.user_id) : 1;
      const requesterId = Number(actingUserId);
      if (originalOwnerId !== requesterId) {
        return { success: false, error: '해당 일정을 등록한 담당자만 삭제할 수 있습니다. (권한 없음)' };
      }
    }

    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
    triggerDualBackup();
    syncCloudData(db);
    broadcastSchedulesUpdated({ id, deleted: true });
    return { success: true, id };
  });
}

module.exports = {
  broadcastSchedulesUpdated,
  syncCustomerInsuranceExpirySchedules,
  registerScheduleHandlers
};
