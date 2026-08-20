const { ipcMain } = require('electron');
const https = require('https');
const http = require('http');
const { getDb } = require('../database');

function safeRegisterHandle(channel, handler) {
  try {
    ipcMain.removeHandler(channel);
  } catch (e) {}
  try {
    ipcMain.handle(channel, handler);
    console.log('[Market-IPC] Registered:', channel);
  } catch (e) {
    console.error('Failed to register ' + channel + ':', e);
  }
}

function fetchJsonFromUrl(urlStr) {
  return new Promise((resolve, reject) => {
    const client = urlStr.startsWith('https://') ? https : http;
    const req = client.get(urlStr, {
      headers: { 'User-Agent': 'ALPHA-CRM-MarketService' }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJsonFromUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('HTTP Status ' + res.statusCode));
      }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function registerMarketHandlers(mainWindow) {
  // 1. Get latest market briefing
  safeRegisterHandle('market:get-latest', async () => {
    const db = getDb();
    try {
      const row = db.prepare('SELECT * FROM market_briefings ORDER BY date DESC LIMIT 1').get();
      if (row) {
        return {
          success: true,
          briefing: {
            id: row.id,
            date: row.date,
            title: row.title,
            updated_at: row.updated_at,
            summary_3lines: JSON.parse(row.summary_3lines || '[]'),
            domestic: JSON.parse(row.domestic_json || '{}'),
            overseas: JSON.parse(row.overseas_json || '{}'),
            news: JSON.parse(row.news_json || '[]'),
            created_at: row.created_at
          }
        };
      }

      // If DB is empty, try loading from GitHub raw latest
      try {
        const rawUrl = 'https://raw.githubusercontent.com/dddi1989-cell/alpha-crm-app/main/data/market_latest.json?t=' + Date.now();
        const data = await fetchJsonFromUrl(rawUrl);
        if (data && data.date) {
          const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO market_briefings (date, title, updated_at, summary_3lines, domestic_json, overseas_json, news_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          insertStmt.run(
            data.date,
            data.title || '',
            data.updated_at || '',
            JSON.stringify(data.summary_3lines || []),
            JSON.stringify(data.domestic || {}),
            JSON.stringify(data.overseas || {}),
            JSON.stringify(data.news || []),
            new Date().toISOString()
          );
          return { success: true, briefing: data };
        }
      } catch (rawErr) {
        console.log('[Market] Raw fallback load error:', rawErr.message);
      }

      return { success: false, error: '등록된 시황 데이터가 없습니다.' };
    } catch (err) {
      console.error('market:get-latest error:', err);
      return { success: false, error: err.message };
    }
  });

  // 2. Get market briefing by specific date
  safeRegisterHandle('market:get-by-date', async (event, targetDate) => {
    const db = getDb();
    try {
      const row = db.prepare('SELECT * FROM market_briefings WHERE date = ?').get(targetDate);
      if (row) {
        return {
          success: true,
          briefing: {
            id: row.id,
            date: row.date,
            title: row.title,
            updated_at: row.updated_at,
            summary_3lines: JSON.parse(row.summary_3lines || '[]'),
            domestic: JSON.parse(row.domestic_json || '{}'),
            overseas: JSON.parse(row.overseas_json || '{}'),
            news: JSON.parse(row.news_json || '[]'),
            created_at: row.created_at
          }
        };
      }

      // Try loading from GitHub history
      try {
        const histUrl = 'https://raw.githubusercontent.com/dddi1989-cell/alpha-crm-app/main/data/history/market_' + targetDate + '.json?t=' + Date.now();
        const data = await fetchJsonFromUrl(histUrl);
        if (data && data.date) {
          return { success: true, briefing: data };
        }
      } catch (e) {}

      return { success: false, error: targetDate + ' 일자의 시황 데이터가 없습니다.' };
    } catch (err) {
      console.error('market:get-by-date error:', err);
      return { success: false, error: err.message };
    }
  });

  // 3. Get history date list
  safeRegisterHandle('market:get-history-dates', async () => {
    const db = getDb();
    try {
      const rows = db.prepare('SELECT date, title FROM market_briefings ORDER BY date DESC LIMIT 60').all();
      return { success: true, history: rows };
    } catch (err) {
      console.error('market:get-history-dates error:', err);
      return { success: false, history: [] };
    }
  });

  // 4. Manual Refresh from GitHub
  safeRegisterHandle('market:refresh', async () => {
    const db = getDb();
    try {
      const rawUrl = 'https://raw.githubusercontent.com/dddi1989-cell/alpha-crm-app/main/data/market_latest.json?t=' + Date.now();
      const data = await fetchJsonFromUrl(rawUrl);
      if (data && data.date) {
        const insertStmt = db.prepare(`
          INSERT OR REPLACE INTO market_briefings (date, title, updated_at, summary_3lines, domestic_json, overseas_json, news_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertStmt.run(
          data.date,
          data.title || '',
          data.updated_at || '',
          JSON.stringify(data.summary_3lines || []),
          JSON.stringify(data.domestic || {}),
          JSON.stringify(data.overseas || {}),
          JSON.stringify(data.news || []),
          new Date().toISOString()
        );
        return { success: true, briefing: data };
      }
      return { success: false, error: '최신 시황 데이터를 불러올 수 없습니다.' };
    } catch (err) {
      console.error('market:refresh error:', err);
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerMarketHandlers };
