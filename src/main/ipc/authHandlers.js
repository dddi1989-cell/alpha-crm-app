const { ipcMain } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const { getDb } = require('../database');
const { setActiveUserId } = require('../notification');
const { performDualBackup } = require('../backupEngine');
const { syncCloudAccounts, syncCloudData, githubDownloadFile, _mergeAccountsIntoDB, GITHUB_ACCOUNT_FILE, getCloudAccountStorePath } = require('../services/cloudSyncService');

function getRoleRank(role) {
  const map = {
    'Admin': 99,
    'admin': 99,
    'CEO': 6,
    '총괄': 6,
    'COO': 5,
    '사업단장': 5,
    '본부장': 4,
    '지점장': 3,
    '팀장': 2,
    'Manager': 2,
    'FA': 1,
    'Agent': 1
  };
  return map[role] || 1;
}

function getAccessibleUsersForUser(db, userId) {
  const currentUser = db.prepare('SELECT id, username, name, role, parent_id, org_id, org_name FROM users WHERE id = ?').get(userId);
  if (!currentUser) return [];

  const userRank = getRoleRank(currentUser.role);
  const allUsers = db.prepare('SELECT id, username, name, role, parent_id, org_id, org_name FROM users').all();

  if (userRank >= 5 || currentUser.role === 'Admin' || currentUser.role === 'admin') {
    return allUsers;
  }

  const userMap = new Map();
  allUsers.forEach(u => userMap.set(u.id, u));

  const accessibleUserIds = new Set();
  accessibleUserIds.add(currentUser.id);

  let addedNew = true;
  let guard = 0;
  while (addedNew && guard < 50) {
    addedNew = false;
    guard++;
    for (const u of allUsers) {
      if (u.parent_id && accessibleUserIds.has(u.parent_id) && !accessibleUserIds.has(u.id)) {
        accessibleUserIds.add(u.id);
        addedNew = true;
      }
    }
  }

  if (currentUser.org_id || currentUser.org_name) {
    for (const u of allUsers) {
      if (!accessibleUserIds.has(u.id)) {
        const sameOrg = (currentUser.org_id && u.org_id === currentUser.org_id) ||
                        (currentUser.org_name && u.org_name === currentUser.org_name);
        if (sameOrg) {
          const targetRank = getRoleRank(u.role);
          if (userRank > targetRank) {
            accessibleUserIds.add(u.id);
          }
        }
      }
    }
  }

  return allUsers.filter(u => accessibleUserIds.has(u.id));
}

