const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let dbInstance = null;

function getBackupDirectory() {
  let userDataPath;
  try {
    const { app } = require('electron');
    userDataPath = app.getPath('userData');
  } catch (err) {
    userDataPath = path.join(process.env.APPDATA || process.env.HOME, 'offline-crm-app');
  }
  
  const backupDir = path.join(userDataPath, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

function getDbPath() {
  const backupDir = getBackupDirectory();
  return path.join(backupDir, 'main.db');
}

function initDatabase(dbPath = null) {
  const targetPath = dbPath || getDbPath();
  dbInstance = new Database(targetPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  // Schema creation
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      type TEXT DEFAULT 'Team',
      parent_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES organizations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Agent',
      parent_id INTEGER,
      org_id INTEGER,
      org_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      birth_date TEXT,
      insurance_provider TEXT,
      insurance_details TEXT,
      insurances TEXT,
      referrer_id INTEGER,
      company TEXT,
      status TEXT DEFAULT 'Active',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (referrer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      customer_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      scheduled_at TEXT NOT NULL,
      reminder_offset_minutes INTEGER DEFAULT 0,
      category_type TEXT DEFAULT 'UserSchedule',
      status TEXT DEFAULT 'Pending',
      notified INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      author_name TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT '상품전략',
      views INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS post_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_type TEXT,
      file_path TEXT,
      download_url TEXT,
      file_data TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Robust column migration for post_attachments table
  const postAttachmentColumns = ['file_path', 'download_url', 'file_data'];
  postAttachmentColumns.forEach(col => {
    try {
      const tableInfo = dbInstance.prepare("PRAGMA table_info(post_attachments)").all();
      const existingColumns = tableInfo.map(c => c.name);
      if (!existingColumns.includes(col)) {
        dbInstance.exec(`ALTER TABLE post_attachments ADD COLUMN ${col} TEXT;`);
      }
    } catch (colErr) {}
  });

  // Robust column migration for customers table
  const customerColumns = ['user_id', 'insurance_provider', 'insurance_details', 'insurances', 'referrer_id', 'company', 'report_pdf_path', 'report_excel_path', 'birth_date'];
  customerColumns.forEach(col => {
    try {
      const tableInfo = dbInstance.prepare("PRAGMA table_info(customers)").all();
      const existingColumns = tableInfo.map(c => c.name);
      if (!existingColumns.includes(col)) {
        const type = (col === 'referrer_id' || col === 'user_id') ? 'INTEGER DEFAULT 1' : 'TEXT';
        dbInstance.exec(`ALTER TABLE customers ADD COLUMN ${col} ${type};`);
      }
    } catch (colErr) {}
  });

  // Column migration for schedules table
  try {
    const tableInfo = dbInstance.prepare("PRAGMA table_info(schedules)").all();
    const existingColumns = tableInfo.map(c => c.name);
    if (!existingColumns.includes('reminder_offset_minutes')) {
      dbInstance.exec("ALTER TABLE schedules ADD COLUMN reminder_offset_minutes INTEGER DEFAULT 0;");
    }
    if (!existingColumns.includes('user_id')) {
      dbInstance.exec("ALTER TABLE schedules ADD COLUMN user_id INTEGER DEFAULT 1;");
    }
    if (!existingColumns.includes('category_type')) {
      dbInstance.exec("ALTER TABLE schedules ADD COLUMN category_type TEXT DEFAULT 'UserSchedule';");
    }
  } catch (colErr) {}

  // Column migration for users table (phone, org_id, org_name)
  try {
    const userTableInfo = dbInstance.prepare("PRAGMA table_info(users)").all();
    const existingUserCols = userTableInfo.map(c => c.name);
    if (!existingUserCols.includes('phone')) {
      dbInstance.exec("ALTER TABLE users ADD COLUMN phone TEXT;");
    }
    if (!existingUserCols.includes('org_id')) {
      dbInstance.exec("ALTER TABLE users ADD COLUMN org_id INTEGER;");
    }
    if (!existingUserCols.includes('org_name')) {
      dbInstance.exec("ALTER TABLE users ADD COLUMN org_name TEXT;");
    }
  } catch (userColErr) {}

  // (Default organizations seeding removed - only user-created organizations are retained)

  // Ensure default admin account exists (username: admin, password: admin)
  try {
    const crypto = require('crypto');
    const existingAdmin = dbInstance.prepare("SELECT id FROM users WHERE username = 'admin'").get();
    if (!existingAdmin) {
      const hash = crypto.createHash('sha256').update('admin').digest('hex');
      const now = new Date().toISOString();
      dbInstance.prepare(`
        INSERT INTO users (username, password_hash, name, role, parent_id, org_name, created_at, updated_at)
        VALUES ('admin', ?, '최고 관리자', 'Admin', NULL, '본사 총괄 사업단', ?, ?)
      `).run(hash, now, now);
    }
  } catch (adminErr) {
    console.error('Error seeding admin user:', adminErr);
  }

  return dbInstance;
}

function getDb() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  initDatabase,
  getDb,
  closeDb,
  getBackupDirectory,
  getDbPath
};
