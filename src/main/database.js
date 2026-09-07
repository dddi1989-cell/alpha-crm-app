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
      birth_type TEXT DEFAULT 'solar',
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
      date TEXT,
      time TEXT,
      type TEXT DEFAULT 'Meeting',
      reminder_offset_minutes INTEGER DEFAULT 0,
      category_type TEXT DEFAULT 'UserSchedule',
      org_id INTEGER,
      org_name TEXT,
      is_broadcast INTEGER DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS market_briefings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      title TEXT,
      updated_at TEXT,
      summary_3lines TEXT,
      domestic_json TEXT,
      overseas_json TEXT,
      news_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pension_products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      product_name TEXT NOT NULL,
      category TEXT NOT NULL,
      company_name TEXT NOT NULL,
      other_companies TEXT,
      badge_color TEXT DEFAULT 'amber',
      rank_tag TEXT,
      rate_text TEXT,
      guaranteed_rate REAL DEFAULT 0.055,
      payout_rate REAL DEFAULT 0.052,
      annual_rate REAL DEFAULT 0.031,
      assumed_rate REAL DEFAULT 0.050,
      tax_benefit TEXT,
      key_features TEXT,
      effective_month TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  // Seed default pension products if empty
  try {
    const count = dbInstance.prepare("SELECT COUNT(*) as count FROM pension_products").get().count;
    if (count === 0) {
      const now = new Date().toISOString();
      const currentMonthStr = `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`;
      const insertStmt = dbInstance.prepare(`
        INSERT INTO pension_products (id, name, product_name, category, company_name, other_companies, badge_color, rank_tag, rate_text, guaranteed_rate, payout_rate, annual_rate, assumed_rate, tax_benefit, key_features, effective_month, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const defaultProducts = [
        [
          'guaranteed',
          '평생 최저보증 연금 (단리 5.5% 평생보증)',
          '(무)HighFive그랑에이지변액연금보험',
          '최저보증형 종신연금',
          'iM라이프 (구 DGB생명)',
          'KDB생명 ((무)버팀목평생보증연금), IBK연금보험 ((무)평생보증연금)',
          'amber',
          '🏆 안정수익 1위 (강력추천)',
          '연 5.5% 단리 평생보증 (연금지급률 확정)',
          0.055, 0.052, 0.031, 0.050,
          '10년 유지 시 비과세 (이자소득세 0원)',
          JSON.stringify([
            '투자 수익률 하락과 무관하게 계약 시점의 최저보증 연금액 100% 확정 보증',
            '살아있는 동안 평생 매월 동일한 확정 연금 지급 (사망 시까지 지속)',
            '금리 하락기에도 원금 손실 없는 가장 안전한 노후 준비 1순위'
          ]),
          currentMonthStr,
          now
        ],
        [
          'declared_rate',
          '공시이율형 비과세 연금보험',
          '(무)삼성생명 플러스연금보험 (대면정규)',
          '공시이율 복리 연금',
          '삼성생명',
          '한화생명 ((무)라이프플러스 연금보험), 교보생명 ((무)미리보는내연금보험)',
          'emerald',
          '⭐ 안정 복리형',
          '공시이율 3.1% (최저보증 1.0%)',
          0.055, 0.052, 0.031, 0.050,
          '10년 이상 유지 시 전액 비과세 (금융소득종합과세 제외)',
          JSON.stringify([
            '안정적인 복리 이자 증식 및 최저보증이율 안전망 (대면 정규 판매 상품)',
            '목돈 필요 시 중도인출 및 추가납입 기능 활용 가능',
            '금융소득종합과세 제외되는 완벽한 비과세 혜택'
          ]),
          currentMonthStr,
          now
        ],
        [
          'tax_deduct',
          '세액공제 연금저축보험 (세제적격)',
          '(무)삼성화재 아름다운생활 연금저축보험',
          '세제적격 연금저축보험',
          '삼성화재',
          '삼성생명 ((무)골든연금 연금저축보험), 한화손해보험 ((무)연금저축보험)',
          'blue',
          '💰 세금환급 1위',
          '공시이율 3.2% + 연말정산 최대 16.5% 환급',
          0.055, 0.052, 0.032, 0.050,
          '매년 최대 99만원 세액공제 (총 세금 환급)',
          JSON.stringify([
            '보험사 세제적격 상품으로 매년 연말정산 시 막강한 세금 환급 (최대 16.5%)',
            '원금 보장 및 복리 부리 + 유당 배당금 및 연금 수령 시 저율과세(3.3~5.5%)',
            '직장인 및 자영업자 절세 재테크 1순위 필수 보험 상품'
          ]),
          currentMonthStr,
          now
        ],
        [
          'variable',
          '변액/투자형 연금보험 (펀드운용형)',
          '(무)동행 변액연금보험 (스텝업 원금보장)',
          '변액투자 연금',
          '메트라이프생명',
          '푸본현대생명 ((무)MAX 변액연금보험), BNP파리바카디프생명 ((무)i-선택변액)',
          'purple',
          '📈 고수익 추구형',
          '가정수익률 연 5.0% (원금보장형)',
          0.055, 0.052, 0.031, 0.050,
          '10년 이상 유지 시 비과세',
          JSON.stringify([
            '글로벌 주식/채권 분산투자로 인플레이션 헷지 및 초과수익 추구',
            '연금개시 시점 납입원금 100%~130% 최저보증 기능 탑재',
            '시장 상승기 높은 연금 수령액 기대 가능'
          ]),
          currentMonthStr,
          now
        ]
      ];

      for (const p of defaultProducts) {
        insertStmt.run(...p);
      }
    }
  } catch (e) {
    console.error('Seed pension_products error:', e);
  }

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
  const customerColumns = [
    'user_id', 'insurance_provider', 'insurance_details', 'insurances', 'referrer_id', 
    'company', 'report_pdf_path', 'report_excel_path', 'birth_date', 'birth_type',
    'relationship', 'pool_group', 'is_pool'
  ];
  customerColumns.forEach(col => {
    try {
      const tableInfo = dbInstance.prepare("PRAGMA table_info(customers)").all();
      const existingColumns = tableInfo.map(c => c.name);
      if (!existingColumns.includes(col)) {
        let type = 'TEXT';
        if (col === 'referrer_id' || col === 'user_id') type = 'INTEGER DEFAULT 1';
        if (col === 'is_pool') type = 'INTEGER DEFAULT 0';
        if (col === 'birth_type') type = "TEXT DEFAULT 'solar'";
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
    if (!existingColumns.includes('date')) {
      dbInstance.exec("ALTER TABLE schedules ADD COLUMN date TEXT;");
    }
    if (!existingColumns.includes('time')) {
      dbInstance.exec("ALTER TABLE schedules ADD COLUMN time TEXT;");
    }
    if (!existingColumns.includes('type')) {
      dbInstance.exec("ALTER TABLE schedules ADD COLUMN type TEXT DEFAULT 'Meeting';");
    }
    if (!existingColumns.includes('org_id')) {
      dbInstance.exec("ALTER TABLE schedules ADD COLUMN org_id INTEGER;");
    }
    if (!existingColumns.includes('org_name')) {
      dbInstance.exec("ALTER TABLE schedules ADD COLUMN org_name TEXT;");
    }
    if (!existingColumns.includes('is_broadcast')) {
      dbInstance.exec("ALTER TABLE schedules ADD COLUMN is_broadcast INTEGER DEFAULT 0;");
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

  // Column migration for customers table (hometax_data)
  try {
    const custTableInfo = dbInstance.prepare("PRAGMA table_info(customers)").all();
    const existingCustCols = custTableInfo.map(c => c.name);
    if (!existingCustCols.includes('hometax_data')) {
      dbInstance.exec("ALTER TABLE customers ADD COLUMN hometax_data TEXT;");
    }
  } catch (custColErr) {}

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
