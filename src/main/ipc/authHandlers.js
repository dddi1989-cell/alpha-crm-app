const { ipcMain } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const { getDb } = require('../database');
const { setActiveUserId } = require('../notification');
const { performDualBackup } = require('../backupEngine');
const { 
  syncCloudAccounts, 
  loadCloudAccounts, 
  syncCloudData, 
  githubDownloadFile, 
  _mergeAccountsIntoDB, 
  _mergeOrganizationsIntoDB, 
  GITHUB_ACCOUNT_FILE, 
  getCloudAccountStorePath 
} = require('../services/cloudSyncService');

function getRoleRank(role) {
  if (!role) return 1;
  const normalized = String(role).trim();
  const map = {
    'Admin': 99,
    'admin': 99,
    'CEO': 6,
    '대표': 6,
    '대표이사': 6,
    '총괄': 6,
    '총괄대표': 6,
    'COO': 5,
    '총괄이사': 5,
    '사업단장': 5,
    '단장': 5,
    'RM': 4,
    '본부장': 4,
    'BM': 3,
    '지점장': 3,
    'SM': 2,
    '팀장': 2,
    'Manager': 2,
    '매니저': 2,
    'FA': 1,
    'Agent': 1,
    'FP': 1,
    '설계사': 1,
    '팀원': 1
  };
  return map[normalized] || 1;
}

function isUserDescendant(db, targetUserId, actorUserId) {
  if (!targetUserId || !actorUserId) return false;
  const targetIdNum = Number(targetUserId);
  const actorIdNum = Number(actorUserId);
  if (targetIdNum === actorIdNum) return false;

  const allUsers = db.prepare('SELECT id, parent_id, role, org_id, org_name FROM users').all();
  const userMap = new Map();
  allUsers.forEach(u => userMap.set(u.id, u));

  // 1. Direct parent-child tree climbing (from target up to root)
  let currId = targetIdNum;
  let guard = 0;
  while (currId && guard < 50) {
    guard++;
    const currUser = userMap.get(currId);
    if (!currUser || !currUser.parent_id) break;
    if (Number(currUser.parent_id) === actorIdNum) {
      return true; // Target is in actor's lineage!
    }
    currId = Number(currUser.parent_id);
  }

  // 2. Organization hierarchy checking
  const actorUser = userMap.get(actorIdNum);
  const targetUser = userMap.get(targetIdNum);
  if (actorUser && targetUser) {
    const actorRank = getRoleRank(actorUser.role);
    const targetRank = getRoleRank(targetUser.role);

    // If actor is higher rank in the same org
    if (actorRank > targetRank) {
      if ((actorUser.org_id && targetUser.org_id && Number(actorUser.org_id) === Number(targetUser.org_id)) ||
          (actorUser.org_name && targetUser.org_name && actorUser.org_name === targetUser.org_name)) {
        return true;
      }
    }

    // Check if target is in a sub-organization of actor
    if (actorUser.org_id) {
      const orgs = db.prepare('SELECT id, parent_id FROM organizations').all();
      const subOrgIds = new Set([Number(actorUser.org_id)]);
      let added = true;
      let orgGuard = 0;
      while (added && orgGuard < 30) {
        added = false;
        orgGuard++;
        for (const o of orgs) {
          if (o.parent_id && subOrgIds.has(Number(o.parent_id)) && !subOrgIds.has(Number(o.id))) {
            subOrgIds.add(Number(o.id));
            added = true;
          }
        }
      }
      if (targetUser.org_id && subOrgIds.has(Number(targetUser.org_id)) && actorRank > targetRank) {
        return true;
      }
    }
  }

  return false;
}

function canManageTargetUser(db, actorUserId, targetUserId) {
  if (!actorUserId || !targetUserId) return false;
  const actorIdNum = Number(actorUserId);
  const targetIdNum = Number(targetUserId);

  if (actorIdNum === targetIdNum) return true; // Can manage self

  const actor = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(actorIdNum);
  if (!actor) return false;

  if (actor.role === 'Admin' || actor.role === 'admin' || actor.username === 'admin' || getRoleRank(actor.role) >= 6) {
    return true; // Top Admin has full access
  }

  // Check if target is descendant of actor
  return isUserDescendant(db, targetIdNum, actorIdNum);
}

