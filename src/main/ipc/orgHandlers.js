const { ipcMain } = require('electron');
const { getDb } = require('../database');
const { syncCloudAccounts } = require('../services/cloudSyncService');
const { getRoleRank } = require('./authHandlers');

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

              const filtered = enrichedOrgs.filter(o => allowedOrgIds.has(o.id));
              return { success: true, organizations: filtered };
            } else {
              return { success: true, organizations: [] };
            }
          }
        }
      }

      return { success: true, organizations: enrichedOrgs };
    } catch (err) {
      console.error('get-all-organizations error:', err);
      return { success: false, error: err.message, organizations: [] };
    }
  });

  ipcMain.handle('org:create-organization', async (event, { name, type = 'Team', parent_id = null }) => {
    const db = getDb();
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

  ipcMain.handle('org:update-organization', async (event, { id, name, type, parent_id }) => {
    const db = getDb();
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

  ipcMain.handle('org:delete-organization', async (event, id) => {
    const db = getDb();
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

  ipcMain.handle('org:get-subordinate-data', async (event, managerUserId) => {
    const db = getDb();
    try {
      const subordinateUsers = getAccessibleUsersForUser(db, managerUserId);
      const subUserIds = subordinateUsers.map(u => u.id);

      if (subUserIds.length === 0) {
        return { success: true, users: [], schedules: [], longTouchCustomers: [] };
      }

      const placeholders = subUserIds.map(() => '?').join(',');

      const schedules = db.prepare(`
        SELECT s.*, u.name as user_name, u.role as user_role, u.org_name as user_org_name, c.name as customer_name, c.phone as customer_phone
        FROM schedules s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.user_id IN (${placeholders})
        ORDER BY s.scheduled_at ASC
      `).all(...subUserIds);

      const customers = db.prepare(`
        SELECT c.*, u.name as user_name, u.role as user_role, u.org_name as user_org_name
        FROM customers c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.user_id IN (${placeholders})
        ORDER BY c.name ASC
      `).all(...subUserIds);

      const now = new Date();
      const past6MonthsTime = now.getTime() - (180 * 24 * 60 * 60 * 1000);
      const future1MonthTime = now.getTime() + (30 * 24 * 60 * 60 * 1000);

      const longTouchCustomers = customers.filter(cust => {
        const custSchedules = schedules.filter(s => {
          if (s.customer_id && String(s.customer_id) === String(cust.id)) return true;
          if (s.title && cust.name && s.title.includes(cust.name)) return true;
          return false;
        });

        const hasRecentSchedule = custSchedules.some(s => {
          if (!s.scheduled_at) return false;
          const stTime = new Date(s.scheduled_at).getTime();
          return !isNaN(stTime) && stTime >= past6MonthsTime && stTime <= future1MonthTime;
        });

        return cust.status === 'Inactive' || !hasRecentSchedule;
      });

      return {
        success: true,
        users: subordinateUsers,
        schedules,
        longTouchCustomers
      };
    } catch (err) {
      console.error('get-subordinate-data error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('org:get-organization-aggregate-data', async (event, { orgId, orgName }) => {
    const db = getDb();
    try {
      let orgUsers = [];
      if (orgId) {
        orgUsers = db.prepare(`
          SELECT u.id, u.username, u.name, u.phone, u.role, u.parent_id, u.org_id, u.org_name, u.created_at, p.name as parent_name
          FROM users u
          LEFT JOIN users p ON u.parent_id = p.id
          WHERE u.org_id = ?
        `).all(orgId);
      } else if (orgName) {
        orgUsers = db.prepare(`
          SELECT u.id, u.username, u.name, u.phone, u.role, u.parent_id, u.org_id, u.org_name, u.created_at, p.name as parent_name
          FROM users u
          LEFT JOIN users p ON u.parent_id = p.id
          WHERE u.org_name = ?
        `).all(orgName);
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

      const customers = db.prepare(`
        SELECT c.*, u.name as user_name, u.role as user_role, u.org_name as user_org_name
        FROM customers c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.user_id IN (${placeholders})
        ORDER BY c.name ASC
      `).all(...userIds);

      const schedules = db.prepare(`
        SELECT s.*, u.name as user_name, u.role as user_role, u.org_name as user_org_name, c.name as customer_name, c.phone as customer_phone
        FROM schedules s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.user_id IN (${placeholders})
        ORDER BY s.scheduled_at ASC
      `).all(...userIds);

      const now = new Date();
      const past6MonthsTime = now.getTime() - (180 * 24 * 60 * 60 * 1000);
      const future1MonthTime = now.getTime() + (30 * 24 * 60 * 60 * 1000);

      const longTouchList = [];
      const processedCustomers = customers.map(cust => {
        const custSchedules = schedules.filter(s => {
          if (s.customer_id && String(s.customer_id) === String(cust.id)) return true;
          if (s.title && cust.name && s.title.includes(cust.name)) return true;
          if (s.description && cust.name && s.description.includes(cust.name)) return true;
          return false;
        });

        let lastTouchedAt = null;
        let untouchedDays = null;
        const pastSchedules = custSchedules
          .filter(s => s.scheduled_at && new Date(s.scheduled_at).getTime() <= now.getTime())
          .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

        if (pastSchedules.length > 0) {
          lastTouchedAt = pastSchedules[0].scheduled_at;
          const diffMs = now.getTime() - new Date(lastTouchedAt).getTime();
          untouchedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        } else if (cust.created_at) {
          lastTouchedAt = cust.created_at;
          const diffMs = now.getTime() - new Date(lastTouchedAt).getTime();
          untouchedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        const hasScheduleInWindow = custSchedules.some(s => {
          if (!s.scheduled_at) return false;
          const stTime = new Date(s.scheduled_at).getTime();
          return !isNaN(stTime) && stTime >= past6MonthsTime && stTime <= future1MonthTime;
        });

        const isLongTouch = cust.status === 'Inactive' || !hasScheduleInWindow;
        const enrichedCustomer = {
          ...cust,
          is_long_touch: isLongTouch,
          last_touched_at: lastTouchedAt,
          untouched_days: untouchedDays,
          schedule_count: custSchedules.length
        };

        if (isLongTouch) {
          longTouchList.push(enrichedCustomer);
        }

        return enrichedCustomer;
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
        totalCustomers: processedCustomers.length,
        longTouchCustomers: longTouchList.length,
        activeCustomers: processedCustomers.filter(c => c.status === 'Active' && !c.is_long_touch).length,
        leadCustomers: processedCustomers.filter(c => c.status === 'Lead' && !c.is_long_touch).length,
        totalSchedules: schedules.length,
        pendingSchedules: schedules.filter(s => s.status === 'Pending').length,
        completedSchedules: schedules.filter(s => s.status === 'Completed').length,
        upcomingThisMonth
      };

      return {
        success: true,
        orgInfo: { id: orgId, name: orgName },
        members: orgUsers,
        stats,
        customers: processedCustomers,
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
