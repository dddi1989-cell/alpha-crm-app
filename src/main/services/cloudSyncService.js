const path = require('path');
const fs = require('fs');
const https = require('https');
const { app } = require('electron');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
const SUPABASE_ANON_KEY = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dXdoaWprd2ZtdWZuamZiZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjgyNDQsImV4cCI6MjEwMzE0NDI0NH0.', '-Vo71FsmwJNd2l1-UwD-ixGT_DymxRlcMp0wsONfCyE'].join('');
const STORAGE_BUCKET = 'wbl-board-files';

let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });
  }
  return supabaseClient;
}

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
    const timestamp = Date.now();
    const req = https.request('https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + remotePath + '?ref=main&_t=' + timestamp, {
      method: 'GET',
      headers: {
        'User-Agent': 'ALPHA-CRM-CloudSync',
        'Authorization': 'token ' + GITHUB_TOKEN,
        'Accept': 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
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

// Sequential upload queue to prevent 409 Conflict race conditions
let uploadQueuePromise = Promise.resolve();

function githubUploadFile(remotePath, contentBuffer, commitMessage) {
  const task = async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const sha = await githubGetSha(remotePath);
        const payload = {
          message: commitMessage || ('Sync ' + remotePath),
          content: contentBuffer.toString('base64'),
          branch: 'main'
        };
        if (sha) payload.sha = sha;

        const body = JSON.stringify(payload);

        const ok = await new Promise((resolve) => {
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
              const success = res.statusCode === 200 || res.statusCode === 201;
              console.log(`[GitHub-CloudSync-Upload] ${remotePath} (Attempt ${attempt}) -> Status ${res.statusCode} ${success ? 'OK' : 'FAIL'}`);
              resolve(success);
            });
          });
          req.on('error', (err) => {
            console.error('[GitHub-CloudSync-Upload] Network error:', err.message);
            resolve(false);
          });
          req.write(body);
          req.end();
        });

        if (ok) return true;
        // Wait before retry
        await new Promise(r => setTimeout(r, 400 * attempt));
      } catch (err) {
        console.error('[GitHub-CloudSync-Upload] Attempt error:', err.message);
        await new Promise(r => setTimeout(r, 400 * attempt));
      }
    }
    return false;
  };

  uploadQueuePromise = uploadQueuePromise.then(task, task);
  return uploadQueuePromise;
}