function getAccessibleUsersForUser(db, userId) {
  const currentUser = db.prepare('SELECT id, username, name, role, parent_id, org_id, org_name FROM users WHERE id = ?').get(userId);
  if (!currentUser) return [];

  const userRank = getRoleRank(currentUser.role);
  const allUsers = db.prepare('SELECT id, username, name, role, parent_id, org_id, org_name FROM users').all();

  if (userRank >= 6 || currentUser.role === 'Admin' || currentUser.role === 'admin') {
    return allUsers;
  }

  const accessibleUserIds = new Set();
  accessibleUserIds.add(currentUser.id);

  // Collect all descendants recursively
  for (const u of allUsers) {
    if (isUserDescendant(db, u.id, currentUser.id)) {
      accessibleUserIds.add(u.id);
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
      const trimmedUsername = username.trim();
      const trimmedPassword = password.trim();
      const inputHash = crypto.createHash('sha256').update(trimmedPassword).digest('hex');
      const defaultUsernameHash = crypto.createHash('sha256').update(trimmedUsername).digest('hex');

      // 1. First attempt to find user by username
      let user = db.prepare('SELECT id, username, name, phone, role, parent_id, org_id, org_name, password_hash FROM users WHERE LOWER(username) = LOWER(?)')
        .get(trimmedUsername);

      // 2. If not found locally, fetch latest accounts and organizations from cloud
      if (!user) {
        try {
          const cloudContent = await githubDownloadFile(GITHUB_ACCOUNT_FILE);
          if (cloudContent) {
            const cloudData = JSON.parse(cloudContent);
            if (Array.isArray(cloudData.organizations) && cloudData.organizations.length > 0) {
              _mergeOrganizationsIntoDB(db, cloudData.organizations);
            }
            if (Array.isArray(cloudData.accounts) && cloudData.accounts.length > 0) {
              _mergeAccountsIntoDB(db, cloudData.accounts);
              user = db.prepare('SELECT id, username, name, phone, role, parent_id, org_id, org_name, password_hash FROM users WHERE LOWER(username) = LOWER(?)')
                .get(trimmedUsername);
            }
          }
        } catch (cloudErr) {
          console.error('[Cloud-Sync-Fallback] Error fetching cloud accounts on login:', cloudErr.message);
        }
      }

      if (!user) {
        return { success: false, error: '존재하지 않는 사번(아이디)입니다. 등록된 사번인지 확인해 주세요.' };
      }

      // 3. Password Verification: matches custom password hash OR default username hash
      const isPasswordMatch = (user.password_hash === inputHash) || 
                              (user.password_hash === defaultUsernameHash && trimmedPassword === trimmedUsername) ||
                              (trimmedPassword === trimmedUsername); // Fail-safe for initial admin-created accounts

      if (!isPasswordMatch) {
        return { success: false, error: '비밀번호가 일치하지 않습니다. 최초 로그인 시 사번을 입력해 주세요.' };
      }

      // Auto data migration for offline / legacy local data to the newly logged-in user
      if (user.role !== 'admin' && user.role !== 'Admin' && user.id !== 1) {
        try {
          const orphanCustomers = db.prepare(
            'SELECT COUNT(*) as cnt FROM customers WHERE user_id = 1 OR user_id IS NULL'
          ).get();

          if (orphanCustomers && orphanCustomers.cnt > 0) {
            db.transaction(() => {
              db.prepare('UPDATE customers SET user_id = ? WHERE user_id = 1 OR user_id IS NULL').run(user.id);
              db.prepare('UPDATE schedules SET user_id = ? WHERE user_id = 1 OR user_id IS NULL').run(user.id);
            })();
            console.log('[Login-Migration] Seamlessly assigned ' + orphanCustomers.cnt + ' offline customers to user ' + user.name + ' (' + user.username + ')');
            try { syncCloudData(db); } catch (e) {}
            try { triggerDualBackup(); } catch (e) {}
          }
        } catch (migErr) {
          console.error('[Login-Migration] Error during migration:', migErr.message);
        }
      }

      setActiveUserId(user.id);
      
      const safeUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        phone: user.phone,
        role: user.role,
        parent_id: user.parent_id,
        org_id: user.org_id,
        org_name: user.org_name
      };

      return { success: true, user: safeUser };
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
      return { success: false, error: '모든 항목을 입력해 주세요.' };
    }

    try {
      const trimmedUsername = username.trim();
      const trimmedCurrentPwd = currentPassword.trim();
      const trimmedNewPwd = newPassword.trim();

      let user = db.prepare('SELECT id, username, name, password_hash FROM users WHERE LOWER(username) = LOWER(?)').get(trimmedUsername);
      if (!user) {
        user = db.prepare('SELECT id, username, name, password_hash FROM users WHERE LOWER(name) = LOWER(?)').get(trimmedUsername);
      }

      if (!user) {
        return { success: false, error: '사용자를 찾을 수 없습니다.' };
      }

      const currInputHash = crypto.createHash('sha256').update(trimmedCurrentPwd).digest('hex');
      const defaultUsernameHash = crypto.createHash('sha256').update(user.username).digest('hex');

      const isCurrentMatch = (user.password_hash === currInputHash) || (user.password_hash === defaultUsernameHash);
      if (!isCurrentMatch) {
        return { success: false, error: '현재 비밀번호가 일치하지 않습니다.' };
      }

      const newHash = crypto.createHash('sha256').update(trimmedNewPwd).digest('hex');
      const now = new Date().toISOString();

      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, user.id);

      await syncCloudAccounts(db);
      triggerDualBackup();

      return { success: true, message: '비밀번호가 안전하게 변경되었습니다.' };
    } catch (err) {
      console.error('Change password error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('users:register-request', async (event, { username, name, phone, role = 'FA', org_name = null }) => {
    const db = getDb();
    if (!username || !name) {
      return { success: false, error: '사번(아이디)과 성명은 필수입니다.' };
    }

    const trimmedUsername = username.trim();
    const trimmedName = name.trim();
    const trimmedPhone = (phone || '').trim();

    try {
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(trimmedUsername);
      if (existing) {
        return { success: false, error: '이미 등록된 사번(아이디)입니다. 로그인해 주세요.' };
      }

      const defaultHash = crypto.createHash('sha256').update(trimmedUsername).digest('hex');
      const now = new Date().toISOString();

      let resolvedOrgId = null;
      let resolvedOrgName = (org_name || '').trim() || null;
      if (resolvedOrgName) {
        const orgRow = db.prepare('SELECT id, name FROM organizations WHERE LOWER(name) = LOWER(?)').get(resolvedOrgName);
        if (orgRow) {
          resolvedOrgId = orgRow.id;
          resolvedOrgName = orgRow.name;
        }
      }

      const stmt = db.prepare(`
        INSERT INTO users (username, password_hash, name, phone, role, org_id, org_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(trimmedUsername, defaultHash, trimmedName, trimmedPhone, role, resolvedOrgId, resolvedOrgName, now, now);

      await syncCloudAccounts(db);
      triggerDualBackup();

      return { success: true, id: info.lastInsertRowid, message: '사용자 등록이 완료되었습니다. 초기 비밀번호는 사번과 동일합니다.' };
    } catch (err) {
      console.error('User register request error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('users:get-all', async (event, params = {}) => {
    const db = getDb();
    const currentUserId = typeof params === 'object' ? (params.currentUserId || params.userId) : params;

    try {
      const users = db.prepare(`
        SELECT u.id, u.username, u.name, u.phone, u.role, u.parent_id, u.org_id, u.org_name, u.created_at, p.name as parent_name, p.role as parent_role
        FROM users u
        LEFT JOIN users p ON u.parent_id = p.id
        ORDER BY CASE u.role 
          WHEN 'admin' THEN 1 
          WHEN 'Admin' THEN 1 
          WHEN 'CEO' THEN 2 
          WHEN '총괄' THEN 2 
          WHEN 'COO' THEN 3 
          WHEN '사업단장' THEN 3 
          WHEN '본부장' THEN 4 
          WHEN '지점장' THEN 5 
          WHEN '팀장' THEN 6 
          WHEN 'Manager' THEN 6 
          WHEN 'FA' THEN 7 
          WHEN 'Agent' THEN 7 
          ELSE 8 
        END, u.id ASC
      `).all();

      let targetUsers = users;
      if (currentUserId) {
        const actor = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(Number(currentUserId));
        const isTopAdmin = actor && (actor.role === 'Admin' || actor.role === 'admin' || actor.username === 'admin' || getRoleRank(actor.role) >= 6);

        if (!isTopAdmin) {
          // Managers only see themselves and their subordinates (superior managers are completely hidden)
          targetUsers = users.filter(u => Number(u.id) === Number(currentUserId) || isUserDescendant(db, u.id, currentUserId));
        }
      }

      const enrichedUsers = targetUsers.map(u => ({
        ...u,
        canEdit: currentUserId ? canManageTargetUser(db, currentUserId, u.id) : true
      }));

      return { success: true, users: enrichedUsers };
    } catch (err) {
      return { success: false, error: err.message, users: [] };
    }
  });

  ipcMain.handle('users:get-accessible-subordinates', async (event, currentUserId) => {
    const db = getDb();
    try {
      const accessibleUsers = getAccessibleUsersForUser(db, currentUserId);
      return { success: true, users: accessibleUsers };
    } catch (err) {
      console.error('get-accessible-subordinates error:', err);
      return { success: false, error: err.message, users: [] };
    }
  });

  ipcMain.handle('users:create', async (event, { username, password, name, phone, role = 'FA', parent_id = null, org_id = null, currentUserId = null }) => {
    const db = getDb();
    
    // Check permission: Admin or Manager creating subordinate
    if (currentUserId) {
      const actor = db.prepare('SELECT id, role, username FROM users WHERE id = ?').get(currentUserId);
      const isTopAdmin = actor && (actor.role === 'Admin' || actor.role === 'admin' || actor.username === 'admin' || getRoleRank(actor.role) >= 5);
      
      if (!isTopAdmin) {
        // If not admin, the new user's parent_id must be the actor or a descendant of actor
        const targetParentId = parent_id ? Number(parent_id) : actor.id;
        const canAssignParent = (targetParentId === actor.id) || isUserDescendant(db, targetParentId, actor.id);
        if (!canAssignParent) {
          return { success: false, error: '본인 또는 본인 하위 조직원에게만 신규 팀원을 등록할 수 있습니다.' };
        }
      }
    }

    if (!username || !name) {
      return { success: false, error: '사번(아이디)과 성명은 필수입니다.' };
    }

    const trimmedUsername = username.trim();
    const effectivePassword = (password && password.trim()) ? password.trim() : trimmedUsername;

    try {
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(trimmedUsername);
      if (existing) {
        return { success: false, error: '이미 사용 중인 사번(아이디)입니다.' };
      }

      let resolvedOrgId = org_id ? Number(org_id) : null;
      let resolvedOrgName = null;
      if (resolvedOrgId) {
        const orgRow = db.prepare('SELECT name FROM organizations WHERE id = ?').get(resolvedOrgId);
        if (orgRow) resolvedOrgName = orgRow.name;
      }
      const resolvedParentId = parent_id ? Number(parent_id) : null;

      const hash = crypto.createHash('sha256').update(effectivePassword).digest('hex');
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO users (username, password_hash, name, phone, role, parent_id, org_id, org_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(trimmedUsername, hash, name.trim(), (phone || '').trim(), role, resolvedParentId, resolvedOrgId, resolvedOrgName, now, now);

      await syncCloudAccounts(db);
      triggerDualBackup();

      return { success: true, id: info.lastInsertRowid };
    } catch (err) {
      console.error('User create error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('users:update', async (event, { id, password, name, phone, role, parent_id, org_id, org_name, currentUserId = null }) => {
    const db = getDb();
    if (!id || !name) {
      return { success: false, error: '사용자 ID와 성명은 필수입니다.' };
    }

    const targetUserId = Number(id);

    // Check Hierarchical Permission
    if (currentUserId) {
      const hasPermission = canManageTargetUser(db, currentUserId, targetUserId);
      if (!hasPermission) {
        return { success: false, error: '해당 조직원의 조직도 및 계정 정보를 수정할 권한이 없습니다.' };
      }

      // Check Circular Reference: Target user cannot have self or own descendant as parent_id
      if (parent_id) {
        const parentIdNum = Number(parent_id);
        if (parentIdNum === targetUserId) {
          return { success: false, error: '자기 자신을 직속 상위자로 지정할 수 없습니다.' };
        }
        if (isUserDescendant(db, parentIdNum, targetUserId)) {
          return { success: false, error: '본인의 하위 조직원을 상위자로 지정할 수 없습니다. (순환 참조 방지)' };
        }
      }
    }

    try {
      const now = new Date().toISOString();
      let resolvedOrgId = org_id !== undefined ? (org_id ? Number(org_id) : null) : undefined;
      let resolvedOrgName = undefined;
      if (resolvedOrgId !== undefined && resolvedOrgId !== null) {
        const orgRow = db.prepare('SELECT name FROM organizations WHERE id = ?').get(resolvedOrgId);
        resolvedOrgName = orgRow ? orgRow.name : (org_name || null);
      } else if (resolvedOrgId === null) {
        resolvedOrgName = null;
      }

      let resolvedParentId = parent_id !== undefined ? (parent_id ? Number(parent_id) : null) : undefined;

      if (password && password.trim()) {
        const hash = crypto.createHash('sha256').update(password.trim()).digest('hex');
        if (resolvedOrgId !== undefined) {
          db.prepare(`
            UPDATE users SET password_hash = ?, name = ?, phone = ?, role = ?, parent_id = ?, org_id = ?, org_name = ?, updated_at = ?
            WHERE id = ?
          `).run(hash, name.trim(), (phone || '').trim(), role || 'FA', resolvedParentId !== undefined ? resolvedParentId : null, resolvedOrgId, resolvedOrgName, now, id);
        } else {
          db.prepare(`
            UPDATE users SET password_hash = ?, name = ?, phone = ?, role = ?, parent_id = ?, updated_at = ?
            WHERE id = ?
          `).run(hash, name.trim(), (phone || '').trim(), role || 'FA', resolvedParentId !== undefined ? resolvedParentId : null, now, id);
        }
      } else {
        if (resolvedOrgId !== undefined) {
          db.prepare(`
            UPDATE users SET name = ?, phone = ?, role = ?, parent_id = ?, org_id = ?, org_name = ?, updated_at = ?
            WHERE id = ?
          `).run(name.trim(), (phone || '').trim(), role || 'FA', resolvedParentId !== undefined ? resolvedParentId : null, resolvedOrgId, resolvedOrgName, now, id);
        } else {
          db.prepare(`
            UPDATE users SET name = ?, phone = ?, role = ?, parent_id = ?, updated_at = ?
            WHERE id = ?
          `).run(name.trim(), (phone || '').trim(), role || 'FA', resolvedParentId !== undefined ? resolvedParentId : null, now, id);
        }
      }

      await syncCloudAccounts(db);
      triggerDualBackup();

      return { success: true };
    } catch (err) {
      console.error('User update error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('users:delete', async (event, params) => {
    const db = getDb();
    const id = typeof params === 'object' ? params.id : params;
    const currentUserId = typeof params === 'object' ? params.currentUserId : null;

    // Check Admin permission
    if (currentUserId) {
      const actor = db.prepare('SELECT role, username FROM users WHERE id = ?').get(currentUserId);
      if (!actor || (actor.role !== 'Admin' && actor.role !== 'admin' && actor.username !== 'admin')) {
        return { success: false, error: '사용자 삭제 권한이 없습니다. (최고 관리자 전용)' };
      }
    }

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
