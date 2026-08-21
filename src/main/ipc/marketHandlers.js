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

function fetchJsonFromUrl(urlStr, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const client = urlStr.startsWith('https://') ? https : http;
    const req = client.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...customHeaders
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let loc = res.headers.location;
        if (loc.startsWith('/')) {
          const u = new URL(urlStr);
          loc = u.origin + loc;
        }
        return fetchJsonFromUrl(loc, customHeaders).then(resolve).catch(reject);
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

function fetchHtmlFollowRedirect(urlStr) {
  return new Promise((resolve) => {
    const client = urlStr.startsWith('https://') ? https : http;
    const req = client.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let loc = res.headers.location;
        if (loc.startsWith('/')) {
          const u = new URL(urlStr);
          loc = u.origin + loc;
        }
        return fetchHtmlFollowRedirect(loc).then(resolve);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve(buf);
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

// Google Translation to Korean for Global News
function translateToKorean(text) {
  return new Promise((resolve) => {
    if (!text) return resolve('');
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=' + encodeURIComponent(text);
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          const translated = (json[0] || []).map(x => x[0]).join('');
          resolve(translated || text);
        } catch (e) {
          resolve(text);
        }
      });
    }).on('error', () => resolve(text));
  });
}

// 1. 100% Exact Real-time Domestic Market (Indices & Market-Cap Ranking)
async function fetchRealtimeDomesticData() {
  try {
    const [indicesRes, capRes] = await Promise.all([
      fetchJsonFromUrl('https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI,KOSDAQ').catch(() => null),
      fetchJsonFromUrl('https://m.stock.naver.com/api/stocks/marketValue/KOSPI?page=1&pageSize=8').catch(() => null)
    ]);

    const domestic = {
      indices: [],
      top_stocks: [],
      market_sentiment: '안정'
    };

    // Parse Indices
    const indexDatas = indicesRes?.datas || [];
    indexDatas.forEach(d => {
      const name = d.itemCode === 'KOSPI' ? 'KOSPI (코스피)' : d.itemCode === 'KOSDAQ' ? 'KOSDAQ (코스닥)' : d.stockName;
      const ratioNum = parseFloat(d.fluctuationsRatio || '0');
      const isUp = (d.compareToPreviousPrice?.name === 'RISING') || (ratioNum > 0);
      const isDown = (d.compareToPreviousPrice?.name === 'FALLING') || (ratioNum < 0);
      const sign = isUp ? '+' : '';

      domestic.indices.push({
        name: d.itemCode,
        label: name,
        value: d.closePrice,
        change_amount: d.compareToPreviousClosePrice,
        change_rate: sign + (d.fluctuationsRatio || '0') + '%',
        is_up: isUp,
        is_down: isDown
      });
    });

    // Parse Real-time Top Stocks from Market Value API (Exact matches Naver Pay Stock Top list)
    if (capRes?.stocks && Array.isArray(capRes.stocks)) {
      capRes.stocks.slice(0, 6).forEach(s => {
        const ratioNum = parseFloat(s.fluctuationsRatio || '0');
        const isUp = ratioNum > 0;
        const isDown = ratioNum < 0;
        const sign = isUp ? '+' : '';

        domestic.top_stocks.push({
          ticker: s.itemCode,
          name: s.stockName,
          price: s.closePrice + '원',
          change_amount: s.compareToPreviousClosePrice,
          change_rate: sign + (s.fluctuationsRatio || '0') + '%',
          is_up: isUp,
          is_down: isDown
        });
      });
    }

    return domestic;
  } catch (err) {
    console.error('fetchRealtimeDomesticData error:', err);
    return null;
  }
}

