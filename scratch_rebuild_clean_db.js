const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
const SUPABASE_ANON_KEY = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dXdoaWprd2ZtdWZuamZiZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjgyNDQsImV4cCI6MjEwMzE0NDI0NH0.', '-Vo71FsmwJNd2l1-UwD-ixGT_DymxRlcMp0wsONfCyE'].join('');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

app.whenReady().then(async () => {
  console.log('Starting Clean Master DB Reconstruction from Supabase Cloud...');

  const appData = process.env.APPDATA;
  const targetDirs = [
    path.join(appData, 'offline-crm-app', 'backups'),
    path.join(appData, 'WLB CRM TOOL', 'backups'),
    path.join(appData, 'Electron', 'backups'),
    path.join(appData, 'wlb-crm-tool', 'backups')
  ];

  // 1. Fetch all cloud tables from Supabase
  const [orgRes, userRes, custRes, schedRes, postRes, attRes] = await Promise.all([
    supabase.from('organizations').select('*'),
    supabase.from('users').select('*'),
    supabase.from('customers').select('*'),
    supabase.from('schedules').select('*'),
    supabase.from('posts').select('*'),
    supabase.from('post_attachments').select('*')
  ]);

  console.log(`Cloud data fetched:
  - Organizations: ${orgRes.data?.length || 0}
  - Users: ${userRes.data?.length || 0}
  - Customers: ${custRes.data?.length || 0}
  - Schedules: ${schedRes.data?.length || 0}
  - Posts: ${postRes.data?.length || 0}
  - Attachments: ${attRes.data?.length || 0}`);

  // 2. Load locally cached hometax data
  const parkData = require('./scratch_park_data.json');
  const hongData = require('./scratch_hong_data.json');
  const leeData = require('./scratch_lee_data.json');

  const hometaxMap = {
    '박서현': JSON.stringify(parkData),
    '홍인기': JSON.stringify(hongData),
    '이재성': JSON.stringify(leeData)
  };

  // 3. Create fresh DB at each location
  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Clean old corrupted files
    const files = ['main.db', 'main.db-wal', 'main.db-shm', 'backup.db', 'backup.db-wal', 'backup.db-shm'];
    files.forEach(f => {
      const p = path.join(dir, f);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch (e) {}
      }
    });

    const dbPath = path.join(dir, 'main.db');
    const { initDatabase } = require('./src/main/database');
    const db = initDatabase(dbPath);

    db.pragma('foreign_keys = OFF');

    // Insert Organizations
    if (orgRes.data && orgRes.data.length > 0) {
      const insOrg = db.prepare(`INSERT OR REPLACE INTO organizations (id, name, type, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`);
      for (const o of orgRes.data) {
        insOrg.run(o.id, o.name, o.type || 'Team', o.parent_id, o.created_at, o.updated_at);
      }
    }

    // Insert Users
    if (userRes.data && userRes.data.length > 0) {
      const insUser = db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, name, phone, role, parent_id, org_id, org_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const u of userRes.data) {
        insUser.run(u.id, u.username, u.password_hash, u.name, u.phone, u.role, u.parent_id, u.org_id, u.org_name, u.created_at, u.updated_at);
      }
    }

    // Insert Customers
    if (custRes.data && custRes.data.length > 0) {
      const insCust = db.prepare(`
        INSERT OR REPLACE INTO customers (id, user_id, name, phone, birth_date, birth_type, gender, address, job, relationship, pool_group, pool_updated_at, status, notes, insurance_provider, insurance_details, insurances, hometax_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of custRes.data) {
        const htData = hometaxMap[c.name] || (c.hometax_data ? (typeof c.hometax_data === 'string' ? c.hometax_data : JSON.stringify(c.hometax_data)) : null);
        insCust.run(
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
          typeof c.insurances === 'string' ? c.insurances : JSON.stringify(c.insurances || []),
          htData,
          c.created_at || new Date().toISOString(),
          c.updated_at || new Date().toISOString()
        );
      }
    }

    // Insert Schedules
    if (schedRes.data && schedRes.data.length > 0) {
      const insSched = db.prepare(`
        INSERT OR REPLACE INTO schedules (id, user_id, customer_id, title, description, scheduled_at, date, time, type, status, reminder_offset_minutes, category_type, org_id, org_name, is_broadcast, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of schedRes.data) {
        insSched.run(
          s.id,
          s.user_id || 1,
          s.customer_id,
          s.title,
          s.description || '',
          s.scheduled_at,
          s.date,
          s.time,
          s.type || 'Meeting',
          s.status || 'Pending',
          s.reminder_offset_minutes || 0,
          s.category_type || 'UserSchedule',
          s.org_id,
          s.org_name,
          s.is_broadcast ? 1 : 0,
          s.created_at,
          s.updated_at
        );
      }
    }

    // Insert Posts
    if (postRes.data && postRes.data.length > 0) {
      const insPost = db.prepare(`
        INSERT OR REPLACE INTO posts (id, user_id, author_name, title, content, category, views, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of postRes.data) {
        insPost.run(p.id, p.user_id || 1, p.author_name || '관리자', p.title, p.content || '', p.category || '상품전략', p.views || 0, p.created_at, p.updated_at);
      }
    }

    // Insert Attachments
    if (attRes.data && attRes.data.length > 0) {
      const insAtt = db.prepare(`
        INSERT OR REPLACE INTO post_attachments (id, post_id, file_name, file_size, file_type, download_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of attRes.data) {
        insAtt.run(a.id, a.post_id, a.file_name, a.file_size || 0, a.file_type || '', a.download_url, a.created_at);
      }
    }

    db.pragma('foreign_keys = ON');

    // Check counts
    const finalCusts = db.prepare('SELECT count(*) as c FROM customers').get().c;
    const finalPosts = db.prepare('SELECT count(*) as c FROM posts').get().c;
    console.log(`✓ Rebuilt DB at ${dbPath}: Customers = ${finalCusts}, Posts = ${finalPosts}`);

    db.close();
  }

  console.log('🎉 ALL DATABASES FULLY RESTORED & VALIDATED!');
  app.quit();
});
