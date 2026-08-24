const { ipcMain } = require('electron');
const { getDb } = require('../database');
const { syncCloudAccounts } = require('../services/cloudSyncService');
const { getRoleRank } = require('./authHandlers');
const { normalizeCustomerInsurances } = require('../services/documentParserService');

function registerOrgHandlers(mainWindow, triggerDualBackup) {
  ipcMain.handle('org:get-all-organizations', async (event, params = {}) => {
    const db = getDb();
    try {
      const actingUserId = typeof params === 'object' ? (params.currentUserId || params.userId) : params;

      const orgs = db.prepare(`
        SELECT o.id, o.name, o.type, o.parent_id, o.created_at, o.updated_at,
          p.name as parent_org_name
        FROM organizations o
        LEFT JOIN organizations p ON o.parent_id = p.id
        ORDER BY CASE o.type
          WHEN 'Executive' THEN 1
          WHEN 'HQ' THEN 1
          WHEN 'Headquarters' THEN 2
          WHEN 'Division' THEN 3
          WHEN 'Branch' THEN 4
          WHEN 'Team' THEN 5
          ELSE 6
        END, o.id ASC
      `).all();

      const allUsers = db.prepare('SELECT id, username, name, role, org_id, org_name FROM users').all();
      const orgMap = new Map();
      orgs.forEach(o => orgMap.set(o.id, o));

      const enrichedOrgs = orgs.map(o => {
        const pathNames = [o.name];
        let currParentId = o.parent_id;
        let guard = 0;
        while (currParentId && guard < 20) {
          guard++;
          const pOrg = orgMap.get(currParentId);
          if (pOrg) {
            pathNames.unshift(pOrg.name);
            currParentId = pOrg.parent_id;
          } else {
            break;
          }
        }

        const subOrgIds = new Set([o.id]);
        const subOrgNames = new Set([o.name]);
        let addedNew = true;
        let iterGuard = 0;
        while (addedNew && iterGuard < 50) {
          addedNew = false;
          iterGuard++;
          for (const sub of orgs) {
            if (sub.parent_id && subOrgIds.has(sub.parent_id) && !subOrgIds.has(sub.id)) {
              subOrgIds.add(sub.id);
              subOrgNames.add(sub.name);
              addedNew = true;
            }
          }
        }

        const totalMembers = allUsers.filter(u => {
          if (u.org_id && subOrgIds.has(Number(u.org_id))) return true;
          if (u.org_name && subOrgNames.has(u.org_name)) return true;
          return false;
        });

        const directMembers = allUsers.filter(u => {
          if (u.org_id && Number(u.org_id) === o.id) return true;
          if (u.org_name && u.org_name === o.name) return true;
          return false;
        });

        return {
          ...o,
          org_path: pathNames.join(' ➔ '),
          direct_member_count: directMembers.length,
          total_member_count: totalMembers.length,
          member_count: totalMembers.length
        };
      });

      if (actingUserId) {
        const currentUser = allUsers.find(u => Number(u.id) === Number(actingUserId));
        if (currentUser) {
          const userRank = getRoleRank(currentUser.role);
          const isTopAdmin = userRank >= 5 || currentUser.role === 'Admin' || currentUser.role === 'admin';

          if (!isTopAdmin) {
            let userOrg = null;
            if (currentUser.org_id) {
              userOrg = enrichedOrgs.find(o => o.id === Number(currentUser.org_id));
            }
            if (!userOrg && currentUser.org_name) {
              userOrg = enrichedOrgs.find(o => o.name === currentUser.org_name);
            }

            if (userOrg) {
              const allowedOrgIds = new Set([userOrg.id]);
              let addedSub = true;
              let g = 0;
              while (addedSub && g < 30) {
                addedSub = false;
                g++;
                for (const org of enrichedOrgs) {
                  if (org.parent_id && allowedOrgIds.has(org.parent_id) && !allowedOrgIds.has(org.id)) {
                    allowedOrgIds.add(org.id);
                    addedSub = true;
                  }
                }
              }

              const filtered = enrichedOrgs.map(o => ({
                ...o,
                canEdit: allowedOrgIds.has(o.id)
              }));
              return { success: true, organizations: filtered };
            } else {
              return { success: true, organizations: enrichedOrgs.map(o => ({ ...o, canEdit: false })) };
            }
          }
        }
      }

      return { success: true, organizations: enrichedOrgs.map(o => ({ ...o, canEdit: true })) };
    } catch (err) {
      console.error('get-all-organizations error:', err);
      return { success: false, error: err.message, organizations: [] };
    }
  });

  ipcMain.handle('org:create-organization', async (event, { name, type = 'Team', parent_id = null, currentUserId = null }) => {
    const db = getDb();
    
    // Check permission: Admin or Manager creating sub-org
    if (currentUserId) {
      const actor = db.prepare('SELECT role, username FROM users WHERE id = ?').get(currentUserId);
      const isTopAdmin = actor && (actor.role === 'Admin' || actor.role === 'admin' || actor.username === 'admin' || getRoleRank(actor.role) >= 3);
      if (!isTopAdmin) {
        return { success: false, error: '조직 생성 권한이 없습니다. (관리자 이상 전용)' };
      }
    }

    if (!name || !name.trim()) {
      return { success: false, error: '조직명(팀/본부 이름)을 입력해 주세요.' };
    }
    try {
      const trimmedName = name.trim();
      const existing = db.prepare('SELECT id FROM organizations WHERE LOWER(name) = LOWER(?)').get(trimmedName);
      if (existing) {
        return { success: false, error: '이미 존재하는 조직명입니다.' };
      }
      const now = new Date().toISOString();
      const parentIdNum = parent_id ? Number(parent_id) : null;
      const stmt = db.prepare(`
        INSERT INTO organizations (name, type, parent_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      const info = stmt.run(trimmedName, type, parentIdNum, now, now);
      await syncCloudAccounts(db);
      return { success: true, id: info.lastInsertRowid, message: `[${trimmedName}] 조직이 생성되었습니다.` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('org:update-organization', async (event, { id, name, type, parent_id, currentUserId = null }) => {
    const db = getDb();
    
    // Check permission
    if (currentUserId) {
      const actor = db.prepare('SELECT role, username FROM users WHERE id = ?').get(currentUserId);
      const isTopAdmin = actor && (actor.role === 'Admin' || actor.role === 'admin' || actor.username === 'admin' || getRoleRank(actor.role) >= 3);
      if (!isTopAdmin) {
        return { success: false, error: '조직 정보 수정 권한이 없습니다.' };
      }
    }

    if (!id || !name || !name.trim()) {
      return { success: false, error: '조직 ID와 조직명은 필수입니다.' };
    }
    try {
      const trimmedName = name.trim();
      const existing = db.prepare('SELECT id FROM organizations WHERE LOWER(name) = LOWER(?) AND id != ?').get(trimmedName, id);
      if (existing) {
        return { success: false, error: '이미 사용 중인 다른 조직명입니다.' };
      }
      const now = new Date().toISOString();
      const parentIdNum = parent_id !== undefined ? (parent_id ? Number(parent_id) : null) : undefined;

      if (parentIdNum !== undefined) {
        db.prepare(`
          UPDATE organizations
          SET name = ?, type = ?, parent_id = ?, updated_at = ?
          WHERE id = ?
        `).run(trimmedName, type || 'Team', parentIdNum, now, id);
      } else {
        db.prepare(`
          UPDATE organizations
          SET name = ?, type = ?, updated_at = ?
          WHERE id = ?
        `).run(trimmedName, type || 'Team', now, id);
      }

      db.prepare('UPDATE users SET org_name = ?, updated_at = ? WHERE org_id = ?').run(trimmedName, now, id);
      await syncCloudAccounts(db);
      return { success: true, message: '조직 정보가 성공적으로 수정되었습니다.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('org:delete-organization', async (event, params) => {
    const db = getDb();
    const id = typeof params === 'object' ? params.id : params;
    const currentUserId = typeof params === 'object' ? params.currentUserId : null;

    // Check Admin permission
    if (currentUserId) {
      const actor = db.prepare('SELECT role, username FROM users WHERE id = ?').get(currentUserId);
      if (!actor || (actor.role !== 'Admin' && actor.role !== 'admin' && actor.username !== 'admin')) {
        return { success: false, error: '조직 삭제 권한이 없습니다. (최고 관리자 전용)' };
      }
    }

    try {
      const members = db.prepare('SELECT COUNT(*) as count FROM users WHERE org_id = ?').get(id);
      if (members.count > 0) {
        return { success: false, error: `해당 조직에 소속된 팀원(${members.count}명)이 존재하여 삭제할 수 없습니다. 먼저 소속을 변경해 주세요.` };
      }
      const children = db.prepare('SELECT COUNT(*) as count FROM organizations WHERE parent_id = ?').get(id);
      if (children.count > 0) {
        return { success: false, error: `해당 조직의 하위 조직(${children.count}개)이 존재하여 삭제할 수 없습니다.` };
      }
      db.prepare('DELETE FROM organizations WHERE id = ?').run(id);
      await syncCloudAccounts(db);
      return { success: true, message: '조직이 성공적으로 삭제되었습니다.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('org:get-subordinate-data', async (event, params) => {
    const db = getDb();
    try {
      let currentUserId = null;
      let targetUserId = null;

      if (typeof params === 'object' && params !== null) {
        currentUserId = params.currentUserId || params.managerUserId || params.userId;
        targetUserId = params.targetUserId;
      } else {
        currentUserId = params;
        targetUserId = params;
      }

      if (!currentUserId && !targetUserId) {
        return { success: false, error: '사용자 ID가 지정되지 않았습니다.' };
      }

      const actingTargetId = targetUserId || currentUserId;

      // 1. Fetch Target User Profile
      const targetUser = db.prepare(`
        SELECT u.id, u.username, u.name, u.role, u.parent_id, u.org_id, u.org_name, u.phone,
               o.name as organization_name, o.type as organization_type,
               p.name as parent_name, p.role as parent_role
        FROM users u
        LEFT JOIN organizations o ON u.org_id = o.id
        LEFT JOIN users p ON u.parent_id = p.id
        WHERE u.id = ?
      `).get(actingTargetId);

      if (!targetUser) {
        return { success: false, error: '대상 사용자를 찾을 수 없습니다.' };
      }

      // Build target user's organization path
      let orgPath = targetUser.org_name || targetUser.organization_name || '소속 미지정';
      if (targetUser.org_id) {
        const pathSegments = [];
        let curOrg = db.prepare('SELECT id, name, parent_id FROM organizations WHERE id = ?').get(targetUser.org_id);
        while (curOrg) {
          pathSegments.unshift(curOrg.name);
          if (curOrg.parent_id) {
            curOrg = db.prepare('SELECT id, name, parent_id FROM organizations WHERE id = ?').get(curOrg.parent_id);
          } else {
            break;
          }
        }
        if (pathSegments.length > 0) {
          orgPath = pathSegments.join(' > ');
        }
      }
      targetUser.orgPath = orgPath;

      // 2. Fetch Schedules for Target User
      const schedules = db.prepare(`
        SELECT s.*, u.name as user_name, u.role as user_role, u.org_name as user_org_name, c.name as customer_name
        FROM schedules s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.user_id = ?
        ORDER BY s.scheduled_at ASC
      `).all(actingTargetId);

      // 3. Fetch All Customers for Target User
      const customersRaw = db.prepare(`
        SELECT c.*, u.name as user_name, u.role as user_role, u.org_name as user_org_name
        FROM customers c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.user_id = ?
        ORDER BY c.name ASC
      `).all(actingTargetId);

      const customers = customersRaw.map(normalizeCustomerInsurances);

      // 4. Calculate 6-Month Long-Touch Customers
      const now = new Date();
      const past6MonthsTime = now.getTime() - (180 * 24 * 60 * 60 * 1000);
      const future1MonthTime = now.getTime() + (30 * 24 * 60 * 60 * 1000);

      const longTouchList = [];

      for (const cust of customers) {
        const custSchedules = schedules.filter(s => {
          if (s.customer_id && String(s.customer_id) === String(cust.id)) return true;
          if (s.title && cust.name && s.title.includes(cust.name)) return true;
          return false;
        });

        // Find most recent schedule date
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

          longTouchList.push({
            ...cust,
            last_schedule_date: latestScheduleDate,
            elapsed_days: elapsedDays,
            elapsed_months: elapsedMonths > 0 ? elapsedMonths : (elapsedDays > 0 ? 1 : 0),
            is_long_touch: true
          });
        }
      }

      // 5. Filter POOL Customers
      const poolList = customers.filter(c => c.is_pool === 1 || c.pool_group || c.relationship);

      // 6. Calculate Detailed Stats for Dashboard
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const upcomingThisMonth = schedules.filter(s => {
        const sDate = s.date || (s.scheduled_at ? s.scheduled_at.slice(0, 7) : '');
        return sDate.startsWith(currentYearMonth);
      }).length;

      const activeCustomers = customers.filter(c => c.status === 'Active').length;
      const leadCustomers = customers.filter(c => c.status === 'Lead').length;
      const pendingSchedules = schedules.filter(s => s.status === 'Pending').length;
      const completedSchedules = schedules.filter(s => s.status === 'Completed').length;

      const stats = {
        totalCustomers: customers.length,
        longTouchCustomers: longTouchList.length,
        activeCustomers,
        leadCustomers,
        totalSchedules: schedules.length,
        pendingSchedules,
        completedSchedules,
        upcomingThisMonth
      };

      return {
        success: true,
        targetUser,
        stats,
        longTouchList,
        longTouchCustomers: longTouchList,
        schedules,
        customers,
        poolCustomers: poolList,
        poolList
      };
    } catch (err) {
      console.error('get-subordinate-data error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('org:get-organization-aggregate-data', async (event, { orgId, orgName, currentUserId = null }) => {
    const db = getDb();
    try {
      const allOrgs = db.prepare('SELECT id, name, type, parent_id FROM organizations').all();
      const orgMap = new Map();
      allOrgs.forEach(o => orgMap.set(o.id, o));

      // 1. Collect target org and ALL its recursive sub-organizations (children, grandchildren, etc.)
      const subOrgIds = new Set();
      const subOrgNames = new Set();

      let targetOrg = null;
      if (orgId) {
        targetOrg = orgMap.get(Number(orgId));
      }
      if (!targetOrg && orgName) {
        targetOrg = allOrgs.find(o => o.name === orgName);
      }

      if (targetOrg) {
        subOrgIds.add(targetOrg.id);
        subOrgNames.add(targetOrg.name);

        let added = true;
        let guard = 0;
        while (added && guard < 50) {
          added = false;
          guard++;
          for (const o of allOrgs) {
            if (o.parent_id && subOrgIds.has(Number(o.parent_id)) && !subOrgIds.has(Number(o.id))) {
              subOrgIds.add(Number(o.id));
              subOrgNames.add(o.name);
              added = true;
            }
          }
        }
      }

      // 2. Query all users and filter by subOrgIds
      const allUsers = db.prepare(`
        SELECT u.id, u.username, u.name, u.phone, u.role, u.parent_id, u.org_id, u.org_name, u.created_at, p.name as parent_name
        FROM users u
        LEFT JOIN users p ON u.parent_id = p.id
      `).all();

      let orgUsers = [];
      if (subOrgIds.size > 0) {
        orgUsers = allUsers.filter(u => {
          if (u.org_id && subOrgIds.has(Number(u.org_id))) return true;
          if (u.org_name && subOrgNames.has(u.org_name)) return true;
          return false;
        });
      } else if (orgName) {
        orgUsers = allUsers.filter(u => u.org_name === orgName);
      }

      const userIds = orgUsers.map(u => u.id);
      if (userIds.length === 0) {
        return {
          success: true,
          orgInfo: { id: orgId, name: orgName },
          members: [],
          stats: { memberCount: 0, totalCustomers: 0, longTouchCustomers: 0, activeCustomers: 0, leadCustomers: 0, totalSchedules: 0, pendingSchedules: 0, completedSchedules: 0, upcomingThisMonth: 0 },
          customers: [],
          longTouchList: [],
          schedules: []
        };
      }

      const placeholders = userIds.map(() => '?').join(',');
      const schedules = db.prepare(`
        SELECT s.*, u.name as user_name, u.role as user_role, u.org_name as user_org_name, c.name as customer_name
        FROM schedules s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.user_id IN (${placeholders})
        ORDER BY s.scheduled_at ASC
      `).all(...userIds);

      const rawCustomers = db.prepare(`
        SELECT c.id, c.user_id, c.name, c.status, c.created_at, u.name as user_name, u.role as user_role, u.org_name as user_org_name
        FROM customers c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.user_id IN (${placeholders})
      `).all(...userIds);

      const now = new Date();
      const past6MonthsTime = now.getTime() - (180 * 24 * 60 * 60 * 1000);
      const future1MonthTime = now.getTime() + (30 * 24 * 60 * 60 * 1000);

      const longTouchList = [];
      rawCustomers.forEach(cust => {
        const custSchedules = schedules.filter(s => {
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

        const hasScheduleInWindow = custSchedules.some(s => {
          if (!s.scheduled_at) return false;
          const stTime = new Date(s.scheduled_at).getTime();
          return !isNaN(stTime) && stTime >= past6MonthsTime && stTime <= future1MonthTime;
        });

        if (cust.status === 'Inactive' || !hasScheduleInWindow) {
          const baseTime = latestScheduleTime > 0 ? latestScheduleTime : new Date(cust.created_at || now).getTime();
          const elapsedMs = Math.max(0, now.getTime() - baseTime);
          const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
          const elapsedMonths = Math.floor(elapsedDays / 30);

          longTouchList.push({
            id: cust.id,
            name: cust.name,
            user_id: cust.user_id,
            user_name: cust.user_name || '미배정',
            user_role: cust.user_role || 'FA',
            user_org_name: cust.user_org_name || '',
            status: cust.status,
            last_schedule_date: latestScheduleDate,
            elapsed_days: elapsedDays,
            elapsed_months: elapsedMonths > 0 ? elapsedMonths : (elapsedDays > 0 ? 1 : 0),
            is_long_touch: true
          });
        }
      });

      const thisMonthYear = now.getFullYear();
      const thisMonthIdx = now.getMonth();
      const upcomingThisMonth = schedules.filter(s => {
        if (!s.scheduled_at) return false;
        const d = new Date(s.scheduled_at);
        return d.getFullYear() === thisMonthYear && d.getMonth() === thisMonthIdx;
      }).length;

      const stats = {
        memberCount: orgUsers.length,
        totalCustomers: rawCustomers.length,
        longTouchCustomers: longTouchList.length,
        activeCustomers: rawCustomers.filter(c => c.status === 'Active').length,
        leadCustomers: rawCustomers.filter(c => c.status === 'Lead').length,
        totalSchedules: schedules.length,
        pendingSchedules: schedules.filter(s => s.status === 'Pending').length,
        completedSchedules: schedules.filter(s => s.status === 'Completed').length,
        upcomingThisMonth: upcomingThisMonth
      };

      return {
        success: true,
        orgInfo: { id: orgId, name: orgName },
        members: orgUsers,
        stats,
        customers: [], // Hide general customer details
        longTouchList,
        schedules
      };
    } catch (err) {
      console.error('get-organization-aggregate-data error:', err);
      return { success: false, error: err.message };
    }
  });
}

module.exports = {
  registerOrgHandlers
};