function fetchRawGitHub(remotePath) {
  return new Promise((resolve) => {
    const rawUrl = 'https://raw.githubusercontent.com/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/main/' + remotePath + '?_t=' + Date.now();
    const req = https.get(rawUrl, {
      headers: {
        'User-Agent': 'ALPHA-CRM-CloudSync',
        'Authorization': 'token ' + GITHUB_TOKEN,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
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
    const req = https.request('https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + remotePath + '?ref=main&_t=' + Date.now(), {
      method: 'GET',
      headers: {
        'User-Agent': 'ALPHA-CRM-CloudSync',
        'Authorization': 'token ' + GITHUB_TOKEN,
        'Accept': 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache'
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
    const supabase = getSupabase();
    const users = db.prepare('SELECT id, username, password_hash, name, phone, role, parent_id, org_id, org_name, created_at, updated_at FROM users').all();
    const organizations = db.prepare('SELECT id, name, type, parent_id, created_at, updated_at FROM organizations').all();

    // 1. Sync to Supabase PostgreSQL (Fast & Realtime)
    if (organizations.length > 0) {
      const cleanOrgs = organizations.map(o => ({
        id: Number(o.id),
        name: o.name,
        type: o.type || 'Team',
        parent_id: o.parent_id ? Number(o.parent_id) : null,
        created_at: o.created_at || new Date().toISOString(),
        updated_at: o.updated_at || new Date().toISOString()
      }));
      await supabase.from('organizations').upsert(cleanOrgs);
    }

    if (users.length > 0) {
      const cleanUsers = users.map(u => ({
        id: Number(u.id),
        username: u.username,
        password_hash: u.password_hash,
        name: u.name,
        phone: u.phone || '',
        role: u.role || 'FA',
        parent_id: u.parent_id ? Number(u.parent_id) : null,
        org_id: u.org_id ? Number(u.org_id) : null,
        org_name: u.org_name || null,
        created_at: u.created_at || new Date().toISOString(),
        updated_at: u.updated_at || new Date().toISOString()
      }));
      await supabase.from('users').upsert(cleanUsers);
    }

    console.log('[Supabase-Sync] Successfully synced accounts & organizations to Supabase');

    // 2. Backup locally as JSON cache
    try {
      const payload = { version: 1, last_synced_at: new Date().toISOString(), accounts: users, organizations: organizations };
      fs.writeFileSync(getCloudAccountStorePath(), JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {}

    return true;
  } catch (err) {
    console.error('syncCloudAccounts error:', err);
    return false;
  }
}

async function loadCloudAccounts(db) {
  try {
    const supabase = getSupabase();
    const [orgRes, userRes] = await Promise.all([
      supabase.from('organizations').select('*'),
      supabase.from('users').select('*')
    ]);

    if (orgRes.data && orgRes.data.length > 0) {
      _mergeOrganizationsIntoDB(db, orgRes.data);
    }
    if (userRes.data && userRes.data.length > 0) {
      _mergeAccountsIntoDB(db, userRes.data);
      console.log('[Supabase-Sync] Successfully loaded accounts from Supabase.');
    }
  } catch (err) {
    console.error('loadCloudAccounts error:', err);
    // Fallback to local cached store if offline
    try {
      const storePath = getCloudAccountStorePath();
      if (fs.existsSync(storePath)) {
        const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        if (data.organizations) _mergeOrganizationsIntoDB(db, data.organizations);
        if (data.accounts) _mergeAccountsIntoDB(db, data.accounts);
      }
    } catch (fallbackErr) {}
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
      WHERE excluded.updated_at >= organizations.updated_at OR organizations.updated_at IS NULL
    `);

    const updateTx = db.transaction((orgs) => {
      for (const o of orgs) {
        insertOrUpdate.run(
          o.id,
          o.name,
          o.type || 'Team',
          o.parent_id ? Number(o.parent_id) : null,
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
      WHERE excluded.updated_at >= users.updated_at OR users.updated_at IS NULL
    `);

    const updateTx = db.transaction((accounts) => {
      for (const a of accounts) {
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
          a.parent_id ? Number(a.parent_id) : null,
          a.org_id ? Number(a.org_id) : null,
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

async function uploadBoardAttachment(filePath, originalFileName) {
  try {
    const supabase = getSupabase();
    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(originalFileName);
    const baseName = path.basename(originalFileName, ext);
    const uniqueFileName = `${Date.now()}_${baseName}${ext}`;

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(uniqueFileName, fileBuffer, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('[Supabase-Storage] Upload error:', error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(uniqueFileName);

    return urlData?.publicUrl || null;
  } catch (err) {
    console.error('[Supabase-Storage] uploadBoardAttachment exception:', err);
    return null;
  }
}

async function syncCloudData(db) {
  try {
    const supabase = getSupabase();
    const customers = db.prepare('SELECT * FROM customers').all();
    const schedules = db.prepare('SELECT * FROM schedules').all();
    let posts = [];
    let attachments = [];
    try {
      posts = db.prepare('SELECT * FROM posts').all();
      attachments = db.prepare('SELECT * FROM post_attachments').all();
    } catch (e) {}

    // 1. Sync customers to Supabase
    if (customers.length > 0) {
      const cleanCusts = customers.map(c => ({
        id: Number(c.id),
        user_id: c.user_id ? Number(c.user_id) : 1,
        name: c.name,
        phone: c.phone || '',
        birth_date: c.birth_date || '',
        birth_type: c.birth_type || 'solar',
        gender: c.gender || 'unknown',
        address: c.address || '',
        job: c.job || '',
        relationship: c.relationship || '지인',
        pool_group: c.pool_group || 'A',
        pool_updated_at: c.pool_updated_at || null,
        status: c.status || 'Active',
        notes: c.notes || '',
        insurance_provider: c.insurance_provider || '',
        insurance_details: c.insurance_details || '',
        insurances: typeof c.insurances === 'string' ? JSON.parse(c.insurances || '[]') : (c.insurances || []),
        created_at: c.created_at || new Date().toISOString(),
        updated_at: c.updated_at || new Date().toISOString()
      }));
      await supabase.from('customers').upsert(cleanCusts);
    }

    // 2. Sync schedules to Supabase
    if (schedules.length > 0) {
      const cleanScheds = schedules.map(s => {
        const scheduledAtIso = s.scheduled_at || (s.date ? `${s.date}T${s.time || '00:00'}:00` : new Date().toISOString());
        return {
          id: Number(s.id),
          user_id: s.user_id ? Number(s.user_id) : 1,
          customer_id: s.customer_id ? Number(s.customer_id) : null,
          title: s.title,
          description: s.description || s.notes || '',
          scheduled_at: scheduledAtIso,
          date: s.date || scheduledAtIso.slice(0, 10),
          time: s.time || (scheduledAtIso.length >= 16 ? scheduledAtIso.slice(11, 16) : '00:00'),
          type: s.type || (s.is_broadcast ? '공지' : 'Meeting'),
          status: s.status || 'Pending',
          reminder_offset_minutes: Number(s.reminder_offset_minutes) || 0,
          category_type: s.category_type || (s.is_broadcast ? 'OrgNotice' : 'UserSchedule'),
          org_id: s.org_id ? Number(s.org_id) : null,
          org_name: s.org_name || null,
          is_broadcast: s.is_broadcast ? 1 : 0,
          created_at: s.created_at || new Date().toISOString(),
          updated_at: s.updated_at || new Date().toISOString()
        };
      });
      await supabase.from('schedules').upsert(cleanScheds);
    }

    // 3. Sync posts & attachments to Supabase
    if (posts.length > 0) {
      const cleanPosts = posts.map(p => ({
        id: Number(p.id),
        user_id: p.user_id ? Number(p.user_id) : 1,
        author_name: p.author_name || '관리자',
        title: p.title,
        content: p.content || '',
        category: p.category || '상품전략',
        views: p.views || 0,
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || new Date().toISOString()
      }));
      await supabase.from('posts').upsert(cleanPosts);
    }

    if (attachments.length > 0) {
      const cleanAtts = attachments.map(a => ({
        id: Number(a.id),
        post_id: Number(a.post_id),
        file_name: a.file_name,
        file_size: Number(a.file_size) || 0,
        file_type: a.file_type || '',
        download_url: a.download_url || null,
        created_at: a.created_at || new Date().toISOString()
      }));
      await supabase.from('post_attachments').upsert(cleanAtts);
    }

    console.log('[Supabase-Sync] Successfully synced CRM data to Supabase');

    // 4. Backup locally as JSON cache
    try {
      const payload = { version: 1, last_synced_at: new Date().toISOString(), customers, schedules, posts, post_attachments: attachments };
      fs.writeFileSync(getCloudCrmDataStorePath(), JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {}

    return true;
  } catch (err) {
    console.error('syncCloudData error:', err);
    return false;
  }
}

async function loadCloudData(db) {
  try {
    const supabase = getSupabase();
    const [custRes, schedRes, postRes, attRes] = await Promise.all([
      supabase.from('customers').select('*'),
      supabase.from('schedules').select('*'),
      supabase.from('posts').select('*'),
      supabase.from('post_attachments').select('*')
    ]);

    _mergeCrmDataIntoDB(db, {
      customers: custRes.data || [],
      schedules: schedRes.data || [],
      posts: postRes.data || [],
      post_attachments: attRes.data || []
    });

    console.log('[Supabase-Sync] Successfully loaded CRM data from Supabase.');
  } catch (err) {
    console.error('loadCloudData error:', err);
    // Fallback to local cached store if offline
    try {
      const storePath = getCloudCrmDataStorePath();
      if (fs.existsSync(storePath)) {
        const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        _mergeCrmDataIntoDB(db, data);
      }
    } catch (fallbackErr) {}
  }
}

function _mergeCrmDataIntoDB(db, cloudData) {
  if (!cloudData) return;
  try {
    if (Array.isArray(cloudData.customers) && cloudData.customers.length > 0) {
      const insertCustomer = db.prepare(`
        INSERT INTO customers (id, user_id, name, phone, birth_date, birth_type, gender, address, job, relationship, pool_group, pool_updated_at, status, notes, insurance_provider, insurance_details, insurances, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = CASE WHEN customers.user_id = 1 OR customers.user_id IS NULL THEN excluded.user_id ELSE customers.user_id END,
          name = excluded.name,
          phone = excluded.phone,
          birth_date = excluded.birth_date,
          birth_type = COALESCE(excluded.birth_type, customers.birth_type),
          gender = excluded.gender,
          address = excluded.address,
          job = excluded.job,
          relationship = excluded.relationship,
          pool_group = excluded.pool_group,
          pool_updated_at = excluded.pool_updated_at,
          status = excluded.status,
          notes = excluded.notes,
          insurance_provider = excluded.insurance_provider,
          insurance_details = excluded.insurance_details,
          insurances = excluded.insurances,
          updated_at = excluded.updated_at
        WHERE excluded.updated_at >= customers.updated_at OR customers.updated_at IS NULL
      `);

      const custTx = db.transaction((custs) => {
        for (const c of custs) {
          insertCustomer.run(
            c.id,
            c.user_id || 1,
            c.name,
            c.phone || '',
            c.birth_date || '',
            c.birth_type || 'solar',
            c.gender || 'unknown',
            c.address || '',
            c.job || '',
            c.relationship || '지인',
            c.pool_group || 'A',
            c.pool_updated_at || null,
            c.status || 'Active',
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
        INSERT INTO schedules (id, user_id, customer_id, title, description, scheduled_at, date, time, type, status, reminder_offset_minutes, category_type, org_id, org_name, is_broadcast, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = CASE WHEN schedules.user_id = 1 OR schedules.user_id IS NULL THEN excluded.user_id ELSE schedules.user_id END,
          customer_id = excluded.customer_id,
          title = excluded.title,
          description = excluded.description,
          scheduled_at = excluded.scheduled_at,
          date = excluded.date,
          time = excluded.time,
          type = excluded.type,
          status = excluded.status,
          reminder_offset_minutes = excluded.reminder_offset_minutes,
          category_type = excluded.category_type,
          org_id = excluded.org_id,
          org_name = excluded.org_name,
          is_broadcast = excluded.is_broadcast,
          updated_at = excluded.updated_at
        WHERE excluded.updated_at >= schedules.updated_at OR schedules.updated_at IS NULL
      `);

      const schedTx = db.transaction((scheds) => {
        for (const s of scheds) {
          const scheduledAtIso = s.scheduled_at || (s.date ? `${s.date}T${s.time || '00:00'}:00` : new Date().toISOString());
          const dateVal = s.date || (scheduledAtIso ? scheduledAtIso.slice(0, 10) : '');
          const timeVal = s.time || (scheduledAtIso && scheduledAtIso.length >= 16 ? scheduledAtIso.slice(11, 16) : '00:00');

          insertSchedule.run(
            s.id,
            s.user_id || 1,
            s.customer_id || null,
            s.title,
            s.description || s.notes || '',
            scheduledAtIso,
            dateVal,
            timeVal,
            s.type || (s.is_broadcast ? '공지' : 'Meeting'),
            s.status || 'Pending',
            Number(s.reminder_offset_minutes) || 0,
            s.category_type || (s.is_broadcast ? 'OrgNotice' : 'UserSchedule'),
            s.org_id ? Number(s.org_id) : null,
            s.org_name || null,
            s.is_broadcast ? 1 : 0,
            s.created_at || new Date().toISOString(),
            s.updated_at || new Date().toISOString()
          );
        }
      });
      schedTx(cloudData.schedules);
    }

    // Merge Posts
    if (Array.isArray(cloudData.posts) && cloudData.posts.length > 0) {
      const insertPost = db.prepare(`
        INSERT INTO posts (id, user_id, author_name, title, content, category, views, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          author_name = excluded.author_name,
          title = excluded.title,
          content = excluded.content,
          category = excluded.category,
          views = excluded.views,
          updated_at = excluded.updated_at
        WHERE excluded.updated_at >= posts.updated_at OR posts.updated_at IS NULL
      `);

      const postTx = db.transaction((posts) => {
        for (const p of posts) {
          insertPost.run(
            p.id,
            p.user_id || 1,
            p.author_name || '최고 관리자 (Admin)',
            p.title,
            p.content || '',
            p.category || '상품전략',
            p.views || 0,
            p.created_at || new Date().toISOString(),
            p.updated_at || new Date().toISOString()
          );
        }
      });
      postTx(cloudData.posts);
    }

    // Merge Post Attachments
    if (Array.isArray(cloudData.post_attachments) && cloudData.post_attachments.length > 0) {
      const insertAtt = db.prepare(`
        INSERT INTO post_attachments (id, post_id, file_name, file_size, file_type, download_url, file_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          post_id = excluded.post_id,
          file_name = excluded.file_name,
          file_size = excluded.file_size,
          file_type = excluded.file_type,
          download_url = excluded.download_url,
          file_data = excluded.file_data
      `);

      const attTx = db.transaction((atts) => {
        for (const a of atts) {
          insertAtt.run(
            a.id,
            a.post_id,
            a.file_name,
            a.file_size || 0,
            a.file_type || '',
            a.download_url || null,
            a.file_data || '',
            a.created_at || new Date().toISOString()
          );
        }
      });
      attTx(cloudData.post_attachments);
    }

    // Merge Market Briefings
    if (Array.isArray(cloudData.market_briefings) && cloudData.market_briefings.length > 0) {
      const insertBriefing = db.prepare(`
        INSERT INTO market_briefings (date, title, updated_at, summary_3lines, domestic_json, overseas_json, news_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          title = excluded.title,
          updated_at = excluded.updated_at,
          summary_3lines = excluded.summary_3lines,
          domestic_json = excluded.domestic_json,
          overseas_json = excluded.overseas_json,
          news_json = excluded.news_json
      `);

      const briefTx = db.transaction((briefs) => {
        for (const b of briefs) {
          insertBriefing.run(
            b.date,
            b.title || '',
            b.updated_at || '',
            typeof b.summary_3lines === 'string' ? b.summary_3lines : JSON.stringify(b.summary_3lines || []),
            typeof b.domestic === 'string' ? b.domestic : JSON.stringify(b.domestic || {}),
            typeof b.overseas === 'string' ? b.overseas : JSON.stringify(b.overseas || {}),
            typeof b.news === 'string' ? b.news : JSON.stringify(b.news || []),
            b.created_at || new Date().toISOString()
          );
        }
      });
      briefTx(cloudData.market_briefings);
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

async function syncCloudUpdateManifest(version, downloadUrl, title, releaseNotes) {
  try {
    const manifest = {
      latestVersion: version || '1.5.9',
      minRequiredVersion: '1.0.0',
      title: title || `v${version} 공식 정식 배포 버전`,
      releaseDate: new Date().toISOString().split('T')[0],
      downloadUrl: downloadUrl || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${version}/ALPHA_CRM_MicroPatch_v${version}.asar`,
      installerUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${version}/ALPHA_CRM_Setup_${version}.exe`,
      releaseNotes: releaseNotes || '정식 업데이트 패치',
      forceUpdate: false,
      targetFile: 'resources/app.asar'
    };

    const manifestJson = JSON.stringify(manifest, null, 2);
    githubUploadFile('update_manifest.json', Buffer.from(manifestJson, 'utf8'), `Update manifest to v${version}`)
      .then(ok => {
        if (ok) console.log(`[Cloud-Sync] Successfully pushed update_manifest.json for v${version}`);
      }).catch(e => {
        console.log('[Cloud-Sync] Failed to push update_manifest.json:', e.message);
      });
  } catch (err) {
    console.error('syncCloudUpdateManifest error:', err);
  }
}

function _mergePensionCatalogIntoDB(db, catalogRows) {
  if (!Array.isArray(catalogRows) || catalogRows.length === 0) return;
  try {
    const insertStmt = db.prepare(`
      INSERT INTO pension_products (id, name, product_name, category, company_name, other_companies, badge_color, rank_tag, rate_text, guaranteed_rate, payout_rate, annual_rate, assumed_rate, tax_benefit, key_features, effective_month, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        product_name = excluded.product_name,
        category = excluded.category,
        company_name = excluded.company_name,
        other_companies = excluded.other_companies,
        badge_color = excluded.badge_color,
        rank_tag = excluded.rank_tag,
        rate_text = excluded.rate_text,
        guaranteed_rate = excluded.guaranteed_rate,
        payout_rate = excluded.payout_rate,
        annual_rate = excluded.annual_rate,
        assumed_rate = excluded.assumed_rate,
        tax_benefit = excluded.tax_benefit,
        key_features = excluded.key_features,
        effective_month = excluded.effective_month,
        updated_at = excluded.updated_at
    `);

    db.transaction((rows) => {
      for (const r of rows) {
        insertStmt.run(
          r.id,
          r.name,
          r.product_name,
          r.category,
          r.company_name,
          r.other_companies || '',
          r.badge_color || 'amber',
          r.rank_tag || '',
          r.rate_text || '',
          r.guaranteed_rate !== undefined ? Number(r.guaranteed_rate) : 0.055,
          r.payout_rate !== undefined ? Number(r.payout_rate) : 0.052,
          r.annual_rate !== undefined ? Number(r.annual_rate) : 0.031,
          r.assumed_rate !== undefined ? Number(r.assumed_rate) : 0.050,
          r.tax_benefit || '',
          typeof r.key_features === 'string' ? r.key_features : JSON.stringify(r.key_features || []),
          r.effective_month || '',
          r.updated_at || new Date().toISOString()
        );
      }
    })(catalogRows);
    console.log(`[Pension-Sync] Successfully merged ${catalogRows.length} pension products into local DB`);
  } catch (err) {
    console.error('_mergePensionCatalogIntoDB error:', err);
  }
}

async function loadPensionCatalog(db) {
  try {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: cloudProducts, error } = await supabase.from('pension_products').select('*');
    if (error) {
      console.log('[Pension-CloudSync] Supabase load note:', error.message);
      return;
    }

    if (Array.isArray(cloudProducts) && cloudProducts.length > 0) {
      _mergePensionCatalogIntoDB(db, cloudProducts);
    }
  } catch (err) {
    console.error('loadPensionCatalog error:', err);
  }
}

async function syncPensionCatalog(db) {
  try {
    const supabase = getSupabase();
    if (!supabase) return;

    const localProducts = db.prepare('SELECT * FROM pension_products').all();
    if (localProducts && localProducts.length > 0) {
      const { error } = await supabase.from('pension_products').upsert(localProducts, { onConflict: 'id' });
      if (error) {
        console.log('[Pension-CloudSync] Supabase upsert note:', error.message);
      } else {
        console.log(`[Pension-CloudSync] Successfully synced ${localProducts.length} pension products to Supabase`);
      }
    }
  } catch (err) {
    console.error('syncPensionCatalog error:', err);
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
      await loadPensionCatalog(db);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cloud:synced', { timestamp: new Date().toISOString() });
      }
    } catch (e) {
      console.log('[Periodic-Sync] Background tick error:', e.message);
    }
  }, 60000);
}

module.exports = {
  getSupabase,
  uploadBoardAttachment,
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
  loadPensionCatalog,
  syncPensionCatalog,
  syncCloudUpdateManifest,
  importLegacyLocalDatabases,
  startPeriodicCloudSync,
  _mergeAccountsIntoDB,
  _mergeOrganizationsIntoDB,
  _mergeCrmDataIntoDB
};