function registerAuthHandlers(mainWindow, triggerDualBackup) {
  ipcMain.handle('users:login', async (event, { username, password }) => {
    const db = getDb();
    if (!username || !password) {
      return { success: false, error: '아이디와 비밀번호를 입력해 주세요.' };
    }

    try {
      const hash = crypto.createHash('sha256').update(password.trim()).digest('hex');
      const trimmedUsername = username.trim();

      let user = db.prepare('SELECT id, username, name, phone, role, parent_id, org_id, org_name FROM users WHERE LOWER(username) = LOWER(?) AND password_hash = ?')
        .get(trimmedUsername, hash);

      if (!user) {
        try {
          const cloudContent = await githubDownloadFile(GITHUB_ACCOUNT_FILE);
          if (cloudContent) {
            const cloudData = JSON.parse(cloudContent);
            if (Array.isArray(cloudData.accounts) && cloudData.accounts.length > 0) {
              _mergeAccountsIntoDB(db, cloudData.accounts);
              user = db.prepare('SELECT id, username, name, phone, role, parent_id, org_id, org_name FROM users WHERE LOWER(username) = LOWER(?) AND password_hash = ?')
                .get(trimmedUsername, hash);
            }
          }
        } catch (cloudErr) {
          console.error('[Cloud-Sync-Fallback] Error fetching cloud accounts on login:', cloudErr.message);
        }
      }

      if (!user) {
        return { success: false, error: '아이디 또는 비밀번호가 일치하지 않습니다.' };
      }

      // Auto data migration for new accounts
      if (user.role !== 'admin' && user.role !== 'Admin' && user.id !== 1) {
        try {
          const myCustomers = db.prepare('SELECT COUNT(*) as cnt FROM customers WHERE user_id = ?').get(user.id);
          if (myCustomers.cnt === 0) {
            const otherNonAdminUsers = db.prepare(
              'SELECT COUNT(*) as cnt FROM users WHERE role NOT IN ("admin", "Admin") AND id != 1 AND id != ?'
            ).get(user.id);

            const orphanCustomers = db.prepare(
              'SELECT COUNT(*) as cnt FROM customers WHERE user_id = 1 OR user_id IS NULL'
            ).get();

            if (orphanCustomers.cnt > 0) {
              let shouldMigrate = false;
              if (otherNonAdminUsers.cnt === 0) {
                shouldMigrate = true;
              } else {
                const anyOtherUserWithCustomers = db.prepare(
                  'SELECT COUNT(*) as cnt FROM customers WHERE user_id != 1 AND user_id IS NOT NULL AND user_id != ?'
                ).get(user.id);
                if (anyOtherUserWithCustomers.cnt === 0) {
                  shouldMigrate = true;
                }
              }

              if (shouldMigrate) {
                db.transaction(() => {
                  db.prepare('UPDATE customers SET user_id = ? WHERE user_id = 1 OR user_id IS NULL').run(user.id);
                  db.prepare('UPDATE schedules SET user_id = ? WHERE user_id = 1 OR user_id IS NULL').run(user.id);
                })();
                console.log('[Login-Migration] Auto migrated ' + orphanCustomers.cnt + ' customers to user ' + user.name);
                try { syncCloudData(db); } catch (e) {}
                try { triggerDualBackup(); } catch (e) {}
              }
            }
          }
        } catch (migErr) {
          console.error('[Login-Migration] Error during migration:', migErr.message);
        }
      }

      setActiveUserId(user.id);
      return { success: true, user };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('users:set-active-user', async (event, userId) => {
    setActiveUserId(userId || null);
    return { success: true };
  });

  ipcMain.handle('users:sync-cloud', async () => {
    const db = getDb();
    try {
      const cloudContent = await githubDownloadFile(GITHUB_ACCOUNT_FILE);
      if (cloudContent) {
        const cloudData = JSON.parse(cloudContent);
        if (Array.isArray(cloudData.accounts) && cloudData.accounts.length > 0) {
          _mergeAccountsIntoDB(db, cloudData.accounts);
          const storePath = getCloudAccountStorePath();
          fs.writeFileSync(storePath, cloudContent, 'utf8');
          return { success: true, count: cloudData.accounts.length };
        }
      }
      return { success: true, count: 0 };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('users:register', async (event, { username, name, phone }) => {
    const db = getDb();
    if (!username || !name || !phone) {
      return { success: false, error: '사번(아이디), 성명, 연락처는 필수 입력 항목입니다.' };
    }

    const trimmedUsername = username.trim();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    try {
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(trimmedUsername);
      if (existing) {
        return { success: false, error: '이미 등록된 사번(아이디)입니다. 다른 사번을 입력하거나 로그인하세요.' };
      }

      const hash = crypto.createHash('sha256').update(trimmedUsername).digest('hex');
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO users (username, password_hash, name, phone, role, parent_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'FA', NULL, ?, ?)
      `);
      const info = stmt.run(trimmedUsername, hash, trimmedName, trimmedPhone, now, now);

      syncCloudAccounts(db);
      triggerDualBackup();

      return { 
        success: true, 
        id: info.lastInsertRowid,
        message: trimmedName + ' 님의 이용자 등록이 완료되었습니다!\n\n최초 로그인 시 사번(' + trimmedUsername + ')을 아이디와 비밀번호에 동일하게 입력해 주세요.'
      };
    } catch (err) {
      console.error('User register error:', err);
      return { success: false, error: '이용자 등록 실패: ' + err.message };
    }
  });

  ipcMain.handle('users:change-password', async (event, { username, currentPassword, newPassword }) => {
    const db = getDb();
    if (!username || !currentPassword || !newPassword) {
      return { success: false, error: '모든 필수 항목을 입력해 주세요.' };
    }

    try {
      const curHash = crypto.createHash('sha256').update(currentPassword.trim()).digest('hex');
      const newHash = crypto.createHash('sha256').update(newPassword.trim()).digest('hex');

      const user = db.prepare('SELECT id, name FROM users WHERE LOWER(username) = LOWER(?) AND password_hash = ?')
        .get(username.trim(), curHash);

      if (!user) {
        return { success: false, error: '아이디 또는 현재 비밀번호가 일치하지 않습니다.' };
      }

      const now = new Date().toISOString();
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
        .run(newHash, now, user.id);

      syncCloudAccounts(db);
      triggerDualBackup();

      return { success: true, message: user.name + ' 님의 비밀번호가 성공적으로 변경되었습니다.' };
    } catch (err) {
      console.error('Password change error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('users:get-all', async () => {
    const db = getDb();
    try {
      const users = db.prepare(`
        SELECT u.id, u.username, u.name, u.phone, u.role, u.parent_id, u.org_id, u.org_name, u.created_at, p.name as parent_name, p.role as parent_role
        FROM users u
        LEFT JOIN users p ON u.parent_id = p.id
        ORDER BY CASE u.role 
          WHEN 'admin' THEN 1 
          WHEN 'Admin' THEN 1 
          WHEN 'CEO' THEN 2 
          WHEN 'COO' THEN 3 
          WHEN '본부장' THEN 4 
          WHEN '지점장' THEN 5 
          WHEN '팀장' THEN 6 
          WHEN 'Manager' THEN 6 
          WHEN 'FA' THEN 7 
          WHEN 'Agent' THEN 7 
          ELSE 8 
        END, u.id ASC
      `).all();

      return { success: true, users };
    } catch (err) {
      return { success: false, error: err.message, users: [] };
    }
  });

  ipcMain.handle('users:get-accessible-subordinates', async (event, currentUserId) => {
    const db = getDb();
    try {
      loadCloudAccounts(db).catch(() => {});
      const accessibleUsers = getAccessibleUsersForUser(db, currentUserId);
      return { success: true, users: accessibleUsers };
    } catch (err) {
      console.error('get-accessible-subordinates error:', err);
      return { success: false, error: err.message, users: [] };
    }
  });

  ipcMain.handle('users:create', async (event, { username, password, name, phone, role = 'FA', parent_id = null, org_id = null }) => {
    const db = getDb();
    if (!username || !password || !name) {
      return { success: false, error: '아이디, 비밀번호, 성명은 필수입니다.' };
    }

    try {
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim());
      if (existing) {
        return { success: false, error: '이미 사용 중인 사번(아이디)입니다.' };
      }

      let resolvedOrgId = org_id ? Number(org_id) : null;
      let resolvedOrgName = null;
      if (resolvedOrgId) {
        const orgRow = db.prepare('SELECT name FROM organizations WHERE id = ?').get(resolvedOrgId);
        if (orgRow) resolvedOrgName = orgRow.name;
      }

      const hash = crypto.createHash('sha256').update(password.trim()).digest('hex');
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO users (username, password_hash, name, phone, role, parent_id, org_id, org_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(username.trim(), hash, name.trim(), (phone || '').trim(), role, parent_id || null, resolvedOrgId, resolvedOrgName, now, now);

      syncCloudAccounts(db);
      triggerDualBackup();

      return { success: true, id: info.lastInsertRowid };
    } catch (err) {
      console.error('User create error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('users:update', async (event, { id, password, name, phone, role, parent_id, org_id }) => {
    const db = getDb();
    if (!id || !name) {
      return { success: false, error: '사용자 ID와 성명은 필수입니다.' };
    }

    try {
      const now = new Date().toISOString();
      let resolvedOrgId = org_id !== undefined ? (org_id ? Number(org_id) : null) : undefined;
      let resolvedOrgName = undefined;
      if (resolvedOrgId !== undefined && resolvedOrgId !== null) {
        const orgRow = db.prepare('SELECT name FROM organizations WHERE id = ?').get(resolvedOrgId);
        resolvedOrgName = orgRow ? orgRow.name : null;
      } else if (resolvedOrgId === null) {
        resolvedOrgName = null;
      }

      if (password && password.trim()) {
        const hash = crypto.createHash('sha256').update(password.trim()).digest('hex');
        if (resolvedOrgId !== undefined) {
          db.prepare(`
            UPDATE users SET password_hash = ?, name = ?, phone = ?, role = ?, parent_id = ?, org_id = ?, org_name = ?, updated_at = ?
            WHERE id = ?
          `).run(hash, name.trim(), (phone || '').trim(), role || 'FA', parent_id || null, resolvedOrgId, resolvedOrgName, now, id);
        } else {
          db.prepare(`
            UPDATE users SET password_hash = ?, name = ?, phone = ?, role = ?, parent_id = ?, updated_at = ?
            WHERE id = ?
          `).run(hash, name.trim(), (phone || '').trim(), role || 'FA', parent_id || null, now, id);
        }
      } else {
        if (resolvedOrgId !== undefined) {
          db.prepare(`
            UPDATE users SET name = ?, phone = ?, role = ?, parent_id = ?, org_id = ?, org_name = ?, updated_at = ?
            WHERE id = ?
          `).run(name.trim(), (phone || '').trim(), role || 'FA', parent_id || null, resolvedOrgId, resolvedOrgName, now, id);
        } else {
          db.prepare(`
            UPDATE users SET name = ?, phone = ?, role = ?, parent_id = ?, updated_at = ?
            WHERE id = ?
          `).run(name.trim(), (phone || '').trim(), role || 'FA', parent_id || null, now, id);
        }
      }

      syncCloudAccounts(db);
      triggerDualBackup();

      return { success: true };
    } catch (err) {
      console.error('User update error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('users:delete', async (event, id) => {
    const db = getDb();
    try {
      const user = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
      if (user && (user.username === 'admin' || user.username === 'Admin')) {
        return { success: false, error: '최고 관리자(admin) 계정은 삭제할 수 없습니다.' };
      }

      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      syncCloudAccounts(db);
      triggerDualBackup();

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = {
  getRoleRank,
  getAccessibleUsersForUser,
  registerAuthHandlers
};
