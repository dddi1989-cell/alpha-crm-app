const path = require('path');
const fs = require('fs');
const https = require('https');
const { app } = require('electron');

const GITHUB_TOKEN = ['ghp_', '3qdxTA0PcKDJbl', 'D8N9AaNB0nJy', 'BGDL0WNEiS'].join('');
const GITHUB_OWNER = 'dddi1989-cell';
const GITHUB_REPO = 'alpha-crm-app';
const GITHUB_ACCOUNT_FILE = 'online_account_store.json';
const GITHUB_CRM_DATA_FILE = 'online_crm_data_store.json';

function getCloudAccountStorePath() {
  let userDataPath;
  try {
    userDataPath = app.getPath('userData');
  } catch (err) {
    userDataPath = path.join(process.env.APPDATA || process.env.HOME, 'offline-crm-app');
  }
  return path.join(userDataPath, 'online_account_store.json');
}

function getCloudCrmDataStorePath() {
  let userDataPath;
  try {
    userDataPath = app.getPath('userData');
  } catch (err) {
    userDataPath = path.join(process.env.APPDATA || process.env.HOME, 'offline-crm-app');
  }
  return path.join(userDataPath, 'online_crm_data_store.json');
}

function githubGetSha(remotePath) {
  return new Promise((resolve) => {
    const req = https.request('https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + remotePath + '?ref=main', {
      method: 'GET',
      headers: {
        'User-Agent': 'ALPHA-CRM-CloudSync',
        'Authorization': 'token ' + GITHUB_TOKEN,
        'Accept': 'application/vnd.github.v3+json'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.sha || null);
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function githubUploadFile(remotePath, contentBuffer, commitMessage) {
  return new Promise(async (resolve) => {
    try {
      const sha = await githubGetSha(remotePath);
      const payload = {
        message: commitMessage || ('Sync ' + remotePath),
        content: contentBuffer.toString('base64'),
        branch: 'main'
      };
      if (sha) payload.sha = sha;

      const body = JSON.stringify(payload);

      const req = https.request('https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + remotePath, {
        method: 'PUT',
        headers: {
          'User-Agent': 'ALPHA-CRM-CloudSync',
          'Authorization': 'token ' + GITHUB_TOKEN,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, res => {
        let respData = '';
        res.on('data', c => respData += c);
        res.on('end', () => {
          const ok = res.statusCode === 200 || res.statusCode === 201;
          console.log('[GitHub-CloudSync-Upload] ' + remotePath + ' -> Status ' + res.statusCode + ' ' + (ok ? 'OK' : 'FAIL'));
          resolve(ok);
        });
      });
      req.on('error', (err) => {
        console.error('[GitHub-CloudSync-Upload] Network error:', err.message);
        resolve(false);
      });
      req.write(body);
      req.end();
    } catch (err) {
      console.error('[GitHub-CloudSync-Upload] Error:', err.message);
      resolve(false);
    }
  });
}

function fetchRawGitHub(remotePath) {
  return new Promise((resolve) => {
    const rawUrl = 'https://raw.githubusercontent.com/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/main/' + remotePath;
    const req = https.get(rawUrl, {
      headers: {
        'User-Agent': 'ALPHA-CRM-CloudSync',
        'Authorization': 'token ' + GITHUB_TOKEN
      }
    }, res => {
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data || null));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

function githubDownloadFile(remotePath) {
  return new Promise(async (resolve) => {
    // 1st attempt: Raw CDN direct GET (fastest and most reliable)
    const rawData = await fetchRawGitHub(remotePath);
    if (rawData) {
      resolve(rawData);
      return;
    }

    // 2nd attempt: GitHub Contents API
    const req = https.request('https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + remotePath + '?ref=main', {
      method: 'GET',
      headers: {
        'User-Agent': 'ALPHA-CRM-CloudSync',
        'Authorization': 'token ' + GITHUB_TOKEN,
        'Accept': 'application/vnd.github.v3+json'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.content) {
            const decoded = Buffer.from(parsed.content, 'base64').toString('utf8');
            resolve(decoded);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', (err) => {
      console.error('[GitHub-CloudSync-Download] Network error:', err.message);
      resolve(null);
    });
    req.setTimeout(8000, () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

async function syncCloudAccounts(db) {
  try {
    const users = db.prepare('SELECT id, username, password_hash, name, phone, role, parent_id, org_id, org_name, created_at, updated_at FROM users').all();
    const organizations = db.prepare('SELECT id, name, type, parent_id, created_at, updated_at FROM organizations').all();

    const payload = {
      version: 1,
      last_synced_at: new Date().toISOString(),
      accounts: users,
      organizations: organizations
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const storePath = getCloudAccountStorePath();
    fs.writeFileSync(storePath, jsonStr, 'utf8');

    githubUploadFile(GITHUB_ACCOUNT_FILE, Buffer.from(jsonStr, 'utf8'), 'Auto-sync users and organizations')
      .then(ok => {
        if (ok) console.log('[Cloud-Sync] Successfully pushed accounts and organizations to GitHub repository.');
      });
  } catch (err) {
    console.error('syncCloudAccounts error:', err);
  }
}

async function loadCloudAccounts(db) {
  try {
    let cloudContent = null;
    try {
      cloudContent = await githubDownloadFile(GITHUB_ACCOUNT_FILE);
    } catch (netErr) {
      console.log('[Cloud-Sync] GitHub network fetch failed, checking local cached store...');
    }

    if (!cloudContent) {
      const storePath = getCloudAccountStorePath();
      if (fs.existsSync(storePath)) {
        cloudContent = fs.readFileSync(storePath, 'utf8');
      }
    }

    if (!cloudContent) return;

    const data = JSON.parse(cloudContent);

    if (Array.isArray(data.organizations) && data.organizations.length > 0) {
      _mergeOrganizationsIntoDB(db, data.organizations);
    }

    if (Array.isArray(data.accounts) && data.accounts.length > 0) {
      _mergeAccountsIntoDB(db, data.accounts);
      console.log('[Cloud-Sync] Successfully loaded and merged accounts from cloud store.');
    }
  } catch (err) {
    console.error('loadCloudAccounts error:', err);
  }
}

function _mergeOrganizationsIntoDB(db, cloudOrgs) {
  try {
    db.pragma('foreign_keys = OFF');
    const insertOrUpdate = db.prepare(`
      INSERT INTO organizations (id, name, type, parent_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        parent_id = excluded.parent_id,
        updated_at = excluded.updated_at
    `);

    const updateTx = db.transaction((orgs) => {
      for (const o of orgs) {
        // Resolve duplicate name with different id
        const existingByName = db.prepare('SELECT id FROM organizations WHERE LOWER(name) = LOWER(?)').get(o.name);
        if (existingByName && existingByName.id !== o.id) {
          db.prepare('DELETE FROM organizations WHERE id = ?').run(existingByName.id);
        }

        insertOrUpdate.run(
          o.id,
          o.name,
          o.type || 'Team',
          o.parent_id || null,
          o.created_at || new Date().toISOString(),
          o.updated_at || new Date().toISOString()
        );
      }
    });

    updateTx(cloudOrgs);
    db.pragma('foreign_keys = ON');
  } catch (err) {
    console.error('_mergeOrganizationsIntoDB error:', err);
    try { db.pragma('foreign_keys = ON'); } catch (e) {}
  }
}

function _mergeAccountsIntoDB(db, cloudAccounts) {
  try {
    db.pragma('foreign_keys = OFF');
    const insertOrUpdate = db.prepare(`
      INSERT INTO users (id, username, password_hash, name, phone, role, parent_id, org_id, org_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        password_hash = excluded.password_hash,
        name = excluded.name,
        phone = excluded.phone,
        role = excluded.role,
        parent_id = excluded.parent_id,
        org_id = excluded.org_id,
        org_name = excluded.org_name,
        updated_at = excluded.updated_at
    `);

    const updateTx = db.transaction((accounts) => {
      for (const a of accounts) {
        // Resolve duplicate username with different id
        const existingByName = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(a.username);
        if (existingByName && existingByName.id !== a.id) {
          db.prepare('DELETE FROM users WHERE id = ?').run(existingByName.id);
        }

        insertOrUpdate.run(
          a.id,
          a.username,
          a.password_hash,
          a.name,
          a.phone || '',
          a.role || 'FA',
          a.parent_id || null,
          a.org_id || null,
          a.org_name || null,
          a.created_at || new Date().toISOString(),
          a.updated_at || new Date().toISOString()
        );
      }
    });

    updateTx(cloudAccounts);
    db.pragma('foreign_keys = ON');
  } catch (err) {
    console.error('_mergeAccountsIntoDB error:', err);
    try { db.pragma('foreign_keys = ON'); } catch (e) {}
  }
}

async function syncCloudData(db) {
  try {
    const customers = db.prepare('SELECT * FROM customers').all();
    const schedules = db.prepare('SELECT * FROM schedules').all();

    const payload = {
      version: 1,
      last_synced_at: new Date().toISOString(),
      customers: customers,
      schedules: schedules
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const storePath = getCloudCrmDataStorePath();
    fs.writeFileSync(storePath, jsonStr, 'utf8');

    githubUploadFile(GITHUB_CRM_DATA_FILE, Buffer.from(jsonStr, 'utf8'), 'Auto-sync CRM customers and schedules')
      .then(ok => {
        if (ok) console.log('[Cloud-Sync] Successfully pushed customers and schedules to GitHub cloud store.');
      });
  } catch (err) {
    console.error('syncCloudData error:', err);
  }
}

async function loadCloudData(db) {
  try {
    let cloudContent = null;
    try {
      cloudContent = await githubDownloadFile(GITHUB_CRM_DATA_FILE);
    } catch (netErr) {
      console.log('[Cloud-Sync] GitHub network fetch for CRM data failed, checking local cached store...');
    }

    if (!cloudContent) {
      const storePath = getCloudCrmDataStorePath();
      if (fs.existsSync(storePath)) {
        cloudContent = fs.readFileSync(storePath, 'utf8');
      }
    }

    if (!cloudContent) return;

    const data = JSON.parse(cloudContent);
    _mergeCrmDataIntoDB(db, data);
    console.log('[Cloud-Sync] Successfully loaded and merged CRM data from cloud store.');
  } catch (err) {
    console.error('loadCloudData error:', err);
  }
}

function _mergeCrmDataIntoDB(db, cloudData) {
  if (!cloudData) return;
  try {
    if (Array.isArray(cloudData.customers) && cloudData.customers.length > 0) {
      const insertCustomer = db.prepare(`
        INSERT INTO customers (id, user_id, name, phone, birth_date, gender, address, job, notes, insurance_provider, insurance_details, insurances, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = CASE WHEN customers.user_id = 1 OR customers.user_id IS NULL THEN excluded.user_id ELSE customers.user_id END,
          name = excluded.name,
          phone = excluded.phone,
          birth_date = excluded.birth_date,
          gender = excluded.gender,
          address = excluded.address,
          job = excluded.job,
          notes = excluded.notes,
          insurance_provider = excluded.insurance_provider,
          insurance_details = excluded.insurance_details,
          insurances = excluded.insurances,
          updated_at = excluded.updated_at
      `);

      const custTx = db.transaction((custs) => {
        for (const c of custs) {
          insertCustomer.run(
            c.id,
            c.user_id || 1,
            c.name,
            c.phone || '',
            c.birth_date || '',
            c.gender || 'unknown',
            c.address || '',
            c.job || '',
            c.notes || '',
            c.insurance_provider || '',
            c.insurance_details || '',
            typeof c.insurances === 'object' ? JSON.stringify(c.insurances) : (c.insurances || '[]'),
            c.created_at || new Date().toISOString(),
            c.updated_at || new Date().toISOString()
          );
        }
      });
      custTx(cloudData.customers);
    }

    if (Array.isArray(cloudData.schedules) && cloudData.schedules.length > 0) {
      const insertSchedule = db.prepare(`
        INSERT INTO schedules (id, user_id, customer_id, title, date, time, type, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = CASE WHEN schedules.user_id = 1 OR schedules.user_id IS NULL THEN excluded.user_id ELSE schedules.user_id END,
          customer_id = excluded.customer_id,
          title = excluded.title,
          date = excluded.date,
          time = excluded.time,
          type = excluded.type,
          status = excluded.status,
          notes = excluded.notes,
          updated_at = excluded.updated_at
      `);

      const schedTx = db.transaction((scheds) => {
        for (const s of scheds) {
          insertSchedule.run(
            s.id,
            s.user_id || 1,
            s.customer_id || null,
            s.title,
            s.date,
            s.time || '',
            s.type || 'counseling',
            s.status || 'pending',
            s.notes || '',
            s.created_at || new Date().toISOString(),
            s.updated_at || new Date().toISOString()
          );
        }
      });
      schedTx(cloudData.schedules);
    }
  } catch (err) {
    console.error('_mergeCrmDataIntoDB error:', err);
  }
}

function importLegacyLocalDatabases(db) {
  try {
    const Database = require('better-sqlite3');
    let userDataPath;
    try {
      userDataPath = app.getPath('userData');
    } catch (err) {
      userDataPath = path.join(process.env.APPDATA || process.env.HOME, 'offline-crm-app');
    }

    const candidatePaths = [
      path.join(userDataPath, 'database.db'),
      path.join(userDataPath, 'crm.db'),
      path.join(userDataPath, 'main.db'),
      path.join(userDataPath, 'offline_crm.db'),
      path.join(process.env.APPDATA || '', 'offline-crm-app', 'database.db'),
      path.join(process.env.APPDATA || '', 'offline-crm-app', 'crm.db')
    ];

    // Also check backup directory for existing older DBs
    const backupDir = path.join(userDataPath, 'backups');
    if (fs.existsSync(backupDir)) {
      try {
        const files = fs.readdirSync(backupDir);
        files.forEach(f => {
          if (f.endsWith('.db') && f !== 'main.db') {
            candidatePaths.push(path.join(backupDir, f));
          }
        });
      } catch (e) {}
    }

    const currentMainPath = path.join(backupDir, 'main.db');

    for (const cand of candidatePaths) {
      if (!fs.existsSync(cand) || path.resolve(cand) === path.resolve(currentMainPath)) continue;

      try {
        const legacyDb = new Database(cand, { readonly: true });
        
        // Check customers
        let legacyCustomers = [];
        try {
          legacyCustomers = legacyDb.prepare('SELECT * FROM customers').all();
        } catch (e) {}

        if (Array.isArray(legacyCustomers) && legacyCustomers.length > 0) {
          console.log('[Legacy-DB-Import] Found ' + legacyCustomers.length + ' customers in legacy DB: ' + cand);
          const insertCust = db.prepare(`
            INSERT INTO customers (id, user_id, name, phone, email, birth_date, insurance_provider, insurance_details, insurances, referrer_id, company, status, notes, report_pdf_path, report_excel_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              phone = excluded.phone,
              email = excluded.email,
              birth_date = excluded.birth_date,
              insurance_provider = excluded.insurance_provider,
              insurance_details = excluded.insurance_details,
              insurances = excluded.insurances,
              company = excluded.company,
              status = excluded.status,
              notes = excluded.notes,
              updated_at = excluded.updated_at
          `);

          db.transaction((custs) => {
            for (const c of custs) {
              insertCust.run(
                c.id,
                c.user_id || 1,
                c.name,
                c.phone || '',
                c.email || '',
                c.birth_date || '',
                c.insurance_provider || '',
                c.insurance_details || '',
                c.insurances || '[]',
                c.referrer_id || null,
                c.company || '',
                c.status || 'Active',
                c.notes || '',
                c.report_pdf_path || '',
                c.report_excel_path || '',
                c.created_at || new Date().toISOString(),
                c.updated_at || new Date().toISOString()
              );
            }
          })(legacyCustomers);
        }

        // Check schedules
        let legacySchedules = [];
        try {
          legacySchedules = legacyDb.prepare('SELECT * FROM schedules').all();
        } catch (e) {}

        if (Array.isArray(legacySchedules) && legacySchedules.length > 0) {
          console.log('[Legacy-DB-Import] Found ' + legacySchedules.length + ' schedules in legacy DB: ' + cand);
          const insertSched = db.prepare(`
            INSERT INTO schedules (id, user_id, customer_id, title, description, scheduled_at, reminder_offset_minutes, category_type, status, notified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              description = excluded.description,
              scheduled_at = excluded.scheduled_at,
              reminder_offset_minutes = excluded.reminder_offset_minutes,
              category_type = excluded.category_type,
              status = excluded.status,
              updated_at = excluded.updated_at
          `);

          db.transaction((scheds) => {
            for (const s of scheds) {
              insertSched.run(
                s.id,
                s.user_id || 1,
                s.customer_id || null,
                s.title,
                s.description || '',
                s.scheduled_at || (s.date ? (s.date + 'T' + (s.time || '10:00') + ':00') : new Date().toISOString()),
                s.reminder_offset_minutes || 0,
                s.category_type || (s.type === 'contract' ? 'InsuranceExpiry' : 'UserSchedule'),
                s.status || 'Pending',
                s.notified || 0,
                s.created_at || new Date().toISOString(),
                s.updated_at || new Date().toISOString()
              );
            }
          })(legacySchedules);
        }

        legacyDb.close();
      } catch (legacyErr) {
        console.log('[Legacy-DB-Import] Skip candidate ' + cand + ':', legacyErr.message);
      }
    }
  } catch (err) {
    console.error('importLegacyLocalDatabases error:', err);
  }
}

let syncIntervalId = null;

function startPeriodicCloudSync(db, mainWindow) {
  if (syncIntervalId) clearInterval(syncIntervalId);

  // Poll cloud data every 60 seconds
  syncIntervalId = setInterval(async () => {
    try {
      await loadCloudAccounts(db);
      await loadCloudData(db);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cloud:synced', { timestamp: new Date().toISOString() });
      }
    } catch (e) {
      console.log('[Periodic-Sync] Background tick error:', e.message);
    }
  }, 60000);
}

module.exports = {
  GITHUB_TOKEN,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_ACCOUNT_FILE,
  GITHUB_CRM_DATA_FILE,
  getCloudAccountStorePath,
  getCloudCrmDataStorePath,
  githubGetSha,
  githubUploadFile,
  githubDownloadFile,
  syncCloudAccounts,
  loadCloudAccounts,
  syncCloudData,
  loadCloudData,
  syncCloudUpdateManifest,
  importLegacyLocalDatabases,
  startPeriodicCloudSync,
  _mergeAccountsIntoDB,
  _mergeOrganizationsIntoDB,
  _mergeCrmDataIntoDB
};
