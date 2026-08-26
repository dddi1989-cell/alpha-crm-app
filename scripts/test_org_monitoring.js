const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Create temporary in-memory or test database
const db = new Database(':memory:');

// Init schema
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'Agent',
    parent_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE customers (
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
    report_pdf_path TEXT,
    report_excel_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE schedules (
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
    updated_at TEXT NOT NULL
  );
`);

console.log('1. Setting up Test Users Hierarchy (Admin -> BM -> SM -> FA1, FA2)...');
const now = new Date().toISOString();

// 1. Admin (L7)
db.prepare("INSERT INTO users (id, username, password_hash, name, role, parent_id, created_at, updated_at) VALUES (1, 'admin', 'hash', '최고 관리자', 'Admin', NULL, ?, ?)").run(now, now);
// 2. BM (L3 - 지점장)
db.prepare("INSERT INTO users (id, username, password_hash, name, role, parent_id, created_at, updated_at) VALUES (2, 'bm_kim', 'hash', '김지점장', 'BM', 1, ?, ?)").run(now, now);
// 3. SM (L2 - 팀장, BM 밑)
db.prepare("INSERT INTO users (id, username, password_hash, name, role, parent_id, created_at, updated_at) VALUES (3, 'sm_lee', 'hash', '이팀장', 'SM', 2, ?, ?)").run(now, now);
// 4. FA 1 (L1 - 설계사, SM 밑)
db.prepare("INSERT INTO users (id, username, password_hash, name, role, parent_id, created_at, updated_at) VALUES (4, 'fa_park', 'hash', '박설계', 'FA', 3, ?, ?)").run(now, now);
// 5. FA 2 (L1 - 설계사, BM 직속)
db.prepare("INSERT INTO users (id, username, password_hash, name, role, parent_id, created_at, updated_at) VALUES (5, 'fa_choi', 'hash', '최영업', 'FA', 2, ?, ?)").run(now, now);

console.log('2. Inserting Customers & Schedules for FA1 (박설계)...');
// Customer 1: Active (Has recent schedule)
db.prepare("INSERT INTO customers (id, user_id, name, phone, insurance_provider, insurances, status, created_at, updated_at) VALUES (101, 4, '홍길동', '010-1111-2222', '삼성생명', '[]', 'Active', ?, ?)").run(now, now);
// Customer 2: Long-touch (No schedule in past 6 months)
const past7Months = new Date();
past7Months.setMonth(past7Months.getMonth() - 7);
db.prepare("INSERT INTO customers (id, user_id, name, phone, insurance_provider, insurances, status, created_at, updated_at) VALUES (102, 4, '김철수', '010-3333-4444', '한화손해', '[]', 'Inactive', ?, ?)").run(past7Months.toISOString(), past7Months.toISOString());

// Schedule for Customer 1
const futureSchedule = new Date();
futureSchedule.setDate(futureSchedule.getDate() + 3);
db.prepare("INSERT INTO schedules (id, user_id, customer_id, title, scheduled_at, status, created_at, updated_at) VALUES (201, 4, 101, '보장분석 증권 전달', ?, 'Pending', ?, ?)").run(futureSchedule.toISOString(), now, now);

console.log('3. Testing Hierarchy Traversal for SM (이팀장, user_id=3)...');
const ROLE_RANKS = { 'Admin': 7, 'admin': 7, 'CEO': 6, 'COO': 5, 'RM': 4, 'BM': 3, 'SM': 2, 'FA': 1 };
function getRoleRank(r) { return ROLE_RANKS[r] || 1; }

function getAccessibleSubordinates(currentUserId) {
  const allUsers = db.prepare("SELECT * FROM users").all();
  const userMap = new Map();
  allUsers.forEach(u => userMap.set(u.id, { ...u, rank: getRoleRank(u.role) }));
  const currentUser = userMap.get(currentUserId);
  if (!currentUser) return [];

  if (currentUser.rank >= 5 || currentUser.role === 'Admin') {
    return allUsers.map(u => ({ ...u, canAccess: true }));
  }

  const accessibleIds = new Set([currentUser.id]);
  let added = true;
  while (added) {
    added = false;
    for (const u of allUsers) {
      if (u.parent_id && accessibleIds.has(u.parent_id) && !accessibleIds.has(u.id)) {
        accessibleIds.add(u.id);
        added = true;
      }
    }
  }

  return allUsers.filter(u => accessibleIds.has(u.id));
}

const smAccessible = getAccessibleSubordinates(3);
console.log('SM (이팀장) 조회 가능 조직원:', smAccessible.map(u => `${u.name}(${u.role})`));
if (!smAccessible.some(u => u.id === 4)) {
  throw new Error('SM should have access to FA1 (박설계)');
}

const bmAccessible = getAccessibleSubordinates(2);
console.log('BM (김지점장) 조회 가능 조직원:', bmAccessible.map(u => `${u.name}(${u.role})`));
if (!bmAccessible.some(u => u.id === 3) || !bmAccessible.some(u => u.id === 4) || !bmAccessible.some(u => u.id === 5)) {
  throw new Error('BM should have access to SM, FA1, and FA2');
}

const adminAccessible = getAccessibleSubordinates(1);
console.log('Admin 조회 가능 조직원 수:', adminAccessible.length);
if (adminAccessible.length !== 5) {
  throw new Error('Admin should have access to all 5 users');
}

console.log('4. Testing Subordinate Data Query for FA1 (박설계)...');
const fa1Customers = db.prepare("SELECT * FROM customers WHERE user_id = 4").all();
const fa1Schedules = db.prepare("SELECT * FROM schedules WHERE user_id = 4").all();

console.log(`FA1 고객 수: ${fa1Customers.length}, 일정 수: ${fa1Schedules.length}`);
console.log(`장기미터치 고객: ${fa1Customers.find(c => c.status === 'Inactive').name}`);

console.log('✅ ALL TEST SCENARIOS PASSED SUCCESSFULLY!');
process.exit(0);