// 2. Real-time Overseas Market (Indices, Macro, Tech Stocks)
async function fetchRealtimeOverseasData() {
  const symbols = [
    { symbol: '^GSPC', name: 'S&P 500', type: 'index' },
    { symbol: '^IXIC', name: '나스닥 (NASDAQ)', type: 'index' },
    { symbol: '^DJI', name: '다우존스 (Dow Jones)', type: 'index' },
    { symbol: 'USDKRW=X', name: '원/달러 환율', type: 'macro', unit: '원' },
    { symbol: 'CL=F', name: 'WTI 원유', type: 'macro', unit: '$/배럴' },
    { symbol: '^TNX', name: '미국 10년물 국채금리', type: 'macro', unit: '%' },
    { symbol: 'NVDA', name: '엔비디아 (NVIDIA)', type: 'tech' },
    { symbol: 'AAPL', name: '애플 (Apple)', type: 'tech' },
    { symbol: 'MSFT', name: '마이크로소프트 (Microsoft)', type: 'tech' },
    { symbol: 'TSLA', name: '테슬라 (Tesla)', type: 'tech' },
    { symbol: 'GOOGL', name: '알파벳/구글 (Google)', type: 'tech' }
  ];

  const overseas = {
    indices: [],
    macro: [],
    tech_stocks: []
  };

  await Promise.all(symbols.map(async (item) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.symbol)}?interval=1d&range=2d`;
      const res = await fetchJsonFromUrl(url);
      const meta = res?.chart?.result?.[0]?.meta;
      if (meta) {
        const currentPrice = meta.regularMarketPrice || meta.chartPreviousClose;
        const prevClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
        const changeRate = prevClose ? ((currentPrice - prevClose) / prevClose) * 100 : 0;
        const isUp = changeRate > 0;
        const isDown = changeRate < 0;
        const sign = isUp ? '+' : '';

        if (item.type === 'index') {
          overseas.indices.push({
            symbol: item.symbol,
            name: item.name,
            value: Number(currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            change_rate: sign + changeRate.toFixed(2) + '%',
            is_up: isUp,
            is_down: isDown
          });
        } else if (item.type === 'macro') {
          const valStr = item.unit === '원' 
            ? Number(currentPrice).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '원'
            : Number(currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + item.unit;
          overseas.macro.push({
            symbol: item.symbol,
            name: item.name,
            value: valStr,
            change_rate: sign + changeRate.toFixed(2) + '%',
            is_up: isUp,
            is_down: isDown
          });
        } else if (item.type === 'tech') {
          overseas.tech_stocks.push({
            symbol: item.symbol,
            name: item.name,
            price: '$' + Number(currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            change_rate: sign + changeRate.toFixed(2) + '%',
            is_up: isUp,
            is_down: isDown
          });
        }
      }
    } catch (e) {
      console.log(`[Yahoo-Live] Error fetching ${item.name}:`, e.message);
    }
  }));

  return overseas;
}

// 3. News: 3 Domestic + 3 Global (Direct Korean Translation & Excerpts)
async function fetchCuratedNews() {
  const domesticNews = [];
  const globalNews = [];

  // (1) Fetch 3 Domestic News from Naver Finance
  try {
    const rawBuf = await fetchHtmlFollowRedirect('https://finance.naver.com/news/mainnews.naver');
    if (rawBuf) {
      const decoder = new TextDecoder('euc-kr');
      const htmlText = decoder.decode(rawBuf);

      const blocks = htmlText.split('<li class="block1">');
      for (let i = 1; i < Math.min(blocks.length, 6); i++) {
        if (domesticNews.length >= 3) break;
        const blk = blocks[i];
        const subjMatch = blk.match(/<dd class="articleSubject">\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        const summMatch = blk.match(/<dd class="articleSummary">([\s\S]*?)(?:<span|\Z)/i);
        const pressMatch = blk.match(/<span class="press">([^<]+)<\/span>/i);

        if (subjMatch) {
          let url = subjMatch[1].trim();
          if (url.startsWith('/')) url = 'https://finance.naver.com' + url;
          const title = subjMatch[2].replace(/<[^>]+>/g, '').trim();
          const summary = summMatch ? summMatch[1].replace(/<[^>]+>/g, '').trim() : '';
          const press = pressMatch ? pressMatch[1].trim() : '네이버 금융';

          // Fetch full article body excerpt
          let bodyExcerpt = '';
          try {
            const artBuf = await fetchHtmlFollowRedirect(url);
            if (artBuf) {
              const artHtml = artBuf.toString('utf8');
              const bodyMatch = artHtml.match(/<article[^>]*id=["'](?:dic_area|articleBodyContents)["'][^>]*>([\s\S]*?)<\/article>/i) ||
                                artHtml.match(/<div[^>]*id=["'](?:dic_area|articleBodyContents|articleCont)["'][^>]*>([\s\S]*?)<\/div>/i);
              if (bodyMatch) {
                bodyExcerpt = bodyMatch[1]
                  .replace(/<script[\s\S]*?<\/script>/gi, '')
                  .replace(/<style[\s\S]*?<\/style>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
              }
            }
          } catch (e) {}

          if (title) {
            domesticNews.push({
              source_type: '국내증시',
              title,
              summary: summary || title,
              body_excerpt: bodyExcerpt || summary || title,
              url,
              press
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Domestic news fetch error:', err);
  }

  // (2) Fetch 3 Global News from Yahoo Finance & Translate to Korean
  try {
    const yfRes = await fetchJsonFromUrl('https://query1.finance.yahoo.com/v1/finance/search?q=stock%20market&newsCount=5');
    const newsList = yfRes?.news || [];
    for (const n of newsList) {
      if (globalNews.length >= 3) break;
      const rawTitle = n.title || '';
      const link = n.link || '';
      const publisher = n.publisher || 'Yahoo Finance';

      if (rawTitle) {
        // Direct Korean translation for overseas news
        const koTitle = await translateToKorean(rawTitle);
        const koSummary = `[${publisher} 외신] ${koTitle} - 글로벌 금융시장 실시간 경제 뉴스 요약입니다.`;

        globalNews.push({
          source_type: '글로벌시황',
          title: koTitle,
          original_title: rawTitle,
          summary: koSummary,
          body_excerpt: `[원문 기사 발췌 - ${publisher}]
${rawTitle}

상세 기사 원문은 아래 '원문 기사 읽기'를 통해 외신 사이트에서 바로 확인하실 수 있습니다.`,
          url: link,
          press: publisher + ' (외신)'
        });
      }
    }
  } catch (err) {
    console.error('Global news fetch error:', err);
  }

  return [...domesticNews, ...globalNews];
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

      // If DB empty, do full live refresh immediately
      return await doFullMarketRefresh();
    } catch (err) {
      console.error('market:get-latest error:', err);
      return { success: false, error: err.message };
    }
  });

  // 2. Real-time Live Quotes & Breaking News (For live auto-polling every 30s)
  safeRegisterHandle('market:get-live-quote', async () => {
    try {
      const [domestic, overseas, news] = await Promise.all([
        fetchRealtimeDomesticData(),
        fetchRealtimeOverseasData(),
        fetchCuratedNews()
      ]);

      const now = new Date();
      const kstTime = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(now);

      return {
        success: true,
        updated_at: kstTime + ' (실시간 라이브)',
        domestic: domestic?.indices?.length ? domestic : undefined,
        overseas: overseas?.indices?.length ? overseas : undefined,
        news: news?.length ? news : undefined
      };
    } catch (err) {
      console.error('market:get-live-quote error:', err);
      return { success: false, error: err.message };
    }
  });

  // 3. Get market briefing by specific date
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

      return { success: false, error: targetDate + ' 일자의 시황 데이터가 없습니다.' };
    } catch (err) {
      console.error('market:get-by-date error:', err);
      return { success: false, error: err.message };
    }
  });

  // 4. Get history date list
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

  // 5. Manual Full Refresh (Merges live quotes and saves to DB)
  safeRegisterHandle('market:refresh', async () => {
    return await doFullMarketRefresh();
  });
}

async function doFullMarketRefresh() {
  const db = getDb();
  try {
    const [domestic, overseas, news] = await Promise.all([
      fetchRealtimeDomesticData(),
      fetchRealtimeOverseasData(),
      fetchCuratedNews()
    ]);

    const today = new Date().toISOString().split('T')[0];
    const nowStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Generate 3-line summary
    const summary_3lines = [];
    if (overseas?.indices?.length) {
      const nasdaq = overseas.indices.find(x => x.name.includes('나스닥'));
      const sp = overseas.indices.find(x => x.name.includes('S&P'));
      if (nasdaq && sp) {
        summary_3lines.push(`🇺🇸 뉴욕증시: 나스닥(${nasdaq.value}, ${nasdaq.change_rate}), S&P 500(${sp.value}, ${sp.change_rate}) 마감.`);
      }
    }
    if (domestic?.indices?.length) {
      const kospi = domestic.indices.find(x => x.name === 'KOSPI');
      const kosdaq = domestic.indices.find(x => x.name === 'KOSDAQ');
      if (kospi) {
        summary_3lines.push(`🇰🇷 국내증시: 코스피(${kospi.value}, ${kospi.change_rate}), 코스닥(${kosdaq ? kosdaq.value + ', ' + kosdaq.change_rate : ''}) 실시간 호가.`);
      }
    }
    if (overseas?.macro?.length) {
      const fx = overseas.macro.find(x => x.name.includes('환율'));
      if (fx) {
        summary_3lines.push(`📊 매크로: 원/달러 환율 ${fx.value}(${fx.change_rate}) 변동성 주시.`);
      }
    }

    const liveBriefing = {
      date: today,
      updated_at: `${today} ${nowStr} (실시간 라이브)`,
      title: `[${today}] 오늘의 증시 & 글로벌 금융 시황 실시간 브리핑`,
      summary_3lines: summary_3lines.length ? summary_3lines : ['실시간 시장 지표 갱신 완료.'],
      domestic: domestic || {},
      overseas: overseas || {},
      news: news || []
    };

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO market_briefings (date, title, updated_at, summary_3lines, domestic_json, overseas_json, news_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(
      liveBriefing.date,
      liveBriefing.title,
      liveBriefing.updated_at,
      JSON.stringify(liveBriefing.summary_3lines),
      JSON.stringify(liveBriefing.domestic),
      JSON.stringify(liveBriefing.overseas),
      JSON.stringify(liveBriefing.news),
      new Date().toISOString()
    );

    return { success: true, briefing: liveBriefing };
  } catch (err) {
    console.error('doFullMarketRefresh error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = { registerMarketHandlers };
